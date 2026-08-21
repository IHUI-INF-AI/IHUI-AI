/**
 * tests/__mocks__/async-storage.ts
 *
 * jsdom 环境下模拟 @react-native-async-storage/async-storage。
 * 使用 vi.fn() 包装三方法,支持测试中 verify call / mockRejectedValueOnce 等 spy 操作。
 *
 * resetAsyncStorageMock():清空 Map + mockClear,由 tests/setup.ts beforeEach 调用。
 */
import { vi } from 'vitest'

const store = new Map<string, string>()

export const getItem = vi.fn(async (key: string): Promise<string | null> => {
  return store.get(key) ?? null
})

export const setItem = vi.fn(async (key: string, value: string): Promise<void> => {
  store.set(key, value)
})

export const removeItem = vi.fn(async (key: string): Promise<void> => {
  store.delete(key)
})

export function resetAsyncStorageMock(): void {
  store.clear()
  getItem.mockClear()
  setItem.mockClear()
  removeItem.mockClear()
}

export default {
  getItem,
  setItem,
  removeItem,
  __store: store,
}
