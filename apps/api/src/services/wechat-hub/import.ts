// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 历史消息导入：把 IHUI 导出的 JSONL/CSV（或外部工具整理后的同形数据）回填进微信智联。
 *
 * 设计约束：
 *  - 只写本地库，不触发自动回复、出站 webhook、群成员同步等在线副作用。
 *  - 按 (account_id, platform_message_id) 去重；缺 id 时用内容哈希生成稳定 id，重复导入不会翻倍。
 *  - 历史导入不改 unread_count，避免一导入就把未读数打爆。
 */

import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { wechatHubConversations, wechatHubMessages } from '@ihui/database'
import type {
  WechatConversationKind,
  WechatImportMessagesInput,
  WechatImportMessagesResult,
  WechatImportMessageRow,
  WechatMessageDirection,
  WechatMessageKind,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { assertAccountForUser } from './guards.js'

const MAX_IMPORT_ROWS = 5_000
const INSERT_CHUNK = 500
const MESSAGE_KINDS: WechatMessageKind[] = [
  'text',
  'image',
  'voice',
  'video',
  'file',
  'link',
  'card',
  'system',
  'other',
]
const CONVERSATION_KINDS: WechatConversationKind[] = ['private', 'group', 'official', 'service']

interface NormalizedRow {
  index: number
  platformChatId: string
  platformMessageId: string
  title: string
  conversationKind: WechatConversationKind
  direction: WechatMessageDirection
  kind: WechatMessageKind
  senderId: string | null
  senderName: string | null
  content: string
  mediaUrl: string | null
  sentAt: Date
}

function stableMessageId(row: WechatImportMessageRow, sentAt: Date | null): string {
  return `import:${createHash('sha256')
    .update(
      [
        row.platformChatId,
        row.direction ?? 'inbound',
        row.senderId ?? '',
        sentAt?.toISOString() ?? '',
        row.content ?? '',
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`
}

function parseSentAt(value: WechatImportMessageRow['sentAt']): Date | null {
  if (value === undefined || value === null || value === '') return new Date()
  if (typeof value === 'number') {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const text = value.trim()
  if (!text) return new Date()
  if (/^\d{10,13}$/.test(text)) {
    const ms = text.length === 10 ? Number(text) * 1000 : Number(text)
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeImportRow(
  row: WechatImportMessageRow,
  index: number,
): { value: NormalizedRow } | { error: string } {
  if (!row || typeof row !== 'object') return { error: '不是对象' }
  const platformChatId = `${row.platformChatId ?? ''}`.trim().slice(0, 255)
  if (!platformChatId) return { error: '缺少 platformChatId' }
  const sentAt = parseSentAt(row.sentAt)
  if (!sentAt) return { error: 'sentAt 不是合法时间' }
  const direction: WechatMessageDirection =
    row.direction === 'outbound' ? 'outbound' : row.direction === 'inbound' ? 'inbound' : 'inbound'
  const kind = MESSAGE_KINDS.includes(row.kind as WechatMessageKind)
    ? (row.kind as WechatMessageKind)
    : 'text'
  const conversationKind: WechatConversationKind = CONVERSATION_KINDS.includes(
    row.conversationKind as WechatConversationKind,
  )
    ? (row.conversationKind as WechatConversationKind)
    : platformChatId.endsWith('@chatroom')
      ? 'group'
      : 'private'
  const platformMessageId = `${row.platformMessageId ?? ''}`.trim()
  const hasSentAt = row.sentAt !== undefined && row.sentAt !== null && row.sentAt !== ''
  return {
    value: {
      index,
      platformChatId,
      platformMessageId: (
        platformMessageId || stableMessageId(row, hasSentAt ? sentAt : null)
      ).slice(0, 255),
      title: (`${row.conversationTitle ?? ''}`.trim() || platformChatId).slice(0, 255),
      conversationKind,
      direction,
      kind,
      senderId: row.senderId ? `${row.senderId}`.slice(0, 255) : null,
      senderName: row.senderName ? `${row.senderName}`.slice(0, 255) : null,
      content: `${row.content ?? ''}`.slice(0, 20_000),
      mediaUrl: row.mediaUrl ? `${row.mediaUrl}`.slice(0, 2_000) : null,
      sentAt,
    },
  }
}

/**
 * 历史消息导入。返回 imported/skipped/conversations/errors；
 * 逐行坏数据只记 error，不整批失败。
 */
export async function importWechatMessages(
  userId: string,
  accountId: string,
  input: WechatImportMessagesInput,
): Promise<WechatImportMessagesResult> {
  await assertAccountForUser(userId, accountId)
  const rawRows = Array.isArray(input.messages) ? input.messages : []
  const rows = rawRows.slice(0, MAX_IMPORT_ROWS)
  const valid: NormalizedRow[] = []
  const errors: Array<{ index: number; reason: string }> = []
  rows.forEach((row, index) => {
    const result = normalizeImportRow(row, index)
    if ('error' in result) errors.push({ index, reason: result.error })
    else valid.push(result.value)
  })
  if (valid.length === 0) {
    return { imported: 0, skipped: 0, conversations: 0, errors }
  }

  const chatIds = [...new Set(valid.map((row) => row.platformChatId))]
  const existing = await dbRead
    .select({
      id: wechatHubConversations.id,
      platformChatId: wechatHubConversations.platformChatId,
      title: wechatHubConversations.title,
      kind: wechatHubConversations.kind,
      lastMessageAt: wechatHubConversations.lastMessageAt,
    })
    .from(wechatHubConversations)
    .where(
      and(
        eq(wechatHubConversations.accountId, accountId),
        inArray(wechatHubConversations.platformChatId, chatIds),
      ),
    )
  const existingByChat = new Map(existing.map((row) => [row.platformChatId, row]))
  const lastAtByChat = new Map<string, Date>()
  const firstByChat = new Map<string, NormalizedRow>()
  for (const row of valid) {
    const prev = lastAtByChat.get(row.platformChatId)
    if (!prev || row.sentAt > prev) lastAtByChat.set(row.platformChatId, row.sentAt)
    if (!firstByChat.has(row.platformChatId)) firstByChat.set(row.platformChatId, row)
  }

  const missing = chatIds
    .filter((chatId) => !existingByChat.has(chatId))
    .map((chatId) => {
      const sample = firstByChat.get(chatId) as NormalizedRow
      return {
        accountId,
        platformChatId: chatId,
        kind: sample.conversationKind,
        title: sample.title,
        lastMessageAt: lastAtByChat.get(chatId) ?? null,
        metadata: { source: 'history-import' },
      }
    })
  if (missing.length > 0) {
    await db.insert(wechatHubConversations).values(missing).onConflictDoNothing()
  }
  const all = await dbRead
    .select({
      id: wechatHubConversations.id,
      platformChatId: wechatHubConversations.platformChatId,
    })
    .from(wechatHubConversations)
    .where(
      and(
        eq(wechatHubConversations.accountId, accountId),
        inArray(wechatHubConversations.platformChatId, chatIds),
      ),
    )
  const conversationIdByChat = new Map(all.map((row) => [row.platformChatId, row.id]))

  let imported = 0
  for (let offset = 0; offset < valid.length; offset += INSERT_CHUNK) {
    const chunk = valid.slice(offset, offset + INSERT_CHUNK)
    const values = chunk
      .map((row) => {
        const conversationId = conversationIdByChat.get(row.platformChatId)
        if (!conversationId) return null
        return {
          accountId,
          conversationId,
          direction: row.direction,
          kind: row.kind,
          content: row.content,
          mediaUrl: row.mediaUrl,
          senderId: row.senderId,
          senderName: row.senderName,
          platformMessageId: row.platformMessageId,
          sentAt: row.sentAt,
          deliveryStatus: 'sent',
          rawPayload: { source: 'history-import' },
        }
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
    if (values.length === 0) continue
    const inserted = await db
      .insert(wechatHubMessages)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: wechatHubMessages.id })
    imported += inserted.length
  }

  for (const chatId of chatIds) {
    const conversationId = conversationIdByChat.get(chatId)
    const lastAt = lastAtByChat.get(chatId)
    if (!conversationId || !lastAt) continue
    const current = existingByChat.get(chatId)
    if (current?.lastMessageAt && current.lastMessageAt >= lastAt) continue
    await db
      .update(wechatHubConversations)
      .set({ lastMessageAt: lastAt, updatedAt: new Date() })
      .where(eq(wechatHubConversations.id, conversationId))
  }

  return {
    imported,
    skipped: valid.length - imported,
    conversations: conversationIdByChat.size,
    errors,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
