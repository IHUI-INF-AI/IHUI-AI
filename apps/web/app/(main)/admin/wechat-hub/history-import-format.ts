// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { WechatImportMessageRow } from '@ihui/types'

const CONVERSATION_KINDS = new Set(['private', 'group', 'official', 'service'])
const MESSAGE_KINDS = new Set([
  'text',
  'image',
  'voice',
  'video',
  'file',
  'link',
  'card',
  'system',
  'other',
])

function textOf(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text || undefined
}

function rawTextOf(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value)
  return text || undefined
}

/** 同时接受 IHUI 导出的 snake_case 与 API 的 camelCase。 */
export function normalizeHistoryRow(raw: unknown): WechatImportMessageRow {
  if (!raw || typeof raw !== 'object') return { platformChatId: '' }
  const row = raw as Record<string, unknown>
  const conversationKind = textOf(row.conversationKind ?? row.conversation_kind)
  const direction = textOf(row.direction)
  const kind = textOf(row.kind)
  return {
    platformChatId:
      textOf(row.platformChatId ?? row.conversation_platform_chat_id ?? row.chatId) ?? '',
    platformMessageId: textOf(row.platformMessageId ?? row.platform_message_id ?? row.messageId),
    conversationTitle: textOf(row.conversationTitle ?? row.conversation_title),
    conversationKind:
      conversationKind && CONVERSATION_KINDS.has(conversationKind)
        ? (conversationKind as WechatImportMessageRow['conversationKind'])
        : undefined,
    direction:
      direction === 'inbound' || direction === 'outbound'
        ? (direction as WechatImportMessageRow['direction'])
        : undefined,
    kind: kind && MESSAGE_KINDS.has(kind) ? (kind as WechatImportMessageRow['kind']) : undefined,
    senderId: textOf(row.senderId ?? row.sender_id),
    senderName: textOf(row.senderName ?? row.sender_name),
    content: rawTextOf(row.content),
    mediaUrl: textOf(row.mediaUrl ?? row.media_url),
    sentAt: textOf(row.sentAt ?? row.sent_at),
  }
}

/** 解析带引号、转义和换行的 CSV；只用于 IHUI 导出的平面表头。 */
export function parseCsv(text: string): Record<string, string>[] {
  const table: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      if (row.length > 1 || row[0]) table.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.length > 1 || row[0]) table.push(row)
  const header = table.shift()
  if (!header) return []
  return table.map((cells) =>
    Object.fromEntries(
      header.map((name, index) => [name.replace(/^\uFEFF/, '').trim(), cells[index] ?? '']),
    ),
  )
}

/** 支持整份 JSON、{messages:[]}、JSONL、CSV 四种输入。 */
export function parseHistoryRows(text: string): WechatImportMessageRow[] {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('文件为空')
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? ''
  if (!firstLine.trim().startsWith('{') && !firstLine.trim().startsWith('[')) {
    const records = parseCsv(trimmed)
    if (records.length > 0) return records.map(normalizeHistoryRow)
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.map(normalizeHistoryRow)
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { messages?: unknown }).messages)
    ) {
      return (parsed as { messages: unknown[] }).messages.map(normalizeHistoryRow)
    }
  } catch {
    // 继续按 JSONL 解析
  }
  return trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return normalizeHistoryRow(JSON.parse(line))
      } catch {
        throw new Error(`第 ${index + 1} 行不是合法 JSON`)
      }
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
