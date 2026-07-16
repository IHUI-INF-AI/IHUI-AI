import { setBaseUrl, setTokenProvider } from '@ihui/api-client'

const API_BASE_URL = 'http://127.0.0.1:3001'
const TOKEN_KEY = 'ihui-desktop-token'
const REFRESH_TOKEN_KEY = 'ihui-desktop-refresh-token'

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function readRefreshToken(): string {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

let cached: string = readToken()
let cachedRefresh: string = readRefreshToken()

export function initApi(): void {
  setBaseUrl(API_BASE_URL)
  setTokenProvider({ getToken: () => cached })
}

export function getToken(): string {
  return cached
}

export function getRefreshToken(): string {
  return cachedRefresh
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

export function setRefreshToken(token: string | null): void {
  cachedRefresh = token ?? ''
  try {
    if (cachedRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, cachedRefresh)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  setToken(null)
  setRefreshToken(null)
}
