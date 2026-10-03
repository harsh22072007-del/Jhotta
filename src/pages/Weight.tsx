import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { WeightChart } from '../components/Chart'
import NumberField from '../components/NumberField'
import { db } from '../db/db'
import { addWeight, removeWeight, updateProfile } from '../lib/data'

export default function Weight() {
  const data = useLiveQuery(async () => ({
    profile: await db.profile.get('me'),
    weights: (await db.weight_logs.filter((w) => !w.deleted_at).toArray()).sort(
      (a, b) => a.logged_on.localeCompare(b.logged_on) || a.updated_at - b.updated_at,
    ),
  }), [])
  const [kg, setKg] = useState('')
  if (!data) return null
  const { profile, weights } = data
  const target = profile?.target_weight ?? null

  const perDay = new Map<string, number>() // last weigh-in of each day
  for (const w of weights) perDay.set(w.logged_on, w.kg)
  const days = [...perDay.entries()].slice(-30)
  const latest = weights.at(-1)

  const submit = () => {
    const n = Number(kg)
    if (Number.isFinite(n) && n > 0 && n < 500) {
      void addWeight(n)
      setKg('')
    }
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Weight</h1>

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <p className="font-display text-3xl font-semibold tabular-nums">{latest ? `${latest.kg} kg` : 'No entries yet'}</p>
        {latest && target ? (
          <p className="text-sm text-muted">
            {Math.abs(latest.kg - target) < 0.05 ? 'At your target.' : `${Math.abs(latest.kg - target).toFixed(1)} kg ${latest.kg > target ? 'above' : 'below'} your ${target} kg target`}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <input
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            inputMode="decimal"
            placeholder="Today's weight (kg)"
            aria-label="Weight in kg"
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-3"
          />
          <button onClick={submit} className="rounded-xl bg-accent px-5 font-semibold text-white active:opacity-80">Log</button>
        </div>
        <label className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Target weight</span>
          <NumberField key={target ?? 0} value={target} suffix="kg" label="Target weight in kg"
            onSave={(n) => updateProfile({ target_weight: n > 0 ? n : null })} />
        </label>
      </section>

      {days.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-line bg-card p-4">
          <WeightChart labels={days.map(([d]) => format(parseISO(d), 'd MMM'))} actual={days.map(([, v]) => v)} target={target} />
        </section>
      ) : null}

      {weights.length > 0 ? (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
          {[...weights].reverse().slice(0, 20).map((w) => (
            <li key={w.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted">{format(parseISO(w.logged_on), 'EEE d MMM yyyy')}</span>
              <span className="flex items-center gap-4">
                <span className="font-semibold tabular-nums">{w.kg} kg</span>
                <button onClick={() => removeWeight(w.id)} className="text-muted underline">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-muted">Calorie estimates use your last logged weight.</p>
    </>
  )
}
