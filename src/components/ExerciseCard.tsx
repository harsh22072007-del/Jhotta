import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../db/types'
import { fmtDuration } from '../lib/dates'

interface Props {
  exercise: Exercise
  total: number // reps or seconds logged today
  target: number | null
  onAdd: (amount: number) => void
}

function Timer({ onStop }: { onStop: (sec: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const tick = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearInterval(tick.current), [])

  const start = () => {
    const t = Date.now()
    setStartedAt(t)
    setNow(t)
    tick.current = window.setInterval(() => setNow(Date.now()), 250)
  }
  const stop = () => {
    window.clearInterval(tick.current)
    if (startedAt) {
      const sec = Math.round((Date.now() - startedAt) / 1000)
      if (sec > 0) onStop(sec)
    }
    setStartedAt(null)
  }

  if (startedAt === null) {
    return (
      <button onClick={start} className="w-full rounded-xl bg-accent py-3 font-semibold text-white active:opacity-80">
        Start timer
      </button>
    )
  }
  return (
    <button onClick={stop} className="w-full rounded-xl bg-ink py-3 font-semibold text-white active:opacity-80">
      Stop and save · {fmtDuration((now - startedAt) / 1000)}
    </button>
  )
}

export default function ExerciseCard({ exercise, total, target, onAdd }: Props) {
  const [custom, setCustom] = useState('')
  const timed = exercise.kind === 'timed'
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0
  const fmt = (n: number) => (timed ? fmtDuration(n) : String(n))

  const submitCustom = () => {
    const n = Number(custom)
    if (Number.isFinite(n) && n > 0) {
      onAdd(n)
      setCustom('')
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{exercise.name}</h2>
        <p className="font-display text-2xl font-semibold tabular-nums">
          {fmt(total)}
          {target ? <span className="text-base font-medium text-muted"> / {fmt(target)}</span> : null}
        </p>
      </div>
      {target ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="mt-3">
        {timed ? (
          <Timer onStop={onAdd} />
        ) : (
          <div className="flex gap-2">
            <button onClick={() => onAdd(1)} className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white active:opacity-80">+1</button>
            <button onClick={() => onAdd(5)} className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white active:opacity-80">+5</button>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
              inputMode="numeric"
              placeholder="Custom"
              aria-label={`Custom reps for ${exercise.name}`}
              className="w-20 rounded-xl border border-line bg-paper px-3 text-center"
            />
            <button onClick={submitCustom} className="rounded-xl border border-line px-3 font-medium active:bg-accent-soft">Add</button>
          </div>
        )}
      </div>
    </article>
  )
}
