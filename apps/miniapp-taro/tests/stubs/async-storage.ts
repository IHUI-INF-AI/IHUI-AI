// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * node 环境下的 AsyncStorage 最小桩(内存 Map 语义)。
 *
 * 背景:薄壳页加载 RN 共享屏时会经 ThemeContext → stores/storage-adapter 引
 * `@react-native-async-storage/async-storage`。该包 main 是 lib/commonjs,内部
 * `require('react-native')` 在 Node 解析下绕过本仓 vitest 的裸包 alias,落到真包 Flow
 * 源码(`import typeof * as ...`)⇒ 收集期 `SyntaxError: Unexpected token 'typeof'`。
 * 这里与 tests/stubs/react-native.ts 同型:只切平台依赖,语义用内存键值替身,
 * 不改变任何被测判序(测试不依赖跨进程持久化)。
 */

const store = new Map<string, string>()

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key)
  },
  mergeItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value)
  },
  clear: async (): Promise<void> => {
    store.clear()
  },
  getAllKeys: async (): Promise<string[]> => Array.from(store.keys()),
  multiGet: async (keys: readonly string[]): Promise<[string, string | null][]> =>
    keys.map((k) => [k, store.get(k) ?? null]),
  multiSet: async (pairs: readonly (readonly [string, string])[]): Promise<void> => {
    for (const [k, v] of pairs) store.set(k, v)
  },
  multiRemove: async (keys: readonly string[]): Promise<void> => {
    for (const k of keys) store.delete(k)
  },
  multiMerge: async (pairs: readonly (readonly [string, string])[]): Promise<void> => {
    for (const [k, v] of pairs) store.set(k, v)
  },
  flushGetRequests: async (): Promise<void> => {},
}

export default AsyncStorage
export const useAsyncStorage = (key: string) => ({
  getItem: () => AsyncStorage.getItem(key),
  setItem: (value: string) => AsyncStorage.setItem(key, value),
  mergeItem: (value: string) => AsyncStorage.mergeItem(key, value),
  removeItem: () => AsyncStorage.removeItem(key),
})
