const TOKEN_KEY = 'token'  // V2: unified token key

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  // Check both keys for backwards compatibility
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('kaccp_token')
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  // Also set old key for backwards compatibility
  localStorage.setItem('kaccp_token', token)
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('kaccp_token')
}

export async function apiFetch<T = any>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers as HeadersInit)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || ''
  return contentType.includes('application/json') ? (await res.json()) : ((await res.text()) as any)
}
