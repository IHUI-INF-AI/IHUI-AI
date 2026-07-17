import { vi } from 'vitest'

const store = new Map<string, string>()

export const resetAsyncStorageMock = (): void => {
  store.clear()
}

const AsyncStorage = {
  getItem: vi.fn(async (key: string): Promise<string | null> => {
    return store.has(key) ? (store.get(key) as string) : null
  }),
  setItem: vi.fn(async (key: string, value: string): Promise<void> => {
    store.set(key, String(value))
  }),
  removeItem: vi.fn(async (key: string): Promise<void> => {
    store.delete(key)
  }),
  getAllKeys: vi.fn(async (): Promise<readonly string[]> => Array.from(store.keys())),
  multiGet: vi.fn(async (keys: string[]): Promise<readonly [string, string | null][]> =>
    keys.map((k) => [k, store.has(k) ? (store.get(k) as string) : null]),
  ),
  multiSet: vi.fn(async (pairs: [string, string][]): Promise<void> => {
    for (const [k, v] of pairs) store.set(k, String(v))
  }),
  multiRemove: vi.fn(async (keys: string[]): Promise<void> => {
    for (const k of keys) store.delete(k)
  }),
  clear: vi.fn(async (): Promise<void> => {
    store.clear()
  }),
}

export default AsyncStorage
