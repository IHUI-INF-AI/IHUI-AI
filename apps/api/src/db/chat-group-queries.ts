// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { chatConversationGroups, chatConversations } from '@ihui/database'
import { db } from './index.js'

/**
 * 会话分组的数据访问出口(D165,2026-10-01 立)。
 *
 * 三条不可漂的写法,都是本仓既有纪律在这一域的落地:
 *  ① **归属条件写进被发出的那条 SQL**,不写在调用方的 `if` 里 —— `if` 判得了"这行存在",
 *     判不了"命中";只判存在就会出现"别人的分组被改了而响应照旧回成功"。
 *  ② **回报集合取库侧确认集**(`.returning({id})`),批量移动不得把请求侧数组 `.length`
 *     当 affected(守门 134 那一族:0 行与成功在响应上同形)。
 *  ③ 删分组只清归类(FK `ON DELETE SET NULL`),**不得连带删会话内容** —— 语义是"取消归类"。
 */

export interface ConversationGroupRow {
  id: string
  name: string
  pinned: boolean
  pinnedAt: Date | null
  conversationCount: number
}

export interface CreateGroupResult {
  id: string
  name: string
  pinned: boolean
  /** true = 同名分组已存在,本次没有新建(幂等出口,不是失败)。 */
  created: boolean
}

export interface MoveResult {
  requestedIds: string[]
  affected: number
  /** 请求里那些"不存在或不属于本人"的会话 id —— 逐条点名,不静默。 */
  missedIds: string[]
}

/** 分组清单(带每组会话数)。置顶组在前,其余按名字排 —— 排序规则只在这里定义一次。 */
export async function listConversationGroups(userId: string): Promise<ConversationGroupRow[]> {
  const rows = await db
    .select({
      id: chatConversationGroups.id,
      name: chatConversationGroups.name,
      pinned: chatConversationGroups.pinned,
      pinnedAt: chatConversationGroups.pinnedAt,
      conversationCount: sql<number>`(
        select count(*)::int from ${chatConversations}
        where ${chatConversations.groupId} = ${chatConversationGroups.id}
      )`,
    })
    .from(chatConversationGroups)
    .where(eq(chatConversationGroups.userId, userId))
    .orderBy(asc(chatConversationGroups.pinned), asc(chatConversationGroups.name))
  return rows.map((r) => ({ ...r, conversationCount: Number(r.conversationCount) }))
}

/** 建分组。同名(user_id + name 唯一)不报错,回已有那条并标 created=false。 */
export async function createConversationGroup(
  userId: string,
  name: string,
): Promise<CreateGroupResult> {
  const inserted = await db
    .insert(chatConversationGroups)
    .values({ userId, name })
    .onConflictDoNothing({
      target: [chatConversationGroups.userId, chatConversationGroups.name],
    })
    .returning({
      id: chatConversationGroups.id,
      name: chatConversationGroups.name,
      pinned: chatConversationGroups.pinned,
    })
  const created = inserted[0]
  if (created) {
    return { id: created.id, name: created.name, pinned: created.pinned, created: true }
  }
  const existing = await db
    .select({
      id: chatConversationGroups.id,
      name: chatConversationGroups.name,
      pinned: chatConversationGroups.pinned,
    })
    .from(chatConversationGroups)
    .where(and(eq(chatConversationGroups.userId, userId), eq(chatConversationGroups.name, name)))
    .limit(1)
  const [existingRow] = existing
  if (!existingRow) {
    // 走到这里说明唯一冲突与"查不到"同时成立 —— 只可能是并发删掉了同名组。抛出让调用方重试,不猜。
    throw new Error('group_create_race')
  }
  return { id: existingRow.id, name: existingRow.name, pinned: existingRow.pinned, created: false }
}

export interface GroupMutationResult {
  ok: boolean
  /** 失败原因只在"确实没命中"时给,不拿它冒充"改好了"。 */
  reason?: 'not-found'
}

/** 改名。归属写在 where 上:别人的行 = 0 命中 = not-found。 */
export async function renameConversationGroup(
  userId: string,
  groupId: string,
  name: string,
): Promise<GroupMutationResult> {
  const hit = await db
    .update(chatConversationGroups)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(chatConversationGroups.id, groupId), eq(chatConversationGroups.userId, userId)))
    .returning({ id: chatConversationGroups.id })
  return hit.length > 0 ? { ok: true } : { ok: false, reason: 'not-found' }
}

/** 分组置顶/取消置顶(pinned 与 pinnedAt 同一条 SQL 改,不留两列半新半旧)。 */
export async function setConversationGroupPinned(
  userId: string,
  groupId: string,
  pinned: boolean,
): Promise<GroupMutationResult> {
  const hit = await db
    .update(chatConversationGroups)
    .set({ pinned, pinnedAt: pinned ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(chatConversationGroups.id, groupId), eq(chatConversationGroups.userId, userId)))
    .returning({ id: chatConversationGroups.id })
  return hit.length > 0 ? { ok: true } : { ok: false, reason: 'not-found' }
}

/** 删分组:只清归类。会话行由 FK `ON DELETE SET NULL` 落回未分组,本函数不碰 chat_conversations。 */
export async function deleteConversationGroup(
  userId: string,
  groupId: string,
): Promise<GroupMutationResult> {
  const hit = await db
    .delete(chatConversationGroups)
    .where(and(eq(chatConversationGroups.id, groupId), eq(chatConversationGroups.userId, userId)))
    .returning({ id: chatConversationGroups.id })
  return hit.length > 0 ? { ok: true } : { ok: false, reason: 'not-found' }
}

/**
 * 批量移动会话到分组(groupId=null 表示移出分组)。
 * groupId 非空时先验它属于本人(不属于自己的目标分组 = 整笔拒绝,不是"移动 0 条"),
 * 否则一条越权写会表现为 affected=0 的"看起来失败了"。
 */
export async function moveConversationsToGroup(
  userId: string,
  conversationIds: string[],
  groupId: string | null,
): Promise<MoveResult> {
  const requestedIds = [...new Set(conversationIds)]
  if (requestedIds.length === 0) return { requestedIds, affected: 0, missedIds: [] }

  if (groupId !== null) {
    const target = await db
      .select({ id: chatConversationGroups.id })
      .from(chatConversationGroups)
      .where(and(eq(chatConversationGroups.id, groupId), eq(chatConversationGroups.userId, userId)))
      .limit(1)
    if (target.length === 0) throw new Error('group_not_owned')
  }

  const updated = await db
    .update(chatConversations)
    .set({ groupId, updatedAt: new Date() })
    .where(and(inArray(chatConversations.id, requestedIds), eq(chatConversations.userId, userId)))
    .returning({ id: chatConversations.id })
  const confirmed = new Set(updated.map((r) => r.id))
  return {
    requestedIds,
    affected: confirmed.size,
    missedIds: requestedIds.filter((id) => !confirmed.has(id)),
  }
}

/** 会话列表带上所属分组 id;未分组走 isNull 一档,不靠"缺字段"表达。 */
export async function listConversationGroupIds(
  userId: string,
): Promise<Map<string, string | null>> {
  const rows = await db
    .select({ id: chatConversations.id, groupId: chatConversations.groupId })
    .from(chatConversations)
    .where(eq(chatConversations.userId, userId))
  return new Map(rows.map((r) => [r.id, r.groupId]))
}

/** 供路由在删除分组后回读"落回未分组"的会话数,让响应能如实说"n 条会话已回到未分组"。 */
export async function countUnfiledConversations(userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), isNull(chatConversations.groupId)))
  return Number(rows[0]?.n ?? 0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
