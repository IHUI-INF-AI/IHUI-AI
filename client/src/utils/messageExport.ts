/**
 * 消息导出工具
 * 用于导出聊天记录到文件
 */

import { logger } from './logger'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  model?: string
}

export interface ExportOptions {
  format: 'json' | 'md' | 'txt' | 'csv' | 'markdown'
  filename?: string
  includeMetadata?: boolean
}

/**
 * 导出消息到文件
 */
export function exportMessagesToFile(
  messages: Message[],
  options: ExportOptions = { format: 'json' }
): void {
  if (typeof window === 'undefined') return

  const { format, filename, includeMetadata = true } = options

  let content: string
  let mimeType: string
  let extension: string

  switch (format) {
    case 'json':
      content = exportAsJSON(messages, includeMetadata)
      mimeType = 'application/json'
      extension = 'json'
      break
    case 'md':
      content = exportAsMarkdown(messages, includeMetadata)
      mimeType = 'text/markdown'
      extension = 'md'
      break
    case 'txt':
      content = exportAsText(messages, includeMetadata)
      mimeType = 'text/plain'
      extension = 'txt'
      break
    default:
      throw new Error(`不支持的导出格式: ${format}`)
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  const defaultFilename = `chat-export-${new Date().toISOString().split('T')[0]}`
  link.href = url
  link.download = `${filename || defaultFilename}.${extension}`

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)

  logger.info('[MessageExport] Messages exported:', { format, count: messages.length })
}

/**
 * 导出为 JSON 格式
 */
function exportAsJSON(messages: Message[], includeMetadata: boolean): string {
  const data = includeMetadata
    ? {
        exportTime: new Date().toISOString(),
        messageCount: messages.length,
        messages,
      }
    : messages

  return JSON.stringify(data, null, 2)
}

/**
 * 导出为 Markdown 格式
 */
function exportAsMarkdown(messages: Message[], includeMetadata: boolean): string {
  const lines: string[] = []

  if (includeMetadata) {
    lines.push('# 聊天记录导出')
    lines.push('')
    lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`)
    lines.push(`消息数量: ${messages.length}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  messages.forEach((message) => {
    const role = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统'
    const time = message.timestamp
      ? new Date(message.timestamp).toLocaleString('zh-CN')
      : ''

    lines.push(`### ${role}${time ? ` (${time})` : ''}`)
    if (message.model) {
      lines.push(`*模型: ${message.model}*`)
    }
    lines.push('')
    lines.push(message.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * 导出为纯文本格式
 */
function exportAsText(messages: Message[], includeMetadata: boolean): string {
  const lines: string[] = []

  if (includeMetadata) {
    lines.push('聊天记录导出')
    lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`)
    lines.push(`消息数量: ${messages.length}`)
    lines.push('')
    lines.push('================')
    lines.push('')
  }

  messages.forEach((message) => {
    const role = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统'
    const time = message.timestamp
      ? new Date(message.timestamp).toLocaleString('zh-CN')
      : ''

    lines.push(`[${role}]${time ? ` ${time}` : ''}`)
    if (message.model) {
      lines.push(`(模型: ${message.model})`)
    }
    lines.push(message.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * 格式化消息内容为纯文本
 */
export function formatMessageContent(content: string): string {
  // 移除 HTML 标签
  return content.replace(/<[^>]*>/g, '').trim()
}

export default {
  exportMessagesToFile,
  formatMessageContent,
}
