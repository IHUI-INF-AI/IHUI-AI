/**
 * SecureStore(token 加密持久化,mobile-rn 端)
 *
 * 安全分层:
 * - 优先用 expo-secure-store(iOS Keychain / Android Keystore 系统级加密)
 * - 不可用时降级到 AsyncStorage(开发环境 / 测试 / 模拟器无 Keychain 场景)
 * - 显式标记 secure: false 用于明确接受降级的非敏感数据(本文件暂未提供此类方法)
 *
 * 调用方约定:token 写入用 setSecureItem,读取用 getSecureItem,删除用 deleteSecureItem。
 * 三个方法的 fallback 行为对调用方完全透明,业务代码无需关心底层是 Keychain 还是 AsyncStorage。
 *
 * 实现细节:expo-secure-store 用动态 import 探测(测试环境无此依赖时不抛编译期错,运行时 try/catch 走 fallback)。
 *
 * §9 跨端同步:web 端 token 持久化已有(IndexedDB / cookie),mobile-rn 此处独立维护。
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

type SecureBackend = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  deleteItem(key: string): Promise<void>
  /** 后端是否提供系统级加密(仅用于诊断日志) */
  readonly encrypted: boolean
}

type SecureStoreNative = {
  getItemAsync: (k: string) => Promise<string | null>
  setItemAsync: (k: string, v: string) => Promise<void>
  deleteItemAsync: (k: string) => Promise<void>
}

/**
 * 探测 expo-secure-store 是否可用。
 *
 * 测试环境(jsdom / vitest)下模块根本未安装,动态 import 抛错,返回 null。
 * 运行时若原生模块未链接(iOS 未 pod install / Android 未 rebuild),也会抛错走 fallback。
 */
async function probeSecureStore(): Promise<SecureStoreNative | null> {
  try {
    // 动态 import:测试环境无该依赖时直接走 fallback
    const mod = (await import('expo-secure-store')) as Partial<SecureStoreNative>
    if (typeof mod.getItemAsync !== 'function' || typeof mod.setItemAsync !== 'function') {
      return null
    }
    return mod as SecureStoreNative
  } catch {
    return null
  }
}

let backendPromise: Promise<SecureBackend> | null = null

function getBackend(): Promise<SecureBackend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      const secure = await probeSecureStore()
      if (secure) {
        return {
          getItem: secure.getItemAsync,
          setItem: secure.setItemAsync,
          deleteItem: secure.deleteItemAsync,
          encrypted: true,
        }
      }
      return {
        getItem: async (k) => AsyncStorage.getItem(k),
        setItem: async (k, v) => {
          await AsyncStorage.setItem(k, v)
        },
        deleteItem: async (k) => {
          await AsyncStorage.removeItem(k)
        },
        encrypted: false,
      }
    })()
  }
  return backendPromise
}

/** 写入加密项(token 走此接口) */
export async function setSecureItem(key: string, value: string): Promise<void> {
  const b = await getBackend()
  await b.setItem(key, value)
}

/** 读取加密项 */
export async function getSecureItem(key: string): Promise<string | null> {
  const b = await getBackend()
  return b.getItem(key)
}

/** 删除加密项 */
export async function deleteSecureItem(key: string): Promise<void> {
  const b = await getBackend()
  await b.deleteItem(key)
}

/** 诊断用:返回当前是否走系统级加密(仅测试 / 上线自检) */
export async function isSecureBackendEncrypted(): Promise<boolean> {
  const b = await getBackend()
  return b.encrypted
}

/**
 * 测试 / 调试用:重置后端选择,让下一次调用重新探测。
 * 生产代码不应调用。
 */
export function _resetSecureStoreBackendForTest(): void {
  backendPromise = null
}
