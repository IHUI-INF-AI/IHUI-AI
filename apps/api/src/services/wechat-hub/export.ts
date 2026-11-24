// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { wechatHubConversations, wechatHubMessages } from '@ihui/database'
import type { WechatExportInput, WechatExportResult } from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser } from './guards.js'

const DEFAULT_LIMIT = 5_000
const MAX_LIMIT = 20_000
const CSV_HEADER = [
  'conversation_id',
  'conversation_title',
  'conversation_kind',
  'conversation_platform_chat_id',
  'direction',
  'kind',
  'sender_id',
  'sender_name',
  'content',
  'media_url',
  'platform_message_id',
  'sent_at',
] as const

function parseIsoDate(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} 不是合法时间`, 400, 'WECHAT_EXPORT_BAD_DATE')
  }
  return date
}

function csvCell(value: string): string {
  const text = value.replaceAll('\r\n', '\n')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

/**
 * 导出账号消息为 JSONL / CSV。
 * 只读数据库，不触发平台抓取；默认 5000 条、上限 20000 条，避免一次拉爆内存。
 */
export async function exportAccountMessages(
  userId: string,
  accountId: string,
  input: WechatExportInput,
): Promise<WechatExportResult> {
  await assertAccountForUser(userId, accountId)
  const format = input.format ?? 'jsonl'
  const requested = Number.isFinite(input.limit) ? Number(input.limit) : DEFAULT_LIMIT
  const limit = Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT)

  const conversations = await dbRead
    .select({
      id: wechatHubConversations.id,
      platformChatId: wechatHubConversations.platformChatId,
      kind: wechatHubConversations.kind,
      title: wechatHubConversations.title,
    })
    .from(wechatHubConversations)
    .where(eq(wechatHubConversations.accountId, accountId))
  const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]))
  let conversationIds = conversations.map((conversation) => conversation.id)
  if (input.conversationId) {
    if (!byId.has(input.conversationId)) {
      throw new AppError('会话不存在', 404, 'WECHAT_CONVERSATION_NOT_FOUND')
    }
    conversationIds = [input.conversationId]
  }

  if (conversationIds.length === 0) {
    return {
      filename: `wechat-hub-${accountId.slice(0, 8)}-${timestamp()}.${format}`,
      mimeType: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/x-ndjson;charset=utf-8',
      content: format === 'csv' ? `\uFEFF${CSV_HEADER.join(',')}\n` : '',
      count: 0,
    }
  }

  const conditions = [
    eq(wechatHubMessages.accountId, accountId),
    inArray(wechatHubMessages.conversationId, conversationIds),
  ]
  if (input.since)
    conditions.push(gte(wechatHubMessages.sentAt, parseIsoDate(input.since, 'since')))
  if (input.until)
    conditions.push(lte(wechatHubMessages.sentAt, parseIsoDate(input.until, 'until')))

  const rows = await dbRead
    .select({
      conversationId: wechatHubMessages.conversationId,
      direction: wechatHubMessages.direction,
      kind: wechatHubMessages.kind,
      content: wechatHubMessages.content,
      mediaUrl: wechatHubMessages.mediaUrl,
      senderId: wechatHubMessages.senderId,
      senderName: wechatHubMessages.senderName,
      platformMessageId: wechatHubMessages.platformMessageId,
      sentAt: wechatHubMessages.sentAt,
    })
    .from(wechatHubMessages)
    .where(and(...conditions))
    .orderBy(desc(wechatHubMessages.sentAt))
    .limit(limit)

  const records = rows.reverse().map((row) => {
    const conversation = byId.get(row.conversationId)
    return {
      conversation_id: row.conversationId,
      conversation_title: conversation?.title ?? '',
      conversation_kind: conversation?.kind ?? '',
      conversation_platform_chat_id: conversation?.platformChatId ?? '',
      direction: row.direction,
      kind: row.kind,
      sender_id: row.senderId ?? '',
      sender_name: row.senderName ?? '',
      content: row.content,
      media_url: row.mediaUrl ?? '',
      platform_message_id: row.platformMessageId ?? '',
      sent_at: row.sentAt.toISOString(),
    }
  })

  const stamp = timestamp()
  if (format === 'csv') {
    const lines = [
      CSV_HEADER.join(','),
      ...records.map((record) =>
        [
          record.conversation_id,
          record.conversation_title,
          record.conversation_kind,
          record.conversation_platform_chat_id,
          record.direction,
          record.kind,
          record.sender_id,
          record.sender_name,
          record.content,
          record.media_url,
          record.platform_message_id,
          record.sent_at,
        ]
          .map((value) => csvCell(value))
          .join(','),
      ),
    ]
    return {
      filename: `wechat-hub-${accountId.slice(0, 8)}-${stamp}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: `\uFEFF${lines.join('\n')}\n`,
      count: records.length,
    }
  }

  return {
    filename: `wechat-hub-${accountId.slice(0, 8)}-${stamp}.jsonl`,
    mimeType: 'application/x-ndjson;charset=utf-8',
    content: records.map((record) => JSON.stringify(record)).join('\n'),
    count: records.length,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
