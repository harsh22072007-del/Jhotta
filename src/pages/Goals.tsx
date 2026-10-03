import { useLiveQuery } from 'dexie-react-hooks'
import NumberField from '../components/NumberField'
import { db } from '../db/db'
import { setGoal } from '../lib/data'
import { fmtDuration } from '../lib/dates'
import { useClock } from '../lib/useClock'
import { loadStats } from '../lib/loadStats'
import { bucketKey, computeStreak } from '../lib/stats'

function Meter({ label, done, target, fmt }: { label: string; done: number; target: number; fmt: (n: number) => string }) {
  const pct = Math.min(100, Math.round((done / target) * 100))
  return (
    <div className="mt-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {fmt(done)} / {fmt(target)}{done >= target ? ' ✓' : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Goals() {
  const clock = useClock()
  const data = useLiveQuery(async () => {
    const [stats, goals] = await Promise.all([loadStats(), db.goals.filter((g) => g.active && !g.deleted_at).toArray()])
    return { stats, goals }
  }, [clock])
  if (!data) return null
  const { stats, goals } = data
  const { today, entries, exercises } = stats

  const dayTotals = new Map<string, number>()
  const weekTotals = new Map<string, number>()
  const weekStart = bucketKey(today, 'W')
  for (const e of entries) {
    const k = `${e.day}|${e.exercise_id}`
    dayTotals.set(k, (dayTotals.get(k) ?? 0) + e.amount)
    if (e.day >= weekStart && e.day <= today) weekTotals.set(e.exercise_id, (weekTotals.get(e.exercise_id) ?? 0) + e.amount)
  }
  const daily = goals.filter((g) => g.period === 'daily')
  const streak = computeStreak(today, daily, dayTotals)
  const todayDone = daily.length > 0 && daily.every((g) => (dayTotals.get(`${today}|${g.exercise_id}`) ?? 0) >= g.target)

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Goals</h1>

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <p className="font-display text-4xl font-semibold tabular-nums">
          {streak} <span className="text-lg font-medium text-muted">day streak</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {daily.length === 0
            ? 'Set a daily goal to start a streak.'
            : todayDone
              ? 'Every daily goal is met today.'
              : 'Meet every daily goal today to extend it. A day counts only when all of them are done.'}
        </p>
      </section>

      <div className="mt-5 space-y-3">
        {exercises.filter((e) => e.active).map((ex) => {
          const d = goals.find((g) => g.exercise_id === ex.id && g.period === 'daily')
          const w = goals.find((g) => g.exercise_id === ex.id && g.period === 'weekly')
          const timed = ex.kind === 'timed'
          const fmt = (n: number) => (timed ? fmtDuration(n) : String(n))
          return (
            <article key={ex.id} className="rounded-2xl border border-line bg-card p-4">
              <h2 className="font-medium">{ex.name}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-muted">Daily target</span>
                  <NumberField key={`d${d?.target ?? 0}`} value={d?.target ?? null} suffix={timed ? 'sec' : 'reps'}
                    label={`Daily target for ${ex.name}`} onSave={(n) => setGoal(ex, 'daily', n)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-muted">Weekly target</span>
                  <NumberField key={`w${w?.target ?? 0}`} value={w?.target ?? null} suffix={timed ? 'sec' : 'reps'}
                    label={`Weekly target for ${ex.name}`} onSave={(n) => setGoal(ex, 'weekly', n)} />
                </label>
              </div>
              {d ? <Meter label="Today" done={dayTotals.get(`${today}|${ex.id}`) ?? 0} target={d.target} fmt={fmt} /> : null}
              {w ? <Meter label="This week" done={weekTotals.get(ex.id) ?? 0} target={w.target} fmt={fmt} /> : null}
            </article>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Daily goals reset at local midnight. Leave a target empty or 0 to remove it.</p>
    </>
  )
}
