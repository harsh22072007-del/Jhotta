import { db } from './db'
import type { Exercise, Profile } from './types'

const DEFAULTS: Omit<Exercise, 'sort' | 'active'>[] = [
  { id: 'pushup', name: 'Push-ups', kind: 'reps', kcal_per_rep: 0.45, met: 0 },
  { id: 'pushup-wide', name: 'Wide-arm push-ups', kind: 'reps', kcal_per_rep: 0.45, met: 0 },
  { id: 'pushup-diamond', name: 'Diamond push-ups', kind: 'reps', kcal_per_rep: 0.5, met: 0 },
  { id: 'pushup-hindu', name: 'Hindu push-ups', kind: 'reps', kcal_per_rep: 0.5, met: 0 },
  { id: 'pushup-incline', name: 'Incline push-ups', kind: 'reps', kcal_per_rep: 0.35, met: 0 },
  { id: 'squat', name: 'Squats', kind: 'reps', kcal_per_rep: 0.32, met: 0 },
  { id: 'pullup', name: 'Pull-ups', kind: 'reps', kcal_per_rep: 0.9, met: 0 },
  { id: 'dip', name: 'Dips', kind: 'reps', kcal_per_rep: 0.6, met: 0 },
  { id: 'lunge', name: 'Lunges', kind: 'reps', kcal_per_rep: 0.35, met: 0 },
  { id: 'plank', name: 'Plank', kind: 'timed', kcal_per_rep: 0, met: 3.0 },
  { id: 'rope', name: 'Rope jumps', kind: 'timed', kcal_per_rep: 0, met: 11.0 },
  { id: 'shadow', name: 'Shadow boxing', kind: 'timed', kcal_per_rep: 0, met: 7.8 },
]

export async function initDb() {
  const existing = await db.profile.get('me')
  if (!existing) {
    await db.profile.put({
      id: 'me',
      mode: 'guest',
      timezone: 'Asia/Kolkata',
      target_weight: null,
      default_weight_kg: 70,
      cognito_sub: null,
      updated_at: Date.now(),
      synced_at: null,
    })
  } else if (existing.updated_at === undefined) {
    await db.profile.update('me', { updated_at: Date.now(), synced_at: null })
  }
  if (!(await db.sync_meta.get('me'))) {
    await db.sync_meta.put({ id: 'me', last_pull_at: null, last_push_at: null })
  }
  if ((await db.exercises.count()) === 0) {
    await db.exercises.bulkPut(DEFAULTS.map((e, i) => ({ ...e, sort: i, active: true })))
  }
}

/** Wipe every local table, then re-seed. Used for guest -> Google sign-in and logout. */
export async function resetLocalData(profile?: Partial<Profile>) {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
  await initDb()
  // updated_at 0 + synced_at set: the fresh defaults must never overwrite the cloud profile.
  if (profile) await db.profile.update('me', { ...profile, updated_at: 0, synced_at: Date.now() })
}
