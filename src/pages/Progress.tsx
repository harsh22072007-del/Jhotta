import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart } from '../components/Chart'
import { fmtDuration } from '../lib/dates'
import { useClock } from '../lib/useClock'
import { loadStats, type Entry } from '../lib/loadStats'
import { sumByBucket, type Range } from '../lib/stats'

const RANGES: { id: Range; label: string }[] = [
  { id: 'D', label: 'Day' }, { id: 'W', label: 'Week' }, { id: 'M', label: 'Month' }, { id: 'Y', label: 'Year' },
]

export default function Progress() {
  const clock = useClock()
  const stats = useLiveQuery(loadStats, [clock])
  const [metric, setMetric] = useState('all-reps')
  const [range, setRange] = useState<Range>('D')
  if (!stats) return null
  const { today, exercises, entries } = stats

  const exId = metric.startsWith('ex:') ? metric.slice(3) : null
  const timed = metric === 'all-timed' || exercises.find((e) => e.id === exId)?.kind === 'timed'
  const pick = (e: Entry) =>
    metric === 'kcal' ? true
    : metric === 'all-reps' ? e.kind === 'reps'
    : metric === 'all-timed' ? e.kind === 'timed'
    : e.exercise_id === exId
  const rows = entries.filter(pick).map((e) => ({ day: e.day, value: metric === 'kcal' ? e.kcal : e.amount }))
  const data = sumByBucket(rows, today, range)
  const total = data.reduce((a, b) => a + b.value, 0)
  const shown = metric === 'kcal' ? `${Math.round(total)} kcal` : timed ? fmtDuration(total) : `${total} reps`
  const unit = metric === 'kcal' ? 'kcal (estimated)' : timed ? 'seconds' : 'reps'

  // today's sets per exercise with a running total
  const todayBy = new Map<string, number[]>()
  for (const e of entries) if (e.day === today) todayBy.set(e.exercise_id, [...(todayBy.get(e.exercise_id) ?? []), e.amount])

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Progress</h1>

      <select
        value={metric}
        onChange={(e) => setMetric(e.target.value)}
        aria-label="What to chart"
        className="mt-4 w-full rounded-xl border border-line bg-card px-3 py-3"
      >
        <option value="all-reps">All reps</option>
        <option value="all-timed">All timed work (seconds)</option>
        <option value="kcal">Calories (estimated)</option>
        {exercises.map((e) => (
          <option key={e.id} value={`ex:${e.id}`}>{e.name}</option>
        ))}
      </select>

      <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-accent-soft p-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            onClick={() => setRange(r.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${range === r.id ? 'bg-card text-accent shadow-sm' : 'text-muted'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <p className="font-display text-3xl font-semibold tabular-nums">{shown}</p>
        <p className="mb-3 text-sm text-muted">in this view · {unit}</p>
        <BarChart labels={data.map((d) => d.label)} values={data.map((d) => Math.round(d.value * 10) / 10)} />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Today by exercise</h2>
        {todayBy.size === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing logged today yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card">
            {exercises.filter((e) => todayBy.has(e.id)).map((e) => {
              const sets = todayBy.get(e.id) ?? []
              const f = (n: number) => (e.kind === 'timed' ? fmtDuration(n) : String(n))
              return (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{e.name}</p>
                  <p className="mt-0.5 text-muted tabular-nums">
                    {sets.map(f).join(' + ')} = <span className="font-semibold text-ink">{f(sets.reduce((a, b) => a + b, 0))}</span>
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
