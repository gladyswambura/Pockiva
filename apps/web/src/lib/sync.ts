import { getPendingOps, removeOp, putOp, type OfflineOp } from './db'
import { getToken, refreshAccessToken } from './api'

const BASE = '/api/v1'
const MAX_ATTEMPTS = 10

let syncing = false
let listeners: Set<() => void> = new Set()

export function onSyncChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  listeners.forEach(fn => fn())
}

export function isSyncing(): boolean {
  return syncing
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 }
  syncing = true
  notify()

  let synced = 0
  let failed = 0

  try {
    const ops = await getPendingOps()
    let token = getToken()

    for (const op of ops) {
      if (!token) {
        failed++
        continue
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': op.idempotencyKey,
      }

      try {
        let res = await fetch(`${BASE}${op.endpoint}`, {
          method: op.method,
          headers,
          body: op.body,
        })

        // Access token expired mid-queue : refresh once and retry
        if (res.status === 401) {
          const refreshed = await refreshAccessToken()
          token = getToken()
          if (refreshed && token) {
            headers['Authorization'] = `Bearer ${token}`
            res = await fetch(`${BASE}${op.endpoint}`, { method: op.method, headers, body: op.body })
          }
        }

        if (res.ok) {
          await removeOp(op.id)
          synced++
        } else if (res.status >= 400 && res.status < 500) {
          // Client error : don't retry, remove from queue
          await removeOp(op.id)
          failed++
        } else {
          // Server error : keep in queue with attempt tracking
          failed++
          await retryLater(op)
        }
      } catch {
        // Network error : keep in queue with attempt tracking
        failed++
        await retryLater(op)
      }
    }
  } finally {
    syncing = false
    notify()
  }

  return { synced, failed }
}

async function retryLater(op: OfflineOp): Promise<void> {
  if (op.attempts + 1 >= MAX_ATTEMPTS) {
    await removeOp(op.id)
  } else {
    await putOp({ ...op, attempts: op.attempts + 1 })
  }
}

// Auto-sync when coming back online
export function initSyncListener(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('online', () => {
    // Small delay to let the connection stabilize
    setTimeout(() => { syncQueue().catch(() => {}) }, 1000)
  })

  // Also try on initial load if online
  if (navigator.onLine) {
    setTimeout(() => { syncQueue().catch(() => {}) }, 2000)
  }
}