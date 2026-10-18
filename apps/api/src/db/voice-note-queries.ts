// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'

import { chatVoiceNotes, type ChatVoiceNote } from '@ihui/database'
import type {
  CreateVoiceNoteInput,
  UpdateVoiceNoteInput,
  VoiceNoteGroupFacet,
  VoiceNoteItem,
  VoiceNotePartition,
} from '@ihui/types'

import { db } from './index.js'

/** 单次返回上限:分页参数越界时按此夹紧(与分页只读路由同一档)。 */
export const VOICE_NOTE_MAX_PAGE_SIZE = 100
/** 关键词最长长度:超长直接截断而不是拒绝 —— 搜索框粘贴整段文字是常规操作。 */
export const VOICE_NOTE_MAX_QUERY_LENGTH = 200

const LIKE_ESCAPE = /[%_\\]/g

/** ILIKE 的转义:把用户输入里的 % 与 _ 当字面量,否则"搜 100%"会命中一切。 */
function asLikeTerm(q: string): string {
  return `%${q.slice(0, VOICE_NOTE_MAX_QUERY_LENGTH).replace(LIKE_ESCAPE, (c) => `\\${c}`)}%`
}

function toVoiceNoteItem(row: ChatVoiceNote): VoiceNoteItem {
  return {
    id: row.id,
    conversationId: row.conversationId ?? null,
    title: row.title,
    transcript: row.transcript ?? null,
    durationMs: row.durationMs,
    audioUrl: row.audioUrl ?? null,
    groupKey: row.groupKey,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * 归属条件恒在谓词里:调用方传进来的 userId 来自令牌主体,
 * 任何按 id 的写路径都必须再带一次 eq(userId) —— 少一次就是越权可命中别人的行。
 */
function ownedBy(userId: string, ...rest: ReturnType<typeof eq>[]) {
  return and(eq(chatVoiceNotes.userId, userId), ...rest)
}

export async function listVoiceNotes(
  userId: string,
  opts: {
    page: number
    pageSize: number
    partition?: VoiceNotePartition
    groupKey?: string
    q?: string
    conversationId?: string
    withGroups?: boolean
  },
): Promise<{ list: VoiceNoteItem[]; total: number; groups?: VoiceNoteGroupFacet[] }> {
  const conds = [eq(chatVoiceNotes.userId, userId)]
  const partition = opts.partition ?? 'active'
  conds.push(
    partition === 'archived'
      ? isNotNull(chatVoiceNotes.archivedAt)
      : isNull(chatVoiceNotes.archivedAt),
  )
  if (opts.groupKey) conds.push(eq(chatVoiceNotes.groupKey, opts.groupKey))
  if (opts.conversationId) conds.push(eq(chatVoiceNotes.conversationId, opts.conversationId))
  // 检索落在 SQL 谓词上(标题 + 正文两列),而不是"把整桶拉到前端再 filter":
  // 后者命中与否取决于本地恰好存了多少条,是假检索。
  if (opts.q?.trim()) {
    const term = asLikeTerm(opts.q.trim())
    conds.push(or(ilike(chatVoiceNotes.title, term), ilike(chatVoiceNotes.transcript, term))!)
  }
  const where = and(...conds)

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(chatVoiceNotes)
      .where(where)
      .orderBy(
        partition === 'archived' ? desc(chatVoiceNotes.archivedAt) : desc(chatVoiceNotes.createdAt),
        asc(chatVoiceNotes.id),
      )
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(chatVoiceNotes).where(where),
  ])
  const total = countRows[0]?.total ?? 0

  const groups = opts.withGroups
    ? await db
        .select({
          groupKey: chatVoiceNotes.groupKey,
          count: sql<number>`count(*)::int`,
        })
        .from(chatVoiceNotes)
        .where(eq(chatVoiceNotes.userId, userId))
        .groupBy(chatVoiceNotes.groupKey)
        .orderBy(asc(chatVoiceNotes.groupKey))
    : undefined

  return {
    list: rows.map(toVoiceNoteItem),
    total,
    ...(groups
      ? { groups: groups.map((g) => ({ groupKey: g.groupKey, count: Number(g.count) })) }
      : {}),
  }
}

export async function createVoiceNote(
  userId: string,
  input: CreateVoiceNoteInput,
): Promise<VoiceNoteItem> {
  const [row] = await db
    .insert(chatVoiceNotes)
    .values({
      userId,
      conversationId: input.conversationId ?? null,
      title: input.title,
      transcript: input.transcript ?? null,
      durationMs: input.durationMs,
      audioUrl: input.audioUrl ?? null,
      groupKey: input.groupKey ?? 'inbox',
    })
    .returning()
  if (!row) throw new Error('插入语音笔记未回库')
  return toVoiceNoteItem(row)
}

/**
 * 按 id 的写:userId 进 WHERE ⇒ 命中不了别人的行(返回 0 行由调用方转 404)。
 * 刻意不回显"你没这条笔记"与"这条不存在"的差别 —— 归属探测本身是信息泄露面。
 */
export async function updateVoiceNote(
  userId: string,
  id: string,
  patch: UpdateVoiceNoteInput,
): Promise<VoiceNoteItem | null> {
  // 先取现值、按键比较,只有真变化的字段进 set(门 198 的出口形态,正例见 admin-sys-queries
  // 的 updateMenu)。无条件盖 updatedAt 会把"没改"伪装成"变过",而这张表的 updated_at 是
  // 增量读的消费源 —— 洗一次时序,下游就多补拉一轮。归属谓词在读与写两侧都在,
  // 判不出归属与不存在同样返回 null(归属探测本身是信息泄露面,不区分两型)。
  const [existing] = await db
    .select()
    .from(chatVoiceNotes)
    .where(ownedBy(userId, eq(chatVoiceNotes.id, id)))
    .limit(1)
  if (!existing) return null
  const changed: Partial<typeof chatVoiceNotes.$inferInsert> = {}
  if (patch.title !== undefined && patch.title !== existing.title) changed.title = patch.title
  if (patch.groupKey !== undefined && patch.groupKey !== existing.groupKey)
    changed.groupKey = patch.groupKey
  if (patch.transcript !== undefined && patch.transcript !== existing.transcript)
    changed.transcript = patch.transcript
  if (Object.keys(changed).length === 0) return toVoiceNoteItem(existing)
  const [row] = await db
    .update(chatVoiceNotes)
    .set({ ...changed, updatedAt: new Date() })
    .where(ownedBy(userId, eq(chatVoiceNotes.id, id)))
    .returning()
  return row ? toVoiceNoteItem(row) : null
}

/** 归档 = 写时刻,不是删行;恢复 = 把时刻清回 null。两者都必须带归属谓词。 */
export async function setVoiceNoteArchived(
  userId: string,
  id: string,
  archived: boolean,
): Promise<VoiceNoteItem | null> {
  // 幂等重复(已归档再归档 / 未归档再恢复)不发 UPDATE —— 同 updateVoiceNote:重复一次
  // 就把增量读的消费源往前推一格,而调用方看不出任何差别。
  const [existing] = await db
    .select()
    .from(chatVoiceNotes)
    .where(ownedBy(userId, eq(chatVoiceNotes.id, id)))
    .limit(1)
  if (!existing) return null
  if ((existing.archivedAt !== null) === archived) return toVoiceNoteItem(existing)
  const changed: Partial<typeof chatVoiceNotes.$inferInsert> = {
    archivedAt: archived ? new Date() : null,
  }
  const [row] = await db
    .update(chatVoiceNotes)
    .set({ ...changed, updatedAt: new Date() })
    .where(ownedBy(userId, eq(chatVoiceNotes.id, id)))
    .returning()
  return row ? toVoiceNoteItem(row) : null
}

/** 硬删只在显式 DELETE 上发生(归档与删除是两件事,不得互为副产品)。 */
export async function deleteVoiceNotes(
  userId: string,
  ids: string[],
): Promise<{ deletedIds: string[] }> {
  if (ids.length === 0) return { deletedIds: [] }
  const rows = await db
    .delete(chatVoiceNotes)
    .where(ownedBy(userId, inArray(chatVoiceNotes.id, ids)))
    .returning({ id: chatVoiceNotes.id })
  return { deletedIds: rows.map((r) => r.id) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
