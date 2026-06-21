const ALLOWED_PROTOCOLS = ['http:', 'https:']
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:']

export function isValidRedirect(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmedUrl = url.trim()
  if (!trimmedUrl) {
    return false
  }

  if (trimmedUrl.startsWith('//')) {
    return false
  }

  const lowerUrl = trimmedUrl.toLowerCase()
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerUrl.startsWith(protocol)) {
      return false
    }
  }

  try {
    const parsed = new URL(trimmedUrl, window.location.origin)
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol) && parsed.origin !== window.location.origin) {
      return false
    }
  } catch {
    if (!trimmedUrl.startsWith('/')) {
      return false
    }
  }

  if (!trimmedUrl.startsWith('/')) {
    return false
  }

  return true
}

export function getSafeRedirect(url: string | null | undefined, defaultPath: string = '/'): string {
  if (isValidRedirect(url)) {
    return url as string
  }
  return defaultPath
}
