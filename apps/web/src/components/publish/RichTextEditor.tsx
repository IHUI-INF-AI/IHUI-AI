// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Link2,
  Image as ImageIcon,
  Code,
  Quote,
  List,
  ListOrdered,
  Table as TableIcon,
  Minus,
} from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
// CSP img-src 收窄后,所有外部 http(s) 图片必须走同源代理 /api/media/image,否则被 CSP 拦
import { toMediaImageUrl } from '@/lib/media-proxy'

export interface RichTextEditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly maxLength?: number
  readonly onImageUpload?: (file: File) => Promise<string>
}

type EditMode = 'markdown' | 'richtext'

const DRAFT_KEY = 'ihui-publish-draft'
/** 停止输入后多久把草稿写进 localStorage(防抖;原先 30s 周期会被连续输入不断重建) */
const AUTO_SAVE_DEBOUNCE_MS = 1_500

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
  s = s.replace(
    /<img[^>]*src="([^"]*)"[^>]*\/?>/gi,
    (_m, src: string) => '![](' + toMediaImageUrl(src) + ')',
  )
  s = s.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_m, c: string) =>
      '\n' +
      c
        .split('\n')
        .map((l: string) => '> ' + l)
        .join('\n') +
      '\n',
  )
  s = s.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_m, c: string) => '\n' + c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n'),
  )
  s = s.replace(
    /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_m, c: string) => '\n' + c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '1. $1\n'),
  )
  s = s.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
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
  // 2026-10-31 安全强化第 10 批:url/src 内的 `"` 会闭合属性注入 onmouseover 等
  // 事件处理器 —— 转义后再进属性;链接目标只放行 http(s)/站内/锚点/mailto,
  // javascript: 同族 scheme 一律降级为无 href 的 <a>。
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    const safeUrl = url.replace(/"/g, '%22')
    const safeText = text.replace(/"/g, '&quot;')
    if (!/^(https?:\/\/|\/|#|mailto:)/i.test(url)) return `<a>${safeText}</a>`
    return `<a href="${safeUrl}">${safeText}</a>`
  })
  s = s.replace(
    /!\[\]\(([^)]+)\)/g,
    (_m, src: string) =>
      '<img src="' + toMediaImageUrl(src).replace(/"/g, '%22') + '" alt="" />',
  )
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
  /** 富文本模式的执行档:命令名或本编辑器特判(image/table/code/link/h1..h3/blockquote)。
   *  缺省 ⇒ 富文本模式下该按钮禁用 —— 原实现一律走 markdown 包裹(applyWrap),
   *  而 richtext 分支根本没有 textarea,`if (!ta) return` 让 13 个按钮全部点了没反应。 */
  readonly rich?: string
}

const ACTIONS: readonly ToolbarAction[] = [
  { icon: Bold, labelKey: 'editor.bold', wrap: ['**', '**'], shortcut: 'Ctrl+B', rich: 'bold' },
  { icon: Italic, labelKey: 'editor.italic', wrap: ['*', '*'], shortcut: 'Ctrl+I', rich: 'italic' },
  {
    icon: Heading1,
    labelKey: 'editor.heading',
    wrap: ['\n# ', '\n'],
    shortcut: 'Ctrl+1',
    rich: 'h1',
  },
  {
    icon: Heading2,
    labelKey: 'editor.heading',
    wrap: ['\n## ', '\n'],
    shortcut: 'Ctrl+2',
    rich: 'h2',
  },
  {
    icon: Heading3,
    labelKey: 'editor.heading',
    wrap: ['\n### ', '\n'],
    shortcut: 'Ctrl+3',
    rich: 'h3',
  },
  {
    icon: Link2,
    labelKey: 'editor.link',
    wrap: ['[', '](https://)'],
    shortcut: 'Ctrl+K',
    rich: 'link',
  },
  { icon: ImageIcon, labelKey: 'editor.image', wrap: ['![alt](', ')'], rich: 'image' },
  {
    icon: Code,
    labelKey: 'editor.code',
    wrap: ['`', '`'],
    shortcut: 'Ctrl+Shift+K',
    rich: 'code',
  },
  { icon: Quote, labelKey: 'editor.quote', wrap: ['\n> ', '\n'], rich: 'blockquote' },
  { icon: List, labelKey: 'editor.list', wrap: ['\n- ', '\n'], rich: 'insertUnorderedList' },
  { icon: ListOrdered, labelKey: 'editor.list', wrap: ['\n1. ', '\n'], rich: 'insertOrderedList' },
  {
    icon: TableIcon,
    labelKey: 'editor.table',
    wrap: ['\n| 列1 | 列2 |\n| --- | --- |\n| ', ' | |\n'],
    rich: 'table',
  },
  { icon: Minus, labelKey: 'editor.quote', wrap: ['\n---\n', ''], rich: 'insertHorizontalRule' },
]

/** 本编辑器自有 chord 的键位(从 ACTIONS 派生,与工具条标签同源不漂移) */
const EDITOR_OWNED_CHORDS = new Set(
  ACTIONS.map((a) => a.shortcut?.split('+').pop()?.toLowerCase()).filter((k): k is string =>
    Boolean(k),
  ),
)

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
  const applyWrap = React.useCallback(
    (wrap: readonly [string, string]) => {
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
    },
    [value, onChange],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!e.ctrlKey && !e.metaKey) return
      const k = (e.key ?? '').toLowerCase() // WebView2 偶发 key 为 undefined(IME/合成事件)
      // 本编辑器自有的 chord 必须截断冒泡:React 根容器监听早于 window,
      // 不截断则同一次按键还会再命中 use-global-shortcuts 的全局注册表
      // (Ctrl+1/2/3 = 切对话模式,Ctrl+K = 命令面板),造成"一次按键两件事"。
      if (EDITOR_OWNED_CHORDS.has(k)) e.stopPropagation()
      if (k === 'b') {
        e.preventDefault()
        applyWrap(['**', '**'])
      } else if (k === 'i') {
        e.preventDefault()
        applyWrap(['*', '*'])
      } else if (k === 'k') {
        e.preventDefault()
        applyWrap(['[', '](https://)'])
      } else if (e.shiftKey && k === 'k') {
        e.preventDefault()
        applyWrap(['`', '`'])
      } else if (k === '1') {
        e.preventDefault()
        applyWrap(['\n# ', '\n'])
      } else if (k === '2') {
        e.preventDefault()
        applyWrap(['\n## ', '\n'])
      } else if (k === '3') {
        e.preventDefault()
        applyWrap(['\n### ', '\n'])
      }
    },
    [applyWrap],
  )

  // 富文本模式的工具栏执行档。原实现 13 个按钮一律走 applyWrap(靠 taRef),而 richtext 分支
  // 不渲染 textarea ⇒ `if (!ta) return` 把每次点击静默吞掉(按钮有态、正文无变化)。
  const runRichAction = React.useCallback((act: ToolbarAction) => {
    const ce = ceRef.current
    if (!ce || !act.rich) return
    ce.focus()
    switch (act.rich) {
      case 'image':
        fileInputRef.current?.click()
        return
      case 'link':
        document.execCommand('createLink', false, 'https://')
        return
      case 'table':
        document.execCommand(
          'insertHTML',
          false,
          '<table><tbody><tr><td>列1</td><td>列2</td></tr><tr><td></td><td></td></tr></tbody></table>',
        )
        return
      case 'code': {
        const sel = window.getSelection()?.toString() ?? ''
        const escd = (sel || 'code')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        document.execCommand('insertHTML', false, `<code>${escd}</code>`)
        return
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'blockquote':
        document.execCommand('formatBlock', false, `<${act.rich}>`)
        return
      default:
        document.execCommand(act.rich, false)
    }
  }, [])

  const runAction = React.useCallback(
    (act: ToolbarAction) => {
      if (mode === 'richtext') runRichAction(act)
      else applyWrap(act.wrap)
    },
    [mode, runRichAction, applyWrap],
  )

  // 富文本模式:input 事件 → Markdown。
  // richEmitRef 记录"这次 value 是编辑器自己发出来的"——同步 effect 据此跳过 DOM 重写,
  // 否则每敲一个字都会把 innerHTML 整段覆盖、光标弹回开头(用户无法连续输入)。
  const richEmitRef = React.useRef<string | null>(null)
  const richInitRef = React.useRef(false)
  const handleRichInput = React.useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const html = (e.currentTarget as HTMLDivElement).innerHTML
      const md = htmlToMarkdown(html)
      richEmitRef.current = md
      onChange(md)
    },
    [onChange],
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData('text/plain')
      if (text) {
        e.preventDefault()
        const ta = e.currentTarget
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const next = value.slice(0, start) + text + value.slice(end)
        onChange(next)
      }
    },
    [value, onChange],
  )

  const handleRichPaste = React.useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const md = html ? htmlToMarkdown(html) : text
    document.execCommand('insertText', false, md)
  }, [])

  // 图片上传
  const handleImageSelect = React.useCallback(
    async (file: File) => {
      if (!onImageUpload) return
      try {
        const url = await onImageUpload(file)
        if (mode === 'richtext') {
          // 富文本分支没有 textarea,applyWrap 会静默 return ⇒ 直接插 <img>
          const ce = ceRef.current
          if (!ce) return
          ce.focus()
          const safeSrc = String(url).replace(/"/g, '&quot;')
          const safeAlt = file.name.replace(/"/g, '&quot;')
          document.execCommand(
            'insertHTML',
            false,
            `<img src="${toMediaImageUrl(safeSrc)}" alt="${safeAlt}" />`,
          )
          return
        }
        // 一次算完再交出去。原实现先 applyWrap 插占位并 onChange,紧接着又拿**闭包里的旧 value**
        // 做 replace 再 onChange 一次 ⇒ 第二次把第一次整段覆盖回旧文本(旧 value 里没有
        // `(https://)` 占位,替换根本不命中)⇒ 用户选的图静默丢失。
        const ta = taRef.current
        const start = ta?.selectionStart ?? value.length
        const end = ta?.selectionEnd ?? value.length
        const snippet = `![${file.name.replace(/[[\]]/g, '')}](${url})`
        onChange(value.slice(0, start) + snippet + value.slice(end))
        requestAnimationFrame(() => {
          if (!ta) return
          ta.focus()
          const pos = start + snippet.length
          ta.selectionStart = pos
          ta.selectionEnd = pos
        })
      } catch {
        // 上传失败静默(由调用方 toast)
      }
    },
    [onImageUpload, onChange, value, mode],
  )

  // 自动保存草稿(防抖)。原实现 setInterval 依赖 [value,mode] ⇒ 每敲一个字重建定时器,
  // 连续输入时 30s 永不触发("已自动保存"从未真正写过盘);提示用的 setTimeout 也没清理。
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedHintTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    if (!value) {
      // 内容清空 ⇒ 清掉旧草稿,避免下一篇新建时读到上一题的残留
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* 隐私模式禁用 localStorage:静默 */
      }
      return
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, value)
        setAutoSaved(true)
        if (savedHintTimerRef.current) clearTimeout(savedHintTimerRef.current)
        savedHintTimerRef.current = setTimeout(() => setAutoSaved(false), 2000)
      } catch {
        // localStorage 满或禁用,静默
      }
    }, AUTO_SAVE_DEBOUNCE_MS)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [value])
  React.useEffect(
    () => () => {
      if (savedHintTimerRef.current) clearTimeout(savedHintTimerRef.current)
    },
    [],
  )

  // 模式切换时同步内容:只有"首次挂载/外部改值"才重建 DOM,输入路径绝不回写。
  React.useEffect(() => {
    if (mode !== 'richtext') {
      richInitRef.current = false
      return
    }
    const ce = ceRef.current
    if (!ce) return
    if (richInitRef.current && value === richEmitRef.current) return
    ce.innerHTML = markdownToHtml(value)
    richEmitRef.current = value
    richInitRef.current = true
  }, [mode, value])

  return (
    <div className="overflow-hidden rounded-md border border-input">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1.5">
        <div className="flex items-center gap-0.5">
          {(['markdown', 'richtext'] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? 'default' : 'ghost'}
              size="xs"
              className="px-2 text-xs"
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
                  onClick={() => runAction(act)}
                  disabled={mode === 'richtext' && !act.rich}
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
            '[&_.h1]:text-lg [&_.h1]:font-bold [&_.h2]:text-base [&_.h2]:font-semibold [&_.h3]:text-body [&_.h3]:font-semibold',
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
        {autoSaved && (
          <span className="text-emerald-600 dark:text-emerald-400">{t('editor.autoSaved')}</span>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
