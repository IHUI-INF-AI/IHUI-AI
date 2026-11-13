// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 第三方登录服务。
 * 支持 Google / 微信小程序 / 企业微信(自建应用 PC 网页扫码 + suite 模式)/ 钉钉(DingTalk)。
 * 密钥配置留空时降级为 mock 模式(DEV)。
 *
 * 密钥配置(.env):
 * - GOOGLE_APP_ID / GOOGLE_ANDROID_ID / GOOGLE_SECRET / GOOGLE_PC_REDIRECT_URI
 * - WX_MINI_APPID / WX_MINI_SECRET
 * - WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_SECRET(自建应用 PC 网页扫码)
 * - WECOM_SECRET / WECOM_SUITE_ID / WECOM_SUITE_TICKET(suite 模式,仅小程序场景)
 * - DINGTALK_APP_KEY / DINGTALK_APP_SECRET / DINGTALK_REDIRECT_URI
 */

import { env } from 'node:process'
import { randomBytes } from 'node:crypto'
import { isProxiedUrl, proxiedFetch, directEgressFetch } from '../utils/proxy-dispatcher'

// ============================================================================
// Google OAuth
// ============================================================================

export interface GoogleUserInfo {
  openId: string
  email: string
  name: string
  picture: string
  phone: string
}

export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_APP_ID && env.GOOGLE_SECRET)
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

/** OAuth 上游统一超时(毫秒):上游挂起不得占线程 300s(BUG-25)。 */
const OAUTH_UPSTREAM_TIMEOUT_MS = 10_000

/**
 * OAuth 上游统一出站封装(BUG-25):本文件所有出站请求共用一份超时预算,
 * 不再各处裸 fetch / 各自 AbortSignal.timeout 撞运气。
 * 命中 PROXY_DOMAINS 白名单时走 proxiedFetch,否则 directEgressFetch —— 两侧都经
 * boundedEgressFetch(有界重定向 / 跨 origin 剥头 / 响应字节上限),与 AI 厂商出口同源。
 */
async function oauthFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OAUTH_UPSTREAM_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {}
    if (init.headers)
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value
      })
    const body = init.body === null || init.body === undefined ? undefined : String(init.body)
    const common = {
      method: init.method,
      headers,
      body,
      signal: controller.signal,
    }
    return isProxiedUrl(url)
      ? await proxiedFetch(url, common)
      : await directEgressFetch(url, common)
  } finally {
    clearTimeout(timer)
  }
}

/** 用 code 换 id_token → 校验 aud → 返回用户信息 */
export async function exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
  const tokenResp = await oauthFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_APP_ID ?? '',
      client_secret: env.GOOGLE_SECRET ?? '',
      redirect_uri: env.GOOGLE_PC_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!tokenResp.ok) throw new Error(`Google token exchange failed: ${tokenResp.status}`)
  const tokenData = (await tokenResp.json()) as { id_token: string }
  const idToken = tokenData.id_token
  return verifyGoogleIdToken(idToken)
}

/** 校验 id_token → 返回用户信息 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const resp = await oauthFetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`)
  if (!resp.ok) throw new Error(`Google tokeninfo failed: ${resp.status}`)
  const data = (await resp.json()) as {
    sub: string
    email: string
    name: string
    picture: string
    aud?: string
  }
  // 校验 aud
  const allowed = (env.GOOGLE_APP_IDS ?? env.GOOGLE_APP_ID ?? '').split(',').filter(Boolean)
  if (env.NODE_ENV === 'production' && allowed.length > 0 && !allowed.includes(data.aud ?? '')) {
    throw new Error('Google aud mismatch')
  }
  return {
    openId: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    phone: data.email, // 兜底用 email 当 phone
  }
}

// ============================================================================
// 微信小程序
// ============================================================================

/**
 * 微信系接口的失败形态:**HTTP 200 + body.errcode**(与阿里云 SendSms 的
 * `200 + body.Code=isv.*` 完全同族)。本文件此前只判 `resp.ok`,于是"被拒"被读成
 * "成功但字段是 undefined" —— 而这条腿住在**认证路径**上,不是发信路径。
 *
 * 实测(2026-10-22,假 code 直打线上):`GET /api/auth/wechat/mini/login` 回 500「服务器错误」。
 * 顺着看才发现真正的危险那一格不在 500,而在"它居然可能不 500":
 * `jscode2session` 返回 `{openId: undefined}` 后,`findThirdPartyAccount(platform, undefined)`
 * 一旦没抛,下面就是 `needPhone:true, openId:undefined` 一路往下 ⇒
 * 一枚 `open_id` 为空的绑定/用户可以被凭空造出来(§5「认证不等于授权」:身份不得住在可缺省字段里)。
 *
 * 所以这里把两件事一起判:**errcode 非零是失败**,**关键字段为空也是失败**。
 */
export class WechatApiError extends Error {
  readonly errcode: number
  constructor(what: string, errcode: number, detail: string) {
    super(`${what} 被微信侧拒绝:errcode=${errcode}${detail ? ` ${detail.slice(0, 60)}` : ''}`)
    this.name = 'WechatApiError'
    this.errcode = errcode
  }
}

/** 读微信 JSON:先验 errcode,再验"这个字段必须是非空字符串"。返回该字段值。 */
function requireWechatField(what: string, body: Record<string, unknown>, field: string): string {
  const errcode = Number(body.errcode ?? 0)
  if (errcode !== 0) throw new WechatApiError(what, errcode, String(body.errmsg ?? ''))
  const value = body[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new WechatApiError(what, -1, `响应里 ${field} 不是非空字符串`)
  }
  return value
}

export interface WechatMiniSession {
  openId: string
  unionId: string
  sessionKey: string
}

export function isWechatMiniConfigured(): boolean {
  return Boolean(env.WX_MINI_APPID && env.WX_MINI_SECRET)
}

/** jscode2session */
export async function jscode2session(code: string): Promise<WechatMiniSession> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WX_MINI_APPID}&secret=${env.WX_MINI_SECRET}&js_code=${code}&grant_type=authorization_code`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`Wechat jscode2session failed: ${resp.status}`)
  const data = (await resp.json()) as Record<string, unknown>
  return {
    openId: requireWechatField('jscode2session', data, 'openid'),
    unionId: typeof data.unionid === 'string' ? data.unionid : '',
    sessionKey: typeof data.session_key === 'string' ? data.session_key : '',
  }
}

/** 获取手机号（getuserphonenumber） */
export async function getPhoneNumber(code: string): Promise<string> {
  const accessToken = await getAccessToken()
  const resp = await oauthFetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    },
  )
  if (!resp.ok) throw new Error(`Wechat getuserphonenumber failed: ${resp.status}`)
  const data = (await resp.json()) as Record<string, unknown>
  if (Number(data.errcode ?? 0) !== 0) {
    throw new WechatApiError('getuserphonenumber', Number(data.errcode), String(data.errmsg ?? ''))
  }
  const info = data.phone_info as Record<string, unknown> | undefined
  const phoneNumber = requireWechatField(
    'getuserphonenumber(phone_info)',
    info ?? {},
    'phoneNumber',
  )
  return phoneNumber
}

// ============================================================================
// 微信开放平台-移动应用(App 内授权登录,react-native-wechat-lib 原生 SDK)
// 与网站应用(wx3c...)/小程序(wx...WX_MINI_APPID)不同:移动应用用独立 AppID/Secret,
// code 由 sendAuthRequest('snsapi_userinfo') 取得,经 sns/oauth2/access_token 换 token。
// ============================================================================

export interface WechatAppSession {
  openId: string
  unionId: string
  refreshToken?: string
  nickname?: string
  avatar?: string
}

export function isWechatAppConfigured(): boolean {
  return Boolean(env.WECHAT_MOBILE_APP_ID && env.WECHAT_MOBILE_SECRET)
}

/** 移动应用授权码 → token → 用户信息(sns/oauth2/access_token + sns/userinfo) */
export async function wechatAppCode2session(code: string): Promise<WechatAppSession> {
  if (!env.WECHAT_MOBILE_APP_ID || !env.WECHAT_MOBILE_SECRET) {
    throw new Error('微信移动应用未配置 WECHAT_MOBILE_APP_ID / WECHAT_MOBILE_SECRET')
  }
  const tokenRes = await oauthFetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${env.WECHAT_MOBILE_APP_ID}&secret=${env.WECHAT_MOBILE_SECRET}&code=${code}&grant_type=authorization_code`,
  )
  if (!tokenRes.ok) throw new Error(`wechat app token failed: ${tokenRes.status}`)
  const tokenData = (await tokenRes.json()) as Record<string, unknown>
  // 微信拒绝一次性 code / 密钥不匹配时回的是 HTTP 200 + body.errcode(40029/40163/40125),
  // 旧写法只判 access_token 存在与否、把 errcode 丢进一条泛化文案 ⇒ 线上只能看到
  // 「登录已过期」而拿不到真因(与 jscode2session 那格同一缺陷族:200 不等于成功)。
  const accessToken = requireWechatField('微信移动应用 code2session', tokenData, 'access_token')
  const tokenOpenId = requireWechatField('微信移动应用 code2session', tokenData, 'openid')
  const userRes = await oauthFetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${tokenOpenId}`,
  )
  const wxUser = (await userRes.json()) as Record<string, unknown>
  const userOpenId = requireWechatField('微信移动应用 userinfo', wxUser, 'openid')
  const unionId = wxUser.unionid ?? tokenData.unionid
  return {
    openId: userOpenId,
    unionId: typeof unionId === 'string' ? unionId : '',
    refreshToken:
      typeof tokenData.refresh_token === 'string' ? tokenData.refresh_token : undefined,
    nickname: typeof wxUser.nickname === 'string' ? wxUser.nickname : undefined,
    avatar: typeof wxUser.headimgurl === 'string' ? wxUser.headimgurl : undefined,
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

/** 小程序全局 access_token(内存缓存,提前 200s 过期;供订阅消息等 cgi-bin 接口复用) */
export async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.token
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WX_MINI_APPID}&secret=${env.WX_MINI_SECRET}`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`Wechat gettoken failed: ${resp.status}`)
  const data = (await resp.json()) as Record<string, unknown>
  const token = requireWechatField('cgi-bin/token', data, 'access_token')
  cachedAccessToken = {
    token,
    expiresAt: now + (Number(data.expires_in ?? 7200) - 200) * 1000,
  }
  return token
}

/** 生成小程序无限码 */
export async function generateQrcode(scene: string, page: string): Promise<Buffer> {
  const accessToken = await getAccessToken()
  const resp = await oauthFetch(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene, page, check_path: false }),
    },
  )
  if (!resp.ok) throw new Error(`Wechat qrcode failed: ${resp.status}`)
  return Buffer.from(await resp.arrayBuffer())
}

// ============================================================================
// 企业微信（WeCom）
// ----------------------------------------------------------------------------
// 支持两种模式:
//   1. 自建应用 PC 网页扫码(WECOM_CORP_ID + WECOM_AGENT_ID + WECOM_SECRET)— 当前启用
//   2. 第三方应用服务商 suite 模式(WECOM_SUITE_ID + WECOM_SECRET + WECOM_SUITE_TICKET)— 仅小程序场景
//
// 配置(.env):
//   - 自建应用:WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_SECRET
//   - suite 模式:WECOM_SECRET / WECOM_SUITE_ID / WECOM_SUITE_TICKET
// ============================================================================

export interface WecomSession {
  userId: string
  sessionKey: string
  openUserId: string
  corpId: string
}

/** 自建应用 PC 网页扫码是否已配置 */
export function isWecomConfigured(): boolean {
  return Boolean(env.WECOM_CORP_ID && env.WECOM_SECRET && env.WECOM_AGENT_ID)
}

/** 第三方应用服务商 suite 模式是否已配置 */
export function isWecomSuiteConfigured(): boolean {
  return Boolean(env.WECOM_SECRET && env.WECOM_SUITE_ID)
}

let cachedWecomAccessToken: { token: string; expiresAt: number } | null = null

/** 获取企业微信自建应用 access_token(corpid + corpsecret) */
async function getWecomAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedWecomAccessToken && cachedWecomAccessToken.expiresAt > now + 60000) {
    return cachedWecomAccessToken.token
  }
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${env.WECOM_CORP_ID}&corpsecret=${env.WECOM_SECRET}`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`WeCom gettoken failed: ${resp.status}`)
  const data = (await resp.json()) as {
    access_token?: string
    expires_in?: number
    errcode?: number
    errmsg?: string
  }
  if (!data.access_token) {
    throw new Error(`WeCom gettoken error: ${data.errcode ?? '?'} ${data.errmsg ?? ''}`)
  }
  cachedWecomAccessToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 7200) * 1000,
  }
  return data.access_token
}

/**
 * 自建应用 PC 网页扫码:用授权 code 换用户身份。
 * 文档:https://developer.work.weixin.qq.com/document/path/91023
 * 返回的 userId 是企业内的 userid(用于唯一标识用户)。
 */
export async function wecomPcCode2session(code: string): Promise<WecomSession> {
  const accessToken = await getWecomAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${accessToken}&code=${code}`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`WeCom getuserinfo failed: ${resp.status}`)
  const data = (await resp.json()) as {
    userid?: string
    open_userid?: string
    corpid?: string
    errcode?: number
    errmsg?: string
  }
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`WeCom getuserinfo error: ${data.errcode} ${data.errmsg ?? ''}`)
  }
  if (!data.userid && !data.open_userid) {
    throw new Error('WeCom getuserinfo: 未返回 userid 或 open_userid')
  }
  return {
    userId: data.userid ?? data.open_userid ?? '',
    sessionKey: '',
    openUserId: data.open_userid ?? data.userid ?? '',
    corpId: data.corpid ?? env.WECOM_CORP_ID ?? '',
  }
}

/** suite 模式:获取 suite_access_token(仅第三方应用服务商场景) */
export async function getSuiteAccessToken(): Promise<string> {
  const suiteTicket = env.WECOM_SUITE_TICKET ?? ''
  const resp = await oauthFetch('https://qyapi.weixin.qq.com/cgi-bin/service/get_suite_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suite_id: env.WECOM_SUITE_ID,
      suite_secret: env.WECOM_SECRET,
      suite_ticket: suiteTicket,
    }),
  })
  if (!resp.ok) throw new Error(`WeCom get_suite_token failed: ${resp.status}`)
  const data = (await resp.json()) as { suite_access_token: string }
  return data.suite_access_token
}

/** suite 模式:code2session(企业微信小程序场景) */
export async function wecomCode2session(code: string): Promise<WecomSession> {
  const token = await getSuiteAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/service/miniprogram/jscode2session?suite_access_token=${token}&js_code=${code}&grant_type=authorization_code`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`WeCom code2session failed: ${resp.status}`)
  const data = (await resp.json()) as {
    userid: string
    session_key: string
    open_userid: string
    corpid: string
  }
  return {
    userId: data.userid,
    sessionKey: data.session_key,
    openUserId: data.open_userid,
    corpId: data.corpid,
  }
}

// ============================================================================
// 钉钉（DingTalk）扫码登录
// ============================================================================

export interface DingtalkUserInfo {
  openId: string
  unionId: string
  nick: string
  avatarUrl: string
}

export function isDingtalkConfigured(): boolean {
  return Boolean(env.DINGTALK_APP_KEY && env.DINGTALK_APP_SECRET)
}

/** 构造钉钉扫码登录授权 URL（前端跳转至此 URL 让用户扫码） */
export function buildDingtalkAuthUrl(state: string): string {
  const params = new URLSearchParams({
    redirect_uri: env.DINGTALK_REDIRECT_URI ?? '',
    response_type: 'code',
    client_id: env.DINGTALK_APP_KEY ?? '',
    scope: 'openid',
    state,
    prompt: 'consent',
  })
  return `https://login.dingtalk.com/oauth2/auth?${params.toString()}`
}

/** 用授权码换取 userAccessToken（钉钉 OAuth2 回调处理） */
export async function exchangeDingtalkCode(code: string): Promise<string> {
  const resp = await oauthFetch('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: env.DINGTALK_APP_KEY ?? '',
      clientSecret: env.DINGTALK_APP_SECRET ?? '',
      code,
      grantType: 'authorization_code',
      redirectUri: env.DINGTALK_REDIRECT_URI ?? '',
    }),
  })
  if (!resp.ok) throw new Error(`DingTalk token exchange failed: ${resp.status}`)
  const data = (await resp.json()) as { accessToken?: string }
  if (!data.accessToken) throw new Error('DingTalk token exchange: no accessToken in response')
  return data.accessToken
}

/** 用 userAccessToken 获取钉钉用户信息 */
export async function getDingtalkUserInfo(accessToken: string): Promise<DingtalkUserInfo> {
  const resp = await oauthFetch('https://api.dingtalk.com/v1.0/contact/users/me', {
    headers: { 'x-acs-dingtalk-access-token': accessToken },
  })
  if (!resp.ok) throw new Error(`DingTalk userinfo failed: ${resp.status}`)
  const data = (await resp.json()) as {
    openId?: string
    unionId?: string
    nick?: string
    avatarUrl?: string
  }
  const openId = data.openId ?? data.unionId ?? ''
  if (!openId) throw new Error('DingTalk userinfo: missing openId')
  return {
    openId,
    unionId: data.unionId ?? '',
    nick: data.nick ?? '',
    avatarUrl: data.avatarUrl ?? '',
  }
}

// ============================================================================
// 支付宝登录（auth_code 换 access_token + user_id）
// 密钥留空时降级为 mock 模式（DEV）。
//
// 密钥配置（.env）:
// - ALIPAY_APP_ID: 应用 appid
// - ALIPAY_PRIVATE_KEY: 应用私钥 PEM（或 ALIPAY_PRIVATE_KEY_PATH）
// - ALIPAY_PUBLIC_KEY: 支付宝公钥 PEM（或 ALIPAY_PUBLIC_KEY_PATH）
// ============================================================================

import { createSign } from 'node:crypto'
import {
  isAlipayConfigured as isAlipayPayConfigured,
  resolveAlipayPrivateKey,
  formatTimestamp,
} from './alipay.js'

export interface AlipayUserInfo {
  openId: string
  unionId?: string
  nick: string
  avatar: string
  phone?: string
}

export function isAlipayLoginConfigured(): boolean {
  return isAlipayPayConfigured()
}

/** 取私钥一律走 alipay.js 那一份出口(§0.6 单一真相源):
 *  这里曾自己写过一份"键名非空就读",于是判据说配置好了、签名这一步才 ENOENT 炸成 500。 */
function getPrivateKey(): string {
  const { key, reason } = resolveAlipayPrivateKey()
  if (!key) throw new Error(`支付宝应用私钥不可用:${reason}`)
  return key
}

/** 支付宝 OAuth 的 `timestamp`:与签名配套的 GMT+8 `yyyy-MM-dd HH:mm:ss`(SDB-33)。
 *  旧实现用 `toISOString()` 贴 `+08:00`,实际是 UTC 墙钟 —— 网关按北京时间校验必拒。
 *  唯一出口复用 alipay.ts 的 formatTimestamp(与支付链路同一份时区规范)。 */
export function alipayOAuthTimestamp(now: Date = new Date()): string {
  return formatTimestamp(now)
}

/** 用 auth_code 调 alipay.system.oauth.token 换 access_token + user_id */
export async function exchangeAlipayCode(authCode: string): Promise<{
  accessToken: string
  userId: string
  openId?: string
  unionId?: string
}> {
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.system.oauth.token',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayOAuthTimestamp(),
    version: '1.0',
    grant_type: 'authorization_code',
    code: authCode,
  }
  params.sign = createSign('RSA-SHA256')
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&'),
      'utf-8',
    )
    .sign(getPrivateKey(), 'base64')
  const url = `${env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do'}?${new URLSearchParams(params).toString()}`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`Alipay oauth.token failed: ${resp.status}`)
  const data = (await resp.json()) as {
    alipay_system_oauth_token_response?: {
      access_token?: string
      user_id?: string
      open_id?: string
      union_id?: string
      code?: string
      msg?: string
    }
  }
  const inner = data.alipay_system_oauth_token_response
  if (!inner || !inner.access_token || !inner.user_id) {
    throw new Error(`Alipay oauth.token: ${inner?.msg ?? inner?.code ?? 'no access_token'}`)
  }
  return {
    accessToken: inner.access_token,
    userId: inner.user_id,
    openId: inner.open_id,
    unionId: inner.union_id,
  }
}

/** 用 access_token 拉用户信息（alipay.user.info.share） */
export async function getAlipayUserInfo(accessToken: string): Promise<AlipayUserInfo> {
  const bizContent = JSON.stringify({})
  const params: Record<string, string> = {
    app_id: env.ALIPAY_APP_ID ?? '',
    method: 'alipay.user.info.share',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayOAuthTimestamp(),
    version: '1.0',
    auth_token: accessToken,
    biz_content: bizContent,
  }
  params.sign = createSign('RSA-SHA256')
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&'),
      'utf-8',
    )
    .sign(getPrivateKey(), 'base64')
  const url = `${env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do'}?${new URLSearchParams(params).toString()}`
  const resp = await oauthFetch(url)
  if (!resp.ok) throw new Error(`Alipay user.info.share failed: ${resp.status}`)
  const data = (await resp.json()) as {
    alipay_user_info_share_response?: {
      user_id?: string
      open_id?: string
      union_id?: string
      nick_name?: string
      avatar?: string
      code?: string
      msg?: string
    }
  }
  const inner = data.alipay_user_info_share_response
  if (!inner || inner.code !== '10000') {
    throw new Error(`Alipay user.info.share: ${inner?.msg ?? inner?.code ?? 'failed'}`)
  }
  return {
    openId: inner.user_id ?? inner.open_id ?? '',
    unionId: inner.union_id,
    nick: inner.nick_name ?? '',
    avatar: inner.avatar ?? '',
  }
}

// 重新导出支付服务的 isAlipayConfigured 供业务复用
export { isAlipayPayConfigured }

// ============================================================================
// 飞书（Feishu / Lark）OAuth 登录
// 迁移自 v1.0.2-sealed: server/app/services/feishu_auth_service.py
// 密钥配置（.env）:
// - FEISHU_APP_ID / FEISHU_APP_SECRET
// 密钥留空时降级为 mock 模式（DEV）。
// ============================================================================

const FEISHU_OAUTH_URL = 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token'
const FEISHU_USER_INFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info'

export interface FeishuUserInfo {
  openId: string
  unionId?: string
  name: string
  avatar: string
  mobile?: string
}

export function isFeishuConfigured(): boolean {
  return Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET)
}

/** 用授权码 code 换 user_access_token（飞书 OIDC） */
export async function getFeishuAccessToken(code: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}> {
  const resp = await oauthFetch(FEISHU_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: env.FEISHU_APP_ID ?? '',
      client_secret: env.FEISHU_APP_SECRET ?? '',
      code,
    }),
  })
  if (!resp.ok) throw new Error(`Feishu token exchange failed: ${resp.status}`)
  const body = (await resp.json()) as {
    code?: number
    msg?: string
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (body.code !== 0 || !body.access_token) {
    throw new Error(`Feishu OAuth error: ${body.msg ?? body.code ?? 'no access_token'}`)
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
  }
}

/** 用 user_access_token 拉飞书用户信息 */
export async function getFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
  const resp = await oauthFetch(FEISHU_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
  if (!resp.ok) throw new Error(`Feishu userinfo failed: ${resp.status}`)
  const body = (await resp.json()) as {
    code?: number
    msg?: string
    data?: {
      open_id?: string
      union_id?: string
      name?: string
      avatar_url?: string
      mobile?: string
    }
  }
  if (body.code !== 0) {
    throw new Error(`Feishu userinfo error: ${body.msg ?? body.code ?? 'failed'}`)
  }
  const data = body.data ?? {}
  const openId = data.open_id ?? ''
  if (!openId) throw new Error('Feishu userinfo: missing open_id')
  return {
    openId,
    unionId: data.union_id,
    name: data.name ?? '',
    avatar: data.avatar_url ?? '',
    mobile: data.mobile,
  }
}

// ============================================================================
// 公共工具
// ============================================================================

/** 生成随机 state（CSRF 防护） */
export function generateState(): string {
  return randomBytes(16).toString('hex')
}

/** 生成授权码 code */
export function generateAuthCode(): string {
  return randomBytes(8).toString('hex')
}

/** 生成 client_id */
export function generateClientId(): string {
  return `zhs_${randomBytes(16).toString('hex')}`
}

/** 生成 client_secret */
export function generateClientSecret(): string {
  return randomBytes(32).toString('hex')
}

/** 生成用户 SK（sk- 前缀） */
export function generateUserSk(): string {
  return `sk-${randomBytes(24).toString('hex')}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
