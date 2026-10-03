import {
  format, parseISO, startOfMonth, startOfWeek, startOfYear,
  subDays, subMonths, subWeeks, subYears,
} from 'date-fns'

export type Range = 'D' | 'W' | 'M' | 'Y'
export interface Bucket { key: string; label: string; value: number }

const fmtDay = (d: Date) => format(d, 'yyyy-MM-dd')
const MON = { weekStartsOn: 1 } as const

/** Which chart bucket a local date (YYYY-MM-DD) falls into. */
export function bucketKey(day: string, range: Range): string {
  const d = parseISO(day)
  if (range === 'D') return day
  if (range === 'W') return fmtDay(startOfWeek(d, MON))
  if (range === 'M') return format(d, 'yyyy-MM')
  return format(d, 'yyyy')
}

const COUNT: Record<Range, number> = { D: 14, W: 12, M: 12, Y: 5 }

/** Daily: last 14 days. Weekly: 12 weeks (Mon start). Monthly: 12 months. Yearly: 5 years. */
export function sumByBucket(rows: { day: string; value: number }[], today: string, range: Range): Bucket[] {
  const totals = new Map<string, number>()
  for (const r of rows) {
    const k = bucketKey(r.day, range)
    totals.set(k, (totals.get(k) ?? 0) + r.value)
  }
  const t = parseISO(today)
  const out: Bucket[] = []
  for (let i = COUNT[range] - 1; i >= 0; i--) {
    let key: string
    let label: string
    if (range === 'D') {
      const d = subDays(t, i)
      key = fmtDay(d); label = format(d, 'd MMM')
    } else if (range === 'W') {
      const d = startOfWeek(subWeeks(t, i), MON)
      key = fmtDay(d); label = format(d, 'd MMM')
    } else if (range === 'M') {
      const d = startOfMonth(subMonths(t, i))
      key = format(d, 'yyyy-MM'); label = format(d, 'MMM yy')
    } else {
      const d = startOfYear(subYears(t, i))
      key = format(d, 'yyyy'); label = key
    }
    out.push({ key, label, value: totals.get(key) ?? 0 })
  }
  return out
}

/**
 * Locked rule: a day counts when EVERY active daily goal is met.
 * totals is keyed "YYYY-MM-DD|exerciseId". Today only extends the streak once it is complete;
 * an unfinished today does not break it. No automatic rest-day freeze in v1.
 */
export function computeStreak(
  today: string,
  goals: { exercise_id: string; target: number; starts_on: string }[],
  totals: Map<string, number>,
): number {
  let streak = 0
  let d = parseISO(today)
  for (let i = 0; i < 3650; i++) {
    const day = fmtDay(d)
    const active = goals.filter((g) => g.starts_on <= day)
    if (active.length === 0) break
    const met = active.every((g) => (totals.get(`${day}|${g.exercise_id}`) ?? 0) >= g.target)
    if (met) streak++
    else if (i > 0) break
    d = subDays(d, 1)
  }
  return streak
}
