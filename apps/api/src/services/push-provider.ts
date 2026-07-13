/**
 * 推送服务 provider 抽象层。
 *
 * 设计原则（按 AGENTS.md "做减法"）：
 * - 不引入 firebase-admin / 个推 SDK 等重型 npm 包
 * - 直接 HTTP 调用 FCM HTTP v1 API + 个推 REST API
 * - 无配置时降级为 stub（记录日志，不抛错），与 pdf-service / email-service 一致
 * - 单一 sendPush 入口，按 provider 字段分发
 *
 * 配置环境变量：
 * - FCM_PROJECT_ID: Firebase 项目 ID（启用 FCM 必填）
 * - FCM_SERVICE_ACCOUNT_KEY: Firebase 服务账号 JSON（base64 编码，启用 FCM 必填）
 * - GETUI_APP_ID / GETUI_APP_KEY / GETUI_MASTER_SECRET: 个推凭证（启用个推必填）
 */

import { env } from 'node:process'
import { createHash, randomUUID } from 'node:crypto'

// =============================================================================
// 类型定义
// =============================================================================

export type PushProvider = 'fcm' | 'getui' | 'stub'

export interface PushMessage {
  /** 推送标题 */
  title: string
  /** 推送正文 */
  body: string
  /** 点击跳转 URL（可选） */
  clickUrl?: string
  /** 业务自定义数据（可选） */
  data?: Record<string, unknown>
}

export interface PushTarget {
  /** FCM 的 device token，或个推的 client id */
  token: string
}

export interface PushResult {
  provider: PushProvider
  success: boolean
  messageId?: string
  error?: string
}

// =============================================================================
// Provider 检测
// =============================================================================

export function detectPushProvider(): PushProvider {
  if (env.FCM_PROJECT_ID && env.FCM_SERVICE_ACCOUNT_KEY) return 'fcm'
  if (env.GETUI_APP_ID && env.GETUI_APP_KEY && env.GETUI_MASTER_SECRET) return 'getui'
  return 'stub'
}

// =============================================================================
// FCM (Firebase Cloud Messaging) HTTP v1 API
// =============================================================================

interface FcmServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
}

let cachedFcmAccessToken: { token: string; expireAt: number } | null = null

function isBase64(s: string): boolean {
  try {
    return Buffer.from(s, 'base64').toString('base64') === s.trim()
  } catch {
    return false
  }
}

function decodeFcmServiceAccount(): FcmServiceAccount | null {
  const raw = env.FCM_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    const json = isBase64(raw) ? Buffer.from(raw, 'base64').toString('utf8') : raw
    return JSON.parse(json) as FcmServiceAccount
  } catch {
    return null
  }
}

/** 简易 JWT 签名（RS256），避免引入 jsonwebtoken 依赖。 */
async function signJwtRS256(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url').replace(/=/g, '')
  const input = `${enc(header)}.${enc(payload)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))
  return `${input}.${Buffer.from(sig).toString('base64url').replace(/=/g, '')}`
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = Buffer.from(b64, 'base64')
  return der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength)
}

async function getFcmAccessToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedFcmAccessToken && cachedFcmAccessToken.expireAt > now + 60000) {
    return cachedFcmAccessToken.token
  }
  const sa = decodeFcmServiceAccount()
  if (!sa) return null
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  }
  const jwt = await signJwtRS256(payload, sa.private_key)
  const resp = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt&assertion=${jwt}`,
  })
  if (!resp.ok) return null
  const data = (await resp.json()) as { access_token?: string }
  if (!data.access_token) return null
  cachedFcmAccessToken = {
    token: data.access_token,
    expireAt: now + 3600 * 1000,
  }
  return data.access_token
}

async function sendFcm(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const projectId = env.FCM_PROJECT_ID
  if (!projectId) {
    return { provider: 'fcm', success: false, error: 'FCM_PROJECT_ID 未配置' }
  }
  const accessToken = await getFcmAccessToken()
  if (!accessToken) {
    return { provider: 'fcm', success: false, error: 'FCM access token 获取失败' }
  }
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  const body = {
    message: {
      token: target.token,
      notification: { title: message.title, body: message.body },
      data: message.data ?? {},
      ...(message.clickUrl ? { webpush: { fcm_options: { link: message.clickUrl } } } : {}),
    },
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      return { provider: 'fcm', success: false, error: `FCM ${resp.status}: ${errText}` }
    }
    const data = (await resp.json()) as { name?: string }
    return { provider: 'fcm', success: true, messageId: data.name }
  } catch (e) {
    return { provider: 'fcm', success: false, error: (e as Error).message }
  }
}

// =============================================================================
// 个推 REST API
// =============================================================================

function signGetuiAuth(appKey: string, masterSecret: string, timestamp: string): string {
  return cryptoSha256(`${appKey}${timestamp}${masterSecret}`)
}

function cryptoSha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function getGetuiAuthToken(): Promise<string | null> {
  const appId = env.GETUI_APP_ID
  const appKey = env.GETUI_APP_KEY
  const masterSecret = env.GETUI_MASTER_SECRET
  if (!appId || !appKey || !masterSecret) return null
  const timestamp = String(Math.floor(Date.now() / 1000))
  const sign = signGetuiAuth(appKey, masterSecret, timestamp)
  const url = `https://restapi.getui.com/v2/${appId}/auth`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sign, timestamp, appkey: appKey }),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { data?: { token?: string } }
    return data.data?.token ?? null
  } catch {
    return null
  }
}

async function sendGetui(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const appId = env.GETUI_APP_ID
  if (!appId) {
    return { provider: 'getui', success: false, error: 'GETUI_APP_ID 未配置' }
  }
  const token = await getGetuiAuthToken()
  if (!token) {
    return { provider: 'getui', success: false, error: '个推 token 获取失败' }
  }
  const url = `https://restapi.getui.com/v2/${appId}/push/single/cid`
  const body = {
    request_id: randomUUID(),
    audience: { cid: [target.token] },
    push_message: {
      notification: {
        title: message.title,
        body: message.body,
        click_type: message.clickUrl ? 'url' : 'payload',
        url: message.clickUrl,
        payload: message.clickUrl ? undefined : JSON.stringify(message.data ?? {}),
      },
    },
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      return { provider: 'getui', success: false, error: `个推 ${resp.status}: ${errText}` }
    }
    const data = (await resp.json()) as { code?: number; msg?: string }
    if (data.code !== 10000) {
      return { provider: 'getui', success: false, error: data.msg ?? `个推错误码 ${data.code}` }
    }
    return { provider: 'getui', success: true, messageId: body.request_id }
  } catch (e) {
    return { provider: 'getui', success: false, error: (e as Error).message }
  }
}

// =============================================================================
// 统一入口
// =============================================================================

export async function sendPush(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const provider = detectPushProvider()
  if (provider === 'fcm') return sendFcm(target, message)
  if (provider === 'getui') return sendGetui(target, message)
  // stub
  console.info(`[push-stub] to=${target.token}, title=${message.title}, body=${message.body}`)
  return {
    provider: 'stub',
    success: true,
    messageId: `stub-${Date.now()}`,
  }
}

/** 批量推送（逐条调用，避免批量 API 差异）。 */
export async function sendPushBatch(
  targets: PushTarget[],
  message: PushMessage,
): Promise<PushResult[]> {
  return Promise.all(targets.map((t) => sendPush(t, message)))
}
