import { setBaseUrl, setTokenProvider } from '@ihui/api-client'
import {
  API_BASE_URL,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  EXPIRES_IN_STORAGE_KEY,
} from './config'

let cachedToken: string | null = null
let cachedRefreshToken: string | null = null
let cachedExpiresIn: number | null = null

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)

  const result = await chrome.storage.local.get([
    TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    EXPIRES_IN_STORAGE_KEY,
  ])
  const storedToken = result[TOKEN_STORAGE_KEY]
  const storedRefresh = result[REFRESH_TOKEN_STORAGE_KEY]
  const storedExpiresIn = result[EXPIRES_IN_STORAGE_KEY]
  cachedToken = typeof storedToken === 'string' ? storedToken : null
  cachedRefreshToken = typeof storedRefresh === 'string' ? storedRefresh : null
  cachedExpiresIn = typeof storedExpiresIn === 'number' ? storedExpiresIn : null

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes[TOKEN_STORAGE_KEY]) {
      const newValue = changes[TOKEN_STORAGE_KEY].newValue
      cachedToken = typeof newValue === 'string' ? newValue : null
    }
    if (changes[REFRESH_TOKEN_STORAGE_KEY]) {
      const newValue = changes[REFRESH_TOKEN_STORAGE_KEY].newValue
      cachedRefreshToken = typeof newValue === 'string' ? newValue : null
    }
    if (changes[EXPIRES_IN_STORAGE_KEY]) {
      const newValue = changes[EXPIRES_IN_STORAGE_KEY].newValue
      cachedExpiresIn = typeof newValue === 'number' ? newValue : null
    }
  })

  setTokenProvider({ getToken: () => cachedToken })
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token
  if (token) {
    await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token })
  } else {
    await chrome.storage.local.remove(TOKEN_STORAGE_KEY)
  }
}

export function getToken(): string | null {
  return cachedToken
}

export function clearToken(): void {
  cachedToken = null
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

export async function setTokenPair(pair: TokenPair): Promise<void> {
  cachedToken = pair.accessToken
  cachedRefreshToken = pair.refreshToken
  if (pair.expiresIn !== undefined) cachedExpiresIn = pair.expiresIn
  await chrome.storage.local.set({
    [TOKEN_STORAGE_KEY]: pair.accessToken,
    [REFRESH_TOKEN_STORAGE_KEY]: pair.refreshToken,
    ...(pair.expiresIn !== undefined ? { [EXPIRES_IN_STORAGE_KEY]: pair.expiresIn } : {}),
  })
}

export function getRefreshToken(): string | null {
  return cachedRefreshToken
}

export function getExpiresIn(): number | null {
  return cachedExpiresIn
}

export async function clearAllTokens(): Promise<void> {
  cachedToken = null
  cachedRefreshToken = null
  cachedExpiresIn = null
  await chrome.storage.local.remove([
    TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    EXPIRES_IN_STORAGE_KEY,
  ])
  const { stopAutoRefresh } = await import('./token-utils')
  stopAutoRefresh()
}
