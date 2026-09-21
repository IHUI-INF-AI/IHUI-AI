// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { relayErrorPassthroughRules, type RelayErrorPassthroughRule } from '@ihui/database'
import { logger } from '../utils/logger.js'

/**
 * 上游错误透传服务(2026-09-16 立,五轮补强,对标竞品 /error-passthrough-rules)。
 *
 * 职责:
 * 1. CRUD(管理端配置规则)
 * 2. resolveErrorPassthrough(upstreamStatus, upstreamMessage) — 按规则把上游错误
 *    翻译为下游可理解的 { status, message };无命中返回默认(502 + 通用文案)。
 *
 * 匹配顺序:upstreamStatus 精确相等 → keyword 为空或命中上游消息(不区分大小写)
 * → 按 priority 降序取首条启用规则。
 * 模板:{upstream} 占位符替换为上游原始消息;exposeUpstreamMessage=true 时追加原文。
 * 异常按"无规则"处理(返回默认),不因配置查询失败影响错误返回。
 */

/** 网关 error() 支持的状态码集合(response.ts 的字面量联合,勿随意扩充) */
export type SupportedErrorStatus = 200 | 400 | 401 | 404 | 502 | 503
const SUPPORTED: readonly number[] = [200, 400, 401, 404, 502, 503]

/** 规则里配置的下游状态码若不在网关支持集合内,兜底为 502(避免调用方 TS/运行时报错) */
function toSupported(status: number): SupportedErrorStatus {
  return SUPPORTED.includes(status) ? (status as SupportedErrorStatus) : 502
}

export interface ResolvedErrorPassthrough {
  status: SupportedErrorStatus
  message: string
  /** 命中的规则 id(未命中为 null,便于排障/埋点) */
  ruleId: string | null
}

const DEFAULT_STATUS: SupportedErrorStatus = 502
const DEFAULT_MESSAGE = 'AI service error'

export async function listErrorPassthroughRules(): Promise<RelayErrorPassthroughRule[]> {
  const rows = await dbRead
    .select()
    .from(relayErrorPassthroughRules)
    .orderBy(desc(relayErrorPassthroughRules.priority))
  return rows as RelayErrorPassthroughRule[]
}

export async function createErrorPassthroughRule(input: {
  upstreamStatus: number
  keyword?: string | null
  downstreamStatus: number
  messageTemplate: string
  exposeUpstreamMessage?: boolean
  priority?: number
  enabled?: boolean
  remark?: string | null
}): Promise<RelayErrorPassthroughRule> {
  const [row] = await db
    .insert(relayErrorPassthroughRules)
    .values({
      upstreamStatus: input.upstreamStatus,
      keyword: input.keyword ?? null,
      downstreamStatus: input.downstreamStatus,
      messageTemplate: input.messageTemplate,
      exposeUpstreamMessage: input.exposeUpstreamMessage ?? false,
      priority: input.priority ?? 0,
      enabled: input.enabled ?? true,
      remark: input.remark ?? null,
    })
    .returning()
  return row as RelayErrorPassthroughRule
}

export async function updateErrorPassthroughRule(
  id: string,
  patch: Partial<{
    upstreamStatus: number
    keyword: string | null
    downstreamStatus: number
    messageTemplate: string
    exposeUpstreamMessage: boolean
    priority: number
    enabled: boolean
    remark: string | null
  }>,
): Promise<RelayErrorPassthroughRule | null> {
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.upstreamStatus !== undefined) setData.upstreamStatus = patch.upstreamStatus
  if (patch.keyword !== undefined) setData.keyword = patch.keyword
  if (patch.downstreamStatus !== undefined) setData.downstreamStatus = patch.downstreamStatus
  if (patch.messageTemplate !== undefined) setData.messageTemplate = patch.messageTemplate
  if (patch.exposeUpstreamMessage !== undefined) {
    setData.exposeUpstreamMessage = patch.exposeUpstreamMessage
  }
  if (patch.priority !== undefined) setData.priority = patch.priority
  if (patch.enabled !== undefined) setData.enabled = patch.enabled
  if (patch.remark !== undefined) setData.remark = patch.remark
  const [row] = await db
    .update(relayErrorPassthroughRules)
    .set(setData)
    .where(eq(relayErrorPassthroughRules.id, id))
    .returning()
  return (row as RelayErrorPassthroughRule) ?? null
}

export async function deleteErrorPassthroughRule(id: string): Promise<boolean> {
  const rows = await db
    .delete(relayErrorPassthroughRules)
    .where(eq(relayErrorPassthroughRules.id, id))
    .returning({ id: relayErrorPassthroughRules.id })
  return rows.length > 0
}

/**
 * 翻译上游错误为下游响应。
 * 未命中任何规则时返回默认 502 + 'AI service error'(与既有行为一致,零破坏)。
 */
export async function resolveErrorPassthrough(
  upstreamStatus: number,
  upstreamMessage?: string | null,
): Promise<ResolvedErrorPassthrough> {
  const raw = (upstreamMessage ?? '').trim()
  try {
    const rows = await dbRead
      .select()
      .from(relayErrorPassthroughRules)
      .where(
        and(
          eq(relayErrorPassthroughRules.enabled, true),
          eq(relayErrorPassthroughRules.upstreamStatus, upstreamStatus),
        ),
      )
      .orderBy(desc(relayErrorPassthroughRules.priority))

    const matched = rows.find((r) => {
      const kw = (r.keyword ?? '').trim()
      if (kw === '') return true
      return raw.toLowerCase().includes(kw.toLowerCase())
    })
    if (!matched) return { status: DEFAULT_STATUS, message: raw || DEFAULT_MESSAGE, ruleId: null }

    const rendered = matched.messageTemplate.replace(/\{upstream\}/g, raw || DEFAULT_MESSAGE)
    const message =
      matched.exposeUpstreamMessage && raw && !rendered.includes(raw)
        ? `${rendered}(${raw})`
        : rendered
    return {
      status: toSupported(matched.downstreamStatus),
      message,
      ruleId: matched.id,
    }
  } catch (e) {
    logger.warn('[error-passthrough] 规则查询失败,按默认返回', {
      upstreamStatus,
      err: e instanceof Error ? e.message : String(e),
    })
    return { status: DEFAULT_STATUS, message: raw || DEFAULT_MESSAGE, ruleId: null }
  }
}

/** 管理端:规则命中统计(按状态码分组的规则数,便于检查覆盖度)。 */
export async function countRulesByStatus(): Promise<
  Array<{ upstreamStatus: number; count: number }>
> {
  const rows = await dbRead
    .select({
      upstreamStatus: relayErrorPassthroughRules.upstreamStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(relayErrorPassthroughRules)
    .groupBy(relayErrorPassthroughRules.upstreamStatus)
  return rows.map((r) => ({ upstreamStatus: r.upstreamStatus, count: Number(r.count) }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
