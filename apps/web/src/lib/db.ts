import { openDB, type IDBPDatabase } from 'idb'

export interface LocalEnvelope {
  id: string
  nameEnc: string       // hex ciphertext
  groupCode: string
  color: string
  icon: string
  sortOrder: number
  planCents: number
  goalCents: number
  balanceCents: number
  fundedCents: number
  spentCents: number
  lockUntil: string | null
  kind: string          // bill | debt | goal | system
  archivedAt: string | null
  updatedAt: string
}

export interface LocalLedgerEntry {
  id: string
  kind: string
  fromAccountId: string | null
  toAccountId: string | null
  amountCents: number
  noteEnc: string | null
  createdAt: string
  synced: boolean
}

export interface LocalLoan {
  id: string
  accountId: string
  lenderEnc: string | null
  borrowedCents: number
  totalRepayCents: number
  owedCents: number
  monthlyCents: number
  dueDay: number | null
}

export interface LocalGoal {
  id: string
  textEnc: string | null
  section: string | null
  linkedAccountId: string | null
  done: boolean
  sortOrder: number
}

export interface LocalRoutineStep {
  id: string
  labelEnc: string | null
  sortOrder: number
  doneThisMonth: boolean
}

export interface AppMeta {
  key: string
  value: unknown
}

export interface OfflineOp {
  id: string
  endpoint: string
  method: string
  body: string
  idempotencyKey: string
  createdAt: string
  attempts: number
}

const DB_NAME = 'pockiva'
const DB_VERSION = 1

let _db: IDBPDatabase | null = null

export async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('envelopes', { keyPath: 'id' })
      db.createObjectStore('ledger',    { keyPath: 'id' })
      db.createObjectStore('loans',     { keyPath: 'id' })
      db.createObjectStore('goals',     { keyPath: 'id' })
      db.createObjectStore('routine',   { keyPath: 'id' })
      db.createObjectStore('meta',      { keyPath: 'key' })
      db.createObjectStore('offline_queue', { keyPath: 'id' })
    },
  })
  return _db
}

// ── Meta helpers ──────────────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get('meta', key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value })
}

// ── Envelope helpers ──────────────────────────────────────────

export async function getAllEnvelopes(): Promise<LocalEnvelope[]> {
  const db = await getDb()
  return db.getAll('envelopes')
}

export async function putEnvelope(env: LocalEnvelope): Promise<void> {
  const db = await getDb()
  await db.put('envelopes', env)
}

export async function deleteEnvelope(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('envelopes', id)
}

// ── Ledger helpers ────────────────────────────────────────────

export async function getAllEntries(): Promise<LocalLedgerEntry[]> {
  const db = await getDb()
  const all = await db.getAll('ledger')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function putEntry(entry: LocalLedgerEntry): Promise<void> {
  const db = await getDb()
  await db.put('ledger', entry)
}

// ── Offline queue ─────────────────────────────────────────────

export async function enqueueOp(op: Omit<OfflineOp, 'attempts'>): Promise<void> {
  const db = await getDb()
  await db.put('offline_queue', { ...op, attempts: 0 })
}

export async function putOp(op: OfflineOp): Promise<void> {
  const db = await getDb()
  await db.put('offline_queue', op)
}

export async function getPendingOps(): Promise<OfflineOp[]> {
  const db = await getDb()
  return db.getAll('offline_queue')
}

export async function removeOp(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('offline_queue', id)
}
