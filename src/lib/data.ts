import { db } from '../db/db'
import type { Exercise, Goal, Profile } from '../db/types'
import { dateKey } from './dates'
import { uuid } from './uuid'
import { requestSync } from '../sync/sync'

export async function setGoal(ex: Exercise, period: Goal['period'], target: number) {
  const now = Date.now()
  const id = `goal-${ex.id}-${period}`
  const existing = await db.goals.get(id)
  if (target <= 0) {
    if (existing && !existing.deleted_at) {
      await db.goals.update(id, { active: false, deleted_at: now, updated_at: now, synced_at: null })
      requestSync()
    }
    return
  }
  const profile = await db.profile.get('me')
  const revived = !existing || !!existing.deleted_at
  await db.goals.put({
    id, exercise_id: ex.id, period, target,
    starts_on: revived ? dateKey(now, profile?.timezone ?? 'Asia/Kolkata') : existing.starts_on,
    active: true, updated_at: now, deleted_at: null, synced_at: null,
  })
  requestSync()
}

export async function addWeight(kg: number) {
  const now = Date.now()
  const profile = await db.profile.get('me')
  await db.weight_logs.add({
    id: uuid(),
    logged_on: dateKey(now, profile?.timezone ?? 'Asia/Kolkata'),
    kg, notes: null, updated_at: now, deleted_at: null, synced_at: null,
  })
  requestSync()
}

export async function removeWeight(id: string) {
  const now = Date.now()
  await db.weight_logs.update(id, { deleted_at: now, updated_at: now, synced_at: null })
  requestSync()
}

type ProfilePatch = Partial<Pick<Profile, 'timezone' | 'target_weight' | 'default_weight_kg'>>

export async function updateProfile(patch: ProfilePatch) {
  await db.profile.update('me', { ...patch, updated_at: Date.now(), synced_at: null })
  requestSync()
}

/** Calorie factors travel inside the PROFILE item, so editing one marks the profile dirty. */
export async function setFactor(id: string, patch: Partial<Pick<Exercise, 'kcal_per_rep' | 'met'>>) {
  await db.exercises.update(id, patch)
  await db.profile.update('me', { updated_at: Date.now(), synced_at: null })
  requestSync()
}
