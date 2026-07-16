import AsyncStorage from '@react-native-async-storage/async-storage'
import { setBaseUrl, setTokenProvider } from '@ihui/api-client'
import { API_BASE_URL, TOKEN_STORAGE_KEY } from './config'

let cachedToken: string | null = null

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)
  const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY)
  cachedToken = typeof stored === 'string' ? stored : null
  setTokenProvider({ getToken: () => cachedToken })
}

export function getToken(): string | null {
  return cachedToken
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token
  if (token) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

export async function clearToken(): Promise<void> {
  cachedToken = null
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY)
}
