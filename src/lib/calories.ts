import type { Exercise, WorkoutLog } from '../db/types'

/** Estimated kcal for one log. Counted: kcal-per-rep. Timed: MET x hours x body weight. */
export function kcalFor(ex: Exercise, log: WorkoutLog, weightKg: number): number {
  if (ex.kind === 'reps') return (log.reps ?? 0) * ex.kcal_per_rep
  return (ex.met * weightKg * (log.duration_sec ?? 0)) / 3600
}
