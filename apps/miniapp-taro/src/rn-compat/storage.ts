// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/storage.ts —— `@react-native-async-storage/async-storage` 的小程序等价实现。
 * 落到 Taro storage(与端内既有持久化同一载体),接口按 AsyncStorage 的 Promise 形状。
 */
import Taro from '@tarojs/taro'

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const v = await Taro.getStorage({ key })
      return v.data === undefined || v.data === null ? null : String(v.data)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Taro.setStorage({ key, data: value })
  },
  removeItem: async (key: string): Promise<void> => {
    await Taro.removeStorage({ key })
  },
  // AsyncStorage.mergeItem 的契约是把 value 的 JSON 字段合并进已有 JSON 值,不是整值覆盖;
  // 与 setItem 同实现会让消费方 patch 单字段时静默丢掉其余字段。旧值读不到/非法 JSON
  // 时按空对象起步,不把解析异常抛给调用方(兼容层保持 Promise<void> 形状)。
  mergeItem: async (key: string, value: string): Promise<void> => {
    const parse = (raw: string | null): Record<string, unknown> => {
      try {
        const v = raw ? (JSON.parse(raw) as unknown) : null
        if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
        return v as Record<string, unknown>
      } catch {
        return {}
      }
    }
    const prev = await AsyncStorage.getItem(key)
    await Taro.setStorage({ key, data: JSON.stringify({ ...parse(prev), ...parse(value) }) })
  },
  clear: async (): Promise<void> => {
    await Taro.clearStorage()
  },
  getAllKeys: async (): Promise<string[]> => Taro.getStorageInfoSync().keys,
  multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
    Promise.all(
      keys.map(async (k) => [k, await AsyncStorage.getItem(k)] as [string, string | null]),
    ),
  multiSet: async (pairs: [string, string][]): Promise<void> => {
    await Promise.all(pairs.map(([k, v]) => AsyncStorage.setItem(k, v)))
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)))
  },
}

export default AsyncStorage
export { AsyncStorage }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
