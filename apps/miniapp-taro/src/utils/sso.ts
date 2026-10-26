// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSO 统一登录接入(小程序端)
 *
 * 核心逻辑复用 @ihui/shared/auth/sso-core,仅保留 taro 独占
 * (getStoredSsoCode / clearSsoCode 依赖 @tarojs/taro storage)。
 *
 * 使用场景:小程序需要登录时,跳转到 Web 端 SSO 登录中心,
 * 登录成功后通过一次性 code 回跳小程序,小程序用 code 换取 token。
 */
import { getStorageSync, removeStorageSync, setStorageSync, showToast } from '@tarojs/taro'
import { BASE_URL } from './api-config'
import { setToken, setRefreshToken, setUserInfo } from './auth'
import {
  exchangeSsoCode as exchangeSsoCodeCore,
  validateToken as validateTokenCore,
  ssoLogout as ssoLogoutCore,
  buildSsoLoginUrl,
  extractSsoCode,
} from '@ihui/shared/auth/sso-core'
import type { SsoTokenData } from '@ihui/shared/auth/sso-core'
import { SSO_CODE_STORAGE_KEY, SSO_CLIENT_IDS, WEB_BASE } from '@ihui/shared/constants'

// legacy underscore key (read-only for migration); new key uses hyphen via SSO_CODE_STORAGE_KEY
const SSO_CODE_KEY_LEGACY = 'ihui_sso_code'
const SSO_CLIENT_ID = SSO_CLIENT_IDS.MINIAPP_TARO

/**
 * 小程序端 SSO 授权回跳形态(AGENTS §9 scheme 契约,2026-10-26 G-957)。
 * web 中转页(/sso/login)签发后经 wx.miniProgram.postMessage 回传
 * `{type:'ihui-sso-code', sso_code}`(web 侧出口 apps/web/app/sso/login/miniapp-bridge.ts),
 * 本端由 pages/webview onMessage 与 app.tsx 启动腿消费 —— custom scheme 在小程序
 * web-view 里没有 OS 处理器,它只是过服务端 redirectUri 白名单的合法形态
 * (apps/api auth-sso.ts SSO_ALLOWED_DEEP_LINK_SCHEMES 默认已含 ihui-miniapp)。
 */
export const SSO_REDIRECT_URI = 'ihui-miniapp://sso/callback'

// BASE_URL 含 /api 后缀(http://localhost:8801/api),共享核心端点已含 /api 前缀,
// 此处剥离避免拼接出 /api/api/auth/sso/... 双重前缀。
const API_ORIGIN = BASE_URL.replace(/\/api$/, '')

export type { SsoTokenData } from '@ihui/shared/auth/sso-core'

/** taro 独占:storage 读取 sso_code */
export function getStoredSsoCode(): string {
  const newCode = getStorageSync(SSO_CODE_STORAGE_KEY) || ''
  if (newCode) return newCode
  const oldCode = getStorageSync(SSO_CODE_KEY_LEGACY) || ''
  if (oldCode) {
    setStorageSync(SSO_CODE_STORAGE_KEY, oldCode)
    removeStorageSync(SSO_CODE_KEY_LEGACY)
    return oldCode
  }
  return ''
}

/** taro 独占:storage 清除 sso_code */
export function clearSsoCode(): void {
  removeStorageSync(SSO_CODE_STORAGE_KEY)
  removeStorageSync(SSO_CODE_KEY_LEGACY)
}

/** taro 封装:用 BASE_URL(剥离 /api)+ SSO_CLIENT_ID */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  return exchangeSsoCodeCore(API_ORIGIN, code, SSO_CLIENT_ID)
}

/**
 * 消费一次性 sso_code:调 /api/auth/sso/exchange 换 token 并落盘登录态。
 * 成功弹一次提示并返回 true;code 失效/网络异常返回 false(不弹错,由调用方决定后续)。
 *
 * 本函数是 app.tsx 启动腿(consumeSsoCodeFromLaunch)与 webview 回传腿
 * (pages/webview onMessage)共用的唯一消费出口(G-957 回传腿,判据不另抄一份)。
 */
export async function consumeSsoCode(code: string, successMsg: () => string): Promise<boolean> {
  if (!code) return false
  try {
    const data = await exchangeSsoCode(code)
    if (!data) return false
    setToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    setUserInfo({
      id: data.user.id,
      uuid: data.user.id, // WebSocket 连接判断用 userInfo.uuid,SsoTokenData.user.id 对齐
      nickname: data.user.nickname,
      avatar: data.user.avatar,
      phone: data.user.phone,
      email: data.user.email,
      roleId: data.user.roleId,
      status: data.user.status,
    })
    showToast({ title: successMsg(), icon: 'success' })
    return true
  } catch {
    // SSO code 失效或网络异常,静默忽略(调用方按返回值决定提示/重试)
    return false
  }
}

/**
 * web-view 回传消息里 sso_code 的规范 type(G-957 回传契约)。
 * H5 页(wx.miniProgram.postMessage)与本页接收侧共用这一枚字面量;
 * 消息形态按仓内惯例带 `ihui-` 前缀(同 embed-proxy 的 `ihui-embed-proxy-error`)。
 */
export const SSO_WEBVIEW_MESSAGE_TYPE = 'ihui-sso-code'

/**
 * 从 `<web-view>` bindmessage 事件的 `e.detail.data` 里提取 sso_code,取第一条命中。
 *
 * 微信机制:H5 页 wx.miniProgram.postMessage 的消息不即时送达,而是在「后退 /
 * 组件销毁 / 分享」时以数组形式一次性投递给 bindmessage,元素就是 H5 post 的原始载荷。
 * 接收侧按宽容度取值(发送侧在 web 席位,契约以本函数为准):
 * - 规范对象 `{type:'ihui-sso-code', sso_code}`;带 type 但非本契约的消息一律跳过,
 *   防止误消费其它业务回传;不带 type 的裸 `{sso_code}` 也认(旧形态容错)。
 * - 字符串:URL 形态(`...?sso_code=x`,含自定义协议深链)走共享 extractSsoCode;
 *   JSON 串先解析再按对象规则处理。
 * - 数组嵌套一层以上照旧展开(微信部分端会把 data 套成二维)。
 */
export function extractSsoCodeFromWebviewMessages(data: unknown): string {
  const queue: unknown[] = Array.isArray(data) ? [...data] : [data]
  while (queue.length > 0) {
    const item = queue.shift()
    if (item === null || item === undefined) continue
    if (Array.isArray(item)) {
      queue.unshift(...item)
      continue
    }
    if (typeof item === 'string') {
      const fromUrl = extractSsoCode(item)
      if (fromUrl) return fromUrl
      if (item.trimStart().startsWith('{')) {
        try {
          queue.unshift(JSON.parse(item))
        } catch {
          // 非 JSON 串,忽略
        }
      }
      continue
    }
    if (typeof item === 'object') {
      const msg = item as { type?: unknown; sso_code?: unknown }
      if (typeof msg.type === 'string' && msg.type !== SSO_WEBVIEW_MESSAGE_TYPE) continue
      if (typeof msg.sso_code === 'string' && msg.sso_code) return msg.sso_code
    }
  }
  return ''
}

/** 构建 SSO 登录中心 URL */
export function getSsoLoginUrl(redirectUri: string): string {
  const webBase = process.env.TARO_APP_WEB_URL || WEB_BASE
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
