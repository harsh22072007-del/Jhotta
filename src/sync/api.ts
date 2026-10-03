import { API_URL, AuthError, getIdToken } from './auth'

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const call = async (token: string) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })
  let token = await getIdToken()
  if (!token) throw new AuthError('Not signed in.')
  let res = await call(token)
  if (res.status === 401) {
    token = await getIdToken(true)
    if (!token) throw new AuthError('Session expired. Sign in again.')
    res = await call(token)
    if (res.status === 401) throw new AuthError('Session expired. Sign in again.')
  }
  if (!res.ok) throw new Error(`Server error (${res.status})`)
  return (await res.json()) as T
}
