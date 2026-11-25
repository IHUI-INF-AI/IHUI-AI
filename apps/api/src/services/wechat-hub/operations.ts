// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联扩展操作：联系人同步/删除、群管理、朋友圈发布。
 *
 * 这些能力只对 bridge 后端成立；iLink 官方通道由适配器返回 unsupported，
 * 服务层不伪造成功，UI 直接展示原因。
 */

import { createHash } from 'node:crypto'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import { wechatHubContacts, wechatHubConversations, wechatHubGroupMembers } from '@ihui/database'
import type {
  WechatActionResult,
  WechatBridgeAction,
  WechatGroupActionInput,
  WechatGroupMembersSyncResult,
  WechatMomentArchiveItemView,
  WechatMomentArchiveStat,
  WechatMomentArchiveView,
  WechatMomentCommentView,
  WechatMomentFetchInput,
  WechatMomentFetchResult,
  WechatMomentFieldAvailability,
  WechatMomentInput,
  WechatMomentStopReason,
  WechatMomentView,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { logger } from '../../utils/logger.js'
import {
  assertAccountForUser,
  assertContactForAccount,
  assertConversationForAccount,
} from './guards.js'
import { wechatHubManager } from './manager.js'
import { listGroupMembers } from './contacts.js'
import { pushMemberMapForAccount } from './member-map-sync.js'
import { countMomentsArchive, listMomentsArchive, upsertMoments } from './moments-store.js'

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

/** 仅接受正整数；0、负数、小数、NaN、Infinity 一律归 undefined，不拿 0 占位。 */
function asPositiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
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

/** 同步成功后后台下发成员映射；失败只 warn，不回滚、不影响原同步结果。 */
function fireMemberMapPush(userId: string, accountId: string): void {
  void pushMemberMapForAccount(userId, accountId).catch((e) => {
    logger.warn('[wechat-hub] 成员映射自动下发失败', {
      accountId,
      err: e instanceof Error ? e.message : String(e),
    })
  })
}

/**
 * 严格读取桥上报的字段可得性：四项布尔与 reason 类型都合法才透传，
 * 缺失或形状非法一律归 undefined，不补造默认能力位。
 */
function readMomentFields(value: unknown): WechatMomentFieldAvailability | undefined {
  const raw = asRecord(value)
  if (!raw) return undefined
  const { media, likes, comments, authorIdentity, reason } = raw
  if (
    typeof media !== 'boolean' ||
    typeof likes !== 'boolean' ||
    typeof comments !== 'boolean' ||
    typeof authorIdentity !== 'boolean'
  ) {
    return undefined
  }
  if (reason !== null && typeof reason !== 'string') return undefined
  return { media, likes, comments, authorIdentity, reason }
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
  fireMemberMapPush(userId, accountId)

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

function pickGroupMember(raw: JsonRecord): {
  memberId: string
  nickname: string
  role: string
} | null {
  const memberId =
    asString(raw.memberId) ??
    asString(raw.wxid) ??
    asString(raw.userName) ??
    asString(raw.user_id) ??
    asString(raw.id)
  if (!memberId) return null
  const role =
    asString(raw.role) ??
    (raw.isOwner === true ? 'owner' : raw.isAdmin === true ? 'admin' : 'member')
  return {
    memberId,
    nickname: (
      asString(raw.nickname) ??
      asString(raw.name) ??
      asString(raw.displayName) ??
      ''
    ).slice(0, 255),
    role: role.slice(0, 16),
  }
}

/** 桥返回 members/list/items 都吃，字段别名归一；同一 wxid 只保留一条。 */
export function normalizeBridgeGroupMembers(data: Record<string, unknown>): Array<{
  memberId: string
  nickname: string
  role: string
}> {
  const byId = new Map<string, { memberId: string; nickname: string; role: string }>()
  for (const item of readList(data)) {
    const member = pickGroupMember(item)
    if (member) byId.set(member.memberId, member)
  }
  return [...byId.values()]
}

/**
 * 从桥拉取群成员快照并替换本地镜像。
 * 只有桥明确返回 members 才替换；空列表视为失败，避免把本地成员清空。
 */
export async function syncGroupMembersFromBridge(
  userId: string,
  accountId: string,
  conversationId: string,
): Promise<WechatGroupMembersSyncResult> {
  await assertAccountForUser(userId, accountId)
  const conversation = await assertConversationForAccount(accountId, conversationId)
  const result = await wechatHubManager.performAction(userId, accountId, 'group.members', {
    conversationId,
    chatId: conversation.platformChatId,
  })
  if (!result.ok) {
    return { synced: 0, inserted: 0, updated: 0, removed: 0, members: [], result }
  }
  fireMemberMapPush(userId, accountId)
  const members = normalizeBridgeGroupMembers(result.data)
  if (members.length === 0) {
    return { synced: 0, inserted: 0, updated: 0, removed: 0, members: [], result }
  }

  const existingRows = await dbRead
    .select({
      id: wechatHubGroupMembers.id,
      memberId: wechatHubGroupMembers.memberId,
      nickname: wechatHubGroupMembers.nickname,
      role: wechatHubGroupMembers.role,
    })
    .from(wechatHubGroupMembers)
    .where(
      and(
        eq(wechatHubGroupMembers.accountId, accountId),
        eq(wechatHubGroupMembers.conversationId, conversationId),
      ),
    )
  const existing = new Map(existingRows.map((row) => [row.memberId, row]))
  const incomingIds = members.map((member) => member.memberId)
  const removed = existingRows.filter((row) => !incomingIds.includes(row.memberId)).length
  if (removed > 0) {
    await db
      .delete(wechatHubGroupMembers)
      .where(
        and(
          eq(wechatHubGroupMembers.accountId, accountId),
          eq(wechatHubGroupMembers.conversationId, conversationId),
          notInArray(wechatHubGroupMembers.memberId, incomingIds),
        ),
      )
  }

  let inserted = 0
  let updated = 0
  for (const member of members) {
    const current = existing.get(member.memberId)
    if (!current) {
      await db
        .insert(wechatHubGroupMembers)
        .values({
          accountId,
          conversationId,
          memberId: member.memberId,
          nickname: member.nickname,
          role: member.role,
          metadata: { source: 'bridge-sync' },
        })
        .onConflictDoNothing()
      inserted += 1
      continue
    }
    if (current.nickname === member.nickname && current.role === member.role) continue
    await db
      .update(wechatHubGroupMembers)
      .set({ nickname: member.nickname, role: member.role, updatedAt: new Date() })
      .where(eq(wechatHubGroupMembers.id, current.id))
    updated += 1
  }
  await refreshGroupMemberCount(accountId, conversationId)
  return {
    synced: inserted + updated,
    inserted,
    updated,
    removed,
    members: await listGroupMembers(userId, accountId, conversationId),
    result,
  }
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

function readMomentComments(raw: unknown): WechatMomentCommentView[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => asRecord(item))
    .filter((item): item is JsonRecord => item !== null)
    .map((item) => ({
      ...(asString(item.username) ? { username: asString(item.username) as string } : {}),
      ...(asString(item.nickname) ? { nickname: asString(item.nickname) as string } : {}),
      content: asString(item.content) ?? '',
      ...(typeof item.createTime === 'number' && Number.isFinite(item.createTime)
        ? { createTime: item.createTime }
        : {}),
      ...(asString(item.commentId) ? { commentId: asString(item.commentId) as string } : {}),
      ...(asString(item.refCommentId)
        ? { refCommentId: asString(item.refCommentId) as string }
        : {}),
    }))
    .filter((item) => item.content.length > 0)
}

function readMoment(raw: JsonRecord): WechatMomentView | null {
  const id = asString(raw.id)
  const content = asString(raw.content) ?? ''
  const mediaUrls = asStringArray(raw.mediaUrls)
  const likeUsers = asStringArray(raw.likeUsers)
  const likeUserIds = asStringArray(raw.likeUserIds)
  const commentsData = readMomentComments(raw.commentsData)
  const hasLikes = raw.likes === true || likeUsers.length > 0
  const hasComments = raw.comments === true || commentsData.length > 0
  // DB sidecar 可能返回纯图片/纯点赞动态；只丢弃真正空白的行。
  if (!id || (content.length === 0 && mediaUrls.length === 0 && !hasLikes && !hasComments))
    return null
  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : null
  const page = typeof raw.page === 'number' && Number.isFinite(raw.page) ? raw.page : undefined
  const timeText = asString(raw.timeText)
  const imageCount = asPositiveInt(raw.imageCount)
  const videoCount = asPositiveInt(raw.videoCount)
  const commentTexts = asStringArray(raw.commentTexts)
  return {
    id,
    authorId: asString(raw.authorId),
    authorName: asString(raw.authorName) ?? '未知好友',
    authorResolved: raw.authorResolved === true,
    content,
    mediaUrls,
    createdAt,
    source: asString(raw.source) ?? 'bridge',
    page,
    ...(timeText !== null ? { timeText } : {}),
    ...(imageCount !== undefined ? { imageCount } : {}),
    ...(videoCount !== undefined ? { videoCount } : {}),
    ...(commentTexts.length > 0
      ? { commentTexts }
      : commentsData.length > 0
        ? { commentTexts: commentsData.map((item) => item.content) }
        : {}),
    ...(likeUsers.length > 0 ? { likeUsers } : {}),
    ...(likeUserIds.length > 0 ? { likeUserIds } : {}),
    ...(hasLikes ? { likes: true } : {}),
    ...(hasComments ? { comments: true } : {}),
    ...(commentsData.length > 0 ? { commentsData } : {}),
    ...(asString(raw.createdAtIso) ? { createdAtIso: asString(raw.createdAtIso) as string } : {}),
    ...(asString(raw.mediaLocalDir)
      ? { mediaLocalDir: asString(raw.mediaLocalDir) as string }
      : {}),
    ...(raw.mediaDownloaded === true ? { mediaDownloaded: true } : {}),
    ...(asString(raw.mediaDownloadError)
      ? { mediaDownloadError: asString(raw.mediaDownloadError) as string }
      : {}),
  }
}

const MOMENT_STOP_REASONS: readonly WechatMomentStopReason[] = [
  'page-limit',
  'scroll-stalled',
  'occluded',
  'no-more-data',
  'no-content',
  'error',
  'unsupported',
]

function readStopReason(value: unknown): WechatMomentStopReason | null {
  return typeof value === 'string' && (MOMENT_STOP_REASONS as readonly string[]).includes(value)
    ? (value as WechatMomentStopReason)
    : null
}

function normalizedMomentText(text: string): string {
  return text.toLowerCase().replace(/[\s\u3000【】\[\]〔〕〖〗·•，,。.：:；;！!？?、]/gu, '')
}

/** 归档去重键：平台动态 id 优先；缺失时退化为作者+正文哈希，保证同账号内稳定。 */
function momentKeyOf(moment: WechatMomentView): string {
  if (moment.id) return moment.id
  const author = moment.authorName.trim() || '~'
  const digest = createHash('sha256')
    .update(`${author}\u0000${normalizedMomentText(moment.content)}`)
    .digest('hex')
    .slice(0, 16)
  return `h:${digest}`
}

/** 桥本地归档记录归一化成对外视图；只丢弃真正空白的行。 */
function readArchiveItem(raw: JsonRecord, index: number): WechatMomentArchiveItemView | null {
  const content = asString(raw.content) ?? ''
  const mediaUrls = asStringArray(raw.mediaUrls)
  const likeUsers = asStringArray(raw.likeUsers)
  const likeUserIds = asStringArray(raw.likeUserIds)
  const commentsData = readMomentComments(raw.commentsData)
  const hasLikes = raw.likes === true || likeUsers.length > 0
  const hasComments = raw.comments === true || commentsData.length > 0
  // 纯图片/纯点赞归档也要能展示；只丢弃真正空白的行。
  if (content.length === 0 && mediaUrls.length === 0 && !hasLikes && !hasComments) return null
  const now = new Date().toISOString()
  const page = typeof raw.page === 'number' && Number.isFinite(raw.page) ? raw.page : undefined
  const id = asString(raw.id) ?? `bridge-moment-${index}`
  return {
    id,
    momentKey: asString(raw.momentKey) ?? id,
    authorId: asString(raw.authorId),
    authorName: asString(raw.authorName) ?? '朋友圈好友',
    authorResolved: raw.authorResolved === true,
    content,
    mediaUrls,
    createdAt:
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : null,
    source: asString(raw.source) ?? 'bridge',
    firstSeenAt: asString(raw.firstSeenAt) ?? now,
    lastSeenAt: asString(raw.lastSeenAt) ?? now,
    seenCount:
      typeof raw.seenCount === 'number' && Number.isFinite(raw.seenCount)
        ? Math.max(1, Math.floor(raw.seenCount))
        : 1,
    ...(page !== undefined ? { page } : {}),
    ...(likeUsers.length > 0 ? { likeUsers } : {}),
    ...(likeUserIds.length > 0 ? { likeUserIds } : {}),
    ...(hasLikes ? { likes: true } : {}),
    ...(hasComments ? { comments: true } : {}),
    ...(commentsData.length > 0 ? { commentsData } : {}),
    ...(asString(raw.mediaLocalDir)
      ? { mediaLocalDir: asString(raw.mediaLocalDir) as string }
      : {}),
    ...(raw.mediaDownloaded === true ? { mediaDownloaded: true } : {}),
  }
}

function readMomentArchive(value: unknown): WechatMomentArchiveStat | undefined {
  const raw = asRecord(value)
  if (!raw) return undefined
  const number = (key: string): number =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? Math.max(0, raw[key]) : 0
  return {
    added: number('added'),
    updated: number('updated'),
    total: number('total'),
  }
}

/**
 * 朋友圈只读遍历：OCR 驱动滚动朋友圈窗口，wcfhttp 用 /pyq 翻页并等 type=0 回调。
 * 返回值保留桥的 unsupported/failed 原因，不用空列表伪装成功。
 */
export async function fetchMoments(
  userId: string,
  accountId: string,
  input: WechatMomentFetchInput = {},
): Promise<WechatMomentFetchResult> {
  await assertAccountForUser(userId, accountId)
  const maxPages = Math.min(Math.max(Number(input.maxPages ?? 3) || 3, 1), 30)
  const result = await wechatHubManager.performAction(userId, accountId, 'moment.fetch', {
    maxPages,
    id: Number(input.id ?? 0) || 0,
  })
  const data = asRecord(result.data) ?? {}
  const moments = (Array.isArray(data.moments) ? data.moments : [])
    .map((item) => asRecord(item))
    .filter((item): item is JsonRecord => item !== null)
    .map(readMoment)
    .filter((item): item is WechatMomentView => item !== null)
  const pages =
    typeof data.pages === 'number' && Number.isFinite(data.pages) ? Math.max(0, data.pages) : 0
  const partial = data.partial === true

  // 终止原因优先透传桥上报；桥没给或给了非法值时按可见证据回退，绝不把 page-limit 显示成失败。
  let stopReason = readStopReason(data.stopReason)
  if (stopReason === null) {
    if (result.status === 'unsupported') stopReason = 'unsupported'
    else if (partial && pages >= maxPages) stopReason = 'page-limit'
    else if (moments.length === 0) stopReason = 'no-content'
  }
  const limitReached =
    typeof data.limitReached === 'boolean' ? data.limitReached : stopReason === 'page-limit'
  const occludedBy = asString(data.occludedBy)
  const fields = readMomentFields(data.fields)
  const mediaStat = (key: string): number | undefined => {
    const value = data[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : undefined
  }

  // 抓取成功后归档入库；写库失败只 warn，不影响本次抓取结果与桥原因返回。
  let archive = readMomentArchive(data.archive)
  if (result.ok && moments.length > 0) {
    try {
      archive = await upsertMoments(
        accountId,
        moments.map((moment) => ({
          momentKey: momentKeyOf(moment),
          authorId: moment.authorId,
          authorName: moment.authorName,
          authorResolved: moment.authorResolved === true,
          content: moment.content,
          mediaUrls: moment.mediaUrls,
          createdAt: moment.createdAt,
          source: moment.source,
          page: moment.page,
          ...(moment.mediaLocalDir !== undefined ? { mediaLocalDir: moment.mediaLocalDir } : {}),
          ...(moment.mediaDownloaded === true ? { mediaDownloaded: true } : {}),
          ...(moment.timeText !== undefined ? { timeText: moment.timeText } : {}),
          ...(moment.imageCount !== undefined ? { imageCount: moment.imageCount } : {}),
          ...(moment.commentTexts !== undefined ? { commentTexts: moment.commentTexts } : {}),
          ...(moment.likeUsers !== undefined ? { likeUsers: moment.likeUsers } : {}),
          ...(moment.likeUserIds !== undefined ? { likeUserIds: moment.likeUserIds } : {}),
          ...(moment.commentsData !== undefined ? { commentsData: moment.commentsData } : {}),
          ...(moment.likes === true ? { likes: true } : {}),
          ...(moment.comments === true ? { comments: true } : {}),
        })),
      )
    } catch (e) {
      logger.warn('[wechat-hub] 朋友圈归档入库失败', {
        err: e instanceof Error ? e.message : String(e),
        accountId,
      })
    }
  }

  return {
    moments,
    fetched:
      typeof data.fetched === 'number' && Number.isFinite(data.fetched)
        ? Math.max(0, data.fetched)
        : moments.length,
    pages,
    source: asString(data.source),
    partial,
    stopReason,
    limitReached,
    occludedBy,
    reason: asString(data.reason) ?? result.reason,
    archive,
    ...(fields !== undefined ? { fields } : {}),
    ...(typeof data.downloadMedia === 'boolean' ? { downloadMedia: data.downloadMedia } : {}),
    ...(typeof data.localCacheOnly === 'boolean' ? { localCacheOnly: data.localCacheOnly } : {}),
    ...(mediaStat('downloadedMedia') !== undefined
      ? { downloadedMedia: mediaStat('downloadedMedia') }
      : {}),
    ...(mediaStat('mediaTotal') !== undefined ? { mediaTotal: mediaStat('mediaTotal') } : {}),
    ...(mediaStat('mediaCacheHits') !== undefined
      ? { mediaCacheHits: mediaStat('mediaCacheHits') }
      : {}),
    ...(mediaStat('mediaCacheMisses') !== undefined
      ? { mediaCacheMisses: mediaStat('mediaCacheMisses') }
      : {}),
    ...(mediaStat('mediaExisting') !== undefined
      ? { mediaExisting: mediaStat('mediaExisting') }
      : {}),
    ...(mediaStat('mediaUrlHits') !== undefined ? { mediaUrlHits: mediaStat('mediaUrlHits') } : {}),
    ...(mediaStat('mediaUrlMisses') !== undefined
      ? { mediaUrlMisses: mediaStat('mediaUrlMisses') }
      : {}),
    ...(mediaStat('mediaUrlErrors') !== undefined
      ? { mediaUrlErrors: mediaStat('mediaUrlErrors') }
      : {}),
    ...(mediaStat('mediaUnavailable') !== undefined
      ? { mediaUnavailable: mediaStat('mediaUnavailable') }
      : {}),
    ...(mediaStat('mediaDownloadErrors') !== undefined
      ? { mediaDownloadErrors: mediaStat('mediaDownloadErrors') }
      : {}),
    result,
  }
}

const ARCHIVE_DEFAULT_LIMIT = 50
const ARCHIVE_MAX_LIMIT = 500

function clampArchiveLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return ARCHIVE_DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(Number(value)), 1), ARCHIVE_MAX_LIMIT)
}

/**
 * 归档查询：优先读数据库；库不可用降级读桥本地 JSONL；两者都不可用返回空结果并写明原因。
 * 任何一层失败都不抛 500 伪装成功，storage 字段标明这次数据来自哪里。
 */
export async function listMomentArchive(
  userId: string,
  accountId: string,
  input: { limit?: number; offset?: number } = {},
): Promise<WechatMomentArchiveView> {
  await assertAccountForUser(userId, accountId)
  const limit = clampArchiveLimit(input.limit)
  const offset = Math.max(0, Math.floor(input.offset ?? 0))

  try {
    const moments = await listMomentsArchive(accountId, limit, offset)
    const total = await countMomentsArchive(accountId)
    return { storage: 'database', total, moments, limit, offset, reason: null }
  } catch (dbError) {
    const dbReason = dbError instanceof Error ? dbError.message : String(dbError)
    const bridge = await wechatHubManager.readMomentArchive(userId, accountId, limit)
    if (bridge.ok) {
      const moments = bridge.moments
        .map((item) => asRecord(item))
        .filter((item): item is JsonRecord => item !== null)
        .map((item, index) => readArchiveItem(item, index))
        .filter((item): item is WechatMomentArchiveItemView => item !== null)
      return {
        storage: 'bridge',
        total: bridge.total,
        moments,
        limit,
        offset: 0,
        reason:
          offset > 0
            ? `数据库归档暂不可用，已降级读取桥本地归档（桥不支持翻页，已从第一条返回）：${dbReason}`
            : `数据库归档暂不可用，已降级读取桥本地归档：${dbReason}`,
      }
    }
    return {
      storage: 'none',
      total: 0,
      moments: [],
      limit,
      offset,
      reason: `数据库归档不可用（${dbReason}）；桥本地归档也不可用（${bridge.reason ?? '未知原因'}）`,
    }
  }
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
