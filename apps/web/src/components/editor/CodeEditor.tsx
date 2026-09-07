// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { loader } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { fetchApi } from '@ihui/api-client'
import { cn } from '@/lib/utils'

// 2026-07-31 self-host Monaco Editor(对标 Trae/Codex,避免 CDN/CSP/网络问题)
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
  getModel(): {
    getLanguageId(): string
  } | null
  updateOptions(opts: Record<string, unknown>): void
  getOption<T>(id: number): T
  onDidChangeCursorSelection(cb: (e: { selection: MonacoSelection; source: string }) => void): {
    dispose(): void
  }
  focus(): void
  layout(): void
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
  latencyMs: [] as number[],
  last: undefined as { durationMs: number; fromCache: boolean; cancelled: boolean; language: string } | undefined,
}

function fimCacheKey(prefix: string, suffix: string, language: string): string {
  return `${language}\u0000${prefix.slice(-6000)}\u0000${suffix.slice(0, 2000)}`
}

function recordFimMetric(metrics: FimMetrics, result: {
  completion: string
  fromCache: boolean
  cancelled: boolean
  language: string
}): void {
  const durationMs = Date.now() - metrics.requestStartedAt
  fimMetrics.requestCount += 1
  fimMetrics.latencyMs.push(durationMs)
  if (fimMetrics.latencyMs.length > 100) fimMetrics.latencyMs.shift()
  if (result.fromCache) fimMetrics.cacheHitCount += 1
  if (result.cancelled) fimMetrics.cancellationCount += 1
  if (!result.completion && !result.cancelled) fimMetrics.failureCount += 1
  if (result.completion) fimMetrics.suggestionCount += 1
  fimMetrics.last = { durationMs, fromCache: result.fromCache, cancelled: result.cancelled, language: result.language }
  if (typeof window !== 'undefined') window.__ihuiFimMetrics = fimMetrics
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
        recordFimMetric(metrics, { completion, fromCache: false, cancelled: controller.signal.aborted, language: lang })
        return completion
      } catch (error) {
        const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
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
              return {
                items: [
                  {
                    insertText,
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn: wordUntilPosition.endColumn,
                      endLineNumber: position.lineNumber,
                      endColumn: wordUntilPosition.endColumn,
                    },
                  },
                ],
              }
            },
            freeInlineCompletions() {},
          }
          inlineProviderDisposableRef.current = monacoNs.editor.registerInlineCompletionsProvider(
            '*',
            provider,
          )
        }
      } catch {
        // 静默降级:inline completion 不可用,不影响编辑器其他功能
      }

      if (onMount) onMount(e, monaco as MonacoNamespace)
    },
    [onMount, onSelectionChange, fetchInlineCompletion],
  )

  // 同步外部 fontSize / readOnly 变化
  React.useEffect(() => {
    const e = editorRef.current
    if (!e) return
    e.updateOptions({ fontSize, readOnly })
  }, [fontSize, readOnly])

  // 卸载时释放 inline completion provider + 清理 debounce timer(防内存泄漏)
  React.useEffect(() => {
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
      inlineCompletionCacheRef.current.clear()
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
