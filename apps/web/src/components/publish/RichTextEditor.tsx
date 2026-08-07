'use client'

/**
 * 富文本编辑器 — Markdown 源码 + 所见即所得双模式(轻量自实现,不引入 TipTap/Slate)。
 *
 * 功能:工具栏(加粗/斜体/标题/链接/图片/代码/引用/列表/表格)/ 快捷键 /
 *   粘贴净化 / 字数统计 / 30s 自动保存草稿到 localStorage。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩 / 中文字体对齐
 * AGENTS.md §3:禁 any,精确类型
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Bold, Italic, Heading1, Heading2, Heading3, Link2, Image as ImageIcon,
  Code, Quote, List, ListOrdered, Table as TableIcon, Minus,
} from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

export interface RichTextEditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly maxLength?: number
  readonly onImageUpload?: (file: File) => Promise<string>
}

type EditMode = 'markdown' | 'richtext'

const DRAFT_KEY = 'ihui-publish-draft'
const AUTO_SAVE_INTERVAL_MS = 30_000

/** 粘贴净化:去除危险标签(<script>/<iframe>/<style>/<object>/<embed>),保留结构 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|style|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|style|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

/** 把简易 HTML 转回 Markdown(覆盖 contentEditable 常见输出) */
function htmlToMarkdown(html: string): string {
  let s = sanitizeHtml(html)
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  s = s.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, c: string) => '\n' + c.split('\n').map((l: string) => '> ' + l).join('\n') + '\n')
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, c: string) => '\n' + c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n'))
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, c: string) => '\n' + c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '1. $1\n'))
  s = s.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  return s.replace(/\n{3,}/g, '\n\n').trim()
}

/** Markdown → HTML(仅供富文本预览模式初始化用,覆盖常用语法) */
function markdownToHtml(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let s = esc
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  s = s.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^\*]+)\*/g, '<em>$1</em>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  s = s.replace(/!\[\]\(([^)]+)\)/g, '<img src="$1" alt="" />')
  s = s.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  s = s.replace(/^---$/gm, '<hr/>')
  s = s.replace(/\n/g, '<br/>')
  return s
}

function countWords(text: string): { chars: number; paragraphs: number; minutes: number } {
  const chars = text.replace(/\s/g, '').length
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
  const minutes = Math.max(1, Math.ceil(chars / 400))
  return { chars, paragraphs, minutes }
}

interface ToolbarAction {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly labelKey: string
  readonly wrap: [string, string]
  readonly shortcut?: string
}

const ACTIONS: readonly ToolbarAction[] = [
  { icon: Bold, labelKey: 'editor.bold', wrap: ['**', '**'], shortcut: 'Ctrl+B' },
  { icon: Italic, labelKey: 'editor.italic', wrap: ['*', '*'], shortcut: 'Ctrl+I' },
  { icon: Heading1, labelKey: 'editor.heading', wrap: ['\n# ', '\n'], shortcut: 'Ctrl+1' },
  { icon: Heading2, labelKey: 'editor.heading', wrap: ['\n## ', '\n'], shortcut: 'Ctrl+2' },
  { icon: Heading3, labelKey: 'editor.heading', wrap: ['\n### ', '\n'], shortcut: 'Ctrl+3' },
  { icon: Link2, labelKey: 'editor.link', wrap: ['[', '](https://)'], shortcut: 'Ctrl+K' },
  { icon: ImageIcon, labelKey: 'editor.image', wrap: ['![alt](', ')'] },
  { icon: Code, labelKey: 'editor.code', wrap: ['`', '`'], shortcut: 'Ctrl+Shift+K' },
  { icon: Quote, labelKey: 'editor.quote', wrap: ['\n> ', '\n'] },
  { icon: List, labelKey: 'editor.list', wrap: ['\n- ', '\n'] },
  { icon: ListOrdered, labelKey: 'editor.list', wrap: ['\n1. ', '\n'] },
  { icon: TableIcon, labelKey: 'editor.table', wrap: ['\n| 列1 | 列2 |\n| --- | --- |\n| ', ' | |\n'] },
  { icon: Minus, labelKey: 'editor.quote', wrap: ['\n---\n', ''] },
]

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  onImageUpload,
}: RichTextEditorProps) {
  const t = useTranslations('publish')
  const [mode, setMode] = React.useState<EditMode>('markdown')
  const [autoSaved, setAutoSaved] = React.useState(false)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const ceRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const stats = React.useMemo(() => countWords(value), [value])

  // 在 textarea 当前光标处插入 wrap
  const applyWrap = React.useCallback((wrap: readonly [string, string]) => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)
    const next = value.slice(0, start) + wrap[0] + selected + wrap[1] + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = start + wrap[0].length
      ta.selectionEnd = end + wrap[0].length
    })
  }, [value, onChange])

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); applyWrap(['**', '**']) }
    else if (k === 'i') { e.preventDefault(); applyWrap(['*', '*']) }
    else if (k === 'k') { e.preventDefault(); applyWrap(['[', '](https://)']) }
    else if (e.shiftKey && k === 'k') { e.preventDefault(); applyWrap(['`', '`']) }
    else if (k === '1') { e.preventDefault(); applyWrap(['\n# ', '\n']) }
    else if (k === '2') { e.preventDefault(); applyWrap(['\n## ', '\n']) }
    else if (k === '3') { e.preventDefault(); applyWrap(['\n### ', '\n']) }
  }, [applyWrap])

  // 富文本模式:input 事件 → Markdown
  const handleRichInput = React.useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const html = (e.currentTarget as HTMLDivElement).innerHTML
    onChange(htmlToMarkdown(html))
  }, [onChange])

  const handlePaste = React.useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (text) {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = value.slice(0, start) + text + value.slice(end)
      onChange(next)
    }
  }, [value, onChange])

  const handleRichPaste = React.useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const md = html ? htmlToMarkdown(html) : text
    document.execCommand('insertText', false, md)
  }, [])

  // 图片上传
  const handleImageSelect = React.useCallback(async (file: File) => {
    if (!onImageUpload) return
    try {
      const url = await onImageUpload(file)
      applyWrap([`![${file.name}](`, ')'])
      // 占位:用 url 替换最后一个 (https://) 占位
      onChange((value + '').replace(/\(https:\/\/\)$/, `(${url})`))
    } catch {
      // 上传失败静默(由调用方 toast)
    }
  }, [onImageUpload, applyWrap, onChange, value])

  // 自动保存草稿
  React.useEffect(() => {
    if (mode !== 'markdown' || !value) return
    const timer = setInterval(() => {
      try {
        localStorage.setItem(DRAFT_KEY, value)
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      } catch {
        // localStorage 满或禁用,静默
      }
    }, AUTO_SAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [value, mode])

  // 模式切换时同步内容
  React.useEffect(() => {
    if (mode === 'richtext' && ceRef.current) {
      ceRef.current.innerHTML = markdownToHtml(value)
    }
  }, [mode, value])

  return (
    <div className="rounded-md border border-input">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1.5">
        <div className="flex items-center gap-0.5">
          {(['markdown', 'richtext'] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setMode(m)}
            >
              {t(m === 'markdown' ? 'editor.markdown' : 'editor.richText')}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {ACTIONS.map((act, i) => {
            const Icon = act.icon
            return (
              <Tooltip
                key={`${act.labelKey}-${i}`}
                content={t(act.labelKey as never) + (act.shortcut ? ` (${act.shortcut})` : '')}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => applyWrap(act.wrap)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            )
          })}
          {onImageUpload && (
            <Tooltip content={t('editor.image')}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void handleImageSelect(f)
            }}
          />
        </div>
      </div>

      {/* 编辑区 */}
      {mode === 'markdown' ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={12}
          maxLength={maxLength}
          placeholder={placeholder}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed focus-visible:outline-none"
        />
      ) : (
        <div
          ref={ceRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleRichInput}
          onPaste={handleRichPaste}
          data-placeholder={placeholder}
          className={cn(
            'min-h-[260px] w-full px-3 py-2.5 text-sm leading-relaxed focus-visible:outline-none',
            '[&_.h1]:text-lg [&_.h1]:font-bold [&_.h2]:text-base [&_.h2]:font-semibold [&_.h3]:text-sm [&_.h3]:font-semibold',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
            '[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs',
            '[&_img]:max-w-full [&_img]:rounded-md',
          )}
        />
      )}

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>{t('editor.wordCount', { count: stats.chars })}</span>
        <span>{t('editor.readingTime', { minutes: stats.minutes })}</span>
        {autoSaved && <span className="text-emerald-600 dark:text-emerald-400">{t('editor.autoSaved')}</span>}
      </div>
    </div>
  )
}
