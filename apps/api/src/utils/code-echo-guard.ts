// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-192(2026-10-17):验证码明文回显的收敛闸 + 按「标识(手机号/邮箱)+ IP」的发送频控。
 *
 * 背景:2026-10-13 真机复验实测生产 `POST /api/auth/sms/send` 返回
 * `{"data":{"sent":true,"code":"355255",...}}` —— 知道手机号即可登录任意账号(账号接管级)。
 * 原判据是 `process.env.NODE_ENV !== 'production'`,部署链漏设 / 拼错 NODE_ENV 时
 * 会静默把验证码交给公网。
 *
 * 本模块做两件事:
 *  ① 回显判据收敛成三重「与」:显式调试开关 `AUTH_DEBUG_ECHO_CODE=1`
 *     + 显式 development 档(config.isDevelopmentRuntime,缺省 fail-safe 为 production)
 *     + 请求来自 loopback / 内网。缺一不可(默认不回显)。
 *  ② 在路由的 `preSerialization` 层再剥一次 `data.code` —— 回归锁钉在
 *     「响应体序列化不得带 code」这一层,改 handler 里的 if 位置绕不过去。
 */

import { BlockList, isIP } from 'node:net'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config/index.js'
import {
  incrWindow,
  refundWindows,
  resetCounters,
  windowRemainingMs,
  type WindowSpec,
} from './window-counter.js'
import { logger } from './logger.js'

// ---------------------------------------------------------------------------
// 内网 / loopback 判定
// ---------------------------------------------------------------------------

const INTERNAL_V4 = new BlockList()
INTERNAL_V4.addSubnet('127.0.0.0', 8, 'ipv4') // loopback
INTERNAL_V4.addSubnet('10.0.0.0', 8, 'ipv4') // RFC1918
INTERNAL_V4.addSubnet('172.16.0.0', 12, 'ipv4') // RFC1918
INTERNAL_V4.addSubnet('192.168.0.0', 16, 'ipv4') // RFC1918

const INTERNAL_V6 = new BlockList()
INTERNAL_V6.addAddress('::1', 'ipv6') // loopback
INTERNAL_V6.addSubnet('fc00::', 7, 'ipv6') // unique-local
INTERNAL_V6.addSubnet('fe80::', 10, 'ipv6') // link-local

/** 归一化 IP:去方括号 / 去 IPv6 zone / 拆 IPv4-mapped IPv6(`::ffff:127.0.0.1`)。 */
function normalizeIp(raw: string | undefined): string {
  if (!raw) return ''
  let ip = raw.trim()
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1)
  const zoneIdx = ip.indexOf('%')
  if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx)
  if (ip.startsWith('::ffff:')) {
    const v4 = ip.slice('::ffff:'.length)
    if (isIP(v4) === 4) return v4
  }
  return ip
}

/** 请求来源是否 loopback / 内网(无法判定的一律按「否」处理,fail-closed)。 */
export function isLoopbackOrInternalIp(raw: string | undefined): boolean {
  const ip = normalizeIp(raw)
  const family = isIP(ip)
  if (family === 4) return INTERNAL_V4.check(ip, 'ipv4')
  if (family === 6) return INTERNAL_V6.check(ip, 'ipv6')
  return false
}

// ---------------------------------------------------------------------------
// 回显判据
// ---------------------------------------------------------------------------

/**
 * 是否允许在响应体里回显验证码。
 *
 * 三重条件缺一不可:
 *  - `AUTH_DEBUG_ECHO_CODE=1`(显式开启,默认关);
 *  - 显式 development 档(未声明 / 声明表外的值一律按 production 处理);
 *  - 请求来自 loopback / 内网(公网请求即便前两条成立也不回显)。
 */
export function isCodeEchoAllowed(request: Pick<FastifyRequest, 'ip'>): boolean {
  if (process.env.AUTH_DEBUG_ECHO_CODE !== '1') return false
  const isDevRuntime = config.isDevelopmentRuntime ?? config.NODE_ENV === 'development'
  if (!isDevRuntime) return false
  return isLoopbackOrInternalIp(request.ip)
}

export interface SendCodePayload {
  sent: true
  expiresIn: number
  code?: string
}

/** 构造发码成功响应体:默认不带 `code`,只有回显判据全部成立时才带。 */
export function buildSendCodePayload(
  request: Pick<FastifyRequest, 'ip'>,
  code: string,
  expiresIn: number,
): SendCodePayload {
  return isCodeEchoAllowed(request) ? { sent: true, code, expiresIn } : { sent: true, expiresIn }
}

/**
 * 序列化前的兜底剥离:回显判据不成立时,把 `data.code` 从响应体里摘掉。
 * 即便将来有人在 handler 里写回了 `code`,这一层仍然拦得住。
 */
export function stripCodeFromSendCodeResponse<T>(
  request: Pick<FastifyRequest, 'ip'>,
  payload: T,
): T {
  if (isCodeEchoAllowed(request)) return payload
  if (payload === null || typeof payload !== 'object') return payload
  const body = payload as Record<string, unknown>
  const data = body.data
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return payload
  const record = data as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(record, 'code')) return payload
  const rest = { ...record }
  delete rest.code
  return { ...body, data: rest } as T
}

/** 挂到路由 `preSerialization` 的适配器(签名对齐 Fastify 生命周期钩子)。 */
export function sendCodePreSerialization(
  request: FastifyRequest,
  _reply: FastifyReply,
  payload: unknown,
  done: (err: Error | null, payload?: unknown) => void,
): void {
  try {
    done(null, stripCodeFromSendCodeResponse(request, payload))
  } catch (err) {
    done(err as Error)
  }
}

// ---------------------------------------------------------------------------
// 按「IP」「标识」两把独立计数的发送频控与告警
// ---------------------------------------------------------------------------

/** 同一 IP、同一标识各自在窗口内最多允许 5 次取码(与既有 60 秒重发间隔叠加生效)。 */
export const SEND_QUOTA_MAX_ATTEMPTS = 5
/** 统计窗口:10 分钟。 */
export const SEND_QUOTA_WINDOW_MS = 10 * 60 * 1000
/** 窗口内被拦 N 次后告警一次(避免刷日志)。 */
export const SEND_ALERT_AFTER_BLOCKS = 3

export interface SendQuotaResult {
  allowed: boolean
  /** 被拦时建议的重试等待秒数(用于 Retry-After)。 */
  retryAfterSec: number
}

/** 两把**独立**计数键。
 *
 * F-287:过去这里是联合键 `echo:q:<identifier>|<ip>`,换个号码就得到一份全新计数 ——
 * 「同一 IP 反复换号」这条路径实际上没有任何闸(10 分钟可放大到约 50 次/IP)。
 * 现在拆成 IP 维度与标识维度各记各的账,**任一**超限即拒:
 *   - 换 identifier 绕不过 `echo:q:ip:<ip>`;
 *   - 换 IP 绕不过 `echo:q:id:<identifier>`。
 * 某一维度缺值(拿不到 IP / 空标识)时该维度不计数,避免所有缺值请求挤进同一个桶互相压制。
 */
function codeQuotaKeys(
  identifier: string,
  ip: string | undefined,
): { ipKey: string | null; idKey: string | null } {
  const normalizedIp = normalizeIp(ip)
  return {
    ipKey: normalizedIp ? `echo:q:ip:${normalizedIp}` : null,
    idKey: identifier ? `echo:q:id:${identifier}` : null,
  }
}

/**
 * 消耗一次取码配额。计数覆盖「取码尝试」而非仅「成功发码」——
 * 否则攻击者可以靠 60 秒重发间隔之外的失败尝试白嫖配额。
 *
 * 2026-10-22 迁到共享窗口计数:原来这张 Map 住在进程内,**一次部署就把 5 次/10 分钟的预算清零**。
 * 窗口与告警节流都交给 utils/window-counter。TTL 语义未变:两键同为 10 分钟、从各自首次命中起算。
 */
export async function consumeSendQuota(
  identifier: string,
  ip: string | undefined,
): Promise<SendQuotaResult> {
  const { ipKey, idKey } = codeQuotaKeys(identifier, ip)
  const dimensions: Array<{ dim: 'ip' | 'id'; key: string; attempts: number }> = []
  if (ipKey) {
    const attempts = await incrWindow(ipKey, SEND_QUOTA_WINDOW_MS)
    dimensions.push({ dim: 'ip', key: ipKey, attempts })
  }
  if (idKey) {
    const attempts = await incrWindow(idKey, SEND_QUOTA_WINDOW_MS)
    dimensions.push({ dim: 'id', key: idKey, attempts })
  }

  const exceeded = dimensions.filter((d) => d.attempts > SEND_QUOTA_MAX_ATTEMPTS)
  if (exceeded.length === 0) {
    return { allowed: true, retryAfterSec: 0 }
  }

  // 恰好落在第 N 次拦截那一下才告警:比原来的 alerted 布尔更省一个键,且每窗口只响一次
  const blocked = exceeded[0]!
  const blocks = await incrWindow(blocked.key.replace('echo:q:', 'echo:block:'), SEND_QUOTA_WINDOW_MS)
  if (blocks === SEND_ALERT_AFTER_BLOCKS) {
    logger.warn('验证码发送频控触发:同一 IP / 同一标识在窗口内反复取码', {
      identifier,
      ip: normalizeIp(ip),
      dimensions: exceeded.map((d) => d.dim),
      attempts: Math.max(...exceeded.map((d) => d.attempts)),
      windowMinutes: SEND_QUOTA_WINDOW_MS / 60_000,
    })
  }

  // 两维同时超限时按更晚到期的那个给 Retry-After,避免让客户端提前重试后再被另一维挡一次
  let remainingMs = 0
  for (const d of exceeded) {
    remainingMs = Math.max(remainingMs, await windowRemainingMs(d.key, SEND_QUOTA_WINDOW_MS))
  }
  return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)) }
}

/** 退还一次已消费的取码配额(投递失败时用):没发出去就不该占用「5 次/10 分钟」的预算,
 *  否则云侧故障一次,用户既收不到码也立刻重试不了。
 *  F-287:消费了几把键就退几把 —— 只退其中一把会留下「IP 已放行、标识仍被扣」的错账。 */
export async function refundSendQuota(
  identifier: string,
  ip: string | undefined,
): Promise<void> {
  const { ipKey, idKey } = codeQuotaKeys(identifier, ip)
  const specs: WindowSpec[] = []
  if (ipKey) {
    specs.push({ key: ipKey, windowMs: SEND_QUOTA_WINDOW_MS, max: SEND_QUOTA_MAX_ATTEMPTS })
  }
  if (idKey) {
    specs.push({ key: idKey, windowMs: SEND_QUOTA_WINDOW_MS, max: SEND_QUOTA_MAX_ATTEMPTS })
  }
  await refundWindows(specs)
}

/** 测试用:清空频控计数。计数已搬到共享存储,所以必须**内存与 Redis 两面一起清** ——
 *  只清内存的话,上一用例留下的 `echo:*` 计数会串进下一用例,表现为"配额测试偶发红"。 */
export async function resetSendQuotaForTests(): Promise<void> {
  await resetCounters(['echo:'])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
