import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, Goal, Profile, SyncMeta, WeightLog, WorkoutLog } from './types'

export const db = new Dexie('jhotta') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  workout_logs: EntityTable<WorkoutLog, 'id'>
  goals: EntityTable<Goal, 'id'>
  weight_logs: EntityTable<WeightLog, 'id'>
  profile: EntityTable<Profile, 'id'>
  sync_meta: EntityTable<SyncMeta, 'id'>
}

// Note: null values are not indexable in IndexedDB, so the sync outbox is found
// with a filter (synced_at === null) rather than an index on synced_at.
db.version(1).stores({
  exercises: 'id, kind, sort',
  workout_logs: 'id, exercise_id, performed_at, updated_at',
  goals: 'id, exercise_id, period',
  weight_logs: 'id, logged_on',
  profile: 'id',
  sync_meta: 'id',
})
