import { enqueueOp } from './db'

const BASE = '/api/v1'

export function getToken(): string | null {
  return localStorage.getItem('access_token')
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

export function clearTokens(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function newKey(): string {
  return crypto.randomUUID()
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return false
  try {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!r.ok) return false
    const data = await r.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  idempotencyKey?: string
  offlineFallback?: boolean
}

export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, idempotencyKey, offlineFallback = false }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const init: RequestInit = { method, headers }
  if (body) init.body = JSON.stringify(body)

  // Queue only genuine network failures (offline), never HTTP error responses
  const queueIfOffline = async (err: unknown) => {
    if (offlineFallback && method !== 'GET' && body) {
      await enqueueOp({
        id: crypto.randomUUID(),
        endpoint: path,
        method,
        body: JSON.stringify(body),
        idempotencyKey: idempotencyKey ?? newKey(),
        createdAt: new Date().toISOString(),
      })
    }
    throw err
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch (err) {
    return queueIfOffline(err)
  }

  // Token expired : try refresh once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`
      try {
        res = await fetch(`${BASE}${path}`, { ...init, headers })
      } catch (err) {
        return queueIfOffline(err)
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw err
  }
  return res.json() as Promise<T>
}
