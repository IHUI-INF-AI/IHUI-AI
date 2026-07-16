import { setBaseUrl, setTokenProvider } from '@ihui/api-client'

const API_BASE_URL = 'http://127.0.0.1:3001'
const TOKEN_KEY = 'ihui-desktop-token'

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

let cached: string = readToken()

export function initApi(): void {
  setBaseUrl(API_BASE_URL)
  setTokenProvider({ getToken: () => cached })
}

export function getToken(): string {
  return cached
}

export function setToken(token: string | null): void {
  cached = token ?? ''
  try {
    if (cached) localStorage.setItem(TOKEN_KEY, cached)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  setToken(null)
}
