import { db } from '../db/db'
import type { Exercise } from '../db/types'
import { kcalFor } from './calories'
import { dateKey } from './dates'

export interface Entry {
  id: string
  day: string
  at: number
  exercise_id: string
  kind: 'reps' | 'timed'
  amount: number // reps or seconds
  kcal: number
}
export interface Stats {
  tz: string
  today: string
  exercises: Exercise[]
  entries: Entry[]
}

/** Everything the screens need, computed only from IndexedDB. */
export async function loadStats(): Promise<Stats> {
  const profile = await db.profile.get('me')
  const tz = profile?.timezone ?? 'Asia/Kolkata'
  const [exercises, logs, weights] = await Promise.all([
    db.exercises.orderBy('sort').toArray(),
    db.workout_logs.filter((l) => !l.deleted_at).toArray(),
    db.weight_logs.filter((w) => !w.deleted_at).sortBy('logged_on'),
  ])
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const fallback = profile?.default_weight_kg ?? 70
  // Last logged weight as of that day; before the first weigh-in use the first one.
  const weightAt = (day: string) => {
    let w: number | undefined
    for (const x of weights) {
      if (x.logged_on <= day) w = x.kg
      else break
    }
    return w ?? weights[0]?.kg ?? fallback
  }
  const entries: Entry[] = []
  for (const l of logs) {
    const ex = byId.get(l.exercise_id)
    if (!ex) continue
    const day = dateKey(l.performed_at, tz)
    entries.push({
      id: l.id, day, at: l.performed_at, exercise_id: ex.id, kind: ex.kind,
      amount: l.reps ?? l.duration_sec ?? 0,
      kcal: kcalFor(ex, l, weightAt(day)),
    })
  }
  entries.sort((a, b) => a.at - b.at)
  return { tz, today: dateKey(Date.now(), tz), exercises, entries }
}
