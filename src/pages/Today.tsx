import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { clockTime, dateKey, fmtDuration, longDate } from '../lib/dates'
import { addLog, removeLog } from '../lib/logs'
import { kcalFor } from '../lib/calories'
import ExerciseCard from '../components/ExerciseCard'
import { useClock } from '../lib/useClock'
import { syncLabel, useSyncStatus } from '../sync/sync'

export default function Today() {
  const sync = useSyncStatus()
  const clock = useClock()
  const data = useLiveQuery(async () => {
    const profile = await db.profile.get('me')
    const tz = profile?.timezone ?? 'Asia/Kolkata'
    const now = Date.now()
    const today = dateKey(now, tz)
    const since = now - 48 * 3600 * 1000 // wide window, then filter by local date
    const [exercises, recent, goals, lastWeight] = await Promise.all([
      db.exercises.filter((e) => e.active).sortBy('sort'),
      db.workout_logs.where('performed_at').aboveOrEqual(since).toArray(),
      db.goals.filter((g) => g.active && !g.deleted_at && g.period === 'daily').toArray(),
      db.weight_logs.orderBy('logged_on').filter((w) => !w.deleted_at).last(),
    ])
    const logs = recent
      .filter((l) => !l.deleted_at && dateKey(l.performed_at, tz) === today)
      .sort((a, b) => b.performed_at - a.performed_at)
    return { mode: profile?.mode ?? 'guest', now, tz, exercises, logs, goals, weightKg: lastWeight?.kg ?? profile?.default_weight_kg ?? 70 }
  }, [clock])

  if (!data) return null
  const { mode, now, tz, exercises, logs, goals, weightKg } = data
  const byId = new Map(exercises.map((e) => [e.id, e]))

  const totals = new Map<string, number>()
  let kcal = 0
  for (const l of logs) {
    const ex = byId.get(l.exercise_id)
    if (!ex) continue
    totals.set(ex.id, (totals.get(ex.id) ?? 0) + (l.reps ?? l.duration_sec ?? 0))
    kcal += kcalFor(ex, l, weightKg)
  }

  return (
    <>
      <header>
        <p className="text-sm text-muted">{longDate(now, tz)}</p>
        <h1 className="font-display text-3xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-muted">
          About <span className="font-semibold text-ink">{Math.round(kcal)} kcal</span> burned (estimated)
        </p>
      </header>

      <p className="mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
        {mode === 'guest'
          ? 'Guest mode: your workouts are saved on this device only, not backed up.'
          : syncLabel(sync)}
      </p>

      <div className="mt-5 space-y-3">
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            total={totals.get(ex.id) ?? 0}
            target={goals.find((g) => g.exercise_id === ex.id)?.target ?? null}
            onAdd={(n) => addLog(ex, n)}
          />
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Today's sets</h2>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{byId.get(l.exercise_id)?.name}</span>{' '}
                  <span className="text-muted">{clockTime(l.performed_at, tz)}</span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="font-semibold tabular-nums">
                    {l.reps != null ? `${l.reps} reps` : fmtDuration(l.duration_sec ?? 0)}
                  </span>
                  <button onClick={() => removeLog(l.id)} className="text-muted underline">Undo</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
