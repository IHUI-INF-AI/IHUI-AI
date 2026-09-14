// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileDown, FileJson, Link2, Camera, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'
import { Tooltip } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

// W15(2026-09-13 立):会话级导出 + 分享菜单(对标 Codex/Qoder 会话导出)。
// - Markdown / JSON 导出:纯前端序列化,浏览器 Blob 下载
// - 快照图:Canvas 手绘对话(浅色固定配色,逐字换行兼容 CJK)
// - 分享链接:POST /api/chat/conversations/{id}/share → 复制 /chat/share/{token}

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

/** 角色显示标签的数据来源:i18n key(渲染层翻译) */
type ExportRole = 'user' | 'assistant'

function isExportableMessage(m: ChatMessage): boolean {
  return (m.role === 'user' || m.role === 'assistant') && m.content.trim().length > 0
}

/** 序列化为 Markdown:`## 用户 / ## 助手` 分节 + 正文 */
function buildMarkdown(
  title: string,
  messages: ChatMessage[],
  roleLabel: Record<ExportRole, string>,
): string {
  const lines: string[] = [`# ${title}`, '']
  for (const m of messages) {
    if (!isExportableMessage(m)) continue
    const role = roleLabel[m.role as ExportRole]
    lines.push(`## ${role}`, '', m.content.trimEnd(), '')
  }
  return lines.join('\n')
}

/** 序列化为 JSON:结构与后端消息字段对齐(id/role/content/createdAt/model) */
function buildJson(title: string, messages: ChatMessage[]): string {
  return JSON.stringify(
    {
      title,
      exportedAt: new Date().toISOString(),
      messageCount: messages.filter(isExportableMessage).length,
      messages: messages.filter(isExportableMessage).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        model: m.model ?? null,
      })),
    },
    null,
    2,
  )
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

/** Canvas 手绘对话快照:标题头部 + 逐消息(角色徽章色条 + 正文)。
 *  内容超出画布高度上限时截断并在底部标注。 */
function renderSnapshotBlob(
  title: string,
  messages: ChatMessage[],
  roleLabel: Record<ExportRole, string>,
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

export interface ChatExportMenuProps {
  /** 会话标题(来自 ai-side-panel displayTitle) */
  title: string
  /** 流式进行中禁用导出(内容不完整) */
  disabled?: boolean
}

export function ChatExportMenu({ title, disabled }: ChatExportMenuProps) {
  const t = useTranslations('chat.exportMenu')

  const roleLabel = React.useMemo(
    () => ({ user: t('roleUser'), assistant: t('roleAssistant') }),
    [t],
  )

  const safeTitle = sanitizeText(title) || 'ai-chat'
  const fileBase = safeTitle.slice(0, 40).replace(/[\\/:*?"<>| ]+/g, '-')

  const handleExportMd = React.useCallback(() => {
    const messages = useChatStore.getState().messages
    if (messages.length === 0) return
    downloadBlob(buildMarkdown(safeTitle, messages, roleLabel), `${fileBase}.md`, 'text/markdown')
    toast.success(t('exportStarted'))
  }, [safeTitle, fileBase, roleLabel, t])

  const handleExportJson = React.useCallback(() => {
    const messages = useChatStore.getState().messages
    if (messages.length === 0) return
    downloadBlob(buildJson(safeTitle, messages), `${fileBase}.json`, 'application/json')
    toast.success(t('exportStarted'))
  }, [safeTitle, fileBase, t])

  const handleSnapshot = React.useCallback(() => {
    const messages = useChatStore.getState().messages
    if (messages.length === 0) return
    const blob = renderSnapshotBlob(safeTitle, messages, roleLabel)
    if (!blob) {
      toast.error(t('snapshotFailed'))
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t('exportStarted'))
  }, [safeTitle, fileBase, roleLabel, t])

  const handleShare = React.useCallback(async () => {
    const convId = useChatStore.getState().conversationId
    if (!convId) return
    try {
      const r = await fetchApi<{ token: string }>(`/api/chat/conversations/${convId}/share`, {
        method: 'POST',
      })
      if (!r.success || !r.data?.token) throw new Error(r.error || t('shareFailed'))
      const shareUrl = `${window.location.origin}/chat/share/${r.data.token}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success(t('shareLinkCopied'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('shareFailed'))
    }
  }, [t])

  const itemCls = 'gap-2'

  return (
    <DropdownMenu>
      <Tooltip content={t('label')}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label={t('label')}
            data-testid="chat-export-menu"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" data-testid="chat-export-menu-content">
        <DropdownMenuItem className={itemCls} onClick={handleExportMd} data-testid="chat-export-md">
          <FileDown className="h-4 w-4" aria-hidden />
          {t('exportMd')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={itemCls}
          onClick={handleExportJson}
          data-testid="chat-export-json"
        >
          <FileJson className="h-4 w-4" aria-hidden />
          {t('exportJson')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={itemCls}
          onClick={handleSnapshot}
          data-testid="chat-export-snapshot"
        >
          <Camera className="h-4 w-4" aria-hidden />
          {t('snapshot')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={itemCls}
          onClick={() => void handleShare()}
          data-testid="chat-export-share"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          {t('share')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ChatExportMenu
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
