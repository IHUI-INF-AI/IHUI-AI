// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  relayPromptAuditRules,
  relayPromptAuditHits,
  type RelayPromptAuditRule,
  type RelayPromptAuditHit,
} from '@ihui/database'
import { logger } from '../utils/logger.js'

/**
 * 提示词审计服务(2026-09-17 立,补强 54,对标竞品 /prompt-audit)。
 *
 * 职责:
 * 1. CRUD(管理端配置关键字规则)
 * 2. auditPrompt(text, ctx) — 入站提示词风险检测,返回:
 *    { action: 'pass'|'warn'|'block', hits: [...命中规则] },并落命中记录
 *
 * 安全设计:
 * - **仅关键字子串匹配**(大小写不敏感),不支持正则 → 规避 ReDoS;
 * - 匹配前截断文本(默认前 8000 字符),防止超大输入拖慢链路;
 * - 命中记录写库失败不影响调用结果(fire-and-forget + catch);
 * - 规则查询异常按"无规则"处理(放行),保证审计不阻断业务。
 */
export type PromptAuditAction = 'pass' | 'warn' | 'block'

export interface PromptAuditHit {
  ruleId: string
  ruleName: string
  keyword: string
  action: 'log' | 'warn' | 'block'
  severity: number
}

export interface PromptAuditResult {
  action: PromptAuditAction
  hits: PromptAuditHit[]
}

const MAX_SCAN_CHARS = 8000
const SNIPPET_CONTEXT_CHARS = 60

export async function listPromptAuditRules(): Promise<RelayPromptAuditRule[]> {
  const rows = await dbRead
    .select()
    .from(relayPromptAuditRules)
    .orderBy(desc(relayPromptAuditRules.severity))
  return rows as RelayPromptAuditRule[]
}

export async function createPromptAuditRule(input: {
  name: string
  keyword: string
  action: 'log' | 'warn' | 'block'
  severity?: number
  enabled?: boolean
  remark?: string | null
}): Promise<RelayPromptAuditRule> {
  const [row] = await db
    .insert(relayPromptAuditRules)
    .values({
      name: input.name.trim(),
      keyword: input.keyword.trim(),
      action: input.action,
      severity: input.severity ?? 3,
      enabled: input.enabled ?? true,
      remark: input.remark ?? null,
    })
    .returning()
  return row as RelayPromptAuditRule
}

export async function updatePromptAuditRule(
  id: string,
  patch: Partial<{
    name: string
    keyword: string
    action: 'log' | 'warn' | 'block'
    severity: number
    enabled: boolean
    remark: string | null
  }>,
): Promise<RelayPromptAuditRule | null> {
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) setData.name = patch.name.trim()
  if (patch.keyword !== undefined) setData.keyword = patch.keyword.trim()
  if (patch.action !== undefined) setData.action = patch.action
  if (patch.severity !== undefined) setData.severity = patch.severity
  if (patch.enabled !== undefined) setData.enabled = patch.enabled
  if (patch.remark !== undefined) setData.remark = patch.remark
  const [row] = await db
    .update(relayPromptAuditRules)
    .set(setData)
    .where(eq(relayPromptAuditRules.id, id))
    .returning()
  return (row as RelayPromptAuditRule) ?? null
}

export async function deletePromptAuditRule(id: string): Promise<boolean> {
  const rows = await db
    .delete(relayPromptAuditRules)
    .where(eq(relayPromptAuditRules.id, id))
    .returning({ id: relayPromptAuditRules.id })
  return rows.length > 0
}

export async function listPromptAuditHits(limit = 50): Promise<RelayPromptAuditHit[]> {
  const rows = await dbRead
    .select()
    .from(relayPromptAuditHits)
    .orderBy(desc(relayPromptAuditHits.createdAt))
    .limit(Math.min(Math.max(1, limit), 200))
  return rows as RelayPromptAuditHit[]
}

/** 命中统计(按规则分组,管理端看哪些规则在频繁触发)。 */
export async function countHitsByRule(): Promise<
  Array<{ ruleId: string | null; ruleName: string | null; count: number }>
> {
  const rows = await dbRead
    .select({
      ruleId: relayPromptAuditHits.ruleId,
      ruleName: relayPromptAuditHits.ruleName,
      count: sql<number>`count(*)::int`,
    })
    .from(relayPromptAuditHits)
    .groupBy(relayPromptAuditHits.ruleId, relayPromptAuditHits.ruleName)
  return rows.map((r) => ({ ruleId: r.ruleId, ruleName: r.ruleName, count: Number(r.count) }))
}

/**
 * 入站提示词审计。
 * 无规则/异常 → 放行(pass);命中 block → block;命中 warn → warn;其余 log → pass(仅记录)。
 */
export async function auditPrompt(
  text: string | null | undefined,
  ctx: { userId?: string | null; apiKeyId?: string | null; model?: string | null } = {},
): Promise<PromptAuditResult> {
  const raw = (text ?? '').trim()
  if (raw === '') return { action: 'pass', hits: [] }
  const scanTarget = raw.slice(0, MAX_SCAN_CHARS)
  const lower = scanTarget.toLowerCase()

  let rules: RelayPromptAuditRule[] = []
  try {
    rules = await dbRead
      .select()
      .from(relayPromptAuditRules)
      .where(eq(relayPromptAuditRules.enabled, true))
  } catch (e) {
    logger.warn('[prompt-audit] 规则查询失败,按放行处理', {
      err: e instanceof Error ? e.message : String(e),
    })
    return { action: 'pass', hits: [] }
  }
  if (rules.length === 0) return { action: 'pass', hits: [] }

  const hits: PromptAuditHit[] = []
  let block = false
  let warn = false
  for (const r of rules) {
    const kw = (r.keyword ?? '').trim()
    if (kw === '') continue
    const idx = lower.indexOf(kw.toLowerCase())
    if (idx < 0) continue
    hits.push({
      ruleId: r.id,
      ruleName: r.name,
      keyword: kw,
      action: r.action as 'log' | 'warn' | 'block',
      severity: r.severity,
    })
    if (r.action === 'block') block = true
    else if (r.action === 'warn') warn = true

    // 落命中记录(fire-and-forget,失败不影响调用)
    const from = Math.max(0, idx - SNIPPET_CONTEXT_CHARS)
    void db
      .insert(relayPromptAuditHits)
      .values({
        ruleId: r.id,
        ruleName: r.name,
        userId: ctx.userId ?? null,
        apiKeyId: ctx.apiKeyId ?? null,
        model: ctx.model ?? null,
        keyword: kw,
        actionTaken: r.action,
        snippet: scanTarget.slice(from, idx + kw.length + SNIPPET_CONTEXT_CHARS),
      })
      .catch((e: unknown) => {
        logger.warn('[prompt-audit] 命中记录写入失败', {
          err: e instanceof Error ? e.message : String(e),
        })
      })
  }

  if (hits.length === 0) return { action: 'pass', hits: [] }
  return { action: block ? 'block' : warn ? 'warn' : 'pass', hits }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
