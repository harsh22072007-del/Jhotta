import { useSyncExternalStore } from 'react'
import type { Table } from 'dexie'
import { db } from '../db/db'
import type { Goal, WeightLog, WorkoutLog } from '../db/types'
import { api } from './api'
import { AuthError, authConfigured } from './auth'

// ---- status store (so Settings/Today can show it) ----
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error' | 'expired'
  at: number | null
  error: string | null
}
let status: SyncStatus = { state: 'idle', at: null, error: null }
const listeners = new Set<() => void>()
const setStatus = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s }
  listeners.forEach((l) => l())
}
export const getSyncStatus = () => status
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export const useSyncStatus = () => useSyncExternalStore(subscribe, getSyncStatus)

export function syncLabel(s: SyncStatus): string {
  if (s.state === 'syncing') return 'Syncing...'
  if (s.state === 'offline') return 'Offline: will sync when you are back online.'
  if (s.state === 'error') return 'Sync problem: will retry.'
  if (s.state === 'expired') return 'Session expired: sign in again in Settings.'
  return 'Backed up to your account.'
}

// ---- wire format: the local row plus { type } ----
type Item =
  | ({ type: 'log' } & WorkoutLog)
  | ({ type: 'goal' } & Goal)
  | ({ type: 'weight' } & WeightLog)
  | {
      type: 'profile'
      id: 'me'
      timezone: string
      target_weight: number | null
      default_weight_kg: number
      factors: Record<string, { kcal_per_rep: number; met: number }>
      updated_at: number
    }

type Syncable = { id: string; updated_at: number; synced_at: number | null }

async function markSynced(tbl: unknown, sent: { id: string; updated_at: number }[]) {
  const table = tbl as Table<Syncable, string>
  const now = Date.now()
  await db.transaction('rw', table, async () => {
    for (const s of sent) {
      const cur = await table.get(s.id)
      // only if it was not edited again while the request was in flight
      if (cur && cur.updated_at === s.updated_at) await table.update(s.id, { synced_at: now })
    }
  })
}

async function pushPending() {
  const [logs, goals, weights, profile, exercises] = await Promise.all([
    db.workout_logs.filter((r) => r.synced_at === null).toArray(),
    db.goals.filter((r) => r.synced_at === null).toArray(),
    db.weight_logs.filter((r) => r.synced_at === null).toArray(),
    db.profile.get('me'),
    db.exercises.toArray(),
  ])
  const profilePending = !!profile && profile.synced_at == null
  const items: Item[] = [
    ...logs.map((r) => ({ type: 'log' as const, ...r })),
    ...goals.map((r) => ({ type: 'goal' as const, ...r })),
    ...weights.map((r) => ({ type: 'weight' as const, ...r })),
  ]
  if (profile && profilePending) {
    items.push({
      type: 'profile', id: 'me', timezone: profile.timezone, target_weight: profile.target_weight,
      default_weight_kg: profile.default_weight_kg, updated_at: profile.updated_at,
      factors: Object.fromEntries(exercises.map((e) => [e.id, { kcal_per_rep: e.kcal_per_rep, met: e.met }])),
    })
  }
  for (let i = 0; i < items.length; i += 200) {
    await api('/sync/push', { method: 'POST', body: JSON.stringify({ items: items.slice(i, i + 200) }) })
  }
  const stamp = (rows: { id: string; updated_at: number }[]) => rows.map((r) => ({ id: r.id, updated_at: r.updated_at }))
  await markSynced(db.workout_logs, stamp(logs))
  await markSynced(db.goals, stamp(goals))
  await markSynced(db.weight_logs, stamp(weights))
  if (profile && profilePending) {
    const cur = await db.profile.get('me')
    if (cur && cur.updated_at === profile.updated_at) await db.profile.update('me', { synced_at: Date.now() })
  }
  if (items.length) await db.sync_meta.update('me', { last_push_at: Date.now() })
}

interface PullResponse {
  items: (Record<string, unknown> & { type: string; updated_at: number })[]
  cursor: string | null
  serverTime: string
}

/** Last write wins by updated_at. Rows never leave without a tombstone (deleted_at). */
async function applyItems(items: PullResponse['items']) {
  const now = Date.now()
  await db.transaction('rw', db.tables, async () => {
    for (const raw of items) {
      const { type, ...row } = raw
      if (type === 'log' || type === 'goal' || type === 'weight') {
        const table = type === 'log' ? db.workout_logs : type === 'goal' ? db.goals : db.weight_logs
        const id = row.id as string
        const local = await table.get(id)
        if (!local || row.updated_at > local.updated_at) await table.put({ ...row, synced_at: now } as never)
      } else if (type === 'profile') {
        const local = await db.profile.get('me')
        if (!local || row.updated_at <= local.updated_at) continue
        await db.profile.update('me', {
          timezone: row.timezone as string,
          target_weight: row.target_weight as number | null,
          default_weight_kg: row.default_weight_kg as number,
          updated_at: row.updated_at,
          synced_at: now,
        })
        const factors = (row.factors ?? {}) as Record<string, { kcal_per_rep: number; met: number }>
        for (const [id, f] of Object.entries(factors)) await db.exercises.update(id, f)
      }
    }
  })
}

async function pull() {
  const meta = await db.sync_meta.get('me')
  const since = meta?.last_pull_at ?? '' // empty = first login, full dump
  let cursor = ''
  let serverTime = ''
  do {
    const q = new URLSearchParams()
    if (since) q.set('since', since)
    if (cursor) q.set('cursor', cursor)
    const r = await api<PullResponse>(`/sync/pull?${q}`)
    await applyItems(r.items)
    serverTime ||= r.serverTime
    cursor = r.cursor ?? ''
  } while (cursor)
  await db.sync_meta.update('me', { last_pull_at: serverTime })
}

let running = false
let again = false

/** Push the outbox, then pull anything newer. Safe to call any time. */
export async function syncNow() {
  const profile = await db.profile.get('me')
  if (profile?.mode !== 'user' || !authConfigured) return // guests never upload
  if (running) { again = true; return }
  if (!navigator.onLine) { setStatus({ state: 'offline' }); return }
  running = true
  setStatus({ state: 'syncing', error: null })
  try {
    await pushPending()
    await pull()
    setStatus({ state: 'idle', at: Date.now() })
  } catch (e) {
    if (e instanceof AuthError) setStatus({ state: 'expired', error: e.message })
    else setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) })
  } finally {
    running = false
    if (again) { again = false; void syncNow() }
  }
}

let timer: number | undefined
export function requestSync() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void syncNow(), 400)
}

export function startSyncListeners() {
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  void syncNow()
}
