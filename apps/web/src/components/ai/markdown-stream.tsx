'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { useWorkPanelStore } from '@/stores/work-panel'
// 语法高亮主题(对象常量,体积小,可静态导入;同时导入 dark/light 两份,运行时按主题切换)
// P2 中期增强:亮色模式用 oneLight,暗色模式用 oneDark(此前固定 oneDark,亮色模式下代码块偏暗)
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// MermaidDiagram 仅在客户端加载,不影响首屏 bundle
const MermaidDiagram = dynamic(() => import('@/components/media/MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-xs text-muted-foreground">…</div>,
})

// 语法高亮组件懒加载,避免首屏 bundle 过大
interface SyntaxHighlighterProps {
  language?: string
  style?: Record<string, React.CSSProperties>
  customStyle?: React.CSSProperties
  children?: string
}
const SyntaxHighlighter = dynamic(
  () =>
    import('react-syntax-highlighter').then(
      (m) => m.Prism as React.ComponentType<SyntaxHighlighterProps>,
    ),
  {
    ssr: false,
    loading: () => null,
  },
)

interface MarkdownStreamProps {
  content: string
  isStreaming?: boolean
}

const INLINE_REGEX =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))|(\[[^\]]+\]\[[^\]]*\))/g

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  INLINE_REGEX.lastIndex = 0

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const k = `${keyPrefix}-${key++}`

    if (token.startsWith('`')) {
      nodes.push(
        <code key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={k} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(<em key={k}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[')) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        const href = linkMatch[2]
        const isSafeUrl = /^(https?:|mailto:|\/|#)/.test(href)
        if (!isSafeUrl) {
          nodes.push(token)
        } else {
          nodes.push(
            <a
              key={k}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(e) => {
                // 左键无修饰键:在右侧工作展示区打开(Ctrl/Cmd/Shift/中键保留默认新标签页行为)
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
                e.preventDefault()
                useWorkPanelStore.getState().openPanel({ url: href, source: 'markdown-link' })
              }}
            >
              {linkMatch[1]}
            </a>,
          )
        }
      } else {
        nodes.push(token)
      }
    }
    lastIndex = INLINE_REGEX.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

// 复制到剪贴板 hook(自包含,不依赖外部)
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
}: {
  language?: string
  code: string
  isStreaming?: boolean
  // P2 中期增强:由外层 ThemedCodeBlock 注入(dark → oneDark,其他 → oneLight)
  // 提升为 prop 让 React.memo 在主题切换时也能正确触发重渲染
  syntaxStyle: Record<string, React.CSSProperties>
}): React.ReactElement {
  const tA11y = useTranslations('a11y')
  const { copied, copy } = useCopy()
  // 流式场景下 mermaid 代码会频繁变化,用 debounce 减少 mermaid.render 调用
  // 代码不完整时的渲染失败由 MermaidDiagram 内部错误降级处理,代码完整后会重新渲染
  const debouncedCode = useDebounce(code, 300)

  // mermaid 块交给 MermaidDiagram 客户端渲染(P2-3 成果,不动此分支)
  if (language === 'mermaid') {
    return <MermaidDiagram code={debouncedCode} />
  }

  const lang = (language ?? '').trim().toLowerCase()
  const isPlain = PLAIN_TEXT_LANGS.has(lang)

  // 复制按钮(absolute 定位在 <pre> 右上角)
  // 不用蓝光/纯黑边框,hover 用浅色背景变化,适配 dark/light
  const copyButton = (
    <button
      type="button"
      onClick={() => copy(code)}
      data-testid="copy-button"
      className={cn(
        'absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md',
        'text-zinc-400 transition-colors',
        'hover:bg-zinc-800 hover:text-zinc-100',
        'dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
      )}
      aria-label={copied ? tA11y('codeCopied') : tA11y('copyCode')}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )

  // 流式中的代码块用 opacity-60 标记(临时闭合位置)
  // P2 中期增强:背景与文本颜色跟随主题(light → 白底深字, dark → 深底浅字)
  const preClassName = cn(
    'relative my-2 overflow-x-auto rounded-lg p-3 text-sm',
    'bg-zinc-100 text-zinc-900',
    'dark:bg-zinc-950 dark:text-zinc-100',
    isStreaming && 'opacity-60',
  )

  // 纯文本或无语言:不调 SyntaxHighlighter,避免开销
  if (isPlain) {
    return (
      <pre className={preClassName}>
        {copyButton}
        <code className="font-mono">{code}</code>
      </pre>
    )
  }

  // 语法高亮失败时的降级渲染
  const fallback = (
    <pre className={preClassName}>
      {copyButton}
      <code className={cn('font-mono', language && `language-${language}`)}>{code}</code>
    </pre>
  )

  return (
    <CodeBlockErrorBoundary fallback={fallback}>
      <pre className={preClassName}>
        {copyButton}
        <SyntaxHighlighter
          language={lang}
          style={syntaxStyle}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '0.875rem',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </pre>
    </CodeBlockErrorBoundary>
  )
}

// React.memo 包裹:code/language/syntaxStyle 不变时跳过重渲染(增量解析优化)
// P2 中期增强:syntaxStyle 提升为 prop,主题切换时(对象引用变化)也能正确触发重渲染
const CodeBlock = React.memo(CodeBlockImpl)

/**
 * 主题感知包装层:在 useTheme hook 中读取 resolvedTheme,转成 syntaxStyle 注入 CodeBlock。
 * 不放在 CodeBlock 内部:React.memo 会因 props(只有 code/language)未变而跳过重渲染,
 * 导致主题切换时样式不更新。把 syntaxStyle 提升为 prop 后,memo 能在引用变化时正常触发更新。
 */
function ThemedCodeBlock(props: { language?: string; code: string; isStreaming?: boolean }) {
  const { resolvedTheme } = useTheme()
  const syntaxStyle = resolvedTheme === 'dark' ? oneDark : oneLight
  return <CodeBlock {...props} syntaxStyle={syntaxStyle} />
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length - 1)
}

function parseLineBlocks(segment: string, keyBase: string): React.ReactNode[] {
  const lines = segment.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    if (trimmed === '') {
      i++
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (headingMatch && headingMatch[1] && headingMatch[2] !== undefined) {
      const level = headingMatch[1].length
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm']
      const size = sizes[level - 1] ?? 'text-base'
      blocks.push(
        React.createElement(
          `h${level}`,
          { key: `${keyBase}-${key++}`, className: cn('my-2 font-semibold', size) },
          parseInline(headingMatch[2], `${keyBase}-${key}`),
        ),
      )
      i++
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('> ')) {
        quoteLines.push((lines[i] ?? '').trim().slice(2))
        i++
      }
      blocks.push(
        <blockquote
          key={`${keyBase}-${key++}`}
          className="my-2 border-l-2 border-border pl-3 text-muted-foreground italic"
        >
          {parseInline(quoteLines.join(' '), `${keyBase}-${key}`)}
        </blockquote>,
      )
      continue
    }

    if (
      /^\||^\|.*\|$/.test(trimmed) &&
      i + 1 < lines.length &&
      /^\|?[\s-:]+\|/.test((lines[i + 1] ?? '').trim())
    ) {
      const headerCells = parseTableRow(trimmed)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(parseTableRow((lines[i] ?? '').trim()))
        i++
      }
      blocks.push(
        <div key={`${keyBase}-${key++}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {headerCells.map((c, ci) => (
                  <th
                    key={ci}
                    className="border border-border bg-muted px-3 py-1.5 text-left font-medium"
                  >
                    {parseInline(c, `${keyBase}-th-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className="border border-border px-3 py-1.5">
                      {parseInline(c, `${keyBase}-td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`${keyBase}-${key++}`} className="my-2 list-disc space-y-1 pl-6">
          {items.map((item, ii) => (
            <li key={ii}>{parseInline(item, `${keyBase}-li-${ii}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={`${keyBase}-${key++}`} className="my-2 list-decimal space-y-1 pl-6">
          {items.map((item, ii) => (
            <li key={ii}>{parseInline(item, `${keyBase}-ol-${ii}`)}</li>
          ))}
        </ol>,
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,6})\s+/.test((lines[i] ?? '').trim()) &&
      !/^[-*]\s+/.test((lines[i] ?? '').trim()) &&
      !/^\d+\.\s+/.test((lines[i] ?? '').trim()) &&
      !(lines[i] ?? '').trim().startsWith('> ')
    ) {
      paraLines.push((lines[i] ?? '').trim())
      i++
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={`${keyBase}-${key++}`} className="my-2 leading-relaxed">
          {parseInline(paraLines.join(' '), `${keyBase}-p-${key}`)}
        </p>,
      )
    }
  }

  return blocks
}

// 检测未闭合的代码块围栏(奇数个 ``` 表示未闭合,流式中的常见情况)
function hasUnclosedFence(content: string): boolean {
  const matches = content.match(/```/g)
  return matches !== null && matches.length % 2 === 1
}

function parseMarkdown(content: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = []

  // 边界修复:未闭合的代码块用临时闭合标记让正则能匹配
  // 预处理只用于解析,不修改原 content(避免影响外部状态)
  // 修复前:未闭合代码块会被 split 当段落渲染,闭合瞬间跳变
  // 修复后:未闭合代码块始终按 <pre> 渲染,流式过程平滑
  const isUnclosed = hasUnclosedFence(content)
  const parseContent = isUnclosed ? content + '\n```\n' : content

  const segments = parseContent.split(/(```[\s\S]*?```)/g)

  // 未闭合场景下,定位最后一个代码块段(用于标记流式中的代码块)
  // 注意:追加 '\n```\n' 后,末尾可能多出一个空文本段,所以不能直接用 length-1
  let lastCodeSegIdx = -1
  if (isUnclosed) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]
      if (seg && seg.startsWith('```')) {
        lastCodeSegIdx = i
        break
      }
    }
  }

  segments.forEach((seg, idx) => {
    if (seg.startsWith('```')) {
      const match = /^```(\w*)\n?([\s\S]*?)```$/.exec(seg)
      if (match) {
        const lang = match[1] || undefined
        const code = match[2] ?? ''
        // 未闭合场景下,最后一个代码块是流式中的(用 opacity-60 标记)
        const blockStreaming = idx === lastCodeSegIdx
        // 稳定 key:索引 + 内容前缀(流式追加时 key 稳定,避免 remount)
        // idx 保证唯一性,code.slice(0, 20) 在结构变化时强制 remount
        const blockKey = `code-${idx}-${code.slice(0, 20)}`
        blocks.push(
          <ThemedCodeBlock
            key={blockKey}
            language={lang}
            code={code}
            isStreaming={blockStreaming}
          />,
        )
      }
    } else if (seg) {
      parseLineBlocks(seg, `blk-${idx}`).forEach((b) => {
        blocks.push(b)
      })
    }
  })

  return blocks
}

export function MarkdownStream({ content, isStreaming }: MarkdownStreamProps) {
  // P2 中期增强:把 resolvedTheme 加入 useMemo 依赖,主题切换时重新解析节点树
  // (ThemedCodeBlock 才能感知到主题变化并切换语法高亮)
  const { resolvedTheme } = useTheme()
  const nodes = React.useMemo(
    () => parseMarkdown(content),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parseMarkdown 不依赖 theme,这里只为了让 memo 在主题切换时失效
    [content, resolvedTheme],
  )

  return (
    <div className="text-sm">
      {nodes}
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
