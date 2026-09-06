// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { sensitiveWords, type SensitiveWord, type NewSensitiveWord } from '@ihui/database'
import { recordAuditLog } from '../services/audit-log-service.js'

export interface SensitiveWordListResult {
  list: SensitiveWord[]
  total: number
}

export async function findSensitiveWords(params: {
  page?: number
  pageSize?: number
  category?: string
  status?: number
}): Promise<SensitiveWordListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const conditions = []
  if (params.category) conditions.push(eq(sensitiveWords.category, params.category))
  if (params.status !== undefined) conditions.push(eq(sensitiveWords.status, params.status))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [list, countResult] = await Promise.all([
    dbRead
      .select()
      .from(sensitiveWords)
      .where(where)
      .orderBy(desc(sensitiveWords.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(sensitiveWords)
      .where(where),
  ])

  return { list, total: countResult[0]?.count ?? 0 }
}

export async function findSensitiveWordById(id: string): Promise<SensitiveWord | null> {
  const rows = await dbRead.select().from(sensitiveWords).where(eq(sensitiveWords.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createSensitiveWord(data: NewSensitiveWord): Promise<SensitiveWord> {
  const rows = await db.insert(sensitiveWords).values(data).returning()
  return rows[0]!
}

export async function updateSensitiveWord(
  id: string,
  data: Partial<NewSensitiveWord>,
): Promise<SensitiveWord | null> {
  const rows = await db
    .update(sensitiveWords)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sensitiveWords.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteSensitiveWord(id: string): Promise<boolean> {
  const rows = await db.delete(sensitiveWords).where(eq(sensitiveWords.id, id)).returning()
  return rows.length > 0
}

export async function findActiveSensitiveWords(): Promise<SensitiveWord[]> {
  return dbRead
    .select()
    .from(sensitiveWords)
    .where(eq(sensitiveWords.status, 1))
    .orderBy(desc(sensitiveWords.level))
}

/**
 * 过滤文本中的敏感词
 * @returns { filtered: string, hit: boolean, hits: Array<{ word, category, level }> }
 */
export async function filterSensitiveContent(text: string): Promise<{
  filtered: string
  hit: boolean
  hits: Array<{ word: string; category: string; level: number }>
}> {
  const words = await findActiveSensitiveWords()
  let filtered = text
  const hits: Array<{ word: string; category: string; level: number }> = []

  for (const sw of words) {
    if (text.includes(sw.word)) {
      hits.push({ word: sw.word, category: sw.category, level: sw.level })
      if (sw.level === 1) {
        filtered = filtered.split(sw.word).join(sw.replacement ?? '***')
      }
    }
  }

  return { filtered, hit: hits.length > 0, hits }
}

export interface SensitiveHit {
  word: string
  category: string
  level: number
  /** 命中的字段名(多字段入参时区分来源)。 */
  field?: string
}

/** 单字段 UGC 过滤结果。 */
export interface SanitizeFieldResult {
  /** 是否安全(无临界/违规词命中)。true=可继续写入;false=必须拒绝。 */
  ok: boolean
  /** 脱敏后的文本(字段无命中则与原文本一致)。 */
  text: string
  /** 命中的敏感词(含脱敏词与临界词)。 */
  hits: SensitiveHit[]
}

/** sanitizeUgcInput 审计上下文(记录脱敏/拦截日志用)。 */
export interface SanitizeUgcAuditCtx {
  action?: string
  resourceType?: string
  resourceId?: string
  userId?: string
  ip?: string
  userAgent?: string
}

/**
 * UGC 内容过滤封装 —— 供发帖/评论/圈子/话题/问答/简介等所有写入入口复用。
 *
 * 策略(基于 DB 敏感词 level):
 * - level === 1(一般词)→ 自动脱敏(按 replacement 或 `***` 替换),允许继续写入;
 * - level >= 2(临界/违规词)→ 拒绝写入(ok=false),由调用方返回 400;
 * - 只要任一字段命中,即记一条审计日志(action 默认 `ugc.sensitive.filter`,result 为 blocked/sanitized)。
 *
 * 注意:多字段入参时,任一字段命中临界词即整体返回 ok=false(拒绝整个写入),
 * 避免绕过过滤。调用方拿到 ok=false 后应直接返回 400,不要落库。
 */
export async function sanitizeUgcInput(
  texts: Record<string, string>,
  ctx: SanitizeUgcAuditCtx = {},
): Promise<{
  ok: boolean
  /** 各字段的过滤结果(调用方应使用 result.text 覆盖原字段再落库)。 */
  fields: Record<string, SanitizeFieldResult>
  /** 全部字段命中的敏感词(合并去重)。 */
  hits: SensitiveHit[]
}> {
  const fields: Record<string, SanitizeFieldResult> = {}
  const allHits: SensitiveHit[] = []
  let ok = true

  for (const [field, raw] of Object.entries(texts)) {
    if (!raw) {
      fields[field] = { ok: true, text: raw, hits: [] }
      continue
    }
    const { filtered, hits } = await filterSensitiveContent(raw)
    const fieldHits = hits.map((h) => ({ ...h, field }))
    // level>=2 为临界/违规词:整体拒绝写入(防止多字段拆分绕过)
    if (fieldHits.some((h) => h.level >= 2)) ok = false
    fields[field] = { ok: !fieldHits.some((h) => h.level >= 2), text: filtered, hits: fieldHits }
    allHits.push(...fieldHits)
  }

  if (allHits.length > 0) {
    // 记审计日志(不阻塞主流程,失败仅记录 warning)
    const blocked = !ok
    await recordAuditLog({
      userId: ctx.userId,
      action: ctx.action ?? 'ugc.sensitive.filter',
      resourceType: ctx.resourceType,
      resourceId: ctx.resourceId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      result: blocked ? 'blocked' : 'sanitized',
      metadata: {
        hits: allHits,
      },
    })
  }

  return { ok, fields, hits: allHits }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
