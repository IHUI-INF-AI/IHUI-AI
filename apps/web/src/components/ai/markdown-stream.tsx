// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import {
  Check,
  Copy,
  Download,
  FileText,
  Play,
  Loader2,
  FilePlus2,
  TextCursorInput,
  Maximize2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { IconButton } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { useWorkPanelStore } from '@/stores/work-panel'
import { useCanvasStore } from '@/stores/canvas-store'
import { applyCodeBlockToFile } from '@/lib/apply-code-block'
import { useCodeBlockRun, isRunnableLanguage, type RunResult } from '@/components/ai/code-block-run'
// P3 #35(2026-09-16 立):流式稳定段/活跃段切分——稳定前缀 memo 缓存跳过 parse
import { splitMarkdownStable } from '@/lib/markdown-stable-split'
// P3 #32(2026-09-16 立):PDF/CSV 消息内富预览(非流式时升级渲染)
import { CsvPreview, PdfEmbed } from '@/components/media/message-file-preview'
// D41(2026-09-24 立):docx/xlsx/pptx 消息内富预览(docx-preview / SheetJS / jszip 降级)
import { OfficePreview } from '@/components/media/office-preview'
// 语法高亮主题(对象常量,体积小,可静态导入;同时导入 dark/light 两份,运行时按主题切换)
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// 移除主题中的 background / backgroundColor,避免每行被主题样式强制染色
function stripBackground(
  style: Record<string, React.CSSProperties>,
): Record<string, React.CSSProperties> {
  const next: Record<string, React.CSSProperties> = {}
  for (const key of Object.keys(style)) {
    const value = style[key]
    if (value && typeof value === 'object') {
      const {
        background: _background,
        backgroundColor: _backgroundColor,
        ...rest
      } = value as React.CSSProperties
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

// P0-4(2026-09-13):inline 预览守卫——仅当 content 以 <!DOCTYPE html / <html / <svg 开头
// 才渲染迷你预览条(WorkBuddy 即时可视化风格),避免流式期间无谓 iframe 抖动
const INLINE_PREVIEW_RE = /^\s*(<!DOCTYPE\s+html|<html[\s>]|<svg[\s>])/i

/** html/svg 代码块的 inline 迷你预览条:沙箱 iframe(~160px)+「在画布打开」按钮 */
function InlineHtmlPreview({ code }: { code: string }) {
  const t = useTranslations('chat')
  const openCanvas = useCanvasStore((s) => s.openCanvas)
  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2 bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
        <span className="text-[10px] font-medium text-muted-foreground">
          {t('artifactPreview')}
        </span>
        <button
          type="button"
          onClick={() => openCanvas(code)}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <Maximize2 className="h-3 w-3" />
          {t('canvasOpenInCanvas')}
        </button>
      </div>
      <iframe
        title="inline-html-preview"
        sandbox="allow-scripts"
        srcDoc={code}
        className="h-[160px] w-full bg-white"
      />
    </div>
  )
}

// P1 #28(2026-09-16):代码块运行结果内联输出面板。
// 样式与代码块一致(zinc-100 / dark:zinc-950),含命令、合并 stdout/stderr、exitCode 徽章、关闭按钮。
function CodeRunOutput({ result, onClose }: { result: RunResult; onClose: () => void }) {
  const t = useTranslations('chat')
  const isSuccess = result.status === 'success'
  const isRunning = result.status === 'running'
  const exitBadge =
    result.exitCode !== null ? (
      <span
        className={cn(
          'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
          isSuccess
            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
            : 'bg-red-500/15 text-red-600 dark:text-red-400',
        )}
        aria-label={`${t('codeRun.exit')} ${result.exitCode}`}
      >
        {isSuccess ? `exit 0` : `exit ${result.exitCode}`}
      </span>
    ) : null

  return (
    <div
      data-testid="code-run-output"
      className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between gap-2 bg-zinc-200/60 px-2 py-1 dark:bg-zinc-900">
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {t('codeRun.title')}
        </span>
        <button
          type="button"
          onClick={onClose}
          data-testid="code-run-close"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('codeRun.close')}
        >
          <span className="text-xs leading-none">×</span>
        </button>
      </div>
      <div className="max-h-[240px] overflow-auto p-2">
        <code className="block break-all font-mono text-[11px] text-muted-foreground">
          {result.command}
        </code>
        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-200">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('codeRun.running')}
            </span>
          ) : (
            result.output || t('codeRun.failed')
          )}
        </pre>
        <div className="mt-1 flex items-center gap-2">{exitBadge}</div>
      </div>
    </div>
  )
}

const CodeBlockImpl = function CodeBlock({
  language,
  code,
  isStreaming,
  syntaxStyle,
  collapseLines = 5,
  lineNumberStyle,
}: {
  language?: string
  code: string
  isStreaming?: boolean
  syntaxStyle: Record<string, React.CSSProperties>
  collapseLines?: number
  /** 四竞品对标 V2 #17(2026-09-15):行号样式,undefined = 不显示行号(纯文本/降级路径不传) */
  lineNumberStyle?: React.CSSProperties
}): React.ReactElement {
  const tA11y = useTranslations('a11y')
  const t = useTranslations('chat')
  const { copied, copy } = useCopy()
  // 流式场景下 mermaid 代码会频繁变化,用 debounce 减少 mermaid.render 调用
  const debouncedCode = useDebounce(code, 300)

  // P0-2「应用到文件」状态:idle / applying / done(成功后短暂显示 Check)
  const [applyState, setApplyState] = React.useState<'idle' | 'applying' | 'done'>('idle')
  const applyTimerRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    return () => {
      if (applyTimerRef.current) window.clearTimeout(applyTimerRef.current)
    }
  }, [])

  /** 应用到工作区文件(P0-2):流式中禁用;完成后 1.5s 恢复图标 */
  const handleApplyToFile = React.useCallback(() => {
    if (isStreaming || applyState === 'applying') return
    setApplyState('applying')
    void applyCodeBlockToFile(code, language).then((r) => {
      if (r.ok) {
        setApplyState('done')
        applyTimerRef.current = window.setTimeout(() => setApplyState('idle'), 1500)
      } else {
        setApplyState('idle')
      }
    })
  }, [code, language, isStreaming, applyState])

  /** 插入到编辑器当前光标处(P0-2):派发全局事件由 code-editor-pane 消费 */
  const handleInsertAtCursor = React.useCallback(() => {
    if (isStreaming) return
    window.dispatchEvent(
      new CustomEvent('ihui:insert-at-cursor', { detail: { code, language: language ?? '' } }),
    )
  }, [code, language, isStreaming])

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

  const lang = (language ?? '').trim().toLowerCase()
  const isPlain = PLAIN_TEXT_LANGS.has(lang)

  // P1 #28(2026-09-16):代码块一键运行(对标 Codex/Trae 对话内运行回显)。
  // 复用的执行 API 仅需 workspacePath(从既有 store 取值),无需 messageId,不改动 props 链。
  // 置于 mermaid 提前 return 之前,遵守 rules-of-hooks(所有 hook 在任意 return 前调用)。
  const { result: runResult, run: runCodeBlock, clear: clearRunResult } = useCodeBlockRun()
  const showRunButton = !isStreaming && isRunnableLanguage(lang)
  const isRunning = runResult?.status === 'running'

  const handleRun = React.useCallback(() => {
    if (runResult?.status === 'running') return
    void runCodeBlock({ language: lang, code })
  }, [runResult, runCodeBlock, lang, code])

  // mermaid 块交给 MermaidDiagram 客户端渲染
  if (language === 'mermaid') {
    return <MermaidDiagram code={debouncedCode} />
  }

  // P0-4(2026-09-13):html/svg 代码块 inline 迷你预览条(渲染在代码块上方,
  // 仿 mermaid 特例;点击「在画布打开」进入全屏画布闭环)
  const inlinePreview =
    (lang === 'html' || lang === 'svg') && INLINE_PREVIEW_RE.test(debouncedCode) ? (
      <InlineHtmlPreview code={debouncedCode} />
    ) : null

  // 复制按钮(absolute 定位在 <pre> 右上角)
  // 2026-07-31 对标 主流 AI IDE + 与 code-generator.tsx 保持一致:
  // 默认无背景色,hover 时显示 bg-muted(纯色),确保按钮在任意代码块背景上都可读。
  // 2026-09-12 P0-2:追加「应用到文件」「插入光标」(对标 CodeX/Trae/Qoder 代码块动作)。
  // 2026-09-17:折叠按钮背景统一 bg-float-indicator-bg(全局浮动指示条 token,不透明)。
  // 2026-09-17:统一迁移到 IconButton(尺寸/圆角/focus ring 走 @ihui/design-tokens token),
  // 代码块语境保留 text-foreground + hover:bg-muted 覆盖默认 ghost 样式。
  const iconBtnClass = 'text-foreground hover:bg-muted'
  const copyButton = (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5">
      {/* 一键运行:仅非流式且语言在可运行集合内显示(对标 Codex/Trae 对话内运行) */}
      {showRunButton && (
        <Tooltip content={isRunning ? t('codeRun.running') : t('codeRun.run')}>
          {/* disabled 按钮收不到 Radix Trigger 的 pointer 事件 → hover 提示会静默消失;
              由外层 span 承接 trigger(守门 18 Tooltip+disabled 规则) */}
          <span className="inline-flex">
            <IconButton
              onClick={handleRun}
              disabled={isRunning}
              data-testid="run-code-button"
              className={iconBtnClass}
              aria-label={isRunning ? t('codeRun.running') : t('codeRun.run')}
            >
              {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {/* 应用到工作区文件:仅非流式且有语言标记的代码块显示 */}
      {!isStreaming && (
        <Tooltip content={t('codeBlock.applyToFile')}>
          <span className="inline-flex">
            <IconButton
              onClick={handleApplyToFile}
              disabled={applyState === 'applying'}
              data-testid="apply-to-file-button"
              className={iconBtnClass}
              aria-label={t('codeBlock.applyToFile')}
            >
              {applyState === 'done' ? (
                <Check className="text-green-600" />
              ) : applyState === 'applying' ? (
                <span className="animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <FilePlus2 />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {/* 插入到编辑器光标处:仅非流式显示 */}
      {!isStreaming && (
        <Tooltip content={t('codeBlock.insertAtCursor')}>
          <IconButton
            onClick={handleInsertAtCursor}
            data-testid="insert-at-cursor-button"
            className={iconBtnClass}
            aria-label={t('codeBlock.insertAtCursor')}
          >
            <TextCursorInput />
          </IconButton>
        </Tooltip>
      )}
      <IconButton
        onClick={() => copy(code)}
        data-testid="copy-button"
        className={iconBtnClass}
        aria-label={copied ? tA11y('codeCopied') : tA11y('copyCode')}
      >
        {copied ? <Check /> : <Copy />}
      </IconButton>
    </div>
  )

  // 流式中的代码块用 opacity-60 标记(临时闭合位置)
  // 2026-08-02:对话文字整体放大,代码块 14px → 15px(text-[15px])
  // 2026-08-17 P3:dark 模式代码块统一用更深 zinc-950(与 markdown-stream.test 期望对齐,
  // 原实现用 zinc-900 + 注释"较浅避免同色",但实际测试断言 zinc-950 已通过,改为一致 token)
  const preClassName = cn(
    'relative my-0 overflow-x-auto rounded-lg border border-zinc-200 p-3 text-[15px]',
    'bg-zinc-100 text-zinc-900',
    'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
    isStreaming && 'opacity-60',
  )

  // 折叠按钮(absolute 定位在 <pre> 右下角)
  const collapseButton = shouldCollapse && !isStreaming && (
    <button
      type="button"
      onClick={() => setCollapsed((prev) => !prev)}
      className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-border/60 bg-float-indicator-bg px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <>
        {inlinePreview}
        <pre ref={preRef} className={preClassName}>
          {copyButton}
          {collapseButton}
          <code className="font-mono">{displayCode}</code>
        </pre>
        {runResult && <CodeRunOutput result={runResult} onClose={clearRunResult} />}
      </>
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
    <>
      {inlinePreview}
      <CodeBlockErrorBoundary fallback={fallback}>
        <pre ref={preRef} className={preClassName}>
          {copyButton}
          {collapseButton}
          <SyntaxHighlighter
            language={lang}
            style={syntaxStyle}
            showLineNumbers={!!lineNumberStyle}
            lineNumberStyle={lineNumberStyle}
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
      {runResult && <CodeRunOutput result={runResult} onClose={clearRunResult} />}
    </>
  )
}

// React.memo 包裹:code/language/syntaxStyle 不变时跳过重渲染
const CodeBlock = React.memo(CodeBlockImpl)

/**
 * 主题感知包装层:在 useTheme hook 中读取 resolvedTheme,转成 syntaxStyle 注入 CodeBlock。
 * 不放在 CodeBlock 内部:React.memo 会因 props 未变而跳过重渲染,
 * 把 syntaxStyle 提升为 prop 后,memo 能在引用变化时正常触发更新。
 */
function ThemedCodeBlock(props: {
  language?: string
  code: string
  isStreaming?: boolean
  collapseLines?: number
}) {
  const { resolvedTheme } = useTheme()
  const syntaxStyle = resolvedTheme === 'dark' ? ONE_DARK : ONE_LIGHT
  // 四竞品对标 V2 #17(2026-09-15 立):语法高亮路径显示行号(对标 Codex/Trae/Qoder)。
  // 行号色随主题:dark=zinc-400 / light=zinc-500,半透明 + 禁止选中(复制不夹带行号)。
  // 纯文本/高亮降级路径不传 → 无行号(优雅降级,与高亮能力同生命周期)。
  const lineNumberStyle: React.CSSProperties =
    resolvedTheme === 'dark'
      ? { color: '#a1a1aa', opacity: 0.7, userSelect: 'none' }
      : { color: '#71717a', opacity: 0.7, userSelect: 'none' }
  return <CodeBlock {...props} syntaxStyle={syntaxStyle} lineNumberStyle={lineNumberStyle} />
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

function MarkdownLink({
  href,
  children,
  isStreaming,
}: {
  href?: string
  children?: React.ReactNode
  /** P3 #32:流式中 PDF/CSV 仍渲染下载卡,完成后升级为富预览(避免 iframe 抖动) */
  isStreaming?: boolean
}) {
  const hrefStr = typeof href === 'string' ? href : undefined
  if (!hrefStr) {
    // 无 href 的链接:渲染为 span(避免 a11y 警告)
    return <span>{children}</span>
  }

  const isSafeUrl = /^(https?:|mailto:|\/|#)/.test(hrefStr)
  if (!isSafeUrl) {
    return <span>{children}</span>
  }

  // Office/数据文件:渲染为下载卡片
  if (isOfficeLink(hrefStr)) {
    const fileName = hrefStr.split('/').pop()?.split('?')[0] ?? 'file'
    const ext = (fileName.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase()

    // P3 #32:PDF/CSV 非流式时升级为消息内富预览(PDF 原生查看器 / CSV 表格化)
    if (!isStreaming && ext === 'pdf') {
      return <PdfEmbed src={hrefStr} />
    }
    if (!isStreaming && ext === 'csv') {
      return <CsvPreview src={hrefStr} />
    }
    // D41:docx/xlsx/pptx 非流式时升级为消息内富预览(四态降级见 office-preview)
    if (!isStreaming && (ext === 'docx' || ext === 'xlsx' || ext === 'pptx')) {
      return <OfficePreview src={hrefStr} ext={ext} />
    }

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

/** P3 #35:稳定段渲染组件——content 字符串不变时 memo 命中,整段跳过 react-markdown parse。 */
const StableBlock = React.memo(function StableBlock({
  content,
  components,
}: {
  content: string
  components: Components
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, output: 'html' }]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
})

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
        return (
          <MarkdownLink href={href} isStreaming={isStreaming}>
            {children}
          </MarkdownLink>
        )
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
      // 分隔线:已移除,不需要
      hr() {
        return null
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
        const hasRealContent = childrenArray.some((child) => {
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
    // P3 #32:a 组件透传 isStreaming(PDF/CSV 流式中渲染下载卡,完成后升级富预览)。
    [collapseLines, isStreaming],
  )

  // P3 #35(2026-09-16 立):稳定段/活跃段切分。
  // 流式纯追加 → 前缀冻结:splitMarkdownStable 在最后一个安全块边界(围栏外空行、
  // 非列表延续)切一刀;stable 用 memo 缓存跳过 parse,每 tick 只解析 active。
  // 非流式(完成态)与短内容不切,走既有单 ReactMarkdown 全量路径(零行为差异)。
  const { stable, active } = React.useMemo(
    () => (isStreaming ? splitMarkdownStable(parseContent) : { stable: '', active: parseContent }),
    [parseContent, isStreaming],
  )

  return (
    // 2026-08-02:AI 对话正文 14px → 15px(text-[15px]),用户反馈"太大了 小点"
    <div className="!m-0 !p-0 !space-y-0 text-[15px]" data-testid="markdown-stream">
      {stable ? (
        <>
          {/* 稳定前缀:内容冻结,memo 命中时零 parse */}
          <StableBlock content={stable} components={components} />
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, output: 'html' }]]}
            components={components}
          >
            {active}
          </ReactMarkdown>
        </>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, output: 'html' }]]}
          components={components}
        >
          {active}
        </ReactMarkdown>
      )}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
