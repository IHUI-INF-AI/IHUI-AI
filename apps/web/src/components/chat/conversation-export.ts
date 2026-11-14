// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会话级导出/分享能力(W15):会话无关的纯逻辑 + IO 封装,供侧边栏会话"..."菜单调用。
// - Markdown / JSON 导出:序列化后浏览器 Blob 下载
// - 快照图:Canvas 手绘对话(浅色固定配色,逐字换行兼容 CJK)
// - 分享卡片:SVG 模板 → 离屏 canvas 转 PNG
// - 分享链接:POST /api/chat/conversations/{id}/share → 复制 /chat/share/{token}
// 消息来源按会话 ID 分页拉全量,不依赖前端当前加载的会话。

import { getMessages, exportConversationZip } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import {
  buildConversationMarkdown,
  buildConversationMessagesJson,
  isExportableMessage as isSharedExportableMessage,
  normalizeExportToolCalls,
  sanitizeExportTitle,
  type ConversationExportMessage,
} from '@ihui/shared/chat/conversation-export'
import {
  buildShareCardSvg,
  SHARE_CARD_WIDTH,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_BRAND_COLOR,
} from '@/components/chat/share-card-svg'

export type ExportRole = 'user' | 'assistant'

/** 导出所需的最小消息结构(ChatMessage / ConversationMessage 均可结构化赋值) */
export interface ExportMessage {
  id: string
  role: string
  content: string
  createdAt?: string
  model?: string | null
  /** assistant 推理原文(历史接口按需下发;缺失不是"没有推理"的证据)。 */
  reasoning?: string | null
  /** 服务端落库元数据(toolCalls 在 metadata 内,D24 同一落库面)。 */
  metadata?: Record<string, unknown> | null
  /** 部分端会把 toolCalls 提到顶层(结构同 BaseToolCall)。 */
  toolCalls?: unknown
}

/** 把端内消息收敛为共享导出结构:toolCalls 优先取 metadata,再回退顶层。 */
function toSharedMessages(messages: ExportMessage[]): ConversationExportMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    model: message.model ?? null,
    reasoning: message.reasoning ?? null,
    toolCalls: normalizeExportToolCalls(message.metadata?.toolCalls ?? message.toolCalls),
  }))
}

export type ExportRoleLabel = Record<ExportRole, string> & { toolCalls?: string }

const MESSAGES_PAGE_SIZE = 100

function isExportableMessage(m: ExportMessage): boolean {
  // 快照画布只渲染正文;toolCalls 结构此处不参与判定(类型也不必窄化)
  return isSharedExportableMessage({ role: m.role, content: m.content })
}

/** 按会话 ID 拉取全量消息(时间正序;pageSize 上限 100,循环翻页) */
export async function fetchConversationMessages(id: string): Promise<ExportMessage[]> {
  const first = await getMessages(id, { page: 1, pageSize: MESSAGES_PAGE_SIZE })
  if (!first.success) throw new Error(first.error)
  const all: ExportMessage[] = [...first.data.messages]
  const totalPages = Math.ceil(first.data.total / MESSAGES_PAGE_SIZE)
  for (let p = 2; p <= totalPages; p++) {
    const res = await getMessages(id, { page: p, pageSize: MESSAGES_PAGE_SIZE })
    if (!res.success) throw new Error(res.error)
    all.push(...res.data.messages)
  }
  return all
}

/** 文件名前缀:去控制字符 + 非法字符替换 + 截断 40 */
function toFileBase(title: string): string {
  const safe = sanitizeText(title) || 'ai-chat'
  return safe.slice(0, 40).replace(/[\\/:*?"<>| ]+/g, '-')
}

/** 文本安全化:去掉控制字符,超长截断(快照图与导出共用上限口径) */
function sanitizeText(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
}

/** 逐字符换行(兼容 CJK 无空格断行;ASCII 长词也按字符切,快照图可接受) */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    const candidate = current + ch
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/** 序列化为 Markdown:`## 用户 / ## 助手` 分节 + 正文(序列化规则在 @ihui/shared/chat) */
function buildMarkdown(
  title: string,
  messages: ExportMessage[],
  roleLabel: ExportRoleLabel,
): string {
  return buildConversationMarkdown(title, toSharedMessages(messages), roleLabel)
}

/** 序列化为 JSON:结构与后端消息字段对齐(id/role/content/createdAt/model/reasoning/toolCalls) */
function buildJson(title: string, messages: ExportMessage[]): string {
  return buildConversationMessagesJson(title, toSharedMessages(messages), new Date().toISOString())
}

/** 触发浏览器下载(Blob 方案,内存即弃) */
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

function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 快照画布几何参数(浅色固定配色,不读 CSS 变量 — 离屏 canvas 无主题上下文) */
const SNAPSHOT = {
  width: 720,
  padding: 24,
  headerHeight: 64,
  lineHeight: 20,
  roleBadgeWidth: 52,
  maxCanvasHeight: 16000, // canvas 单幅高度上限(浏览器限制 32767,留安全余量)
  fontSize: 13,
  maxTextCharsPerMessage: 4000, // 单消息导出字符上限(防极端长文撑爆画布)
}

/** Canvas 手绘对话快照:标题头部 + 逐消息(角色徽章色条 + 正文)。
 *  内容超出画布高度上限时截断并在底部标注。 */
function renderSnapshotBlob(
  title: string,
  messages: ExportMessage[],
  roleLabel: ExportRoleLabel,
): Blob | null {
  const canvas = document.createElement('canvas')
  canvas.width = SNAPSHOT.width
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.font = `${SNAPSHOT.fontSize}px system-ui, sans-serif`
  const textMaxWidth = SNAPSHOT.width - SNAPSHOT.padding * 2 - SNAPSHOT.roleBadgeWidth
  const titleLines = wrapText(ctx, sanitizeText(title) || 'AI Chat', textMaxWidth)

  // 预计算每消息行数以确定画布高度
  type Block = { role: ExportRole; lines: string[] }
  const blocks: Block[] = []
  let truncated = false
  for (const m of messages) {
    if (!isExportableMessage(m)) continue
    if (blocks.length >= 200) {
      truncated = true
      break
    }
    let text = sanitizeText(m.content)
    if (text.length > SNAPSHOT.maxTextCharsPerMessage) {
      text = `${text.slice(0, SNAPSHOT.maxTextCharsPerMessage)}…`
    }
    const lines = wrapText(ctx, text, textMaxWidth)
    blocks.push({ role: m.role as ExportRole, lines })
  }

  let height = SNAPSHOT.headerHeight + titleLines.length * 28 + 16
  for (const b of blocks) {
    height += 28 + b.lines.length * SNAPSHOT.lineHeight + 12
  }
  if (truncated) height += 28
  height = Math.min(height + SNAPSHOT.padding, SNAPSHOT.maxCanvasHeight)
  canvas.height = height

  // 背景
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 头部:标题 + 时间戳
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 18px system-ui, sans-serif'
  let y = SNAPSHOT.padding
  for (const line of titleLines) {
    ctx.fillText(line, SNAPSHOT.padding, y + 18)
    y += 28
  }
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = '#8a8a8a'
  ctx.fillText(new Date().toLocaleString() + ' · IHUI AI', SNAPSHOT.padding, y + 14)
  y = SNAPSHOT.headerHeight + titleLines.length * 28 + 16

  // 消息块:角色徽章色条 + 正文
  ctx.font = `${SNAPSHOT.fontSize}px system-ui, sans-serif`
  for (const b of blocks) {
    if (y + 28 > height) break
    const isUser = b.role === 'user'
    // 角色徽章(色块 + 白字)
    ctx.fillStyle = isUser ? '#2563eb' : '#10b981'
    ctx.fillRect(SNAPSHOT.padding, y, SNAPSHOT.roleBadgeWidth, 18)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.fillText(roleLabel[b.role], SNAPSHOT.padding + 6, y + 13)
    ctx.font = `${SNAPSHOT.fontSize}px system-ui, sans-serif`
    y += 28
    ctx.fillStyle = isUser ? '#1e3a8a' : '#1f2937'
    for (const line of b.lines) {
      if (y > height - SNAPSHOT.padding) break
      ctx.fillText(line, SNAPSHOT.padding + SNAPSHOT.roleBadgeWidth, y + 14)
      y += SNAPSHOT.lineHeight
    }
    y += 12
  }
  if (truncated) {
    ctx.fillStyle = '#8a8a8a'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('…', SNAPSHOT.padding, height - SNAPSHOT.padding)
  }

  try {
    const dataUrl = canvas.toDataURL('image/png')
    const bin = atob(dataUrl.split(',')[1] ?? '')
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: 'image/png' })
  } catch {
    return null
  }
}

/** 导出为 Markdown 文件。无可导出消息时返回 false(不触发下载)。 */
export async function downloadConversationMarkdown(
  id: string,
  title: string,
  roleLabel: ExportRoleLabel,
): Promise<boolean> {
  const messages = await fetchConversationMessages(id)
  if (!messages.some(isExportableMessage)) return false
  const safeTitle = sanitizeExportTitle(title)
  downloadBlob(
    buildMarkdown(safeTitle, messages, roleLabel),
    `${toFileBase(title)}.md`,
    'text/markdown',
  )
  return true
}

/** 导出为 JSON 文件。无可导出消息时返回 false(不触发下载)。 */
export async function downloadConversationJson(id: string, title: string): Promise<boolean> {
  const messages = await fetchConversationMessages(id)
  if (!messages.some(isExportableMessage)) return false
  const safeTitle = sanitizeExportTitle(title)
  downloadBlob(buildJson(safeTitle, messages), `${toFileBase(title)}.json`, 'application/json')
  return true
}

/**
 * 导出会话日志 ZIP(conversation.md + messages.json + manifest.json)。
 * 服务端组装,客户端只负责下载;空会话也会产出三件套(manifest 里 messageCount=0)。
 */
export async function downloadConversationZip(id: string, title: string): Promise<boolean> {
  const blob = await exportConversationZip(id)
  downloadBlobFile(blob, `${toFileBase(title)}-${id.slice(0, 8)}.zip`)
  return true
}

/** 复制整段会话为 Markdown。无可导出消息时返回 false(不写剪贴板)。 */
export async function copyConversationMarkdown(
  id: string,
  title: string,
  roleLabel: ExportRoleLabel,
): Promise<boolean> {
  const messages = await fetchConversationMessages(id)
  if (!messages.some(isExportableMessage)) return false
  const markdown = buildMarkdown(sanitizeExportTitle(title), messages, roleLabel)
  try {
    await navigator.clipboard.writeText(markdown)
    return true
  } catch {
    // 非安全上下文/旧浏览器:退回到 execCommand(textarea 方案)
    const textarea = document.createElement('textarea')
    textarea.value = markdown
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  }
}

/** 导出对话快照图 PNG。生成失败抛错;无可导出消息返回 false。 */
export async function downloadConversationSnapshot(
  id: string,
  title: string,
  roleLabel: ExportRoleLabel,
): Promise<boolean> {
  const messages = await fetchConversationMessages(id)
  if (!messages.some(isExportableMessage)) return false
  const blob = renderSnapshotBlob(sanitizeText(title) || 'ai-chat', messages, roleLabel)
  if (!blob) throw new Error('snapshot render failed')
  downloadBlobFile(blob, `${toFileBase(title)}.png`)
  return true
}

/** 导出分享图片卡 PNG(SVG 模板 → 离屏 canvas)。生成失败抛错;无可导出消息返回 false。 */
export async function downloadConversationShareCard(
  id: string,
  title: string,
  userLabel: string,
): Promise<boolean> {
  const messages = (await fetchConversationMessages(id)).filter(isExportableMessage)
  if (messages.length === 0) return false
  const firstUser = messages.find((m) => m.role === 'user')
  const firstAi = messages.find((m) => m.role === 'assistant')
  const svg = buildShareCardSvg({
    title: sanitizeText(title) || 'ai-chat',
    firstUser: (firstUser?.content ?? '').slice(0, 80),
    firstAi: (firstAi?.content ?? '').slice(0, 200),
    time: new Date().toLocaleString(),
    model: firstAi?.model ?? 'IHUI AI',
    brandColor: SHARE_CARD_BRAND_COLOR,
    userLabel,
  })
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('snapshot render failed'))
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_CARD_WIDTH
  canvas.height = SHARE_CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error('snapshot render failed')
  }
  ctx.drawImage(img, 0, 0)
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  URL.revokeObjectURL(url)
  if (!png) throw new Error('snapshot render failed')
  downloadBlobFile(png, `${toFileBase(title)}.png`)
  return true
}

/** 创建分享链接并写入剪贴板,返回分享 URL。失败抛错(消息已本地化由调用方兜底)。 */
export async function copyConversationShareLink(
  id: string,
  fallbackError: string,
): Promise<string> {
  const r = await fetchApi<{ token: string }>(`/api/chat/conversations/${id}/share`, {
    method: 'POST',
  })
  if (!r.success || !r.data?.token) throw new Error(r.error || fallbackError)
  const shareUrl = `${window.location.origin}/chat/share/${r.data.token}`
  await navigator.clipboard.writeText(shareUrl)
  return shareUrl
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** D20(G-11):打印通道导出 PDF —— 隐藏 iframe 装载打印版 HTML,调起系统打印(用户选"另存为 PDF") */
export async function printConversationPdf(
  id: string,
  title: string,
  roleLabel: ExportRoleLabel,
): Promise<boolean> {
  const messages = await fetchConversationMessages(id)
  const printable = messages.filter(isExportableMessage)
  if (printable.length === 0) return false
  const body = printable
    .map(
      (m) =>
        `<section class="msg"><h2>${escapeHtml(
          roleLabel[m.role as ExportRole] ?? m.role,
        )}</h2><pre>${escapeHtml(m.content.trimEnd())}</pre></section>`,
    )
    .join('\n')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px}.msg{margin:0 0 24px}.msg h2{font-size:12px;color:#666;margin:0 0 6px}pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0;font-size:13px;line-height:1.6}@media print{body{margin:12mm}}</style></head><body><h1>${escapeHtml(
    title,
  )}</h1>${body}</body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) {
    iframe.remove()
    return false
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  await new Promise((r) => setTimeout(r, 50))
  win.focus()
  win.print()
  setTimeout(() => iframe.remove(), 1000)
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
