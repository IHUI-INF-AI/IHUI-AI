// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { Platform } from 'react-native'
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
  // web 平台 expo-secure-store 无原生实现:模块可 import 但 getItemAsync 内部调用
  // ExpoSecureStore.default.getValueWithKeyAsync 会抛 TypeError。直接走 AsyncStorage fallback。
  if (Platform.OS === 'web') {
    return null
  }
  try {
    // 必须同步取模块:动态 import() 在 dev bundle 里会被拆成 lazy chunk,Metro 对该 chunk
    // 路径回 404(实测 node_modules/.pnpm/expo-secure-store@57…/SecureStore.bundle),
    // Promise 就 reject ⇒ 静默退回 AsyncStorage 并拒写明文刷新令牌(冷启要重新登录)。
    // require 同步打进主 bundle、不产生分块;测试环境取不到或求值抛错时仍由外层 catch 兜底。
    // 行内豁免:此处 require 是刻意的(见上),仓内 GlobalFloatBox.tsx 有同型先例
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store') as Partial<SecureStoreNative>
    if (typeof mod.getItemAsync !== 'function' || typeof mod.setItemAsync !== 'function') {
      // 取到了模块对象但方法不全:同样要留痕,否则上层只看到"未加密后端"这句误判文案
      if (__DEV__) {
        console.warn('[secure-store] probe: module loaded but methods missing', Object.keys(mod))
      }
      return null
    }
    return mod as SecureStoreNative
  } catch (e) {
    // 静默吞错会让"取不到模块"与"本该走 fallback"长得一样,排障时只能看到上层那句
    // "native module missing is a build defect"的误判文案 —— dev 下把真实原因打出来。
    if (__DEV__) {
      console.warn('[secure-store] probe failed:', e instanceof Error ? e.message : String(e))
    }
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

/** 写入加密项(token 走此接口)
 *
 * opts.rejectPlaintext(2026-10-27 加固):值为 true 且当前后端**不是**系统级加密时,
 * 原生平台一律拒绝落盘 —— 降级后端是 AsyncStorage 明文,refresh token 这种长期凭据
 * 写进去等于 iOS 越狱/Android root 后直接读走账号。拒绝后内存缓存层
 * (createInMemoryTokenStore)不受影响,本会话照常;冷启动需重新登录。
 * 刻意的失效方向:宁可少一次「记住登录」,也不静默把凭据写成明文。
 * web 平台豁免:RN web 的 AsyncStorage 就是 localStorage,与 web 端 token 持久化
 * 同一风险模型(本来就明文),在那里拒绝只会白白打断会话。
 *
 * @returns 'stored'(已落盘) | 'skipped-plaintext'(因拒绝明文而未落盘)
 */
export async function setSecureItem(
  key: string,
  value: string,
  opts: { rejectPlaintext?: boolean } = {},
): Promise<'stored' | 'skipped-plaintext'> {
  const b = await getBackend()
  if (opts.rejectPlaintext && !b.encrypted && Platform.OS !== 'web') {
    console.warn(
      `[secure-store] refused plaintext persistence for ${key} (backend is not encrypted; ` +
        `native module missing is a build defect — cold start will require re-login)`,
    )
    return 'skipped-plaintext'
  }
  await b.setItem(key, value)
  return 'stored'
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
