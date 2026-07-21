/**
 * OAuth 工具函数
 *
 * 等价自旧架构 client/src/features/third-party-login/utils/oauth.ts，
 * 适配新架构并扩展：state 生成、存储、校验与授权 URL 构造。
 */

import type { ThirdPartyPlatform } from '@/types/third-party'

/** sessionStorage 中保存 OAuth state 的 key 前缀 */
const OAUTH_STATE_KEY_PREFIX = 'oauth_state_'

/**
 * 生成随机 state 参数，用于防止 CSRF 攻击。
 * 强制使用 Web Crypto API(crypto.getRandomValues),保证密码学强度;
 * 不可用时抛错(不允许降级到 Math.random — 那是 CWE-330 可预测随机漏洞)。
 * @returns 随机 state 字符串(32 hex chars = 128 bits entropy)
 */
export function generateState(): string {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Web Crypto API 不可用,无法生成密码学安全随机数,拒绝降级到 Math.random()')
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 构造 OAuth 授权 URL。
 *
 * @param baseUrl 授权端点基础地址
 * @param params 查询参数
 * @returns 完整授权 URL（已编码）
 */
export function buildAuthUrl(baseUrl: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  return search ? `${baseUrl}?${search}` : baseUrl
}

/**
 * 在 sessionStorage 中保存指定平台的 OAuth state。
 * 用于回调时与第三方回传的 state 做比对，防止 CSRF。
 */
export function saveOAuthState(platform: ThirdPartyPlatform, state: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(OAUTH_STATE_KEY_PREFIX + platform, state)
  } catch {
    // sessionStorage 不可用时静默失败
  }
}

/**
 * 读取指定平台保存的 OAuth state。
 * @returns 已保存的 state；未保存或不可用时返回 null
 */
export function getOAuthState(platform: ThirdPartyPlatform): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(OAUTH_STATE_KEY_PREFIX + platform)
  } catch {
    return null
  }
}

/**
 * 校验第三方回传的 state 是否与本地保存的一致。
 * @returns true 表示校验通过
 */
export function validateOAuthState(platform: ThirdPartyPlatform, state: string): boolean {
  const saved = getOAuthState(platform)
  if (!saved || !state) return false
  return saved === state
}

/**
 * 清除指定平台保存的 OAuth state。通常在回调处理完成后调用。
 */
export function clearOAuthState(platform: ThirdPartyPlatform): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(OAUTH_STATE_KEY_PREFIX + platform)
  } catch {
    // 静默失败
  }
}
