// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import ExcelJS from 'exceljs'
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { wechatHubConversations, wechatHubMessages } from '@ihui/database'
import type { WechatExportFormat, WechatExportInput, WechatExportResult } from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser } from './guards.js'
import {
  renderChatLab,
  renderHtml,
  renderMarkdown,
  renderPostgresSql,
  type ExportConversationMeta,
  type ExportMessageRow,
} from './export-formats.js'

const DEFAULT_LIMIT = 5_000
const MAX_LIMIT = 20_000
const EXCEL_CELL_LIMIT = 32_000
const EXPORT_FORMATS: WechatExportFormat[] = [
  'jsonl',
  'csv',
  'html',
  'markdown',
  'xlsx',
  'chatlab',
  'sql',
]
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

function resolveFormat(value: WechatExportInput['format']): WechatExportFormat {
  if (value === undefined) return 'jsonl'
  if (!EXPORT_FORMATS.includes(value)) {
    throw new AppError(`不支持的导出格式: ${value}`, 400, 'WECHAT_EXPORT_FORMAT_UNSUPPORTED')
  }
  return value
}

function resolveTimezone(value: string | undefined): string {
  const timezone = (value ?? '').trim() || 'Asia/Shanghai'
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: timezone })
    return timezone
  } catch {
    throw new AppError(`时区不合法: ${timezone}`, 400, 'WECHAT_EXPORT_BAD_TIMEZONE')
  }
}

function isoOrEmpty(date: Date | null): string {
  return date ? date.toISOString() : ''
}

async function buildExcel(rows: ExportMessageRow[]): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'IHUI AI 微信智联'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('消息', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  sheet.columns = [
    { header: '会话', key: 'conversation', width: 24 },
    { header: '会话类型', key: 'conversationKind', width: 10 },
    { header: '方向', key: 'direction', width: 8 },
    { header: '类型', key: 'kind', width: 8 },
    { header: '发送人', key: 'sender', width: 16 },
    { header: '内容', key: 'content', width: 60 },
    { header: '媒体地址', key: 'media', width: 40 },
    { header: '时间', key: 'sentAt', width: 20 },
    { header: '消息 ID', key: 'messageId', width: 34 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: 'middle' }
  for (const row of rows) {
    sheet.addRow({
      conversation: row.conversationTitle || row.conversationId,
      conversationKind: row.conversationKind,
      direction: row.direction,
      kind: row.kind,
      sender: row.direction === 'outbound' ? '我' : row.senderName || row.senderId || '',
      content: row.content.slice(0, EXCEL_CELL_LIMIT),
      media: row.mediaUrl ?? '',
      sentAt: row.sentAt.toISOString(),
      messageId: row.platformMessageId,
    })
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as unknown as ArrayBuffer).toString('base64')
}

/**
 * 导出账号消息：jsonl / csv / html / markdown / xlsx / chatlab。
 *
 * 只读数据库，不触发平台抓取；默认 5000 条、上限 20000 条，避免一次拉爆内存。
 * html/markdown/xlsx/chatlab 属于「给人看 / 给别的工具吃」的形态，
 * 统一按时间正序输出，jsonl/csv 保持原有的正序语义不变。
 */
export async function exportAccountMessages(
  userId: string,
  accountId: string,
  input: WechatExportInput,
): Promise<WechatExportResult> {
  const account = await assertAccountForUser(userId, accountId)
  const format = resolveFormat(input.format)
  const timezone = resolveTimezone(input.timezone)
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
      encoding: 'utf8',
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

  const rows = (
    await dbRead
      .select({
        id: wechatHubMessages.id,
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
  ).reverse()

  const records = rows.map((row) => {
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

  const messageRows: ExportMessageRow[] = rows.map((row) => {
    const conversation = byId.get(row.conversationId)
    return {
      id: row.id,
      conversationId: row.conversationId,
      conversationTitle: conversation?.title ?? '',
      conversationKind: conversation?.kind ?? '',
      direction: row.direction,
      kind: row.kind,
      content: row.content,
      mediaUrl: row.mediaUrl,
      senderId: row.senderId,
      senderName: row.senderName,
      platformMessageId: row.platformMessageId ?? '',
      sentAt: row.sentAt,
    }
  })
  const conversationMeta: ExportConversationMeta[] = conversations
    .filter((conversation) => conversationIds.includes(conversation.id))
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      kind: conversation.kind,
      platformChatId: conversation.platformChatId,
    }))

  const stamp = timestamp()
  const prefix = `wechat-hub-${accountId.slice(0, 8)}-${stamp}`
  const label = account.label || '微信账号'

  if (format === 'html') {
    return {
      filename: `${prefix}.html`,
      mimeType: 'text/html;charset=utf-8',
      content: renderHtml(label, conversationMeta, messageRows, timezone),
      count: messageRows.length,
      encoding: 'utf8',
    }
  }

  if (format === 'markdown') {
    return {
      filename: `${prefix}.md`,
      mimeType: 'text/markdown;charset=utf-8',
      content: renderMarkdown(label, conversationMeta, messageRows, timezone),
      count: messageRows.length,
      encoding: 'utf8',
    }
  }

  if (format === 'chatlab') {
    return {
      filename: `${prefix}.chatlab.json`,
      mimeType: 'application/json;charset=utf-8',
      content: JSON.stringify(renderChatLab(label, conversationMeta, messageRows), null, 2),
      count: messageRows.length,
      encoding: 'utf8',
    }
  }

  if (format === 'sql') {
    return {
      filename: `${prefix}.sql`,
      mimeType: 'application/sql;charset=utf-8',
      content: renderPostgresSql(label, conversationMeta, messageRows, timezone),
      count: messageRows.length,
      encoding: 'utf8',
    }
  }

  if (format === 'xlsx') {
    return {
      filename: `${prefix}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: await buildExcel(messageRows),
      count: messageRows.length,
      encoding: 'base64',
    }
  }

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
      filename: `${prefix}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: `\uFEFF${lines.join('\n')}\n`,
      count: records.length,
      encoding: 'utf8',
    }
  }

  return {
    filename: `${prefix}.jsonl`,
    mimeType: 'application/x-ndjson;charset=utf-8',
    content: records.map((record) => JSON.stringify(record)).join('\n'),
    count: records.length,
    encoding: 'utf8',
  }
}

/** 供报告/指令复用的时间戳工具，避免各处重复实现。 */
export const exportHelpers = { isoOrEmpty, timestamp }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
