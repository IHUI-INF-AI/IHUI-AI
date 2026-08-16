'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Check, Copy, Download, FileText, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { useWorkPanelStore } from '@/stores/work-panel'
// 语法高亮主题(对象常量,体积小,可静态导入;同时导入 dark/light 两份,运行时按主题切换)
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// 移除主题中的 background / backgroundColor,避免每行被主题样式强制染色
function stripBackground(style: Record<string, React.CSSProperties>): Record<string, React.CSSProperties> {
  const next: Record<string, React.CSSProperties> = {}
  for (const key of Object.keys(style)) {
    const value = style[key]
    if (value && typeof value === 'object') {
      const { background: _background, backgroundColor: _backgroundColor, ...rest } = value as React.CSSProperties
      next[key] = { ...rest, background: 'transparent', backgroundColor: 'transparent' }
      continue
    }
    next[key] = value as unknown as React.CSSProperties
  }
  return next
}

const ONE_DARK = stripBackground(oneDark)
const ONE_LIGHT = stripBackground(oneLight)

// MermaidDiagram 仅在客户端加载,不影响首屏 bundle
const MermaidDiagram = dynamic(() => import('@/components/media/MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-xs text-muted-foreground">…</div>,
})

// 语法高亮组件懒加载,避免首屏 bundle 过大
import type { Prism as PrismType } from 'react-syntax-highlighter'
type PrismComponent = typeof PrismType
const SyntaxHighlighter = dynamic(
  (): Promise<PrismComponent> => import('react-syntax-highlighter').then((m) => m.Prism),
  {
    ssr: false,
    loading: () => null,
  },
)

interface MarkdownStreamProps {
  content: string
  isStreaming?: boolean
  /** 代码块默认折叠行数阈值，超过该行数默认折叠，<=0 表示不折叠 */
  collapseLines?: number
}

// 复制到剪贴板 hook
function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const copy = React.useCallback((text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }, [])
  return { copied, copy }
}

// 语法高亮错误降级边界:渲染失败时降级到原始 <pre><code>
class CodeBlockErrorBoundary extends React.PureComponent<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {
    // 静默错误,降级到 fallback 渲染
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// 这些语言用纯文本渲染,不走 SyntaxHighlighter(避免开销)
const PLAIN_TEXT_LANGS = new Set(['', 'text', 'plain', 'txt'])

const CodeBlockImpl = function CodeBlock({
  language,
  code,
  isStreaming,
  syntaxStyle,
  collapseLines = 5,
}: {
  language?: string
  code: string
  isStreaming?: boolean
  syntaxStyle: Record<string, React.CSSProperties>
  collapseLines?: number
}): React.ReactElement {
  const tA11y = useTranslations('a11y')
  const { copied, copy } = useCopy()
  // 流式场景下 mermaid 代码会频繁变化,用 debounce 减少 mermaid.render 调用
  const debouncedCode = useDebounce(code, 300)

  // 代码块折叠状态:默认折叠超过阈值的代码块
  const [collapsed, setCollapsed] = React.useState(true)
  const codeLines = code.split('\n')
  const shouldCollapse = collapseLines > 0 && codeLines.length > collapseLines
  const preRef = React.useRef<HTMLPreElement>(null)

  // 当代码块展开/折叠时，自动滚动到代码块位置
  React.useEffect(() => {
    if (!collapsed && preRef.current) {
      requestAnimationFrame(() => {
        preRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [collapsed])

  // mermaid 块交给 MermaidDiagram 客户端渲染
  if (language === 'mermaid') {
    return <MermaidDiagram code={debouncedCode} />
  }

  const lang = (language ?? '').trim().toLowerCase()
  const isPlain = PLAIN_TEXT_LANGS.has(lang)

  // 复制按钮(absolute 定位在 <pre> 右上角)
  // 2026-07-31 对标 Trae/Codex/Claude Code + 与 code-generator.tsx 保持一致:
  // 默认无背景色,hover 时显示 bg-muted,backdrop-blur-sm 确保按钮在任意代码块背景上都可读。
  const copyButton = (
    <button
      type="button"
      onClick={() => copy(code)}
      data-testid="copy-button"
      className={cn(
        'absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md',
        'text-foreground transition-colors',
        'hover:bg-muted',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label={copied ? tA11y('codeCopied') : tA11y('copyCode')}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )

  // 流式中的代码块用 opacity-60 标记(临时闭合位置)
  // 2026-08-02:对话文字整体放大,代码块 14px → 15px(text-[15px])
  // 2026-08-16:代码块整体背景色与面板背景形成区分,暗色模式用较浅的 zinc-900 避免同色
  const preClassName = cn(
    'relative my-0 overflow-x-auto rounded-lg border border-zinc-200 p-3 text-[15px]',
    'bg-zinc-100 text-zinc-900',
    'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
    isStreaming && 'opacity-60',
  )

  // 折叠按钮(absolute 定位在 <pre> 右下角)
  const collapseButton = shouldCollapse && !isStreaming && (
    <button
      type="button"
      onClick={() => setCollapsed((prev) => !prev)}
      className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-border/60 bg-white px-2 py-1 text-xs text-foreground backdrop-blur-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-black"
      aria-label={collapsed ? '展开代码' : '收起代码'}
    >
      {collapsed ? `展开 (${codeLines.length} 行)` : '收起'}
    </button>
  )

  // 计算折叠后的显示内容
  const displayCode = collapsed && shouldCollapse ? codeLines.slice(0, 5).join('\n') : code

  // 纯文本或无语言:不调 SyntaxHighlighter,避免开销
  if (isPlain) {
    return (
      <pre ref={preRef} className={preClassName}>
        {copyButton}
        {collapseButton}
        <code className="font-mono">{displayCode}</code>
      </pre>
    )
  }

  // 语法高亮失败时的降级渲染
  const fallback = (
    <pre ref={preRef} className={preClassName}>
      {copyButton}
      {collapseButton}
      <code className={cn('font-mono', language && `language-${language}`)}>{displayCode}</code>
    </pre>
  )

  return (
    <CodeBlockErrorBoundary fallback={fallback}>
      <pre ref={preRef} className={preClassName}>
        {copyButton}
        {collapseButton}
        <SyntaxHighlighter
          language={lang}
          style={syntaxStyle}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '15px',
          }}
        >
          {displayCode}
        </SyntaxHighlighter>
      </pre>
    </CodeBlockErrorBoundary>
  )
}

// React.memo 包裹:code/language/syntaxStyle 不变时跳过重渲染
const CodeBlock = React.memo(CodeBlockImpl)

/**
 * 主题感知包装层:在 useTheme hook 中读取 resolvedTheme,转成 syntaxStyle 注入 CodeBlock。
 * 不放在 CodeBlock 内部:React.memo 会因 props 未变而跳过重渲染,
 * 把 syntaxStyle 提升为 prop 后,memo 能在引用变化时正常触发更新。
 */
function ThemedCodeBlock(props: { language?: string; code: string; isStreaming?: boolean; collapseLines?: number }) {
  const { resolvedTheme } = useTheme()
  const syntaxStyle = resolvedTheme === 'dark' ? ONE_DARK : ONE_LIGHT
  return <CodeBlock {...props} syntaxStyle={syntaxStyle} />
}

// 图片放大容器:点击图片在 WorkPanel 打开(同源);外链在新标签页打开
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const srcStr = typeof src === 'string' ? src : undefined
  if (!srcStr) return null

  const isExternal = /^https?:\/\//i.test(srcStr)
  const isDataUri = srcStr.startsWith('data:')
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|$)/i.test(srcStr) || isDataUri
  if (!isImage) return null

  const handleOpen = () => {
    if (isExternal) {
      window.open(srcStr, '_blank', 'noopener,noreferrer')
      return
    }
    useWorkPanelStore.getState().openPanel({ url: srcStr, source: 'markdown-image' })
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="my-0 block max-w-full overflow-hidden rounded-md bg-streamed-container-bg transition-colors hover:bg-streamed-container-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      aria-label={alt ? `图片: ${alt}` : '点击放大图片'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- AI 返回的图片 URL 可能是任意来源,不走 next/image 优化 */}
      <img
        src={srcStr}
        alt={alt ?? ''}
        className="max-h-[400px] max-w-full object-contain"
        loading="lazy"
      />
    </button>
  )
}

// 视频内嵌播放:支持 mp4/webm/ogg
function MarkdownVideo({ src }: { src?: string }) {
  const srcStr = typeof src === 'string' ? src : undefined
  if (!srcStr) return null
  const isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(srcStr)
  if (!isVideo) return null
  return (
    <video src={srcStr} controls className="my-0 max-w-full rounded-md" preload="metadata">
      <track kind="captions" />
    </video>
  )
}

// Office 文件链接卡片:Word/Excel/PPT/PDF
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?|pdf|csv|md|txt|rtf|odt|ods|odp)(\?|$)/i
function isOfficeLink(href: string): boolean {
  return OFFICE_EXT.test(href)
}

function MarkdownLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const hrefStr = typeof href === 'string' ? href : undefined
  if (!hrefStr) {
    // 无 href 的链接:渲染为 span(避免 a11y 警告)
    return <span>{children}</span>
  }

  const isSafeUrl = /^(https?:|mailto:|\/|#)/.test(hrefStr)
  if (!isSafeUrl) {
    return <span>{children}</span>
  }

  // Office 文件:渲染为下载卡片
  if (isOfficeLink(hrefStr)) {
    const fileName = hrefStr.split('/').pop()?.split('?')[0] ?? 'file'
    const ext = (fileName.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase()
    return (
      <a
        href={hrefStr}
        target="_blank"
        rel="noopener noreferrer"
        download={fileName}
        className="my-0 flex items-center gap-2 rounded-md border border-border bg-streamed-container-bg px-3 py-2 text-sm transition-colors hover:bg-streamed-container-bg-hover"
      >
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{fileName}</span>
        <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
          {ext}
        </span>
        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    )
  }

  // 视频链接(非内嵌):渲染为带 Play 图标的链接
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(hrefStr)) {
    return (
      <a
        href={hrefStr}
        target="_blank"
        rel="noopener noreferrer"
        className="my-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-streamed-container-bg px-2.5 py-1 text-sm transition-colors hover:bg-streamed-container-bg-hover"
      >
        <Play className="h-3.5 w-3.5" aria-hidden />
        <span>{children}</span>
      </a>
    )
  }

  // 普通链接:左键无修饰键在 WorkPanel 打开
  return (
    <a
      href={hrefStr}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        useWorkPanelStore.getState().openPanel({ url: hrefStr, source: 'markdown-link' })
      }}
    >
      {children}
    </a>
  )
}

// 检测未闭合的代码块围栏(奇数个 ``` 表示未闭合,流式中的常见情况)
function hasUnclosedFence(content: string): boolean {
  const matches = content.match(/```/g)
  return matches !== null && matches.length % 2 === 1
}

export function MarkdownStream({ content, isStreaming, collapseLines = 5 }: MarkdownStreamProps) {
  // 自适应 throttle(leading + trailing)合并解析频率:
  // - 短内容(<2000 字符)用 50ms 保证跟手感
  // - 中等内容(2000-5000 字符)用 150ms 平衡
  // - 长内容(>5000 字符)用 400ms 降低解析频率
  // 修复"全量 re-parse 锯齿卡顿":固定 200ms 节流后长回答仍每次全量解析 react-markdown,
  // 改用按长度自适应 + useDeferredValue 让 React 在空闲时更新,避免阻塞主流式渲染
  const throttleRef = React.useRef<number>(50)
  React.useEffect(() => {
    const len = content.length
    if (len < 2000) throttleRef.current = 50
    else if (len < 5000) throttleRef.current = 150
    else throttleRef.current = 400
  }, [content.length])

  const [throttledContent, setThrottledContent] = React.useState(content)
  const lastFlushRef = React.useRef<number>(0)
  const trailingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastFlushRef.current
    const throttle = throttleRef.current
    if (elapsed >= throttle) {
      lastFlushRef.current = now
      setThrottledContent(content)
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
    } else if (trailingTimerRef.current === null) {
      trailingTimerRef.current = setTimeout(() => {
        lastFlushRef.current = Date.now()
        trailingTimerRef.current = null
        setThrottledContent(content)
      }, throttle - elapsed)
    }
  }, [content])

  React.useEffect(() => {
    return () => {
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
    }
  }, [])

  // useDeferredValue:让 React 在空闲时才更新 deferredContent,避免阻塞主流式渲染。
  // 副作用:流式光标动画看起来"滞后",但用户感知是"内容正在生成"而非"光标在跳",可接受
  const deferredContent = React.useDeferredValue(throttledContent)

  // 流式场景:未闭合代码块临时闭合让 react-markdown 能解析
  // 流式中的代码块用 isStreamingCodeRef 标记,渲染时 opacity-60
  const isStreamingCodeRef = React.useRef(false)
  const parseContent = React.useMemo(() => {
    if (hasUnclosedFence(deferredContent)) {
      isStreamingCodeRef.current = true
      return deferredContent + '\n```\n'
    }
    isStreamingCodeRef.current = false
    return deferredContent
  }, [deferredContent])

  // components memo:无依赖(主题感知在 ThemedCodeBlock 内部 useTheme 处理)
  const components = React.useMemo<Components>(
    () => ({
      code({ className, children, ...props }) {
        // 行内 code:`xxx` 不带 language- class,直接渲染
        // 块级 code:```lang\nxxx``` 带 language-xxx class,父级 <pre> 由我们接管
        const match = /language-(\w+)/.exec(className ?? '')
        const lang = match?.[1]
        const codeText = String(children ?? '').replace(/\n$/, '')

        // 块级代码:有 language-xxx 或多行 code → 用 CodeBlock 渲染
        if (lang || codeText.includes('\n')) {
          return (
            <ThemedCodeBlock
              language={lang}
              code={codeText}
              isStreaming={isStreamingCodeRef.current}
              collapseLines={collapseLines}
            />
          )
        }

        // 行内 code
        return (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
            {children}
          </code>
        )
      },
      // pre 包装:react-markdown 默认 <pre><code>,我们已经把 code 替换为 CodeBlock,
      // 这里让 pre 直接渲染 children(避免双重 pre 嵌套)
      pre({ children }) {
        return <>{children}</>
      },
      img({ src, alt }) {
        return <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} />
      },
      video({ src }) {
        return <MarkdownVideo src={typeof src === 'string' ? src : undefined} />
      },
      a({ href, children }) {
        return <MarkdownLink href={href}>{children}</MarkdownLink>
      },
      // 表格:外层包 overflow-x-auto 容器,移动端可横向滚动
      // 2026-08-02:表格字号同步放大 14px → 15px
      table({ children }) {
        return (
          <div className="my-0 overflow-x-auto">
            <table className="my-0 w-full border-collapse text-[15px]">{children}</table>
          </div>
        )
      },
      thead({ children }) {
        return <thead className="bg-muted/50">{children}</thead>
      },
      th({ children }) {
        return (
          <th className="border border-border px-3 py-1.5 text-left font-medium">{children}</th>
        )
      },
      td({ children }) {
        return <td className="border border-border px-3 py-1.5">{children}</td>
      },
      // 分隔线:用低对比度样式(符合 §4 禁止分割线规则 - 容器完整描边允许,纯线条用 border 替代)
      // hr 在 markdown 语义里是必需的(用户明确要求支持分隔线),样式用 bg-muted 替代纯线条
      hr() {
        return <div className="my-0 h-px bg-border" role="separator" aria-hidden />
      },
      // 删除线:GFM ~~text~~
      del({ children }) {
        return <del className="text-muted-foreground line-through">{children}</del>
      },
      // 任务列表 checkbox:GFM - [ ] / - [x]
      input({ checked, ...props }) {
        // 仅处理 checkbox(其他 input 透传)
        if (props.type !== 'checkbox' && checked === undefined) {
          return <input {...props} />
        }
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled
            className="mr-1.5 h-3.5 w-3.5 rounded-sm align-middle accent-primary"
            aria-label={checked ? '已完成' : '未完成'}
            readOnly
          />
        )
      },
      // 列表项:任务列表的 li 需要去掉默认 list-style(因为前面有 checkbox)
      li({ children, ...props }) {
        // GFM 任务列表:li 内首元素是 checkbox input
        const firstChild = Array.isArray(children) ? children[0] : children
        const isTaskItem =
          React.isValidElement(firstChild) &&
          (firstChild as React.ReactElement<{ type?: string }>).props?.type === 'checkbox'
        return (
          <li
            className={cn('my-0', isTaskItem && 'list-none')}
            {...(props as React.LiHTMLAttributes<HTMLLIElement>)}
          >
            {children}
          </li>
        )
      },
      blockquote({ children }) {
        return (
          <blockquote className="my-0 border-l-2 border-border pl-3 text-muted-foreground italic">
            {children}
          </blockquote>
        )
      },
      // 标题样式
      h1({ children }) {
        return <h1 className="my-0 text-2xl font-semibold">{children}</h1>
      },
      h2({ children }) {
        return <h2 className="my-0 text-xl font-semibold">{children}</h2>
      },
      h3({ children }) {
        return <h3 className="my-0 text-lg font-semibold">{children}</h3>
      },
      h4({ children }) {
        return <h4 className="my-0 text-base font-semibold">{children}</h4>
      },
      h5({ children }) {
        return <h5 className="my-0 text-sm font-semibold">{children}</h5>
      },
      h6({ children }) {
        return <h6 className="my-0 text-sm font-medium">{children}</h6>
      },
      p({ children }) {
        // 过滤掉由 markdown 多余空行产生的空段落(<br>)和纯空白段落
        const childrenArray = React.Children.toArray(children)
        const hasRealContent = childrenArray.some(child => {
          if (typeof child === 'string') return child.trim().length > 0
          if (typeof child === 'number') return true
          // <br> 视为空内容(由 markdown 多余空行产生)
          if (React.isValidElement(child) && child.type === 'br') return false
          return true // 其他 React 元素(如 strong、em、code、a)视为有效内容
        })
        if (!hasRealContent) return null
        return <p className="my-0 leading-relaxed">{children}</p>
      },
      ul({ children }) {
        return <ul className="my-0 list-disc space-y-1 pl-6">{children}</ul>
      },
      ol({ children }) {
        return <ol className="my-0 list-decimal space-y-1 pl-6">{children}</ol>
      },
      strong({ children }) {
        return <strong className="font-semibold">{children}</strong>
      },
      em({ children }) {
        return <em>{children}</em>
      },
    }),
    // 2026-08-16 修复:code 组件内部使用 collapseLines(透传给 ThemedCodeBlock),
    // 此前 deps 为空导致闭包捕获旧值,代码折叠行数变化不生效。
    [collapseLines],
  )

  return (
    // 2026-08-02:AI 对话正文 14px → 15px(text-[15px]),用户反馈"太大了 小点"
    <div className="!m-0 !p-0 !space-y-0 text-[15px]" data-testid="markdown-stream">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {parseContent}
      </ReactMarkdown>
      {isStreaming && (
        <span
          className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle"
          aria-hidden
        />
      )}
    </div>
  )
}

export default MarkdownStream
