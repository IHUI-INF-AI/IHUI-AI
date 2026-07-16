import { setBaseUrl, setTokenProvider } from '@ihui/api-client'
import { API_BASE_URL, TOKEN_STORAGE_KEY } from './config'

let cachedToken: string | null = null

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)

  const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY)
  const stored = result[TOKEN_STORAGE_KEY]
  cachedToken = typeof stored === 'string' ? stored : null

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes[TOKEN_STORAGE_KEY]) {
      const newValue = changes[TOKEN_STORAGE_KEY].newValue
      cachedToken = typeof newValue === 'string' ? newValue : null
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
