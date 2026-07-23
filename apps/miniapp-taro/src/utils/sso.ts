/**
 * SSO 统一登录接入(小程序端)
 *
 * 核心逻辑复用 @ihui/shared/auth/sso-core,仅保留 taro 独占
 * (getStoredSsoCode / clearSsoCode 依赖 @tarojs/taro storage)。
 *
 * 使用场景:小程序需要登录时,跳转到 Web 端 SSO 登录中心,
 * 登录成功后通过一次性 code 回跳小程序,小程序用 code 换取 token。
 */
import { getStorageSync, removeStorageSync } from '@tarojs/taro'
import { BASE_URL } from './request'
import {
  exchangeSsoCode as exchangeSsoCodeCore,
  validateToken as validateTokenCore,
  ssoLogout as ssoLogoutCore,
  buildSsoLoginUrl,
} from '@ihui/shared/auth/sso-core'
import type { SsoTokenData } from '@ihui/shared/auth/sso-core'

const SSO_CODE_KEY = 'ihui_sso_code'
const SSO_CLIENT_ID = 'miniapp-taro'

// BASE_URL 含 /api 后缀(http://localhost:8801/api),共享核心端点已含 /api 前缀,
// 此处剥离避免拼接出 /api/api/auth/sso/... 双重前缀。
const API_ORIGIN = BASE_URL.replace(/\/api$/, '')

export type { SsoTokenData } from '@ihui/shared/auth/sso-core'

/** taro 独占:storage 读取 sso_code */
export function getStoredSsoCode(): string {
  return getStorageSync(SSO_CODE_KEY) || ''
}

/** taro 独占:storage 清除 sso_code */
export function clearSsoCode(): void {
  removeStorageSync(SSO_CODE_KEY)
}

/** taro 封装:用 BASE_URL(剥离 /api)+ SSO_CLIENT_ID */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  return exchangeSsoCodeCore(API_ORIGIN, code, SSO_CLIENT_ID)
}

/** 构建 SSO 登录中心 URL */
export function getSsoLoginUrl(redirectUri: string): string {
  const webBase = process.env.TARO_APP_WEB_URL || 'http://localhost:8801'
  return buildSsoLoginUrl(webBase, redirectUri, SSO_CLIENT_ID)
}

/** taro 封装:返回 boolean(保持原签名) */
export async function validateToken(token: string): Promise<boolean> {
  const result = await validateTokenCore(API_ORIGIN, token)
  return result?.valid === true
}

/** taro 封装:登出 */
export async function ssoLogout(token: string): Promise<boolean> {
  return ssoLogoutCore(API_ORIGIN, token)
}
