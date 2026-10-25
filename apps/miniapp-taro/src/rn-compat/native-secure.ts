// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-secure.ts —— `expo-secure-store` 在小程序端的**等价实现**(不是空壳)。
 *
 * 为什么必须补(2026-10-26 现读):`apps/mobile-rn/src/lib/auth/secure-store.ts` 用动态 import
 * 探测 expo-secure-store,而 expo SDK 57 的 `expo-modules-core/package.json` 写着
 * `"main": "src/index.ts"` —— 发的是未编译 TS。weapp 侧 webpack 不转译 node_modules 的 .ts,
 * 于是构建当场 `ModuleParseError: Unexpected token (5:7)`,整轮产物出不来。
 *
 * 语义对照(逐项点名,不静默):
 *   · getItemAsync / setItemAsync / deleteItemAsync ⇒ Taro Storage(键加前缀,与 native-extras 的
 *     fs 承载同一族)。小程序没有 Keychain/Keystore 这一层 ⇒ 安全等级降为"设备本地存储",
 *     这是平台事实,不是实现偷懒:调用方拿到的仍是"读不到就是 null、写读删幂等"的同一套契约。
 *   · isAvailableAsync ⇒ 恒 true(存储原语总在)。
 *   · 值形态:RN 侧只允许 string ⇒ 这里同样只接 string,非 string 显式抛错,不悄悄 stringify。
 */
import Taro from '@tarojs/taro'

const PREFIX = 'ihui-compat-secure:'
const warned = new Set<string>()
function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rn-compat] ${message}`)
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    const v = Taro.getStorageSync(`${PREFIX}${key}`)
    return v === '' || v === null || v === undefined ? null : String(v)
  } catch {
    warnOnce(
      'secure-get',
      `expo-secure-store.getItemAsync(${key}) 读端内存储失败 ⇒ 按"无凭据"返回 null`,
    )
    return null
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (typeof value !== 'string') {
    throw new TypeError(
      `[rn-compat] expo-secure-store.setItemAsync(${key}) 只接受 string(与 RN 侧同契约,不做静默 stringify)`,
    )
  }
  Taro.setStorageSync(`${PREFIX}${key}`, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  Taro.removeStorageSync(`${PREFIX}${key}`)
}

export async function isAvailableAsync(): Promise<boolean> {
  warnOnce(
    'secure-level',
    'expo-secure-store 在小程序端由本地存储承载(无系统 Keychain/Keystore 等级)',
  )
  return true
}

export const ACCESSIBLE = {
  WHEN_UNLOCKED: 'WhenUnlocked',
  AFTER_FIRST_UNLOCK: 'AfterFirstUnlock',
  ALWAYS: 'Always',
} as const

export default { getItemAsync, setItemAsync, deleteItemAsync, isAvailableAsync, ACCESSIBLE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
