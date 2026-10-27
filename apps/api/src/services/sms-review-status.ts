// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 腾讯云短信「模板 / 签名」审核状态(DescribeSmsTemplateList / DescribeSmsSignList)。
 *
 * 为什么要在后台里查:模板 ID 写进 env 只代表"我们提交过这一枚",
 * 不代表腾讯侧已过审 —— 未过审的模板发送时会被云侧拒掉,运营却只能看到一行
 * `tencent_rejected:...`,还要回控制台翻审核意见。这里把审核状态直接并进运营页。
 *
 * 边界:
 *  - 纯查询,不改变任何发送行为;查不到一律 `unknown`,绝不默认"已通过"。
 *  - 审核意见是腾讯侧自由文本,只在管理员接口里展示(截断 200 字),不进发送链路的 reason。
 *  - 5 分钟进程内缓存:运营页刷新不至于每开一次就打一发云 API;失败只缓存 60 秒。
 */
import { env } from 'node:process'
import { TencentTc3AuthStrategy } from './vendor-auth-strategies.js'
import { logger } from '../utils/logger.js'

const HOST = 'sms.tencentcloudapi.com'
const SERVICE = 'sms'
const VERSION = '2021-01-11'
const DEFAULT_REGION = 'ap-guangzhou'
const REQUEST_TIMEOUT_MS = 8_000

const CACHE_TTL_MS = 5 * 60_000
const FAIL_CACHE_TTL_MS = 60_000
const REPLY_MAX_LEN = 200

const tc3 = new TencentTc3AuthStrategy()

export type SmsReviewStatus = 'approved' | 'pending' | 'rejected' | 'unknown'

export interface SmsReviewInfo {
  status: SmsReviewStatus
  /** 腾讯侧审核意见(已截断)。可能为空。 */
  reply?: string
  /** 云侧更新时间(ISO),没有则缺省。 */
  updatedAt?: string
}

export interface SmsReviewResult {
  /** 是否真的拿到了云侧响应。false 时 byId 里的 status 一律 unknown。 */
  available: boolean
  checkedAt: string | null
  byId: Record<string, SmsReviewInfo>
  /** 机器可读的错误码(不含云侧原文) */
  errorCode?: string
}

interface CacheEntry {
  expiresAt: number
  result: SmsReviewResult
}

const cache = new Map<string, CacheEntry>()

/** 腾讯状态码 → 审核状态闭集:0 已通过生效、2 通过待生效、1 审核中、-1 未通过。
 *  其余值一律 unknown —— 新增状态码时宁可显示未知,也不能猜成已通过。 */
export function reviewStatusFromCode(code: unknown): SmsReviewStatus {
  if (code === 0 || code === 2) return 'approved'
  if (code === 1) return 'pending'
  if (code === -1) return 'rejected'
  return 'unknown'
}

function trimReply(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  return t ? t.slice(0, REPLY_MAX_LEN) : undefined
}

function secondsToIso(v: unknown): string | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return new Date(n * 1000).toISOString()
}

interface RawReviewEntry {
  TemplateId?: unknown
  SignId?: unknown
  StatusCode?: unknown
  ReviewReply?: unknown
  UpdateTime?: unknown
}

function parseEntries(
  raw: unknown,
  listKey: 'DescribeTemplateStatusSet' | 'DescribeSignListStatusSet',
  idKey: 'TemplateId' | 'SignId',
): Record<string, SmsReviewInfo> {
  const resp = (raw as { Response?: Record<string, unknown> } | null | undefined)?.Response
  const list = resp?.[listKey]
  if (!Array.isArray(list)) return {}
  const out: Record<string, SmsReviewInfo> = {}
  for (const item of list) {
    const e = item as RawReviewEntry | null
    const id = e?.[idKey]
    if (id === undefined || id === null) continue
    const key = String(id)
    out[key] = {
      status: reviewStatusFromCode(e?.StatusCode),
      reply: trimReply(e?.ReviewReply),
      updatedAt: secondsToIso(e?.UpdateTime),
    }
  }
  return out
}

/** 模板列表响应 → { 模板ID: 审核信息 }。导出为纯函数,便于用固定响应钉住字段名。
 *  注意列表键是 `DescribeTemplateStatusSet`(不是 `DescribeTemplateListStatusSet`)——
 *  2026-10-26 对真 API 实测确认,签名侧才是 `DescribeSignListStatusSet`。 */
export function parseTemplateReview(raw: unknown): Record<string, SmsReviewInfo> {
  return parseEntries(raw, 'DescribeTemplateStatusSet', 'TemplateId')
}

/** 签名列表响应 → { 签名ID: 审核信息 }。 */
export function parseSignReview(raw: unknown): Record<string, SmsReviewInfo> {
  return parseEntries(raw, 'DescribeSignListStatusSet', 'SignId')
}

export function isTencentReviewQueryConfigured(): boolean {
  return Boolean(env.TENCENT_SMS_SECRET_ID && env.TENCENT_SMS_SECRET_KEY)
}

function unavailable(errorCode: string): SmsReviewResult {
  return {
    available: false,
    checkedAt: null,
    byId: {},
    errorCode,
  }
}

async function callTencent(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const signed = tc3.buildHeaders(
    { key: env.TENCENT_SMS_SECRET_ID, secret: env.TENCENT_SMS_SECRET_KEY },
    {
      method: 'POST',
      url: `https://${HOST}/`,
      body: payload,
      config: {
        service: SERVICE,
        host: HOST,
        version: VERSION,
        region: env.TENCENT_SMS_REGION || DEFAULT_REGION,
        action,
      },
    },
  )
  const res = await fetch(`https://${HOST}/`, {
    method: 'POST',
    headers: signed.headers,
    body: signed.body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return res.json().catch(() => null)
}

function responseErrorCode(raw: unknown): string | undefined {
  const err = (raw as { Response?: { Error?: { Code?: unknown } } } | null | undefined)?.Response
    ?.Error
  return typeof err?.Code === 'string' ? err.Code : undefined
}

async function query(
  key: string,
  ids: string[],
  action: string,
  idField: 'TemplateIdSet' | 'SignIdSet',
  parse: (raw: unknown) => Record<string, SmsReviewInfo>,
  force: boolean,
): Promise<SmsReviewResult> {
  const cleanIds = [...new Set(ids.map((v) => Number(v)).filter(Number.isFinite))]
  if (cleanIds.length === 0) return unavailable('no_ids')

  const cacheKey = `${key}:${cleanIds.sort((a, b) => a - b).join(',')}`
  const hit = cache.get(cacheKey)
  if (!force && hit && hit.expiresAt > Date.now()) return hit.result

  if (!isTencentReviewQueryConfigured())
    return unavailable('not_configured: TENCENT_SMS_SECRET_ID/KEY')

  try {
    const raw = await callTencent(action, { [idField]: cleanIds, International: 0 })
    const errorCode = responseErrorCode(raw)
    if (errorCode) {
      logger.warn('腾讯云短信审核状态查询被拒', { action, errorCode })
      const result = unavailable(errorCode)
      cache.set(cacheKey, { expiresAt: Date.now() + FAIL_CACHE_TTL_MS, result })
      return result
    }
    const byId = parse(raw)
    const result: SmsReviewResult = {
      available: true,
      checkedAt: new Date().toISOString(),
      byId,
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result })
    return result
  } catch (e) {
    const code = (e as { name?: unknown })?.name
    const errorCode = typeof code === 'string' ? code : 'unknown'
    logger.warn('腾讯云短信审核状态查询异常', { action, errorCode })
    const result = unavailable(errorCode)
    cache.set(cacheKey, { expiresAt: Date.now() + FAIL_CACHE_TTL_MS, result })
    return result
  }
}

export function getTencentTemplateReview(
  ids: string[],
  opts?: { force?: boolean },
): Promise<SmsReviewResult> {
  return query(
    'template',
    ids,
    'DescribeSmsTemplateList',
    'TemplateIdSet',
    parseTemplateReview,
    opts?.force === true,
  )
}

export function getTencentSignReview(
  ids: string[],
  opts?: { force?: boolean },
): Promise<SmsReviewResult> {
  return query('sign', ids, 'DescribeSmsSignList', 'SignIdSet', parseSignReview, opts?.force === true)
}

/** 测试出口(§22c):解析器与状态码映射是"错了会把未过审显示成已生效"的静默判据。 */
export const __test__ = {
  reviewStatusFromCode,
  trimReply,
  secondsToIso,
  parseTemplateReview,
  parseSignReview,
}
