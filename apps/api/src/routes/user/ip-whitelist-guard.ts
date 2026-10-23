// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号级 IP 白名单的**生效链唯一出口** —— 只拦"新登录会话"，不碰续期。
 *
 * 为什么守卫必须站在"凭据已验证之后、签发之前"这一格：
 * 白名单判的是"这次会话能不能建立"，签发出去就收不回（先签后拒等于把会话发出去了）。
 *
 * 判定输入只有两样，且都不来自客户端可写字段：
 *   - 来源 IP = `request.ip`（Fastify 按 server.ts 的 TRUSTED_PROXIES 白名单解出，
 *     裸读 X-Forwarded-For 会绕过该判据，见 services/security-service.ts 头注同条纪律）
 *   - 主体 = 承载层显式传入的 `userId`（刚验证过凭据的那个账号）
 * 客户端在 body/query/header 里自报的 userId / ip 一律不参与判定。
 *
 * 空表 = 未启用（用户视角的真实语义，不是"全拦"），因此不存在新开关键：
 * 没写过白名单的账号走这条链恒定放行。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  findUserPreferences,
  upsertUserPreference,
  USER_PREFERENCE_GROUPS,
} from '../../db/user-preferences-queries.js'
import { recordSecurityEvent } from '../../db/security-logs-queries.js'
import { error } from '../../utils/response.js'

const GROUP = USER_PREFERENCE_GROUPS.security

export const IP_WHITELIST_KEY = 'ipWhitelist'
/** 自救出口：最后一次修改白名单时的来源 IP —— 否则用户在错误网络上清空白名单会被永久锁死 */
const IP_WHITELIST_TRUSTED_IP_KEY = 'ipWhitelistTrustedIp'

const LOGIN_BLOCKED_BY_IP_ALLOWLIST = 'login_blocked_by_ip_allowlist'

/** 与 web settings/security-log 的 ABNORMAL_EVENTS 同名单；改名必须同批改那一处。 */
export function isIpLiteral(value: string): boolean {
  return z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success
}

/**
 * 字面量归一化：`::1` 与 `0:0:0:0:0:0:0:1` 必须判等，`::ffff:127.0.0.1` 与
 * `127.0.0.1` 必须判等（双栈 socket 上 request.ip 实测就是后者形态）。
 * 非字面量（含 CIDR、zone id、坏段）返回 null —— 调用方按"量不出来源"处理。
 */
export function normalizeIpLiteral(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return null
  if (z.ipv4().safeParse(value).success) return value
  if (!value.includes(':')) return null
  const halves = value.split('::')
  if (halves.length > 2) return null
  const headText = halves[0] ?? ''
  const tailText = halves.length === 2 ? (halves[1] ?? '') : ''
  const headLen = headText ? headText.split(':').length : 0
  const segments = [
    ...(headText ? headText.split(':') : []),
    ...(tailText ? tailText.split(':') : []),
  ]
  const groups: number[] = []
  for (const seg of segments) {
    if (seg.includes('.')) {
      if (!z.ipv4().safeParse(seg).success) return null
      const octets = seg.split('.').map((x) => Number(x))
      groups.push((octets[0]! << 8) + octets[1]!, (octets[2]! << 8) + octets[3]!)
    } else {
      if (!/^[0-9a-f]{1,4}$/.test(seg)) return null
      groups.push(Number.parseInt(seg, 16))
    }
  }
  const missing = 8 - groups.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const full = [
    ...groups.slice(0, headLen),
    ...new Array<number>(missing).fill(0),
    ...groups.slice(headLen),
  ]
  // v4-mapped(::ffff:a.b.c.d)折回 v4 字面量，否则双栈 socket 的 request.ip 永远对不上表
  if (full[5] === 0xffff && full.slice(0, 5).every((g) => g === 0)) {
    const hi = full[6]!
    const lo = full[7]!
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
  }
  return full.map((g) => g.toString(16)).join(':')
}

/** 存储面取值口径：坏行不把读面打碎，写面仍会整体覆盖。 */
export async function readIpWhitelist(userId: string): Promise<string[]> {
  const { list } = await findUserPreferences(userId, GROUP)
  const raw = list.find((row) => row.key === IP_WHITELIST_KEY)?.value
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function readIpWhitelistTrustedIp(userId: string): Promise<string | null> {
  const { list } = await findUserPreferences(userId, GROUP)
  const raw = list.find((row) => row.key === IP_WHITELIST_TRUSTED_IP_KEY)?.value
  const normalized = normalizeIpLiteral(raw)
  // 存行坏了不能把自救出口判成"有另一个 IP"，宁可没有自救位（失败关闭）
  return raw && !normalized ? null : normalized
}

/** POST/DELETE 成功后都要刷这个键 —— 修改动作本身即"这台 IP 有权限改白名单"的证据。 */
export async function recordIpWhitelistChangeSourceIp(
  userId: string,
  ip: string | null | undefined,
): Promise<void> {
  const normalized = normalizeIpLiteral(ip)
  if (!normalized) return
  await upsertUserPreference(userId, GROUP, IP_WHITELIST_TRUSTED_IP_KEY, normalized)
}

export type LoginIpDecision =
  | { allowed: true; via: 'not-configured' | 'allowlist' | 'trusted-ip' }
  | { allowed: false; whitelistSize: number }

export async function evaluateLoginIpWhitelist(params: {
  request: { ip: string }
  userId: string
}): Promise<LoginIpDecision> {
  const whitelist = await readIpWhitelist(params.userId)
  if (whitelist.length === 0) return { allowed: true, via: 'not-configured' }
  const source = normalizeIpLiteral(params.request.ip)
  if (!source) return { allowed: false, whitelistSize: whitelist.length }
  if (whitelist.some((entry) => normalizeIpLiteral(entry) === source)) {
    return { allowed: true, via: 'allowlist' }
  }
  const trusted = await readIpWhitelistTrustedIp(params.userId)
  if (trusted && trusted === source) return { allowed: true, via: 'trusted-ip' }
  return { allowed: false, whitelistSize: whitelist.length }
}

export type LoginIpGate = { allowed: true } | { allowed: false; reply: FastifyReply }

/**
 * 登录腿的统一闸门：放行返回 `{allowed:true}`，拒绝时**就地回 403 并落一条安全事件**。
 * 调用方必须写成 `if (!gate.allowed) return gate.reply`，保证拒绝路径上没有任何签发。
 *
 * 认证不等于授权：这里 request.userId 在登录前恒为空（checkAuth 还没跑），
 * 而事件表 user_id notNull —— 主体只能由承载层把"刚验证过凭据的那个 userId"显式传进来，
 * 既不能从被操作记录反推，也不能信客户端自报。文案不含白名单内容与任何 IP。
 */
export async function gateLoginIpWhitelist(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
): Promise<LoginIpGate> {
  const decision = await evaluateLoginIpWhitelist({ request, userId })
  if (decision.allowed) return { allowed: true }
  await recordSecurityEvent(
    request,
    LOGIN_BLOCKED_BY_IP_ALLOWLIST,
    { reason: 'ip_not_in_allowlist', allowlistSize: decision.whitelistSize },
    { principalUserId: userId },
  )
  const blocked = reply
    .status(403)
    .send(error(403, '当前网络不在该账号的登录 IP 白名单内，请切换网络后再试'))
  return { allowed: false, reply: blocked }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
