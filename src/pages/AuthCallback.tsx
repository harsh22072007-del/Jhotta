import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { resetLocalData } from '../db/init'
import { completeLogin } from '../sync/auth'
import { getSyncStatus, syncNow } from '../sync/sync'

let inflight: Promise<void> | null = null // the auth code is single-use; guard against StrictMode's double effect

async function finishLogin(search: string) {
  const claims = await completeLogin(search)
  const cur = await db.profile.get('me')
  // Same account re-authenticating keeps its data. Guest or a different account: wipe, then pull.
  if (!(cur?.mode === 'user' && cur.cognito_sub === claims.sub)) {
    await resetLocalData({ mode: 'user', cognito_sub: claims.sub })
  }
  await syncNow()
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inflight ??= finishLogin(window.location.search)
    inflight.then(
      () => {
        const s = getSyncStatus()
        if (s.state === 'error' || s.state === 'expired') setError(s.error ?? 'Could not load your data.')
        else navigate('/', { replace: true })
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [navigate])

  return (
    <div className="pt-16 text-center">
      {error ? (
        <>
          <p className="font-medium">Sign-in didn't finish</p>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link to="/settings" className="mt-4 inline-block text-accent underline">Back to Settings</Link>
        </>
      ) : (
        <p className="text-muted">Signing you in and loading your data...</p>
      )}
    </div>
  )
}
