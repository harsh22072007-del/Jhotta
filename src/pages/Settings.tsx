import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import NumberField from '../components/NumberField'
import { db } from '../db/db'
import { resetLocalData } from '../db/init'
import { setFactor, updateProfile } from '../lib/data'
import { authConfigured, clearSession, getClaims, hostedLogoutUrl, startLogin } from '../sync/auth'
import { syncLabel, syncNow, useSyncStatus } from '../sync/sync'

const ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['Asia/Kolkata', 'UTC'] // very old browsers
  }
})()

async function exportJson() {
  const dump = {
    exported_at: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    workout_logs: await db.workout_logs.toArray(),
    goals: await db.goals.toArray(),
    weight_logs: await db.weight_logs.toArray(),
    profile: await db.profile.toArray(),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `jhotta-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const card = 'mt-4 rounded-2xl border border-line bg-card p-4'
const btn = 'w-full rounded-xl py-3 font-semibold active:opacity-80'

export default function Settings() {
  const profile = useLiveQuery(() => db.profile.get('me'))
  const exercises = useLiveQuery(() => db.exercises.orderBy('sort').toArray())
  const pending = useLiveQuery(async () => {
    const [a, b, c, p] = await Promise.all([
      db.workout_logs.filter((r) => r.synced_at === null).count(),
      db.goals.filter((r) => r.synced_at === null).count(),
      db.weight_logs.filter((r) => r.synced_at === null).count(),
      db.profile.get('me'),
    ])
    return a + b + c + (p && p.synced_at == null ? 1 : 0)
  })
  const sync = useSyncStatus()
  const [confirm, setConfirm] = useState<'login' | 'logout' | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!profile || !exercises) return null

  const signedIn = profile.mode === 'user'
  const claims = signedIn ? getClaims() : null
  const zones = ZONES.includes(profile.timezone) ? ZONES : [profile.timezone, ...ZONES]

  const login = async () => {
    try { await startLogin() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const logout = async () => {
    clearSession()
    await resetLocalData()
    const url = hostedLogoutUrl()
    if (url) window.location.assign(url)
    else setConfirm(null)
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Settings</h1>

      <section className={card}>
        <p className="font-medium">{signedIn ? 'Signed in with Google' : 'Guest mode'}</p>
        {signedIn ? (
          <>
            {claims?.email ? <p className="text-sm text-muted">{claims.email}</p> : null}
            <p className="mt-2 text-sm text-muted">
              {syncLabel(sync)}
              {pending ? ` ${pending} change${pending === 1 ? '' : 's'} waiting.` : ''}
            </p>
            {sync.error ? <p className="mt-1 text-sm text-red-700">{sync.error}</p> : null}
            <div className="mt-3 flex gap-2">
              {sync.state === 'expired' ? (
                <button onClick={login} className={`${btn} bg-accent text-white`}>Sign in again</button>
              ) : (
                <button onClick={() => { void syncNow() }} className={`${btn} border border-line`}>Sync now</button>
              )}
              <button onClick={() => setConfirm('logout')} className={`${btn} border border-line`}>Log out</button>
            </div>
            {confirm === 'logout' ? (
              <div className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">
                <p>
                  Logging out clears all workout data from this device. Your account keeps its backup, and you can sign in again to restore it.
                  {pending ? ` ${pending} change${pending === 1 ? '' : 's'} not yet backed up will be lost.` : ''}
                </p>
                <div className="mt-2 flex gap-2">
                  <button onClick={logout} className="flex-1 rounded-lg bg-ink py-2 font-semibold text-white">Log out and clear</button>
                  <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-line py-2">Cancel</button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Your data lives only on this device and is never uploaded. Sign in with Google to back it up and use it on other devices.
            </p>
            {!authConfigured ? (
              <p className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                Cloud sign-in isn't set up yet. Deploy the backend and fill in the VITE_ values in .env (see backend/DEPLOY.md).
              </p>
            ) : confirm === 'login' ? (
              <div className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">
                <p>
                  <strong>Warning:</strong> signing in deletes the workouts, goals and weights stored on this device. Guest data is not merged into your account. Export a JSON backup first if you want to keep it.
                </p>
                <div className="mt-2 flex gap-2">
                  <button onClick={login} className="flex-1 rounded-lg bg-accent py-2 font-semibold text-white">Delete and continue</button>
                  <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-line py-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirm('login')} className={`${btn} mt-3 bg-accent text-white`}>Sign in with Google</button>
            )}
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-xl font-semibold">Preferences</h2>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Timezone</span>
          <select
            value={profile.timezone}
            onChange={(e) => updateProfile({ timezone: e.target.value })}
            className="min-w-0 max-w-[60%] rounded-xl border border-line bg-paper px-2 py-2"
          >
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Weight for calories until you log one</span>
          <NumberField key={profile.default_weight_kg} value={profile.default_weight_kg} suffix="kg" label="Default weight"
            onSave={(n) => n > 0 && updateProfile({ default_weight_kg: n })} />
        </label>
        <p className="mt-2 text-xs text-muted">Days and the daily goal reset follow this timezone, not UTC.</p>
      </section>

      <section className={card}>
        <h2 className="font-display text-xl font-semibold">Calorie estimates</h2>
        <p className="mt-1 text-sm text-muted">
          Estimated only. Counted exercises use kcal per rep. Timed ones use MET × hours × body weight.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {exercises.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span>{e.name}</span>
              {e.kind === 'reps' ? (
                <NumberField key={e.kcal_per_rep} value={e.kcal_per_rep} suffix="kcal/rep" label={`kcal per rep for ${e.name}`}
                  onSave={(n) => setFactor(e.id, { kcal_per_rep: n })} />
              ) : (
                <NumberField key={e.met} value={e.met} suffix="MET" label={`MET for ${e.name}`}
                  onSave={(n) => setFactor(e.id, { met: n })} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <button onClick={exportJson} className={`${btn} mt-4 border border-line bg-card`}>Export data as JSON</button>
      <p className="mt-2 text-xs text-muted">A safety net in case the browser clears its storage.</p>
    </>
  )
}
