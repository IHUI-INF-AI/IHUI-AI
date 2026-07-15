/**
 * OAuth 第三方登录服务。
 * 支持 Google / 微信小程序 / 企业微信（WeCom suite）/ 钉钉（DingTalk）。
 * 密钥配置留空时降级为 mock 模式（DEV）。
 *
 * 密钥配置（.env）:
 * - GOOGLE_APP_ID / GOOGLE_ANDROID_ID / GOOGLE_SECRET / GOOGLE_PC_REDIRECT_URI
 * - WX_MINI_APPID / WX_MINI_SECRET
 * - WECOM_SECRET (suite_secret) / WECOM_SUITE_ID
 * - DINGTALK_APP_KEY / DINGTALK_APP_SECRET / DINGTALK_REDIRECT_URI
 */

import { env } from 'node:process'
import { randomBytes } from 'node:crypto'

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

/** 用 code 换 id_token → 校验 aud → 返回用户信息 */
export async function exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_APP_ID ?? '',
      client_secret: env.GOOGLE_SECRET ?? '',
      redirect_uri: env.GOOGLE_PC_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenResp.ok) throw new Error(`Google token exchange failed: ${tokenResp.status}`)
  const tokenData = (await tokenResp.json()) as { id_token: string }
  const idToken = tokenData.id_token
  return verifyGoogleIdToken(idToken)
}

/** 校验 id_token → 返回用户信息 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const resp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  )
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
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Wechat jscode2session failed: ${resp.status}`)
  const data = (await resp.json()) as { openid: string; unionid: string; session_key: string }
  return { openId: data.openid, unionId: data.unionid, sessionKey: data.session_key }
}

/** 获取手机号（getuserphonenumber） */
export async function getPhoneNumber(code: string): Promise<string> {
  const accessToken = await getAccessToken()
  const resp = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    },
  )
  if (!resp.ok) throw new Error(`Wechat getuserphonenumber failed: ${resp.status}`)
  const data = (await resp.json()) as { phone_info: { phoneNumber: string } }
  return data.phone_info.phoneNumber
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.token
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WX_MINI_APPID}&secret=${env.WX_MINI_SECRET}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Wechat gettoken failed: ${resp.status}`)
  const data = (await resp.json()) as { access_token: string; expires_in: number }
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 200) * 1000,
  }
  return data.access_token
}

/** 生成小程序无限码 */
export async function generateQrcode(scene: string, page: string): Promise<Buffer> {
  const accessToken = await getAccessToken()
  const resp = await fetch(
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
// 企业微信（WeCom suite）
// ============================================================================

export interface WecomSession {
  userId: string
  sessionKey: string
  openUserId: string
  corpId: string
}

export function isWecomConfigured(): boolean {
  return Boolean(env.WECOM_SECRET && env.WECOM_SUITE_ID)
}

/** 获取 suite_access_token */
export async function getSuiteAccessToken(): Promise<string> {
  const suiteTicket = env.WECOM_SUITE_TICKET ?? ''
  const resp = await fetch('https://qyapi.weixin.qq.com/cgi-bin/service/get_suite_token', {
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

/** code2session（企业微信小程序） */
export async function wecomCode2session(code: string): Promise<WecomSession> {
  const token = await getSuiteAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/service/miniprogram/jscode2session?suite_access_token=${token}&js_code=${code}&grant_type=authorization_code`
  const resp = await fetch(url)
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
  const resp = await fetch('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
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
  const resp = await fetch('https://api.dingtalk.com/v1.0/contact/users/me', {
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
import { readFileSync } from 'node:fs'
import { isAlipayConfigured as isAlipayPayConfigured } from './alipay.js'

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

function getPrivateKey(): string {
  if (env.ALIPAY_PRIVATE_KEY) return env.ALIPAY_PRIVATE_KEY
  if (env.ALIPAY_PRIVATE_KEY_PATH) return readFileSync(env.ALIPAY_PRIVATE_KEY_PATH, 'utf-8')
  return ''
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
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
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
  const resp = await fetch(url)
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
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
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
  const resp = await fetch(url)
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
