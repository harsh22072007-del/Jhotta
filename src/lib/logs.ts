import { db } from '../db/db'
import type { Exercise } from '../db/types'
import { uuid } from './uuid'
import { requestSync } from '../sync/sync'

/** Every write goes to IndexedDB first. synced_at = null puts it in the outbox. */
export async function addLog(ex: Exercise, amount: number) {
  const now = Date.now()
  await db.workout_logs.add({
    id: uuid(),
    exercise_id: ex.id,
    performed_at: now,
    reps: ex.kind === 'reps' ? Math.round(amount) : null,
    duration_sec: ex.kind === 'timed' ? Math.round(amount) : null,
    notes: null,
    updated_at: now,
    deleted_at: null,
    synced_at: null,
  })
  requestSync()
}

/** Soft delete so a signed-in user's delete can sync later. */
export async function removeLog(id: string) {
  const now = Date.now()
  await db.workout_logs.update(id, { deleted_at: now, updated_at: now, synced_at: null })
  requestSync()
}
