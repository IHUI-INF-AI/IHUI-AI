// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联扩展操作：联系人同步/删除、群管理、朋友圈发布。
 *
 * 这些能力只对 bridge 后端成立；iLink 官方通道由适配器返回 unsupported，
 * 服务层不伪造成功，UI 直接展示原因。
 */

import { and, eq, sql } from 'drizzle-orm'
import { wechatHubContacts, wechatHubConversations, wechatHubGroupMembers } from '@ihui/database'
import type {
  WechatActionResult,
  WechatBridgeAction,
  WechatGroupActionInput,
  WechatMomentInput,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import {
  assertAccountForUser,
  assertContactForAccount,
  assertConversationForAccount,
} from './guards.js'
import { wechatHubManager } from './manager.js'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function readList(data: Record<string, unknown>): JsonRecord[] {
  const candidates = [data.contacts, data.list, data.items, data.members]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => asRecord(item))
        .filter((item): item is JsonRecord => item !== null)
    }
  }
  return []
}

function pickContact(raw: JsonRecord): {
  platformUserId: string
  displayName: string
  remark: string
  tags: string[]
} | null {
  const platformUserId =
    asString(raw.platformUserId) ??
    asString(raw.memberId) ??
    asString(raw.wxid) ??
    asString(raw.userName) ??
    asString(raw.userId) ??
    asString(raw.id)
  if (!platformUserId) return null
  return {
    platformUserId,
    displayName:
      asString(raw.displayName) ??
      asString(raw.nickname) ??
      asString(raw.name) ??
      asString(raw.remark) ??
      '',
    remark: asString(raw.remark) ?? asString(raw.remarkName) ?? '',
    tags: asStringArray(raw.tags),
  }
}

/** 桥返回形状不统一：data/list/items/members/contacts 都吃，字段别名在 pickContact 归一。 */
export function normalizeBridgeContacts(data: Record<string, unknown>): Array<{
  platformUserId: string
  displayName: string
  remark: string
  tags: string[]
}> {
  return readList(data)
    .map((item) => pickContact(item))
    .filter((item): item is NonNullable<ReturnType<typeof pickContact>> => item !== null)
}

/**
 * 从桥同步联系人。桥应实现 contact.sync，返回 { contacts: [...] }。
 * 已存在联系人只更新平台昵称/备注，不覆盖本地 tags/blocked。
 */
export async function syncContacts(
  userId: string,
  accountId: string,
): Promise<{ synced: number; inserted: number; updated: number; result: WechatActionResult }> {
  await assertAccountForUser(userId, accountId)
  const result = await wechatHubManager.performAction(userId, accountId, 'contact.sync', {})
  if (!result.ok) return { synced: 0, inserted: 0, updated: 0, result }

  const contacts = normalizeBridgeContacts(result.data)
  if (contacts.length === 0) return { synced: 0, inserted: 0, updated: 0, result }

  const existingRows = await dbRead
    .select({
      id: wechatHubContacts.id,
      platformUserId: wechatHubContacts.platformUserId,
      displayName: wechatHubContacts.displayName,
      remark: wechatHubContacts.remark,
    })
    .from(wechatHubContacts)
    .where(eq(wechatHubContacts.accountId, accountId))
  const existing = new Map(existingRows.map((row) => [row.platformUserId, row]))

  let inserted = 0
  let updated = 0
  const fresh: Array<typeof wechatHubContacts.$inferInsert> = []
  for (const contact of contacts) {
    const current = existing.get(contact.platformUserId)
    if (!current) {
      fresh.push({
        accountId,
        platformUserId: contact.platformUserId,
        displayName: contact.displayName,
        remark: contact.remark,
        tags: contact.tags,
        metadata: { source: 'bridge-sync' },
      })
      inserted += 1
      continue
    }
    const changed: Record<string, unknown> = {}
    if (contact.displayName && contact.displayName !== current.displayName) {
      changed.displayName = contact.displayName
    }
    if (contact.remark && contact.remark !== current.remark) changed.remark = contact.remark
    if (Object.keys(changed).length === 0) continue
    await db
      .update(wechatHubContacts)
      .set({ ...changed, updatedAt: new Date() })
      .where(eq(wechatHubContacts.id, current.id))
    updated += 1
  }
  if (fresh.length > 0) await db.insert(wechatHubContacts).values(fresh).onConflictDoNothing()
  return { synced: inserted + updated, inserted, updated, result }
}

/** 桥侧删除好友/联系人，成功后再删本地副本。 */
export async function deleteContact(
  userId: string,
  accountId: string,
  contactId: string,
): Promise<WechatActionResult> {
  await assertAccountForUser(userId, accountId)
  const contact = await assertContactForAccount(accountId, contactId)
  const result = await wechatHubManager.performAction(userId, accountId, 'contact.delete', {
    memberId: contact.platformUserId,
  })
  if (!result.ok) return result
  await db.delete(wechatHubContacts).where(eq(wechatHubContacts.id, contactId))
  return result
}

async function refreshGroupMemberCount(accountId: string, conversationId: string): Promise<void> {
  const counts = await dbRead
    .select({ count: sql<number>`count(*)::int` })
    .from(wechatHubGroupMembers)
    .where(
      and(
        eq(wechatHubGroupMembers.accountId, accountId),
        eq(wechatHubGroupMembers.conversationId, conversationId),
      ),
    )
  await db
    .update(wechatHubConversations)
    .set({ memberCount: counts[0]?.count ?? 0, updatedAt: new Date() })
    .where(eq(wechatHubConversations.id, conversationId))
}

/** 群动作成功后同步本地会话/成员视图；桥是平台真相，本地只做镜像。 */
async function applyGroupLocalState(
  accountId: string,
  conversationId: string | undefined,
  input: WechatGroupActionInput,
  result: WechatActionResult,
): Promise<void> {
  if (!result.ok) return
  let targetConversationId = conversationId
  if (input.action === 'create') {
    const chatId = asString(result.data.chatId)
    if (!chatId) return
    const inserted = await db
      .insert(wechatHubConversations)
      .values({
        accountId,
        platformChatId: chatId,
        kind: 'group',
        title: input.title?.trim() ?? '',
        memberCount: 0,
        metadata: {},
      })
      .onConflictDoNothing()
      .returning({ id: wechatHubConversations.id })
    targetConversationId =
      inserted[0]?.id ??
      (
        await dbRead
          .select({ id: wechatHubConversations.id })
          .from(wechatHubConversations)
          .where(
            and(
              eq(wechatHubConversations.accountId, accountId),
              eq(wechatHubConversations.platformChatId, chatId),
            ),
          )
          .limit(1)
      )[0]?.id
    if (!targetConversationId) return
  }
  if (!targetConversationId) return
  if (input.action === 'create' && input.memberIds?.length) {
    for (const memberId of input.memberIds) {
      await db
        .insert(wechatHubGroupMembers)
        .values({
          accountId,
          conversationId: targetConversationId,
          memberId,
          nickname: '',
          role: 'member',
          metadata: {},
        })
        .onConflictDoNothing()
    }
  }
  if (input.action === 'create') {
    await refreshGroupMemberCount(accountId, targetConversationId)
    return
  }
  if (input.action === 'invite' && input.memberIds?.length) {
    for (const memberId of input.memberIds) {
      await db
        .insert(wechatHubGroupMembers)
        .values({
          accountId,
          conversationId: targetConversationId,
          memberId,
          nickname: '',
          role: 'member',
          metadata: {},
        })
        .onConflictDoNothing()
    }
    await refreshGroupMemberCount(accountId, targetConversationId)
    return
  }
  if (input.action === 'kick' && input.memberIds?.length) {
    for (const memberId of input.memberIds) {
      await db
        .delete(wechatHubGroupMembers)
        .where(
          and(
            eq(wechatHubGroupMembers.accountId, accountId),
            eq(wechatHubGroupMembers.conversationId, targetConversationId),
            eq(wechatHubGroupMembers.memberId, memberId),
          ),
        )
    }
    await refreshGroupMemberCount(accountId, targetConversationId)
    return
  }
  if (input.action === 'rename' && input.title?.trim()) {
    await db
      .update(wechatHubConversations)
      .set({ title: input.title.trim(), updatedAt: new Date() })
      .where(eq(wechatHubConversations.id, targetConversationId))
  }
}

/** 群管理动作统一入口；create 不要求已有会话，其余动作必须先校验会话归属。 */
export async function runGroupAction(
  userId: string,
  accountId: string,
  input: WechatGroupActionInput,
): Promise<WechatActionResult> {
  await assertAccountForUser(userId, accountId)
  const action = `group.${input.action}` as WechatBridgeAction
  const payload: Record<string, unknown> = {}
  if (input.memberIds?.length) payload.memberIds = input.memberIds
  if (input.title?.trim()) payload.title = input.title.trim()
  if (input.text?.trim()) payload.text = input.text.trim()
  if (input.action !== 'create') {
    if (!input.conversationId) {
      throw new AppError('群动作缺少 conversationId', 400, 'WECHAT_GROUP_CONVERSATION_REQUIRED')
    }
    const conversation = await assertConversationForAccount(accountId, input.conversationId)
    payload.conversationId = input.conversationId
    payload.chatId = conversation.platformChatId
  }
  const result = await wechatHubManager.performAction(userId, accountId, action, payload)
  await applyGroupLocalState(accountId, input.conversationId, input, result)
  return result
}

/** 朋友圈发布；仅 bridge 后端可执行。 */
export async function publishMoment(
  userId: string,
  accountId: string,
  input: WechatMomentInput,
): Promise<WechatActionResult> {
  await assertAccountForUser(userId, accountId)
  return wechatHubManager.performAction(userId, accountId, 'moment.publish', {
    text: input.text,
    mediaUrls: input.mediaUrls ?? [],
  })
}

/**
 * 切换微信当前打开会话；仅 OCR/RPA 类 bridge 驱动实现。
 * 只接受标题，不传平台 chatId —— 驱动侧按微信界面搜索/会话列表定位。
 */
export async function switchChat(
  userId: string,
  accountId: string,
  title: string,
): Promise<WechatActionResult> {
  await assertAccountForUser(userId, accountId)
  const trimmed = title.trim()
  if (!trimmed) {
    throw new AppError('切换会话缺少 title', 400, 'WECHAT_CHAT_TITLE_REQUIRED')
  }
  return wechatHubManager.performAction(userId, accountId, 'chat.switch', { title: trimmed })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
