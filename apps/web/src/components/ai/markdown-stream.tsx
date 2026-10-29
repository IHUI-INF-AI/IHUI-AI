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
  ImageDown,
  ImageOff,
  Play,
  Loader2,
  FilePlus2,
  TextCursorInput,
  TextWrap,
  Maximize2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
// 2026-10-29:中文全角括号 autolink 收尾修正(GFM 只认 ASCII 边界,全角右括号会被吞进 href)
import { remarkTrimCjkAutolink } from '@/lib/markdown-autolink-cjk'
import rehypeKatex from 'rehype-katex'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { MarkdownTableBlock } from './markdown-table-toolbar'
import { OverflowShadow } from './overflow-shadow'
import { IconButton } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { useWorkPanelStore } from '@/stores/work-panel'
// D129:点开图片的唯一出口(外链 window.open / 其余进工作面板);助手侧与用户气泡共用一份判断
import { openImageSource } from '@/lib/open-image-source'
import { useCanvasStore } from '@/stores/canvas-store'
import { applyCodeBlockToFile } from '@/lib/apply-code-block'
// D197:代码块「自动换行」偏好(zustand persist,跨会话记忆);D198:代码块「复制为图片」落盘
import { useCodeBlockPrefsStore } from '@/stores/code-block-prefs'
import { codeTextToPngBlob } from '@/lib/copy-as-image'
import { useCodeBlockRun, isRunnableLanguage, type RunResult } from '@/components/ai/code-block-run'
// P3 #35(2026-09-16 立):流式稳定段/活跃段切分——稳定前缀 memo 缓存跳过 parse
// 2026-10-30:块级增量——稳定前缀再按安全切点拆块,每块独立 memo,每帧只重解析最后一块
import {
  splitMarkdownBlocks,
  splitMarkdownStable,
  judgeBlockStability,
} from '@/lib/markdown-stable-split'
// V3 #70(2026-09-27 立):PDF/CSV/TSV/office 消息内富预览的唯一入口。
// 取代此前 P3 #32 的两个分支与 D41 的 office 分支 —— 派发器内部仍复用既有
// PDFViewer(pdf.js)/ OfficePreview(SUPPORTED_EXTS 唯一支持表),不是第二套实现。
import { RichFilePreview } from '@/components/file-preview'
// D76 残余②(2026-09-25 立):正文产物链接 → 反向聚焦产物卡。复用 MessageList 已挂的
// ihui:focus-artifact 通道(不新增事件名/payload 形状);无对应卡时接管失败,保持原行为。
import { tryFocusArtifactFromLink } from '@/components/media/artifact-turn-badge'
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
  // G-834:「已复制」回退 timer 收进 ref,卸载时 clearTimeout ——
  // 此前裸调 setTimeout 不留句柄:组件先卸载时 timer 仍会触发 setState,连续复制还会叠 timer。
  // 写法与本文件既有 applyTimerRef(:255-260)同型,先例:progress-sections/plan-steps-card.tsx:347-368。
  const copyTimerRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])
  const copy = React.useCallback((text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        // 再次复制先清旧句柄,保证任一时刻至多一个回退 timer
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current)
        }
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
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

// G-842(2026-09-29):代码块 header —— 文件图标 + 语言名映射出的示例文件名。
// 形态对标上游 ai-elements/code-block.tsx 的「language → 示例文件名映射 + header」结构
// (结构对标,条目为本仓自拟,非上游文案);未收录语言兜底 code.<lang>,无语言兜底 code.txt。
const CODE_FILE_NAME_BY_LANGUAGE: Record<string, string> = {
  bash: 'script.sh',
  c: 'main.c',
  cpp: 'main.cpp',
  cs: 'Program.cs',
  csharp: 'Program.cs',
  css: 'style.css',
  dart: 'main.dart',
  go: 'main.go',
  html: 'index.html',
  java: 'Main.java',
  js: 'index.js',
  json: 'data.json',
  jsx: 'component.jsx',
  kotlin: 'Main.kt',
  md: 'README.md',
  php: 'index.php',
  plain: 'code.txt',
  py: 'main.py',
  python: 'main.py',
  ruby: 'main.rb',
  rust: 'main.rs',
  sh: 'script.sh',
  shell: 'script.sh',
  sql: 'query.sql',
  swift: 'main.swift',
  text: 'code.txt',
  ts: 'index.ts',
  tsx: 'component.tsx',
  typescript: 'index.ts',
  vue: 'App.vue',
  xml: 'data.xml',
  yaml: 'config.yaml',
}

/** G-842:语言名 → header 显示文件名(未收录兜底 code.<lang>,空语言兜底 code.txt) */
function resolveCodeFileName(language?: string): string {
  const normalized = (language ?? '').trim().toLowerCase()
  return CODE_FILE_NAME_BY_LANGUAGE[normalized] ?? `code.${normalized || 'txt'}`
}

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
        /* iframe-sandbox-relax: 预览的是模型现写的 html/svg 代码块(srcDoc),不给 allow-scripts
           则内联预览整块空白,该功能即失效。档值 = MODEL_CONTENT_SANDBOX
           (packages/ui-react/src/components/webview-frame.tsx 的唯一实现),
           刻意**不含** allow-same-origin ⇒ 帧内 opaque origin,读不到本站 Cookie/存储。 */
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
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  preserveExpanded = false,
  dark = false,
}: {
  language?: string
  code: string
  isStreaming?: boolean
  syntaxStyle: Record<string, React.CSSProperties>
  collapseLines?: number
  /** 四竞品对标 V2 #17(2026-09-15):行号样式,undefined = 不显示行号(纯文本/降级路径不传) */
  lineNumberStyle?: React.CSSProperties
  /** 2026-10-29 流式观感档⑦:stable 晋升跨树 remount 时携带的"保持展开"事实(见 useState 注记) */
  preserveExpanded?: boolean
  /** D198:复制为图片的底色/前景色取深色或浅色主题(由 ThemedCodeBlock 注入,与语法高亮同生命周期) */
  dark?: boolean
}): React.ReactElement {
  const tA11y = useTranslations('a11y')
  const t = useTranslations('chat')
  const { copied, copy } = useCopy()
  // 流式场景下 mermaid 代码会频繁变化,用 debounce 减少 mermaid.render 调用
  const debouncedCode = useDebounce(code, 300)

  // D197:自动换行偏好(全站单选持久,zustand persist store ihui-code-block-prefs)
  const wrap = useCodeBlockPrefsStore((s) => s.wrap)
  const toggleWrap = useCodeBlockPrefsStore((s) => s.toggleWrap)

  // D198:「复制为图片」状态(成功后短暂显示 Check,与 applyState/copy 回退同型)
  const [imageCopied, setImageCopied] = React.useState(false)
  const imageTimerRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    return () => {
      if (imageTimerRef.current !== null) window.clearTimeout(imageTimerRef.current)
    }
  }, [])

  const handleCopyImage = React.useCallback(() => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return
    void codeTextToPngBlob(code, { dark })
      .then((blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]))
      .then(() => {
        setImageCopied(true)
        if (imageTimerRef.current !== null) window.clearTimeout(imageTimerRef.current)
        imageTimerRef.current = window.setTimeout(() => setImageCopied(false), 1500)
      })
      .catch(() => {})
  }, [code, dark])

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

  // 2026-10-29 流式观感档⑦:折叠初值可被 preserveExpanded 携带 —— stable 晋升跨
  // ReactMarkdown 双树 remount 时(键不互通,React 树间无法迁移节点)新实例若一律
  // 折叠,用户看到"围栏块写完瞬间塌回 5 行"=「闭合跳一下」的根子;该 prop 由
  // MarkdownStream 的实例级登记簿给出该 prop:判序=**先记后判**(闭合与下一栏开栏挤同一拍
  // 时,该块首拍挂载前一刻刚入簿仍被认可);历史重载被闸死(见 sessionStreamedRef 注记),
  // 在写尾块不入簿。
  const [collapsed, setCollapsed] = React.useState(() => !preserveExpanded)
  // 2026-10-29 流式观感档⑩(e2e 像素守门现形):闭合沿变那一拍,prop preserveExpanded
  // 已为 true 但 collapsed 还是挂载旧值 true —— 档③ 的 setCollapsed(false) 在 effect 里
  // (paint 之后),中间存在**一帧折叠闪位**(实浏览器逐帧量到 302px→99px→302px;jsdom 恒不可见)。
  // 修:展开判定在"用户未亲手点过折叠钮"期间由 collapsed 态 ∪ carry 事实共同决定 ——
  // carry 在场即视为展开(挂载/沿变两型统一),用户一旦亲手操作,其意志最高、立即接管。
  const userToggledCollapseRef = React.useRef(false)
  const preRef = React.useRef<HTMLPreElement>(null)

  // 当代码块展开/折叠时，自动滚动到代码块位置
  React.useEffect(() => {
    if (!collapsed && preRef.current) {
      requestAnimationFrame(() => {
        preRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [collapsed])

  /* 2026-10-28 流式观感档③:流式中代码块**尾部跟随全展**(Qoder 式"看着写完"),
     此前流式只冻前 5 行 = 中段在写、屏幕上纹丝不动,观感断档最大的一处。
     刚结束(本会话内 流式→完成)的块保持展开不闪折;历史重载(挂载即非流式)维持
     既有"长块默认折叠"设计 —— 用 wasStreaming ref 只接 in-session 沿变。 */
  const wasStreamingRef = React.useRef(Boolean(isStreaming))
  React.useEffect(() => {
    if (isStreaming) wasStreamingRef.current = true
    else if (wasStreamingRef.current) {
      wasStreamingRef.current = false
      setCollapsed(false)
    }
  }, [isStreaming])

  // 2026-10-28 流式观感档②:流式高亮输入走 300ms 防抖值(mermaid/html 预览同源做法)——
  // batcher 每帧 append,若每帧都让 SyntaxHighlighter 全量重新 tokenize,长代码块必掉帧;
  // 防抖把高亮重排频率钳到 3.3Hz,字符流本身仍逐帧平滑。完成态(含中止/flush)恒取
  // 最新 code,防抖快照不可能盖住终值(非流式分支直接用原值)。
  const hlSource = isStreaming ? debouncedCode : code
  const codeLines = hlSource.split('\n')
  const shouldCollapse = collapseLines > 0 && codeLines.length > collapseLines
  // 档⑩:未亲手点过钮时,carry 事实(preserveExpanded)与 collapsed 取并集判展开 ——
  // 闭合沿变那一拍不再闪一帧折叠;用户一旦操作,其意志立即接管。
  const effectiveCollapsed = isStreaming
    ? false
    : userToggledCollapseRef.current
      ? collapsed
      : collapsed && !preserveExpanded

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

  // mermaid 块交给 MermaidDiagram 客户端渲染。
  // 判据取已小写的 `lang` 而非原始 `language`:此前这里是 `language === 'mermaid'`,
  // 于是 ```Mermaid(首字母大写,模型很常这么写)匹配不到、整块掉进 Prism 高亮分支,
  // 既不走图表也不受 MermaidDiagram 内的渲染预算管 —— 唯一出口上开了一个 bypass。
  // 预算只在 MermaidDiagram 一处判(它是 web 端唯一的 mermaid 渲染点),这里负责
  // 保证"该进那道闸的都进得去"。
  if (lang === 'mermaid') {
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
                <Loader2 className="animate-spin" />
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
      {/* D197:自动换行开关(偏好持久化;aria-pressed 表达当前态,文案随态切换 开启/关闭) */}
      <Tooltip content={wrap ? t('codeBlock.wrapOff') : t('codeBlock.wrapOn')}>
        <IconButton
          onClick={toggleWrap}
          data-testid="wrap-toggle-button"
          className={iconBtnClass}
          aria-label={wrap ? t('codeBlock.wrapOff') : t('codeBlock.wrapOn')}
          aria-pressed={wrap}
        >
          <TextWrap className={cn(wrap && 'text-primary')} />
        </IconButton>
      </Tooltip>
      {/* D198:复制为图片(代码块文本 canvas 绘制为 PNG 写入剪贴板) */}
      <Tooltip content={t('codeBlock.copyImage')}>
        <IconButton
          onClick={handleCopyImage}
          data-testid="copy-image-button"
          className={iconBtnClass}
          aria-label={t('codeBlock.copyImage')}
        >
          {imageCopied ? <Check className="text-green-600" /> : <ImageDown />}
        </IconButton>
      </Tooltip>
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

  // 流式中的代码块不再整块压暗(2026-10-28 档④:此前 opacity-60 "草稿灰"+完成瞬间翻亮,
  // 观感断档;在写信号已交给硬闪光标与流式指示条,代码本体保持正常色=所见即终稿)。
  // 2026-08-02:对话文字整体放大,代码块 14px → 15px(text-[15px])
  // 2026-08-17 P3:dark 模式代码块统一用更深 zinc-950(与 markdown-stream.test 期望对齐,
  // 原实现用 zinc-900 + 注释"较浅避免同色",但实际测试断言 zinc-950 已通过,改为一致 token)
  // G-842:边框/圆角上移到外层 frame(header + <pre> 同框),<pre> 只保留底色与排版
  // D197:开启自动换行时横滚让位于 pre-wrap(白空格继承到内层 code),否则维持横滚原状
  const preClassName = cn(
    'relative my-0 p-3 text-[15px]',
    wrap ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto',
    'bg-zinc-100 text-zinc-900',
    'dark:bg-zinc-950 dark:text-zinc-100',
  )
  // G-842:外层 frame(仿本文件 CodeRunOutput 的「外框 + header 条 + 主体」形态)
  const codeFrameClass = 'overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700'
  // G-842:代码块 header —— 文件图标 + 语言名映射的示例文件名(纯展示,非交互)
  const codeHeader = (
    <div
      data-testid="code-block-header"
      className="flex items-center gap-1.5 bg-zinc-200/60 px-3 py-1.5 dark:bg-zinc-900"
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-mono text-xs text-muted-foreground">
        {resolveCodeFileName(language)}
      </span>
    </div>
  )

  // 折叠按钮(absolute 定位在 <pre> 右下角)
  const collapseButton = shouldCollapse && !isStreaming && (
    <button
      type="button"
      onClick={() => {
        // 档⑩:用户意志接管展开判定(carry 让位);标签/动作统一以 effectiveCollapsed 为准
        userToggledCollapseRef.current = true
        setCollapsed(!effectiveCollapsed)
      }}
      className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-sm border border-border/60 bg-float-indicator-bg px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={effectiveCollapsed ? '展开代码' : '收起代码'}
    >
      {effectiveCollapsed ? `展开 (${codeLines.length} 行)` : '收起'}
    </button>
  )

  // 计算折叠后的显示内容(流式=尾随全展;折叠判定与高亮输入同源 hlSource)
  const displayCode =
    effectiveCollapsed && shouldCollapse ? codeLines.slice(0, 5).join('\n') : hlSource

  // 纯文本或无语言:不调 SyntaxHighlighter,避免开销
  if (isPlain) {
    return (
      <>
        {inlinePreview}
        <div className={codeFrameClass}>
          {codeHeader}
          {/* G-827:横滚代码块的方向阴影线索。wrap 档无横向溢出,不套壳(避免无意义 DOM)。 */}
          <CodeOverflowShell wrap={!!wrap}>
            <pre ref={preRef} className={preClassName}>
              {copyButton}
              {collapseButton}
              <code className="font-mono">{displayCode}</code>
            </pre>
          </CodeOverflowShell>
        </div>
        {runResult && <CodeRunOutput result={runResult} onClose={clearRunResult} />}
      </>
    )
  }

  // 语法高亮失败时的降级渲染
  const fallback = (
    <div className={codeFrameClass}>
      {codeHeader}
      <CodeOverflowShell wrap={!!wrap}>
        <pre ref={preRef} className={preClassName}>
          {copyButton}
          {collapseButton}
          <code className={cn('font-mono', language && `language-${language}`)}>{displayCode}</code>
        </pre>
      </CodeOverflowShell>
    </div>
  )

  return (
    <>
      {inlinePreview}
      <CodeBlockErrorBoundary fallback={fallback}>
        <div className={codeFrameClass}>
          {codeHeader}
          <CodeOverflowShell wrap={!!wrap}>
            <pre ref={preRef} className={preClassName}>
              {copyButton}
              {collapseButton}
              <SyntaxHighlighter
                language={lang}
                style={syntaxStyle}
                showLineNumbers={!!lineNumberStyle}
                lineNumberStyle={lineNumberStyle}
                // D197:换行偏好传导进高亮器(code 标签 whiteSpace: pre-wrap;与行号并存时行转 flex)
                wrapLongLines={wrap}
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
          </CodeOverflowShell>
        </div>
      </CodeBlockErrorBoundary>
      {runResult && <CodeRunOutput result={runResult} onClose={clearRunResult} />}
    </>
  )
}

// React.memo 包裹:code/language/syntaxStyle 不变时跳过重渲染
const CodeBlock = React.memo(CodeBlockImpl)

/**
 * G-827 代码块横滚壳:非 wrap 档(横滚)时套 OverflowShadow 出方向阴影;
 * wrap 档无横向溢出 ⇒ 直接透传 children(不多一层 DOM,也不产生可命中的阴影节点)。
 * 初始(未测量)时 OverflowShadow 两态皆 false ⇒ 只渲染容器、不渲染阴影,不闪跳。
 */
function CodeOverflowShell({ wrap, children }: { wrap: boolean; children: React.ReactNode }) {
  if (wrap) return <>{children}</>
  return <OverflowShadow>{children}</OverflowShadow>
}

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
  /** 2026-10-29 流式观感档⑦:stable 晋升跨树 remount 时携"已展开"事实,透传 CodeBlockImpl */
  preserveExpanded?: boolean
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
  // D198:主题同时供给「复制为图片」的底色/前景色选择
  return (
    <CodeBlock
      {...props}
      syntaxStyle={syntaxStyle}
      lineNumberStyle={lineNumberStyle}
      dark={resolvedTheme === 'dark'}
    />
  )
}

// 图片放大容器:点击图片在 WorkPanel 打开(同源);外链在新标签页打开
// G-738(2026-09-28 立,吸收上游 ui/ai-elements/markdown-image.tsx 的三态纪律):
// 此前内联 <img> 裸挂载——加载失败只剩空白区域且零状态;而流式中同位置图片改写
// (src 变化)时 React 会复用旧 img 节点,旧资源的异步事件可能命中新 src 的处理器。
// 两条写法纪律:① **状态↔src 配对**——状态只在属于它的 source 与当前 src 等值时可信,
// src 换了旧状态一律作废;该判据语义与本仓 `use-preview-staleness.ts` 的 `case 'reset'`
// ("url 变了:上一文件的记录必须作废")同源。那台状态机服务的是 fetch 文本内容身份
// (content/version/pending 维度),内联图的事件源是 DOM img 的 onLoad/onError,不能直接
// 复用其 reducer,但"资源变更 ⇒ 旧记录不得续用"只此一条判据,不造第二种语义。
// ② **key 按资源重建**——<img key={srcStr}>,换 src 即换节点,load/error 只更新
// 触发该事件的那张图的状态。
type MarkdownImageStatus = 'loading' | 'loaded' | 'error'

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const tA11y = useTranslations('a11y')
  // 复用既有键(ai.toolCall.imageLoadFailed = "图片加载失败",五语言已在位),
  // 不新增语言包键;加载中文案同理复用 a11y.loading。
  const tImage = useTranslations('ai.toolCall')
  const srcStr = typeof src === 'string' ? src : undefined
  const [imageState, setImageState] = React.useState<{
    source: string
    status: MarkdownImageStatus
  }>(() => ({ source: srcStr ?? '', status: 'loading' }))
  if (!srcStr) return null

  // 纪律①:状态↔src 配对。state.source !== 当前 src ⇒ 旧状态不可信,视为 loading。
  const effectiveStatus = imageState.source === srcStr ? imageState.status : 'loading'

  const isDataUri = srcStr.startsWith('data:')
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|$)/i.test(srcStr) || isDataUri
  if (!isImage) return null

  const handleOpen = () => {
    // D129:点开图片的行为抽到唯一出口 `openImageSource`(外链 window.open / 其余进工作面板)——
    // 用户自己上传的图现在要走同一套行为,在组件里再抄一份判断就会漂开
    // (漂开的表现是"助手发的图能点开、用户传的图点不开",最难归因的那一型)。
    openImageSource(srcStr, 'markdown-image')
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="my-0 block max-w-full overflow-hidden rounded-sm bg-streamed-container-bg transition-colors hover:bg-streamed-container-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      aria-label={alt ? `图片: ${alt}` : '点击放大图片'}
    >
      {effectiveStatus === 'error' ? (
        // G-738:失败态独立容器 role="img" + aria-label(上游 markdown-image.tsx 同构),
        // 与加载中的 role="status" **分开**——两种 aria 语义不共用一个承载元素。
        <span
          role="img"
          aria-label={tImage('imageLoadFailed')}
          data-markdown-image-state="error"
          className="flex min-h-24 w-full items-center justify-center px-3 py-2 text-muted-foreground"
        >
          <ImageOff className="h-6 w-6" aria-hidden />
        </span>
      ) : (
        <>
          {effectiveStatus === 'loading' && (
            <span
              role="status"
              data-markdown-image-state="loading"
              className="flex min-h-24 w-full items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {tA11y('loading')}
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- AI 返回的图片 URL 可能是任意来源,不走 next/image 优化 */}
          <img
            // G-738 纪律②:按资源重建节点(上游 key={displaySrc} 同判据)——React 复用
            // 同一 img 时,旧资源的异步事件可能命中新 src 的处理器;换 key 即换节点。
            key={srcStr}
            src={srcStr}
            alt={alt ?? ''}
            className={cn(
              'max-h-[400px] max-w-full object-contain',
              effectiveStatus === 'loading' && 'invisible',
            )}
            loading="lazy"
            onLoad={() => setImageState({ source: srcStr, status: 'loaded' })}
            onError={() => setImageState({ source: srcStr, status: 'error' })}
          />
        </>
      )}
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
// V3 #70:补 tsv —— 原表把 CSV 放进来却没有 TSV,分隔符表格预览因此对 TSV 整型失明。
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?|pdf|csv|tsv|md|txt|rtf|odt|ods|odp)(\?|$)/i
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

    // V3 #70:PDF/CSV/TSV 与 office 那一族的富预览统一走 file-preview 派发器
    // (pdf = pdf.js 真渲染 + 页码/翻页/缩放;csv|tsv = 表头固定 + 列宽自适应 + 行数如实提示)
    if (
      !isStreaming &&
      (ext === 'pdf' ||
        ext === 'csv' ||
        ext === 'tsv' ||
        ext === 'docx' ||
        ext === 'xlsx' ||
        ext === 'pptx')
    ) {
      return <RichFilePreview href={hrefStr} ext={ext} />
    }

    return (
      <a
        href={hrefStr}
        target="_blank"
        rel="noopener noreferrer"
        download={fileName}
        className="my-0 flex items-center gap-2 rounded-md border border-border bg-streamed-container-bg px-3 py-2 text-sm transition-colors hover:bg-streamed-container-bg-hover"
        onClick={(e) => {
          // D76 残余②:正文产物链接反向聚焦。仅当消息流里有同锚点产物卡时接管
          // (preventDefault + ihui:focus-artifact);无卡保持原下载行为不改语义。
          // 修饰键/中键点击交还浏览器(与新标签页/另存为惯例一致)。
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
          if (tryFocusArtifactFromLink(hrefStr)) e.preventDefault()
        }}
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
        // D76 残余②:命中产物卡的链接优先反向聚焦卡片(与下载卡分支同一判据),
        // 无卡再走 WorkPanel 打开原行为。
        if (tryFocusArtifactFromLink(hrefStr)) return
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

/**
 * 观感档⑦:本实例"已渲染过的完整代码文本"登记簿(跨 stable 晋升 remount 移交展开态)。
 * 先记后判的出口:重复文本 delete 再 add,挪到 FIFO 队尾(长代码块逐拍入簿时,
 * 旧前缀先被挤掉、终稿常驻);超上限只淘汰最久未更新的一条头。行首围栏缩进容错
 * ≤3 空格,与 markdown-stable-split 同一形态。
 */
const STREAMED_CODE_TEXTS_MAX = 256
function noteStreamedCodeText(set: Set<string>, text: string): void {
  if (!text) return
  set.delete(text)
  set.add(text)
  if (set.size > STREAMED_CODE_TEXTS_MAX) {
    const oldest = set.values().next().value
    if (oldest !== undefined) set.delete(oldest)
  }
}

/**
 * 观感档⑦/⑧:切出最后一个"开了还没闭"围栏的**块体文本**;全闭 ⇒ null。
 * 行首 ```/~~~ 计一次翻转(与切分判据同行首形态);尾沿剥一个 '\n' 的口径与
 * code() 渲染侧的 `String(children).replace(/\n$/,'')` 逐字节对齐,两侧可比。
 * 判"在写尾块"用**内容等值而非行号**:react-markdown 的 node.position 行号是
 * 相对各自 parse 输入(stable 切片 / active 切片)的起点,跨树比较必错位
 * (⑦ 初版用全局行号对 active 恰好可用、对 stable 恒假 —— ⑧ 逐块化后 stable 侧
 * 也要判,行号法不再安全,2026-10-29 自查换为内容判据)。
 * 与 hasUnclosedFence 计数粗判分工:粗判管虚拟闭合(奇偶即可),本函数给块体;
 * 粗判真而本函数 null(行内 ``` 噪声造成)的罕见分歧 ⇒ 调用侧回退旧粗判,失效方向无害。
 */
function lastOpenFenceBody(content: string): string | null {
  const lines = content.split('\n')
  let open = false
  let openedAt = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^\s{0,3}(```|~~~)/.test(lines[i] ?? '')) {
      if (open) {
        open = false
      } else {
        open = true
        openedAt = i
      }
    }
  }
  if (!open || openedAt < 0) return null
  // 尾沿换行归一(档⑦/⑧边界修正,e2e 像素守门现形):content 尾恰好停在换行符时,
  // 渲染侧 codeText(虚拟闭栏前多一个 \n,只 strip 一个)与切片侧 body 会差一个尾 \n ——
  // 等值误判"已写完"→ 完成态/在写态逐拍交替 + 防抖快照回卷(实测行数 9→2 闪回)。
  // 比对值双侧去尾 \n 归一;显示值(codeText 本体)一字不动。
  return lines
    .slice(openedAt + 1)
    .join('\n')
    .replace(/\n+$/, '')
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
      remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath, remarkTrimCjkAutolink]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, output: 'html' }]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
})

export function MarkdownStream({ content, isStreaming, collapseLines = 5 }: MarkdownStreamProps) {
  // 流式内容随平滑 batcher 逐帧增长;渲染层只做"同帧合并 + 轻节流",
  // 不再对长内容降级到 400ms(那会在长回答上重新引入整坨蹦),
  // 也不再走 useDeferredValue(其注释自承会让流式光标滞后、与正文节拍打架)。
  // 解析开销由 P3 #35 稳定/活跃切分(前缀 memo 跳过 parse)+ 代码块高亮 300ms 防抖兜底,
  // 故这里可放心贴近逐帧渲染,长回答也逐字淌、光标与正文同一拍。
  const THROTTLE_MS = 16
  const [throttledContent, setThrottledContent] = React.useState(content)
  const lastFlushRef = React.useRef<number>(0)
  const trailingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastFlushRef.current
    if (elapsed >= THROTTLE_MS) {
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
      }, THROTTLE_MS - elapsed)
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

  // 流式场景:未闭合代码块临时闭合让 react-markdown 能解析
  // 流式中的代码块用 isStreamingCodeRef 标记(档④:不再整块压暗,"在写"信号=尾随光标与
  // 流式指示条,代码本体保持正常色=所见即终稿)
  const isStreamingCodeRef = React.useRef(false)
  // 2026-10-29 观感档⑦:先记后判的判序是有意的 —— "本拍刚闭合、下一栏同拍开"时,该块
  // 首拍(入簿拍)即晋升拍,先判会拿不到携带、代码块空塌一次;先记后判让同一渲染拍内
  // 的迁居实例也认得出"这文本在本实例出现过"。假阳风险由下面两道闸挡住:
  // ① sessionStreamedRef —— 从未出现未闭合围栏的历史/单拍整段重载**绝不移交**(默认折叠设计逐字不变);
  // ② streamingFenceBodyRef(档⑧)—— 在写尾块(块体与最后开栏围栏内容等值)不入簿,
  //    中间态前缀不挤容量;同一 ref 供逐块化外观判定,一物两用不另设第二判据。
  const streamedCodeTextsRef = React.useRef<Set<string>>(new Set())
  const sessionStreamedRef = React.useRef(false)
  const streamingFenceBodyRef = React.useRef<string | null>(null)
  // G-737(2026-09-28 立,吸收上游 ui/ai-elements/message.tsx 的渲染键纪律——
  // "streaming/static 只是解析模式,不应参与渲染器身份;否则流式状态抖动会卸载
  // 整棵 markdown 子树,让已显示的正文重新触发淡入动画"):isStreaming 此前直接进
  // components 的 useMemo deps,它一翻 components 就是新引用 ⇒ StableBlock(默认浅
  // 比较)在内容已冻结时仍 memo 失效、稳定前缀整段重 parse。下载卡/富预览所需的
  // 读取改走 ref(与本文件既有 isStreamingCodeRef 同型):StableBlock 在 stable 非空时
  // 挂载(P3 #35 切分门,现已跨 isStreaming 翻转保持结构);流式时该路径 a 组件读到的
  // ref 为 true(整体仍在写),完成翻转时 ref 已随末块闭合转 false ⇒ 代码块自然升级完成态;
  // 非稳定路径每次随父渲染 pass,ref 在渲染前已更新为当前值 ⇒
  // "PDF/CSV 流式中渲染下载卡,完成后升级富预览"(P3 #32)行为逐字不变。
  const isStreamingRef = React.useRef(isStreaming)
  isStreamingRef.current = isStreaming
  const parseContent = React.useMemo(() => {
    const unclosed = hasUnclosedFence(throttledContent)
    isStreamingCodeRef.current = unclosed
    // ⑦ 簿籍侧输入:在写尾块的开栏行号 + "本会话出现过未闭合围栏"闸。
    // ref 写入对同一 throttledContent 幂等(与上方 G-737 ref 同型),双调用评估无碍。
    streamingFenceBodyRef.current = unclosed ? lastOpenFenceBody(throttledContent) : null
    if (unclosed) sessionStreamedRef.current = true
    return unclosed ? throttledContent + '\n```\n' : throttledContent
  }, [throttledContent])

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
          const streamingCode = isStreamingCodeRef.current
          // 档⑧:"在写"逐块化 —— 块体与最后开栏围栏的内容等值才是正在写的那块,
          // 其余已闭围栏当拍进完成外观(动作按钮/折叠态不再干等整实例翻转);
          // 粗判为奇但切不出发栏体(行内 ``` 噪声)⇒ 无从识别,回落旧粗判,失效方向不劣化。
          const writingBody = streamingFenceBodyRef.current
          // 比对双侧尾 \n 归一(与 lastOpenFenceBody 同一规则;displayCode 用原 codeText)
          const isWritingCode =
            streamingCode &&
            (writingBody === null ||
              codeText.replace(/\n+$/, '') === writingBody.replace(/\n+$/, ''))
          // ⑦:在写尾块不入簿(中间态前缀不是"完成过"的事实);携带 = 本会话见过未闭合围栏
          // ∧ 文本已入簿 ⇒ 晋升新实例不把折叠滚回复位。判序先记后判(闭合与下栏开挤同一拍,
          // 首拍即晋升拍,先判会空塌一次)。
          if (!isWritingCode) noteStreamedCodeText(streamedCodeTextsRef.current, codeText)
          return (
            <ThemedCodeBlock
              language={lang}
              code={codeText}
              isStreaming={isWritingCode}
              collapseLines={collapseLines}
              preserveExpanded={
                sessionStreamedRef.current && streamedCodeTextsRef.current.has(codeText)
              }
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
          <MarkdownLink href={href} isStreaming={isStreamingRef.current}>
            {children}
          </MarkdownLink>
        )
      },
      // 表格:G-824 抽出 MarkdownTableBlock(工具栏 + 横向滚动容器 + 真实 <table> ref)。
      // 表格节点之外一字未动,流式切分与 memo deps 不碰。
      table({ children }) {
        return <MarkdownTableBlock>{children}</MarkdownTableBlock>
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
    // G-737(2026-09-28):isStreaming **移出 deps** —— 解析模式不得进入渲染器身份,
    // 否则它一翻 components 新引用 ⇒ StableBlock memo 失效、冻结前缀整段重 parse。
    // a 组件改读 isStreamingRef(渲染 pass 前已同步),语义不变、身份不再抖动。
    [collapseLines],
  )

  // P3 #35(2026-09-16 立):稳定段/活跃段切分。
  // 流式纯追加 → 前缀冻结:splitMarkdownStable 在最后一个安全块边界(围栏外空行、
  // 非列表延续)切一刀;stable 用 memo 缓存跳过 parse,每 tick 只解析 active。
  // 2026-10-28 观感档⑥:「完成瞬间 active→stable 重排」根因修复——
  // 原实现 isStreaming=false 时强制不切分(stable=''、active=全文),渲染子节点从
  // [StableBlock, Active] 塌成 [ReactMarkdown(全文)],React 只能卸载旧子树、重建整棵
  // ⇒ 用户看到围栏闭合「跳一下」。改为**始终切分**(短内容/无安全切点由 split 内部
  // 返回 stable='' 兜底),翻转前后 content 不变 ⇒ 子节点结构恒定 ⇒ StableBlock memo
  // 命中不重渲染、Active 内容亦不变 ⇒ 零重排。代码块变实/运行按钮等「完成态」由
  // 档⑦/⑧ 起的"在写"逐块判定驱动,不再整实例一个粗判位。
  // 2026-10-29 流式观感档⑦:同区第二刀 —— 上面那格只钉住了「完成翻转」;真身还在
  // 「流式中途晋升」这格:splitStart 前进把写完的围栏块晋入 stable 前缀时,块要跨
  // ReactMarkdown 双树迁居。v10 不给块级子节点注入位置键(实测 lib/index.js,只过
  // URL 属性名),树间无节点迁移、同 index 异 type ⇒ 前缀重排处整列卸载重挂。段落重挂
  // =原位换字无手感;代码块重挂则折叠 useState 复位、新实例挂载即 collapsed=true
  // (观感档③ 保持展开沿变设计够不到"重挂载即全新实例")⇒「闭合跳一下」=刚写完的
  // 代码块瞬间塌回 collapseLines 行。修在渲染层、切分判据零改动:实例级登记簿
  // noteStreamedCodeText(先记后判;在写尾块与从未见过未闭合围栏的整段重载都不移交),
  // 晋升新实例凭簿中已有文本领 preserveExpanded 直接展开挂载。历史重载默认折叠设计逐字不变。
  // splitMarkdownStable / P3 #35 切分规则一字未动 —— 副作用面零外溢。
  // 同区两档补刀(2026-10-29 收口,切分判据依旧一字未动):
  // ⑧ 逐块化"在写"判定:code() 拿块体与"最后一个开栏围栏内容"等值比对,写完未退尾的块
  //   当拍进完成外观(按钮/折叠态不再等整实例翻粗判位)。判据材料本是 ⑦ 尾块排除一格,
  //   顺带修掉 ⑦ 初版跨树行号错位之患(node.position 行号相对各树自己的切片,全局比较是
  //   半真半假的巧合);粗判奇而切不出发栏体 ⇒ 回落旧粗判,等值误判窗口(尾块内容与更早
  //   某块全文重复)最坏=旧粗判行为,失效方向从不"提前开闸"。
  // ⑨ mermaid 重挂闪一拍:MermaidDiagram.tsx 把 renderedKeyRef 升级为模块级"已成功的
  //   消毒后 SVG 缓存 + 同键并发合流",晋升重挂实例首帧同步取图,占位闪烁与二次全量布局
  //   一并退役;容量/失效/主题隔离规则见该文件头注。
  // ⑩ 闭合沿变的一帧折叠闪位(2026-10-29 e2e 像素守门现形,jsdom 恒不可见):
  //   isStreaming prop 翻 false 那一拍 collapsed state 还是挂载旧值 true,档③ 的
  //   setCollapsed(false) 在 effect(paint 后)才落地 → 中间一帧按折叠态渲染(实测 302→99→302)。
  //   修在 CodeBlockImpl:未亲手点过折叠钮期间,展开判定由 collapsed ∪ preserveExpanded 事实
  //   并集决定(effectiveCollapsed);用户一旦操作立即接管。权威回归 = e2e/streaming-lifecycle
  //   逐帧高度单调判据;jsdom 侧另钉"用户意志接管"与"carry 优先"两型。
  const { stable, active } = React.useMemo(() => splitMarkdownStable(parseContent), [parseContent])

  // 2026-10-30 块级增量渲染:stable 前缀按全部安全切点拆成有序块,每块一个 StableBlock。
  // 切点只会向后追加(流式纯追加 ⇒ 已落地切点不移动)⇒ 前缀块 content 字符串恒等,
  // StableBlock memo 命中、整块跳过 parse;新内容只落在最后一块与 active。
  // key 用序号:块的"身份"就是它在切点序列里的位置,前缀块内容不会变。
  // 其余一律不动:active 仍整段渲染(含在写代码块判定)、components 依赖仍只有
  // collapseLines、throttle 与 parseContent 的虚拟闭合逻辑原样。
  //
  // 2026-10-29 补:上面那句"切点只会向后追加"此前是**假设**,不是判据 —— 实测会破
  // (列表标记逐字符到达时块边界回退,见 judgeBlockStability 头注)。现在每拍都用
  // judgeBlockStability 对账,并把结果喂给 key:
  //   · 边界稳定(常态)⇒ 序号 key 原样,前缀块 memo 命中;
  //   · 边界漂移(判据兜住的异常型)⇒ epoch 自增,整列 key 换组强制重挂。
  //     漂移时前缀块内容已错位,**必须**重挂才正确;有了这道闸,漂移至少不会以
  //     "React 按旧下标复用错节点、界面出现张冠李戴的段落"这种最难归因的形态出现。
  // 判据本身在 lib 层(纯函数、可单测),这里只做接线与告警,不复算任何判据(§0.6)。
  const blockLedgerRef = React.useRef<{
    source: string
    blocks: readonly string[]
    epoch: number
  }>({ source: '', blocks: [], epoch: 0 })

  const renderBlocks = React.useMemo(() => {
    if (!stable) {
      blockLedgerRef.current = { source: '', blocks: [], epoch: blockLedgerRef.current.epoch }
      return [] as readonly string[]
    }
    const { blocks } = splitMarkdownBlocks(stable)
    const ledger = blockLedgerRef.current
    const v = judgeBlockStability({
      previousBlocks: ledger.blocks,
      previousSource: ledger.source,
      source: stable,
      nextBlocks: blocks,
    })
    if (v.splitEnabled) {
      // 首次开启切分(上一拍单块即全文):可预期的一次性重建,内容刚过门槛,代价可忽略。
      // 不告警、不换 epoch —— 它不是边界回退,分型与处置都必须与回退分开。
      blockLedgerRef.current = { source: stable, blocks, epoch: ledger.epoch }
      return blocks
    }
    if (v.appendOnly && !v.stable) {
      // 边界回退:本仓"失效方向必须响"纪律 —— 不静默修,点名下标后强制重挂。
      const epoch = ledger.epoch + 1
      blockLedgerRef.current = { source: stable, blocks, epoch }
      console.warn(
        `[markdown-stream] 块边界回退 block=${String(v.firstDriftIndex)} prev=${String(ledger.blocks.length)} next=${String(blocks.length)} epoch=${String(epoch)}`,
      )
      return blocks
    }
    if (!v.appendOnly) {
      // 非纯追加(stable 自身被改写,如上级回退/重放/编辑后重生成)。
      //
      // 2026-10-29 补(真浏览器验证发现的结构性缺口):这一型此前**既不告警也不换 epoch**
      // —— 判据把"上游改写"合法地归为不可判(`appendOnly: false`),但调用方只覆盖了
      // `appendOnly && !stable` 那一支,于是非追加时沿用旧 epoch 静默更新账本。
      // 后果不是"判错",而是**该重挂的时候没重挂**:块内容已整体换过,序号 key 却不变,
      // React 按旧下标复用节点 —— 段落张冠李戴、代码块折叠态与 mermaid 渲染结果串到新内容上。
      //
      // 处置:不可判 ≠ 可沿用。内容身份变了就必须换 epoch(结构性保险,不依赖判据判出漂移);
      // 同时告警,因为"stable 回退"本身在纯追加流里不该发生,出现即值得看一眼。
      const epoch = ledger.epoch + 1
      blockLedgerRef.current = { source: stable, blocks, epoch }
      console.warn(
        `[markdown-stream] stable 非纯追加(上游改写)prev=${String(ledger.source.length)} next=${String(stable.length)} epoch=${String(epoch)}`,
      )
      return blocks
    }
    blockLedgerRef.current = { source: stable, blocks, epoch: ledger.epoch }
    return blocks
  }, [stable])

  const blockKeyPrefix = `b${blockLedgerRef.current.epoch}`

  return (
    // 2026-08-02:AI 对话正文 14px → 15px(text-[15px]),用户反馈"太大了 小点"
    // 2026-10-28 观感档⑤:流式光标改 CSS ::after 内联尾随(stream-caret-host,定义在
    // animations.css)——旧 DOM span 挂在容器末尾,块级输出断行让它悬在下一行行首;
    // 现光标作为最后一个块元素的行内子盒,真·跟在末字符后。DOM 不再渲染 caret 节点。
    <div
      className={cn('!m-0 !p-0 !space-y-0 text-[15px]', isStreaming && 'stream-caret-host')}
      data-testid="markdown-stream"
    >
      {stable ? (
        <>
          {/* 稳定前缀:按块冻结,各块 memo 命中时零 parse(每帧只重解析最后一块)。
              key 前缀随边界漂移 epoch 变 —— 漂移时强制整列重挂(见 renderBlocks 注记)。 */}
          {renderBlocks.map((block, index) => (
            <StableBlock
              key={`${blockKeyPrefix}-block-${index}`}
              content={block}
              components={components}
            />
          ))}
          <ReactMarkdown
            remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath, remarkTrimCjkAutolink]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, output: 'html' }]]}
            components={components}
          >
            {active}
          </ReactMarkdown>
        </>
      ) : (
        <ReactMarkdown
          remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath, remarkTrimCjkAutolink]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, output: 'html' }]]}
          components={components}
        >
          {active}
        </ReactMarkdown>
      )}
    </div>
  )
}

export default MarkdownStream
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
