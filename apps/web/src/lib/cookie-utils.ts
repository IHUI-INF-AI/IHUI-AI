export function getAuthCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const configured = process.env.NEXT_PUBLIC_COOKIE_DOMAIN
  if (configured) return configured
  return undefined
}

export function setAuthCookie(token: string | null): void {
  if (typeof document === 'undefined') return
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const domain = getAuthCookieDomain()
  const parts = ['path=/', 'max-age=604800', 'SameSite=Lax']
  if (isSecure) parts.push('Secure')
  if (domain) parts.push(`domain=${domain}`)
  if (token) {
    document.cookie = `auth_token=${token}; ${parts.join('; ')}`
  } else {
    document.cookie = `auth_token=; ${parts.map((p) => (p.startsWith('max-age') ? 'max-age=0' : p)).join('; ')}`
  }
}
