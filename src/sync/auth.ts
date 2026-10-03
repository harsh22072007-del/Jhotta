// Cognito Hosted UI + Google, Authorization Code flow with PKCE. No secrets live in the PWA:
// only the public client id, the Cognito domain and the API URL (see .env.example).
const env = import.meta.env
const DOMAIN = (env.VITE_COGNITO_DOMAIN as string | undefined)?.replace(/\/$/, '')
const CLIENT_ID = env.VITE_COGNITO_CLIENT_ID as string | undefined
export const API_URL = (env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
export const authConfigured = Boolean(DOMAIN && CLIENT_ID && API_URL)

const REDIRECT_URI = `${window.location.origin}/auth/callback`
const TOKEN_KEY = 'jhotta.auth'
const PKCE_KEY = 'jhotta.pkce'

export class AuthError extends Error {}

interface Tokens {
  id_token: string
  refresh_token: string
  expires_at: number
}
export interface Claims {
  sub: string
  email?: string
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function decodeClaims(jwt: string): Claims {
  const body = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(body)) as Claims
}

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}
const saveTokens = (t: Tokens) => localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
export const clearSession = () => localStorage.removeItem(TOKEN_KEY)
export const hasSession = () => readTokens() !== null

export function getClaims(): Claims | null {
  const t = readTokens()
  return t ? decodeClaims(t.id_token) : null
}

export async function startLogin() {
  if (!authConfigured || !CLIENT_ID) throw new Error('Cloud sign-in is not configured yet.')
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))
  const q = new URLSearchParams({
    identity_provider: 'Google',
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    code_challenge: b64url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
    state,
  })
  window.location.assign(`${DOMAIN}/oauth2/authorize?${q}`)
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID ?? '', ...params }),
  })
  if (!res.ok) throw new AuthError(`Sign-in failed (${res.status})`)
  return (await res.json()) as { id_token: string; refresh_token?: string; expires_in: number }
}

/** Runs on /auth/callback: exchanges the code, stores tokens, returns who signed in. */
export async function completeLogin(search: string): Promise<Claims> {
  const p = new URLSearchParams(search)
  if (p.get('error')) throw new Error(p.get('error_description') ?? 'Sign-in was cancelled.')
  const code = p.get('code')
  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null') as { verifier: string; state: string } | null
  if (!code || !saved || saved.state !== p.get('state')) throw new Error('Sign-in was interrupted. Please try again.')
  sessionStorage.removeItem(PKCE_KEY)
  const r = await tokenRequest({
    grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: saved.verifier,
  })
  saveTokens({
    id_token: r.id_token,
    refresh_token: r.refresh_token ?? '',
    expires_at: Date.now() + r.expires_in * 1000,
  })
  return decodeClaims(r.id_token)
}

let refreshing: Promise<string> | null = null

/** A valid id token (refreshed when close to expiry). null = never signed in. */
export async function getIdToken(force = false): Promise<string | null> {
  const t = readTokens()
  if (!t) return null
  if (!force && t.expires_at - 60_000 > Date.now()) return t.id_token
  refreshing ??= (async () => {
    try {
      const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
      saveTokens({ id_token: r.id_token, refresh_token: t.refresh_token, expires_at: Date.now() + r.expires_in * 1000 })
      return r.id_token
    } catch (e) {
      if (e instanceof TypeError) throw e // network down: keep the session
      clearSession()
      throw new AuthError('Session expired. Sign in again.')
    }
  })().finally(() => { refreshing = null })
  return refreshing
}

export function hostedLogoutUrl(): string | null {
  if (!authConfigured || !CLIENT_ID) return null
  const q = new URLSearchParams({ client_id: CLIENT_ID, logout_uri: window.location.origin })
  return `${DOMAIN}/logout?${q}`
}
