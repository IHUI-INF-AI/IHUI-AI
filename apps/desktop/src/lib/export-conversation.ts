import type { ChatMessage } from './types'
import { pickSavePath, writeTextFile, isTauri } from './desktop'

export type ExportFormat = 'markdown' | 'json' | 'txt'

export interface ExportOptions {
  format: ExportFormat
  title?: string
  messages: ChatMessage[]
}

/** 格式化时间戳为文件名友好的字符串(2026-07-23_15-30)。 */
function formatTimestamp(ts: number = Date.now()): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
}

/** 把 ChatMessage[] 序列化为指定格式字符串。 */
export function serializeConversation(messages: ChatMessage[], format: ExportFormat, title = '对话'): string {
  switch (format) {
    case 'markdown':
      return toMarkdown(messages, title)
    case 'json':
      return toJSON(messages, title)
    case 'txt':
      return toPlainText(messages, title)
  }
}

function toMarkdown(messages: ChatMessage[], title: string): string {
  const lines: string[] = [`# ${title}`, '', `> 导出时间:${new Date().toLocaleString()}`, `> 消息数:${messages.length}`, '']
  for (const m of messages) {
    const role = m.role === 'user' ? '🧑 用户' : '🤖 AI'
    lines.push(`## ${role}`, '', m.content || '(空)', '')
    if (m.attachments && m.attachments.length > 0) {
      lines.push('**附件:**')
      for (const a of m.attachments) {
        lines.push(`- ${a.name}(${a.mime}, ${formatSize(a.size)})`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}

function toJSON(messages: ChatMessage[], title: string): string {
  return JSON.stringify(
    {
      title,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mime: a.mime,
          size: a.size,
          isImage: a.isImage,
        })),
      })),
    },
    null,
    2,
  )
}

function toPlainText(messages: ChatMessage[], title: string): string {
  const lines: string[] = [`${title}`, `导出时间:${new Date().toLocaleString()}`, `消息数:${messages.length}`, '='.repeat(40), '']
  for (const m of messages) {
    const role = m.role === 'user' ? '用户' : 'AI'
    lines.push(`[${role}]`, m.content || '(空)', '')
    if (m.attachments && m.attachments.length > 0) {
      lines.push(`附件:${m.attachments.map((a) => a.name).join(', ')}`)
      lines.push('')
    }
    lines.push('-'.repeat(40), '')
  }
  return lines.join('\n')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 导出对话到本地文件(打开原生保存对话框)。
 * @returns 保存路径,null 表示用户取消
 */
export async function exportConversationToFile(opts: ExportOptions): Promise<string | null> {
  const content = serializeConversation(opts.messages, opts.format, opts.title || '对话')
  const ext = opts.format === 'markdown' ? 'md' : opts.format
  const defaultName = `ihui-${formatTimestamp()}.${ext}`
  if (!isTauri()) {
    // 浏览器降级:触发下载
    downloadBlob(content, defaultName, opts.format === 'json' ? 'application/json' : 'text/plain')
    return defaultName
  }
  const path = await pickSavePath(defaultName, [
    { name: opts.format === 'markdown' ? 'Markdown' : opts.format.toUpperCase(), extensions: [ext] },
  ])
  if (!path) return null
  await writeTextFile(path, content)
  return path
}

/** 浏览器降级:触发文件下载。 */
function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
