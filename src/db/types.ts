export type ExerciseKind = 'reps' | 'timed'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  kcal_per_rep: number // used when kind = reps
  met: number // used when kind = timed
  sort: number
  active: boolean
}

export interface WorkoutLog {
  id: string
  exercise_id: string
  performed_at: number // epoch ms
  reps: number | null
  duration_sec: number | null
  notes: string | null
  updated_at: number
  deleted_at: number | null
  synced_at: number | null // null = still in the outbox
}

export interface Goal {
  id: string
  exercise_id: string
  period: 'daily' | 'weekly'
  target: number // reps or seconds
  starts_on: string // YYYY-MM-DD
  active: boolean
  updated_at: number
  deleted_at: number | null
  synced_at: number | null
}

export interface WeightLog {
  id: string
  logged_on: string // YYYY-MM-DD, local date
  kg: number
  notes: string | null
  updated_at: number
  deleted_at: number | null
  synced_at: number | null
}

export interface Profile {
  id: 'me'
  mode: 'guest' | 'user'
  timezone: string
  target_weight: number | null
  default_weight_kg: number // used for kcal until a weight is logged
  cognito_sub: string | null
  updated_at: number
  synced_at: number | null // null = profile/settings changes waiting to sync
}

export interface SyncMeta {
  id: 'me'
  last_pull_at: string | null
  last_push_at: number | null
}
