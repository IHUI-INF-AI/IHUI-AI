// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { loader } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import {
  fetchApi,
  getLspDefinition,
  getLspReferences,
  getLspDiagnostics,
  getLspHover,
} from '@ihui/api-client'
import { cn } from '@/lib/utils'
import { useDebugStore } from '@/stores/debug'

// 2026-07-31 self-host Monaco Editor(对标 主流 IDE,避免 CDN/CSP/网络问题)
// 默认从 cdn.jsdelivr.net 加载,GFW/网络/CSP 经常导致 vs/loader.js 加载失败。
// 改为本地 /vs 路径(monaco-editor 包 min/vs 已复制到 apps/web/public/vs)。
// loader.config 必须在模块顶层执行(早于 MonacoEditor 渲染),全局只配置一次。
if (typeof window !== 'undefined') {
  loader.config({ paths: { vs: '/vs' } })
}

/**
 * Monaco 编辑器 React 包装(@monaco-editor/react 动态 import 避免 SSR)。
 *
 * 暴露的能力:
 * - 受控 value / onChange(双向绑定)
 * - onSelectionChange(选区变化回调,1-based ISelection)
 * - onMount(editor, monaco)(把 monaco 实例透出给调用方,用于 executeEdits 等命令式操作)
 * - 自动跟随 next-themes 主题(vs-dark / vs)
 * - 代码折叠(folding + showFoldingControls: 'mouseover')
 * - minimap 可选(showMinimap prop,默认 false,满足 AGENTS.md §4 compact 约束)
 * - AI inline completion(注册 InlineCompletionsProvider,debounce 300ms,
 *   调用 /ai/llm/fim 专用 FIM 端点(全文前缀+后缀),失败静默降级,不弹登录窗不报错)
 */

// 类型定义:从 @monaco-editor/react 透出(避免显式 import monaco-editor 类型)
type MonacoEditorInstance = {
  getValue(): string
  setValue(value: string): void
  executeEdits(
    source: string,
    edits: Array<{
      range: {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }
      text: string | null
      forceMoveMarkers?: boolean
    }>,
  ): boolean
  getSelection(): {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
  getModel(): MonacoModel | null
  updateOptions(opts: Record<string, unknown>): void
  getOption<T>(id: number): T
  onDidChangeCursorSelection(cb: (e: { selection: MonacoSelection; source: string }) => void): {
    dispose(): void
  }
  /** 断点 gutter decoration 增量同步(1-7c 调试链路,Monaco 经典 API) */
  deltaDecorations(
    oldIds: string[],
    newDecorations: Array<{
      range: {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }
      options: {
        isWholeLine?: boolean
        glyphMarginClassName?: string
      }
    }>,
  ): string[]
  /** gutter 点击断点切换(仅消费 target.type===2 即 GUTTER_GLYPH_MARGIN) */
  onMouseDown(
    cb: (e: {
      target: {
        type: number
        position: { lineNumber: number; column: number } | null
      }
    }) => void,
  ): {
    dispose(): void
  }
  focus(): void
  layout(): void
  /** LSP diagnostics 通道(0-4c):把后端诊断渲染为 squiggles(owner='ihui-lsp') */
  setModelMarkers(
    model: MonacoModel,
    owner: string,
    markers: Array<{
      startLineNumber: number
      startColumn: number
      endLineNumber: number
      endColumn: number
      message: string
      severity: number
      source?: string
    }>,
  ): void
  /** 模型内容变化(0-4c:diagnostics debounce 触发源;P1-9:补全接受检测) */
  onDidChangeModelContent(
    cb: (e: {
      changes?: Array<{ rangeOffset: number; rangeLength: number; text: string }>
    }) => void,
  ): { dispose(): void }
  /** 跨文件 definition 跳转落点(pendingReveal 揭示用) */
  setPosition(position: MonacoPosition): void
  revealPositionInCenter(position: MonacoPosition): void
}

// Monaco inline completion 相关最小类型(避免引入 monaco-editor 类型声明,全显式标注)
type MonacoPosition = {
  lineNumber: number
  column: number
}

type MonacoWordRange = {
  startColumn: number
  endColumn: number
}

type MonacoModel = {
  getLanguageId(): string
  getLineContent(lineNumber: number): string
  getWordUntilPosition(position: MonacoPosition): MonacoWordRange
  /** 光标位置 → 全文偏移(FIM 全文前缀/后缀切分用) */
  getOffsetAt(position: MonacoPosition): number
  /** 模型 uri(definition/references provider 返回同文件跳转目标用) */
  uri: { toString(): string }
}

type MonacoCancellationToken = {
  readonly isCancellationRequested: boolean
  onCancellationRequested(cb: () => void): { dispose(): void }
}

type MonacoInlineCompletionItem = {
  insertText: string
  range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
}

type MonacoInlineCompletions = {
  items: MonacoInlineCompletionItem[]
}

type MonacoInlineCompletionContext = {
  triggerKind: 'Invoke' | 'Automatic'
  selectedSuggestionInfo?: unknown
}

const FIM_CACHE_LIMIT = 30

interface FimMetrics {
  requestStartedAt: number
  prefix: string
  suffix: string
}

declare global {
  interface Window {
    __ihuiFimMetrics?: {
      requestCount: number
      cacheHitCount: number
      cancellationCount: number
      failureCount: number
      suggestionCount: number
      /** 用户按 Tab 接受建议的次数(2026-09-13 P1-9 补全接受率分子) */
      acceptedCount: number
      /** 建议展示后被忽略/取消的次数(接受率副指标,不参与接受率计算) */
      dismissedCount: number
      latencyMs: number[]
      last?: { durationMs: number; fromCache: boolean; cancelled: boolean; language: string }
    }
  }
}

const fimMetrics = {
  requestCount: 0,
  cacheHitCount: 0,
  cancellationCount: 0,
  failureCount: 0,
  suggestionCount: 0,
  acceptedCount: 0,
  dismissedCount: 0,
  latencyMs: [] as number[],
  last: undefined as
    { durationMs: number; fromCache: boolean; cancelled: boolean; language: string } | undefined,
}

// ---- 补全指标上报(P1-9 接受率闭环)----
// 后端按 model **累加**增量,故这里只上报"自上次上报以来的差值",
// 避免全量累计值被反复相加。防抖 5s,失败静默,绝不阻塞编辑器。
const FIM_REPORT_DEBOUNCE_MS = 5_000
let fimReportModel = 'auto'
// 待上报延迟样本(上报后清空)
let fimReportLatency: number[] = []
// 上次已上报的累计值基线
const fimReportBaseline = {
  requestCount: 0,
  cacheHitCount: 0,
  cancellationCount: 0,
  failureCount: 0,
  suggestionCount: 0,
  acceptedCount: 0,
  dismissedCount: 0,
}
let fimReportTimer: ReturnType<typeof setTimeout> | null = null

/** 立即上报增量快照(无变化则跳过;失败静默,不阻塞编辑器) */
function flushFimReport(): void {
  fimReportTimer = null
  const delta = {
    requestCount: fimMetrics.requestCount - fimReportBaseline.requestCount,
    cacheHitCount: fimMetrics.cacheHitCount - fimReportBaseline.cacheHitCount,
    cancellationCount: fimMetrics.cancellationCount - fimReportBaseline.cancellationCount,
    failureCount: fimMetrics.failureCount - fimReportBaseline.failureCount,
    suggestionCount: fimMetrics.suggestionCount - fimReportBaseline.suggestionCount,
    acceptedCount: fimMetrics.acceptedCount - fimReportBaseline.acceptedCount,
    dismissedCount: fimMetrics.dismissedCount - fimReportBaseline.dismissedCount,
  }
  const latencyMs = fimReportLatency
  const changed = latencyMs.length > 0 || Object.values(delta).some((value) => value > 0)
  if (!changed) return
  // 先推进基线再发请求:即便上报失败也不重复投递(指标尽力而为)
  fimReportBaseline.requestCount = fimMetrics.requestCount
  fimReportBaseline.cacheHitCount = fimMetrics.cacheHitCount
  fimReportBaseline.cancellationCount = fimMetrics.cancellationCount
  fimReportBaseline.failureCount = fimMetrics.failureCount
  fimReportBaseline.suggestionCount = fimMetrics.suggestionCount
  fimReportBaseline.acceptedCount = fimMetrics.acceptedCount
  fimReportBaseline.dismissedCount = fimMetrics.dismissedCount
  fimReportLatency = []
  try {
    // Promise.resolve 包裹:即便 fetchApi 返回非 Promise(mock/异常实现)也不抛错
    void Promise.resolve(
      fetchApi('/api/llm/fim/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: fimReportModel || 'auto', ...delta, latencyMs }),
      }),
    ).catch((error) => {
      console.warn('[ihui-fim] 补全指标上报失败(已忽略)', error)
    })
  } catch (error) {
    console.warn('[ihui-fim] 补全指标上报异常(已忽略)', error)
  }
}

/** 防抖调度上报(5s 内的多次指标变更合并为一次) */
function scheduleFimReport(): void {
  if (fimReportTimer) clearTimeout(fimReportTimer)
  fimReportTimer = setTimeout(flushFimReport, FIM_REPORT_DEBOUNCE_MS)
}

function fimCacheKey(prefix: string, suffix: string, language: string): string {
  return `${language}\u0000${prefix.slice(-6000)}\u0000${suffix.slice(0, 2000)}`
}

function recordFimMetric(
  metrics: FimMetrics,
  result: {
    completion: string
    fromCache: boolean
    cancelled: boolean
    language: string
    /** 后端实际使用的模型 id(用于按模型聚合接受率) */
    model?: string
  },
): void {
  const durationMs = Date.now() - metrics.requestStartedAt
  fimMetrics.requestCount += 1
  fimMetrics.latencyMs.push(durationMs)
  fimReportLatency.push(durationMs)
  if (fimMetrics.latencyMs.length > 100) fimMetrics.latencyMs.shift()
  if (result.fromCache) fimMetrics.cacheHitCount += 1
  if (result.cancelled) fimMetrics.cancellationCount += 1
  if (!result.completion && !result.cancelled) fimMetrics.failureCount += 1
  if (result.completion) fimMetrics.suggestionCount += 1
  if (result.model) fimReportModel = result.model
  fimMetrics.last = {
    durationMs,
    fromCache: result.fromCache,
    cancelled: result.cancelled,
    language: result.language,
  }
  if (typeof window !== 'undefined') window.__ihuiFimMetrics = fimMetrics
  scheduleFimReport()
}

type MonacoInlineCompletionsProvider = {
  provideInlineCompletions(
    model: MonacoModel,
    position: MonacoPosition,
    context: MonacoInlineCompletionContext,
    token: MonacoCancellationToken,
  ): Promise<MonacoInlineCompletions | null | undefined>
  freeInlineCompletions(completions: MonacoInlineCompletions): void
}

type MonacoNamespace = {
  editor: {
    DefineTheme(opts: unknown): void
    registerInlineCompletionsProvider(
      languageId: string,
      provider: MonacoInlineCompletionsProvider,
    ): { dispose(): void }
  }
  /** LSP 四核心注册入口(0-4c,语言选择器 '*' 全量注册,失败静默降级) */
  languages?: {
    registerHoverProvider(
      languageSelector: string,
      provider: {
        provideHover(
          model: MonacoModel,
          position: MonacoPosition,
          token: MonacoCancellationToken,
        ): Promise<MonacoHover | null> | MonacoHover | null
      },
    ): { dispose(): void }
    registerDefinitionProvider(
      languageSelector: string,
      provider: {
        provideDefinition(
          model: MonacoModel,
          position: MonacoPosition,
          token: MonacoCancellationToken,
        ): Promise<MonacoLocationLink[] | null> | MonacoLocationLink[] | null
      },
    ): { dispose(): void }
    registerReferenceProvider(
      languageSelector: string,
      provider: {
        provideReferences(
          model: MonacoModel,
          position: MonacoPosition,
          context: { includeDeclaration: boolean },
          token: MonacoCancellationToken,
        ): Promise<MonacoLocationLink[] | null> | MonacoLocationLink[] | null
      },
    ): { dispose(): void }
  }
  /** MarkerSeverity 数值常量(Error=8 / Warning=4 / Info=2 / Hint=1) */
  MarkerSeverity?: { Hint: number; Info: number; Warning: number; Error: number }
}

/** Monaco hover 返回结构(markdown 字符串数组) */
type MonacoHover = {
  contents: Array<{ value: string }>
  range?: MonacoRange
}

/** Monaco 通用 range(1-based) */
type MonacoRange = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

/** Monaco definition/references 跳转目标(uri + range) */
type MonacoLocationLink = {
  uri: { toString(): string }
  range: MonacoRange
}

/** 路径归一化(Windows 反斜杠 → '/',供 LSP 跨文件匹配) */
function normPath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** LspLocation(后端 relpath + 1-based)→ Monaco range(同文件跳转) */
function locToMonacoRange(loc: {
  line: number
  column: number
  endLine?: number
  endColumn?: number
}): MonacoRange {
  return {
    startLineNumber: loc.line,
    startColumn: loc.column,
    endLineNumber: loc.endLine ?? loc.line,
    endColumn: loc.endColumn ?? loc.column + 1,
  }
}

/** LSP severity 字符串(Error/Warning/Info/Hint)→ Monaco MarkerSeverity 数值 */
function severityToMarker(
  sev: string,
  ms: { Hint: number; Info: number; Warning: number; Error: number } | undefined,
): number {
  switch (sev.toLowerCase()) {
    case 'error':
      return ms?.Error ?? 8
    case 'warning':
      return ms?.Warning ?? 4
    case 'info':
    case 'information':
      return ms?.Info ?? 2
    case 'hint':
      return ms?.Hint ?? 1
    default:
      return ms?.Warning ?? 4
  }
}

export type MonacoSelection = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

/** /ai/llm/fim 响应体(2026-09-07 升级,fetchApi 已解包 {code,message,data} 外层,失败静默降级) */
interface FimCompletionData {
  completion?: string
  /** 后端实际使用的模型 id(auto 路由结果,用于按模型聚合接受率) */
  model?: string
}

export interface CodeEditorProps {
  value: string
  language?: string
  onChange?: (value: string) => void
  onSelectionChange?: (selection: MonacoSelection, selectedText: string) => void
  onMount?: (editor: MonacoEditorInstance, monaco: MonacoNamespace) => void
  fontSize?: number
  className?: string
  /** 只读模式(默认 false) */
  readOnly?: boolean
  /** placeholder(显示在编辑器空白处,Monaco 无原生支持,实现为 overlay) */
  placeholder?: string
  /** 显示 minimap(默认 false,满足 AGENTS.md §4 compact 约束) */
  showMinimap?: boolean
  /** 文件路径(提供时启用断点 gutter:点击行号左侧槽位 toggle 断点,与调试面板共享 store) */
  filePath?: string
  /** 工作区根路径(0-4c:提供 filePath+workspacePath 时启用 LSP hover/definition/references/diagnostics) */
  workspacePath?: string
  /** LSP 跨文件跳转回调(definition 落在其他文件时由宿主打开;编辑器记录 pendingReveal 待内容加载后揭示) */
  onOpenLocation?: (loc: { file: string; line: number; column: number }) => void
}

/** Monaco editor 组件的最小 props 类型(用于类型安全的渲染) */
interface MonacoEditorProps {
  height?: string | number
  language?: string
  value?: string
  theme?: string
  onChange?: (value: string | undefined) => void
  onMount?: (editor: unknown, monaco: unknown) => void
  loading?: React.ReactNode
  options?: Record<string, unknown>
}

/** 异步加载 @monaco-editor/react(SSR 安全) */
async function loadMonacoEditor(): Promise<React.ComponentType<MonacoEditorProps>> {
  const mod = await import('@monaco-editor/react')
  return mod.default as React.ComponentType<MonacoEditorProps>
}

const MonacoEditor = dynamic(loadMonacoEditor, {
  ssr: false,
  loading: () => <div className="p-2 text-xs text-muted-foreground">Loading editor...</div>,
})

export function CodeEditor({
  value,
  language = 'plaintext',
  onChange,
  onSelectionChange,
  onMount,
  fontSize = 14,
  className,
  readOnly = false,
  placeholder,
  showMinimap = false,
  filePath,
  workspacePath,
  onOpenLocation,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs'
  const editorRef = React.useRef<MonacoEditorInstance | null>(null)
  // AI inline completion provider disposable(卸载时释放)
  const inlineProviderDisposableRef = React.useRef<{ dispose(): void } | null>(null)
  // debounce timer(用户停止输入 300ms 后才请求 AI 补全,避免频繁调用 AI 服务)
  const completionDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const inlineCompletionAbortRef = React.useRef<AbortController | null>(null)
  const inlineCompletionCacheRef = React.useRef(new Map<string, string>())
  // 最近一次返回给 Monaco 的非空建议(Tab 接受 / 忽略判定用;内容变化时结算并清空)
  const lastSuggestionRef = React.useRef<{ insertText: string; offset: number } | null>(null)

  // ---- 断点 gutter(1-7c 调试链路) ----
  // filePathRef:编辑器实例跨文件复用(切换 tab 不重挂载),事件回调需实时读取当前文件,
  // 因此用 ref 而非闭包捕获,每次渲染同步
  const filePathRef = React.useRef<string | undefined>(undefined)
  filePathRef.current = filePath
  // 当前 decoration ids(deltaDecorations 增量同步的旧 ids 游标)
  const breakpointDecosRef = React.useRef<string[]>([])
  // useDebugStore 订阅(断点在面板/编辑器任一侧变化均同步红点)
  const breakpointUnsubRef = React.useRef<(() => void) | null>(null)

  // ---- LSP 四核心(0-4c) ----
  // workspacePathRef / onOpenLocationRef:编辑器实例跨文件复用,事件回调实时读取当前值
  const workspacePathRef = React.useRef<string | undefined>(undefined)
  workspacePathRef.current = workspacePath
  const onOpenLocationRef = React.useRef<
    ((loc: { file: string; line: number; column: number }) => void) | null
  >(null)
  onOpenLocationRef.current = onOpenLocation ?? null
  // LSP provider disposables(卸载释放)
  const lspDisposablesRef = React.useRef<Array<{ dispose(): void }>>([])
  // diagnostics debounce timer(输入停止 800ms 后才请求,避免频繁调用)
  const diagnosticsDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // 跨文件 definition 跳转落点(等新 tab 内容加载完成后 reveal)
  const pendingRevealRef = React.useRef<{ file: string; line: number; column: number } | null>(null)
  // LSP 不可用降级提示(同一挂载周期只提示一次,避免刷屏)
  const lspUnavailableHintedRef = React.useRef(false)
  // Monaco MarkerSeverity 常量(挂载时从 monaco 命名空间捕获,缺省走协议默认值)
  const markerSeverityRef = React.useRef<
    { Hint: number; Info: number; Warning: number; Error: number } | undefined
  >(undefined)

  /** LSP 请求失败(503 lsp-unavailable / 网络 / 超时)静默降级:不弹窗不阻塞,仅控制台一次性提示可改用 codegraph */
  const noteLspUnavailable = React.useCallback(
    (scope: string, res?: { error?: string; errorCode?: string }) => {
      if (lspUnavailableHintedRef.current) return
      lspUnavailableHintedRef.current = true
      const hint =
        res?.errorCode === 'lsp-unavailable' || res?.error?.includes('LSP')
          ? '建议改用 codegraph/goto_definition 或 codegraph/find_references 作为离线兜底。'
          : ''
      console.info(`[ihui-lsp] ${scope} 不可用,已静默降级(编辑器功能不受影响)。${hint}`)
    },
    [],
  )

  /** 请求 /lsp/diagnostics 并渲染 squiggles(失败静默降级,不动 Monaco 内置 worker 的 markers) */
  const refreshDiagnostics = React.useCallback(() => {
    const ws = workspacePathRef.current
    const fp = filePathRef.current
    if (!ws || !fp) return
    getLspDiagnostics({ workspacePath: ws, file: fp })
      .then((res) => {
        const e = editorRef.current
        const model = e?.getModel()
        if (!e || !model) return
        if (!res.success) {
          noteLspUnavailable('diagnostics', res)
          return
        }
        const markers = (res.data.diagnostics ?? []).map((d) => ({
          startLineNumber: d.line,
          startColumn: d.column,
          endLineNumber: d.endLine ?? d.line,
          endColumn: d.endColumn ?? d.column + 1,
          message: d.message,
          severity: severityToMarker(d.severity, markerSeverityRef.current),
          source: d.source ?? 'ihui-lsp',
        }))
        e.setModelMarkers(model, 'ihui-lsp', markers)
      })
      .catch(() => noteLspUnavailable('diagnostics'))
  }, [noteLspUnavailable])

  /** 把 store 中当前文件的断点同步为 Monaco glyph decoration 红点 */
  const syncBreakpointDecorations = React.useCallback((e: MonacoEditorInstance) => {
    const fp = filePathRef.current
    if (!fp) return
    const bps = useDebugStore.getState().breakpoints.filter((b) => b.file === fp && b.enabled)
    const newDecos = bps.map((b) => ({
      range: {
        startLineNumber: b.line,
        startColumn: 1,
        endLineNumber: b.line,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        glyphMarginClassName: 'ihui-breakpoint-glyph',
      },
    }))
    breakpointDecosRef.current = e.deltaDecorations(breakpointDecosRef.current, newDecos)
  }, [])

  /**
   * 调用 /ai/llm/fim 获取 AI 内联补全建议(2026-09-07 升级为专用 FIM 端点)。
   * 此前走 /ai/llm/chat 对话端点且 prefix 只有当前行 → 补全质量差、延迟高。
   * 现走 ai-service 专用 FIM(fill-in-the-middle)端点:
   * - 全文前缀(截尾 6000 字符)+ 后缀(截头 2000 字符),真实 fill-in-middle 语义
   * - temperature=0 + max_tokens=128,模型 auto 路由(本地/零成本优先)
   * 任意失败(网络/404/未授权/解析错误)均静默降级返回空串,
   * 不影响编辑器正常使用,不弹登录窗,不报错。
   * 复用 @ihui/api-client 的 fetchApi(已注入 token,无需新依赖)。
   */
  const fetchInlineCompletion = React.useCallback(
    async (prefix: string, suffix: string, lang: string): Promise<string> => {
      const cacheKey = fimCacheKey(prefix, suffix, lang)
      const cached = inlineCompletionCacheRef.current.get(cacheKey)
      if (cached !== undefined) return cached

      inlineCompletionAbortRef.current?.abort()
      const controller = new AbortController()
      inlineCompletionAbortRef.current = controller
      const requestStartedAt = Date.now()
      const metrics: FimMetrics = { requestStartedAt, prefix, suffix }
      try {
        const res = await fetchApi<FimCompletionData>('/ai/llm/fim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, suffix, language: lang, max_tokens: 128 }),
          signal: controller.signal,
          timeoutMs: 3000,
        })
        const completion = res.success ? (res.data?.completion ?? '') : ''
        if (!controller.signal.aborted) {
          inlineCompletionCacheRef.current.set(cacheKey, completion)
          if (inlineCompletionCacheRef.current.size > FIM_CACHE_LIMIT) {
            const oldestKey = inlineCompletionCacheRef.current.keys().next().value
            if (oldestKey !== undefined) inlineCompletionCacheRef.current.delete(oldestKey)
          }
        }
        recordFimMetric(metrics, {
          completion,
          fromCache: false,
          cancelled: controller.signal.aborted,
          language: lang,
          model: res.success ? res.data?.model : undefined,
        })
        return completion
      } catch (error) {
        const cancelled =
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        recordFimMetric(metrics, { completion: '', fromCache: false, cancelled, language: lang })
        return ''
      }
    },
    [],
  )

  const handleMount = React.useCallback(
    (editor: unknown, monaco: unknown) => {
      const e = editor as MonacoEditorInstance
      editorRef.current = e
      // 选区变化:上报给调用方
      e.onDidChangeCursorSelection((ev) => {
        if (!onSelectionChange) return
        const sel = ev.selection
        const model = e.getModel()
        if (!model) return
        const lines = (e.getValue() || '').split('\n')
        // 精确截取选中文本(单行/多行均正确处理 column 边界)
        let selectedText: string
        if (sel.startLineNumber === sel.endLineNumber) {
          const line = lines[sel.startLineNumber - 1] ?? ''
          selectedText = line.slice(sel.startColumn - 1, sel.endColumn - 1)
        } else {
          const firstLine = (lines[sel.startLineNumber - 1] ?? '').slice(sel.startColumn - 1)
          const middleLines = lines.slice(sel.startLineNumber, sel.endLineNumber - 1)
          const lastLine = (lines[sel.endLineNumber - 1] ?? '').slice(0, sel.endColumn - 1)
          selectedText = [firstLine, ...middleLines, lastLine].join('\n')
        }
        onSelectionChange(sel, selectedText)
      })

      // 注册 AI inline completion provider(全局语言 '*',Tab 接受,失败静默降级)
      // 幽灵文本由 Monaco 内联补全标准机制渲染,用户按 Tab 接受
      try {
        const monacoNs = monaco as MonacoNamespace
        if (monacoNs.editor?.registerInlineCompletionsProvider) {
          const provider: MonacoInlineCompletionsProvider = {
            async provideInlineCompletions(model, position, _context, token) {
              // debounce 300ms:用户停止输入后才请求,避免每次按键都调用 AI 服务
              await new Promise<void>((resolve) => {
                let done = false
                const finish = () => {
                  if (done) return
                  done = true
                  if (completionDebounceRef.current) {
                    clearTimeout(completionDebounceRef.current)
                    completionDebounceRef.current = null
                  }
                  sub.dispose()
                  resolve()
                }
                const sub = token.onCancellationRequested(finish)
                completionDebounceRef.current = setTimeout(finish, 300)
              })
              if (token.isCancellationRequested) return { items: [] }

              // 2026-09-07 升级:FIM 全文上下文。此前 prefix 只取当前行 →
              // 模型看不到文件其余部分,补全质量差。现取全文前缀(光标前)+
              // 全文后缀(光标后),由后端截断到 6000/2000 字符。
              const fullText = e.getValue() ?? ''
              const offset = model.getOffsetAt(position)
              const prefix = fullText.slice(0, offset)
              const suffix = fullText.slice(offset)
              // 空行或纯空白前缀无上下文,跳过(不调用 AI)
              if (!prefix.trim()) return { items: [] }

              const lang = model.getLanguageId() ?? 'plaintext'
              if (token.isCancellationRequested) return { items: [] }
              const suggestion = await fetchInlineCompletion(prefix, suffix, lang)
              if (token.isCancellationRequested) return { items: [] }
              if (!suggestion) return { items: [] }

              // 多行补全缩进对齐:后续行追加当前行前导空白(Monaco 原样插入文本)
              const currentLine = model.getLineContent(position.lineNumber)
              const indent = currentLine.match(/^[ \t]*/)?.[0] ?? ''
              const suggestionLines = suggestion.split('\n')
              const insertText =
                indent && suggestionLines.length > 1
                  ? suggestionLines
                      .map((line, i) => (i === 0 || line.trim() === '' ? line : indent + line))
                      .join('\n')
                  : suggestion

              const wordUntilPosition = model.getWordUntilPosition(position)
              const startColumn = wordUntilPosition.endColumn
              const completions: MonacoInlineCompletions = {
                items: [
                  {
                    insertText,
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn,
                      endLineNumber: position.lineNumber,
                      endColumn: startColumn,
                    },
                  },
                ],
              }
              // 记录待决建议:Monaco 接受时会把它原样插入模型,
              // 供 onDidChangeModelContent 按 (offset, insertText) 精确识别 Tab 接受
              lastSuggestionRef.current = {
                insertText,
                offset: model.getOffsetAt({ lineNumber: position.lineNumber, column: startColumn }),
              }
              return completions
            },
            freeInlineCompletions() {
              // 接受/忽略的计数统一由下方 onDidChangeModelContent 判定,
              // 避免 "free 先于内容变化触发" 时把 Tab 接受误记成忽略。
            },
          }
          inlineProviderDisposableRef.current = monacoNs.editor.registerInlineCompletionsProvider(
            '*',
            provider,
          )
          // ---- 补全接受率(Tab 接受检测,P1-9)----
          // Monaco 接受内联补全时把 insertText 原样插入模型,体现为一次
          // rangeLength=0、rangeOffset=记录的插入点、text===insertText 的内容变化。
          // 命中 → acceptedCount+1;内容以其他方式变化(用户继续输入) → dismissedCount+1。
          // 计数只在内容变化处判定,避免与 freeInlineCompletions 的时序竞争。
          e.onDidChangeModelContent((ev) => {
            const pending = lastSuggestionRef.current
            if (!pending) return
            const change = ev.changes?.[0]
            const accepted =
              !!change &&
              change.rangeLength === 0 &&
              change.rangeOffset === pending.offset &&
              change.text === pending.insertText
            if (accepted) {
              fimMetrics.acceptedCount += 1
            } else {
              // 内容以其他方式变化(用户继续输入)→ 建议被忽略
              fimMetrics.dismissedCount += 1
            }
            scheduleFimReport()
            lastSuggestionRef.current = null
          })
        }
      } catch {
        // 静默降级:inline completion 不可用,不影响编辑器其他功能
      }

      // ---- LSP 四核心接线(0-4c)----
      // hover / definition / references 三 provider + diagnostics 通道(setModelMarkers)。
      // 全部调 ai-service /lsp/* 端点;LSP 不可用(503 lsp-unavailable / 网络失败)时
      // 静默降级返回空,不阻塞编辑器,仅控制台一次性提示可改用 codegraph 兜底。
      try {
        const monacoNs = monaco as MonacoNamespace
        if (markerSeverityRef.current === undefined && monacoNs.MarkerSeverity) {
          markerSeverityRef.current = monacoNs.MarkerSeverity
        }
        if (monacoNs.languages) {
          // LSP 位置入参(实时读取 refs:编辑器实例跨 tab 复用,闭包值会过期)
          const lspInput = (position: MonacoPosition) => {
            const ws = workspacePathRef.current
            const fp = filePathRef.current
            if (!ws || !fp) return null
            return {
              workspacePath: ws,
              file: fp,
              line: position.lineNumber,
              column: position.column,
            }
          }

          // 1) hover:textDocument/hover → markdown 浮层
          lspDisposablesRef.current.push(
            monacoNs.languages.registerHoverProvider('*', {
              async provideHover(_model, position, _token) {
                const input = lspInput(position)
                if (!input) return null
                try {
                  const res = await getLspHover(input)
                  if (!res.success) {
                    noteLspUnavailable('hover', res)
                    return null
                  }
                  if (!res.data.hover) return null
                  return {
                    contents: [{ value: res.data.hover }],
                    range: locToMonacoRange({ line: position.lineNumber, column: position.column }),
                  }
                } catch {
                  noteLspUnavailable('hover')
                  return null
                }
              },
            }),
          )

          // 2) definition:textDocument/definition → 同文件 Monaco 跳转 / 跨文件走 onOpenLocation
          lspDisposablesRef.current.push(
            monacoNs.languages.registerDefinitionProvider('*', {
              async provideDefinition(model, position, _token) {
                const input = lspInput(position)
                if (!input) return null
                try {
                  const res = await getLspDefinition(input)
                  if (!res.success) {
                    noteLspUnavailable('definition', res)
                    return null
                  }
                  const locs = res.data.locations ?? []
                  if (!locs.length) return null
                  const cur = normPath(filePathRef.current ?? '')
                  const sameFile = locs.filter((l) => normPath(l.file) === cur)
                  if (sameFile.length) {
                    return sameFile.map((l) => ({ uri: model.uri, range: locToMonacoRange(l) }))
                  }
                  // 跨文件:交给宿主打开(IDE 打开新 tab),记录落点,内容加载后由 pendingReveal 揭示
                  const cross = locs.find((l) => normPath(l.file) !== cur)
                  if (!cross) return []
                  pendingRevealRef.current = {
                    file: normPath(cross.file),
                    line: cross.line,
                    column: cross.column,
                  }
                  onOpenLocationRef.current?.(cross)
                  return []
                } catch {
                  noteLspUnavailable('definition')
                  return null
                }
              },
            }),
          )

          // 3) references:textDocument/references → 同文件引用列表(Monaco Peek 面板渲染)
          lspDisposablesRef.current.push(
            monacoNs.languages.registerReferenceProvider('*', {
              async provideReferences(model, position, context, _token) {
                const input = lspInput(position)
                if (!input) return null
                try {
                  const res = await getLspReferences({
                    ...input,
                    includeDeclaration: context.includeDeclaration,
                  })
                  if (!res.success) {
                    noteLspUnavailable('references', res)
                    return null
                  }
                  const cur = normPath(filePathRef.current ?? '')
                  // 跨文件引用 Monaco 无法直接打开(需 codeEditorService),仅渲染同文件部分
                  return (res.data.locations ?? [])
                    .filter((l) => normPath(l.file) === cur)
                    .map((l) => ({ uri: model.uri, range: locToMonacoRange(l) }))
                } catch {
                  noteLspUnavailable('references')
                  return null
                }
              },
            }),
          )

          // 4) diagnostics:内容变化 debounce 800ms → /lsp/diagnostics → setModelMarkers squiggles
          e.onDidChangeModelContent(() => {
            if (diagnosticsDebounceRef.current) clearTimeout(diagnosticsDebounceRef.current)
            diagnosticsDebounceRef.current = setTimeout(() => {
              diagnosticsDebounceRef.current = null
              refreshDiagnostics()
            }, 800)
          })
          // 挂载后首轮诊断(等 Monaco 完成首帧渲染,避免与内置 worker 竞争)
          setTimeout(() => refreshDiagnostics(), 500)
        }
      } catch {
        // 静默降级:LSP provider 注册失败(老版本 Monaco 无 languages API),不影响编辑器
      }

      // 断点 gutter(1-7c):点击 glyph margin 槽位 toggle 断点(编辑器 ↔ 调试面板共享 store)。
      // Monaco MouseTargetType.GUTTER_GLYPH_MARGIN === 2
      e.onMouseDown((ev) => {
        const fp = filePathRef.current
        if (!fp) return
        if (ev.target.type === 2 && ev.target.position) {
          useDebugStore.getState().toggleBreakpointAt(fp, ev.target.position.lineNumber)
        }
      })

      // 断点变化订阅(面板增删/切换断点 → 编辑器红点实时同步)
      if (breakpointUnsubRef.current) breakpointUnsubRef.current()
      breakpointUnsubRef.current = useDebugStore.subscribe(() => {
        const ed = editorRef.current
        if (ed) syncBreakpointDecorations(ed)
      })
      syncBreakpointDecorations(e)

      if (onMount) onMount(e, monaco as MonacoNamespace)
    },
    [
      onMount,
      onSelectionChange,
      fetchInlineCompletion,
      syncBreakpointDecorations,
      noteLspUnavailable,
      refreshDiagnostics,
    ],
  )

  // 同步外部 fontSize / readOnly 变化
  React.useEffect(() => {
    const e = editorRef.current
    if (!e) return
    e.updateOptions({ fontSize, readOnly })
  }, [fontSize, readOnly])

  // 切换文件(tab 切换不重挂载编辑器):清除旧文件红点,同步新文件断点
  React.useEffect(() => {
    const e = editorRef.current
    if (e) syncBreakpointDecorations(e)
  }, [filePath, syncBreakpointDecorations])

  // LSP(0-4c):切换文件时刷新新文件的 diagnostics(旧文件 markers 随 model 复用被覆盖)
  React.useEffect(() => {
    if (!workspacePath || !filePath) return
    refreshDiagnostics()
  }, [workspacePath, filePath, refreshDiagnostics])

  // LSP(0-4c):跨文件 definition 跳转揭示 —— onOpenLocation 打开的新 tab 内容异步加载完成后,
  // value prop 变化触发本 effect,校验落点文件与当前文件一致即 setPosition + reveal
  React.useEffect(() => {
    const e = editorRef.current
    const pending = pendingRevealRef.current
    if (!e || !pending) return
    const cur = normPath(filePath ?? '')
    if (
      !cur ||
      (cur !== pending.file &&
        !cur.endsWith('/' + pending.file) &&
        !pending.file.endsWith('/' + cur))
    )
      return
    // 内容为空 = tab 还在异步加载文件内容,等下一轮 value 变化再试
    if (!e.getValue()) return
    const pos = { lineNumber: pending.line, column: pending.column }
    e.setPosition(pos)
    e.revealPositionInCenter(pos)
    pendingRevealRef.current = null
  }, [value, filePath])

  // 卸载时释放 inline completion provider + 清理 debounce timer(防内存泄漏)
  React.useEffect(() => {
    // 缓存 ref 对象(而非 .current 快照):cleanup 时读取同一 Map,规避 ref 值漂移告警
    const inlineCompletionCache = inlineCompletionCacheRef.current
    return () => {
      if (inlineProviderDisposableRef.current) {
        inlineProviderDisposableRef.current.dispose()
        inlineProviderDisposableRef.current = null
      }
      if (completionDebounceRef.current) {
        clearTimeout(completionDebounceRef.current)
        completionDebounceRef.current = null
      }
      inlineCompletionAbortRef.current?.abort()
      inlineCompletionAbortRef.current = null
      inlineCompletionCache.clear()
      // LSP(0-4c):释放四核心 provider + 清理 diagnostics debounce
      for (const d of lspDisposablesRef.current) {
        try {
          d.dispose()
        } catch {
          // 忽略 dispose 异常
        }
      }
      lspDisposablesRef.current = []
      if (diagnosticsDebounceRef.current) {
        clearTimeout(diagnosticsDebounceRef.current)
        diagnosticsDebounceRef.current = null
      }
      pendingRevealRef.current = null
      // 释放断点 store 订阅
      if (breakpointUnsubRef.current) {
        breakpointUnsubRef.current()
        breakpointUnsubRef.current = null
      }
      // P1-9:卸载时补发一次未上报的补全指标(尽力而为,失败静默)
      if (fimReportTimer) {
        clearTimeout(fimReportTimer)
        flushFimReport()
      }
    }
  }, [])

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <MonacoEditor
        height="100%"
        language={language}
        value={value}
        theme={theme}
        onChange={(v) => onChange?.(v ?? '')}
        onMount={handleMount}
        loading={<div className="p-2 text-xs text-muted-foreground">Loading editor...</div>}
        options={{
          fontSize,
          readOnly,
          minimap: { enabled: showMinimap },
          // 断点 gutter 槽位(仅传入 filePath 的调试场景启用)
          glyphMargin: Boolean(filePath),
          folding: true,
          showFoldingControls: 'mouseover',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          roundedLineSelection: false,
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontLigatures: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
      />
      {placeholder && !value && (
        <div className="pointer-events-none absolute left-3 top-2 z-10 text-sm text-muted-foreground/60">
          {placeholder}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
