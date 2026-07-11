/**
 * 用户记忆服务。
 *
 * 基于 user_memories schema，为 AI 对话提供长期记忆管理：
 * - 记忆类型：preference(偏好) / fact(事实) / event(事件) / skill(技能) / relationship(关系)
 * - 重要度评分（0-100）：影响检索排序与遗忘策略
 * - 访问统计：记录每次检索命中，低频低重要度记忆可被遗忘
 * - 状态管理：active → archived → forgotten
 *
 * 典型用法：
 *   await remember(userId, { memoryType: 'preference', content: '喜欢科幻小说', importance: 80 })
 *   const memories = await recall(userId, { memoryType: 'preference', limit: 10 })
 */

import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userMemories, type UserMemory } from '@ihui/database'

export type MemoryType = 'preference' | 'fact' | 'event' | 'skill' | 'relationship'
export type MemoryStatus = 'active' | 'archived' | 'forgotten'

export interface MemoryInput {
  memoryType: MemoryType
  content: string
  summary?: string
  importance?: number
  source?: string
  metadata?: Record<string, unknown>
}

export interface MemoryQuery {
  memoryType?: MemoryType
  status?: MemoryStatus
  keyword?: string
  minImportance?: number
  limit?: number
  offset?: number
}

/** 存储一条记忆。 */
export async function remember(userId: string, input: MemoryInput): Promise<UserMemory> {
  const [row] = await db
    .insert(userMemories)
    .values({
      userId,
      memoryType: input.memoryType,
      content: input.content,
      summary: input.summary ?? null,
      importance: input.importance ?? 50,
      source: input.source ?? null,
      metadata: input.metadata ?? {},
      status: 'active',
      accessCount: 0,
    })
    .returning()
  return row!
}

/** 批量存储记忆。 */
export async function rememberBatch(userId: string, inputs: MemoryInput[]): Promise<number> {
  if (inputs.length === 0) return 0
  const rows = await db
    .insert(userMemories)
    .values(
      inputs.map((input) => ({
        userId,
        memoryType: input.memoryType,
        content: input.content,
        summary: input.summary ?? null,
        importance: input.importance ?? 50,
        source: input.source ?? null,
        metadata: input.metadata ?? {},
        status: 'active' as const,
        accessCount: 0,
      })),
    )
    .returning()
  return rows.length
}

/** 检索记忆（按重要度降序，可过滤）。 */
export async function recall(userId: string, query: MemoryQuery = {}): Promise<UserMemory[]> {
  const { memoryType, status = 'active', keyword, minImportance, limit = 20, offset = 0 } = query

  let q = db.select().from(userMemories).$dynamic()
  const conditions = [eq(userMemories.userId, userId)]
  if (memoryType) conditions.push(eq(userMemories.memoryType, memoryType))
  if (status) conditions.push(eq(userMemories.status, status))
  if (minImportance !== undefined) {
    conditions.push(sql`${userMemories.importance} >= ${minImportance}`)
  }
  if (keyword) {
    conditions.push(ilike(userMemories.content, `%${keyword}%`))
  }
  q = q.where(and(...conditions))

  return q
    .orderBy(desc(userMemories.importance), desc(userMemories.updatedAt))
    .limit(limit)
    .offset(offset)
}

/** 获取单条记忆详情（同时更新访问统计）。 */
export async function getMemory(memoryId: string): Promise<UserMemory | null> {
  const [row] = await db.select().from(userMemories).where(eq(userMemories.id, memoryId))

  if (row) {
    // 异步更新访问统计（不阻塞读取）
    void db
      .update(userMemories)
      .set({
        accessCount: row.accessCount + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(userMemories.id, memoryId))
  }
  return row ?? null
}

/** 更新记忆内容。 */
export async function updateMemory(
  memoryId: string,
  updates: Partial<Pick<UserMemory, 'content' | 'summary' | 'importance' | 'status' | 'metadata'>>,
): Promise<UserMemory | null> {
  const [row] = await db
    .update(userMemories)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userMemories.id, memoryId))
    .returning()
  return row ?? null
}

/** 遗忘一条记忆（标记为 forgotten，不物理删除）。 */
export async function forget(memoryId: string): Promise<boolean> {
  const result = await db
    .update(userMemories)
    .set({ status: 'forgotten', updatedAt: new Date() })
    .where(eq(userMemories.id, memoryId))
    .returning()
  return result.length > 0
}

/** 归档低频访问的记忆（accessCount < threshold 且超过 days 天未访问）。 */
export async function archiveStaleMemories(
  userId: string,
  options: { accessThreshold?: number; staleDays?: number } = {},
): Promise<number> {
  const { accessThreshold = 2, staleDays = 30 } = options
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)

  const result = await db
    .update(userMemories)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(
      and(
        eq(userMemories.userId, userId),
        eq(userMemories.status, 'active'),
        sql`${userMemories.accessCount} < ${accessThreshold}`,
        sql`(${userMemories.lastAccessedAt} IS NULL OR ${userMemories.lastAccessedAt} < ${cutoff})`,
      ),
    )
    .returning()
  return result.length
}

/** 获取用户记忆统计。 */
export async function getMemoryStats(userId: string): Promise<{
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  avgImportance: number
}> {
  const rows = await db
    .select({
      memoryType: userMemories.memoryType,
      status: userMemories.status,
      importance: userMemories.importance,
    })
    .from(userMemories)
    .where(eq(userMemories.userId, userId))

  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  let importanceSum = 0

  for (const r of rows) {
    byType[r.memoryType] = (byType[r.memoryType] ?? 0) + 1
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    importanceSum += r.importance
  }

  return {
    total: rows.length,
    byType,
    byStatus,
    avgImportance: rows.length > 0 ? Math.round(importanceSum / rows.length) : 0,
  }
}

/** 从对话文本中提取记忆（简单关键词匹配，供 AI 调用）。 */
export function extractMemoriesFromText(text: string): MemoryInput[] {
  const memories: MemoryInput[] = []
  const patterns: Array<{ type: MemoryType; regex: RegExp }> = [
    { type: 'preference', regex: /我(?:喜欢|讨厌|偏好|不爱|爱)(.{2,50})/g },
    { type: 'fact', regex: /我(?:是|叫|姓)(.{2,30})/g },
    { type: 'skill', regex: /我(?:会|擅长|精通)(.{2,30})/g },
  ]

  for (const { type, regex } of patterns) {
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      const content = m[1]!.trim()
      if (content.length >= 2) {
        memories.push({
          memoryType: type,
          content: m[0],
          summary: content.slice(0, 100),
          importance: type === 'preference' ? 70 : 60,
          source: 'conversation',
        })
      }
    }
  }
  return memories
}
