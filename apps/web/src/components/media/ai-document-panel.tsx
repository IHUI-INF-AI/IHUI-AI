// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Copy, Loader2, Send, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { fetchApi, getBaseUrl, getToken } from '@/lib/api'
import { previewExtOf } from '@/lib/file-preview-kind'
import { MarkdownBody } from '@/components/docs/markdown-body'

/** 与 apps/api/src/routes/office-ai.ts 的 ANALYZE_EXTS 同集(新增格式两处同步)。 */
const AI_ANALYZE_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'odp',
  'ods',
  'rtf',
  'epub',
  'csv',
  'tsv',
  'txt',
  'md',
  'markdown',
  'json',
  'html',
  'htm',
])

export type AiAnalyzeMode = 'summary' | 'keypoints' | 'qa'

export interface AiAnalyzeResult {
  answer: string
  mode: AiAnalyzeMode
  model: string | null
  usage: unknown
  extractedChars: number
  truncated: boolean
}

/** 当前文件是否适合走“读正文 → AI 分析”链路(图片/音视频/3D 暂不冒充支持)。 */
export function canAnalyzeWithAi(name: string): boolean {
  return AI_ANALYZE_EXTS.has(previewExtOf(name))
}

interface AnalyzeStreamMeta {
  extractedChars: number
  truncated: boolean
}

interface RequestAnalyzeOptions {
  file: Blob
  name: string
  mode: AiAnalyzeMode
  question: string
  signal: AbortSignal
  onMeta?: (meta: AnalyzeStreamMeta) => void
  onChunk?: (chunk: string) => void
}

function analyzeQuery(mode: AiAnalyzeMode, question: string): string {
  const params = new URLSearchParams({ mode })
  if (mode === 'qa') params.set('question', question.trim())
  return params.toString()
}

function analyzeForm(file: Blob, name: string): FormData {
  const form = new FormData()
  form.append('file', file, name)
  return form
}

async function analyzeViaJson(
  options: RequestAnalyzeOptions,
  url: string,
): Promise<AiAnalyzeResult> {
  const res = await fetchApi<AiAnalyzeResult>(url, {
    method: 'POST',
    body: analyzeForm(options.file, options.name),
    timeoutMs: 120_000,
    signal: options.signal,
  })
  if (!res.success) throw new Error(res.error || 'AI_ERROR')
  return res.data
}

/**
 * 消费 /api/office/analyze/stream 的 SSE:
 * meta → chunk* → done/error。chunk 立即回调,让面板边收边渲染;
 * 上游在 done 里带 model/usage,这里统一收敛成 AiAnalyzeResult。
 */
async function consumeAnalyzeStream(
  response: Response,
  mode: AiAnalyzeMode,
  options: RequestAnalyzeOptions,
): Promise<AiAnalyzeResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('AI_STREAM_NO_BODY')
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''
  let model: string | null = null
  let usage: unknown = null
  let meta: AnalyzeStreamMeta = { extractedChars: 0, truncated: false }

  const handleLine = (line: string): void => {
    if (!line.startsWith('data:')) return
    const raw = line.slice(5).trim()
    if (!raw || raw === '[DONE]') return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    if (event.type === 'meta') {
      meta = {
        extractedChars:
          typeof event.extractedChars === 'number' ? event.extractedChars : meta.extractedChars,
        truncated: event.truncated === true,
      }
      options.onMeta?.(meta)
      return
    }
    if (event.type === 'error') {
      throw new Error(typeof event.message === 'string' ? event.message : 'AI_STREAM_ERROR')
    }
    if (event.type === 'done') {
      model = typeof event.model === 'string' ? event.model : model
      usage = event.usage ?? usage
      return
    }
    if (typeof event.content === 'string' && event.content) {
      answer += event.content
      options.onChunk?.(event.content)
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handleLine(line)
  }
  if (buffer) handleLine(buffer)

  if (!answer.trim()) throw new Error('AI_EMPTY')
  return {
    answer,
    mode,
    model,
    usage,
    extractedChars: meta.extractedChars,
    truncated: meta.truncated,
  }
}

/**
 * 优先走 SSE,失败时回退到原 JSON 接口:
 * - 旧部署还没有 /analyze/stream(404/405) → 回退,不把功能打挂;
 * - 浏览器/测试环境没有 fetch 或网络层直接抛错 → 回退;
 * - 流已经开始后出现 error 帧不再回退,避免同一问题重复请求。
 */
async function requestAnalyze(options: RequestAnalyzeOptions): Promise<AiAnalyzeResult> {
  const query = analyzeQuery(options.mode, options.question)
  const streamPath = `/api/office/analyze/stream?${query}`
  const jsonPath = `/api/office/analyze?${query}`

  if (typeof fetch !== 'function') return analyzeViaJson(options, jsonPath)

  const token = getToken()
  let response: Response
  try {
    response = await fetch(`${getBaseUrl()}${streamPath}`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: analyzeForm(options.file, options.name),
      credentials: 'include',
      signal: options.signal,
    })
  } catch (err) {
    if (options.signal.aborted) throw err
    return analyzeViaJson(options, jsonPath)
  }

  if (!response.ok) {
    if ([401, 404, 405].includes(response.status)) {
      return analyzeViaJson(options, jsonPath)
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `AI_STREAM_HTTP_${response.status}`)
  }
  if (!response.body) return analyzeViaJson(options, jsonPath)
  return consumeAnalyzeStream(response, options.mode, options)
}

interface Props {
  file: Blob
  name: string
  className?: string
  /** 打开面板即自动生成摘要(默认 true;测试可关)。 */
  autoRun?: boolean
  onClose?: () => void
}

/**
 * 统一文件查看器里的 AI 文档助手(2026-11-26 立)。
 *
 * 产品语义:不是“跳到聊天窗口再让用户自己上传”,而是让用户正在看的这份文件
 * 直接成为 AI 上下文 —— 同一屏内完成预览、摘要、要点提取和针对文档的问答。
 * 正文提取与 RAG 入库共用 document-parser,AI 调用统一走 ai-service,
 * 因此 PDF / Word / Excel / PPT / 旧版 Office / 文本表格都能被读到。
 */
export function AiDocumentPanel({ file, name, className, autoRun = true, onClose }: Props) {
  const t = useTranslations('docs.projectFiles')
  const [mode, setMode] = React.useState<AiAnalyzeMode>('summary')
  const [question, setQuestion] = React.useState('')
  const [answer, setAnswer] = React.useState<AiAnalyzeResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const requestSeq = React.useRef(0)
  const abortRef = React.useRef<AbortController | null>(null)

  const canAnalyze = canAnalyzeWithAi(name)

  const run = React.useCallback(
    async (nextMode: AiAnalyzeMode, nextQuestion = '') => {
      if (!canAnalyze) {
        setError(t('aiUnsupported'))
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(t('aiTooLarge'))
        return
      }
      if (nextMode === 'qa' && !nextQuestion.trim()) return
      const seq = ++requestSeq.current
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setAnswer(null)
      setError(null)
      setCopied(false)
      const streamed = { current: '' }
      const baseAnswer: AiAnalyzeResult = {
        answer: '',
        mode: nextMode,
        model: null,
        usage: null,
        extractedChars: 0,
        truncated: false,
      }
      try {
        const result = await requestAnalyze({
          file,
          name,
          mode: nextMode,
          question: nextQuestion,
          signal: controller.signal,
          onMeta: (meta) => {
            if (seq !== requestSeq.current) return
            setAnswer({
              ...baseAnswer,
              answer: streamed.current,
              extractedChars: meta.extractedChars,
              truncated: meta.truncated,
            })
          },
          onChunk: (chunk) => {
            if (seq !== requestSeq.current) return
            streamed.current += chunk
            setAnswer((prev) =>
              prev
                ? { ...prev, answer: streamed.current }
                : { ...baseAnswer, answer: streamed.current },
            )
          },
        })
        if (seq !== requestSeq.current) return
        setMode(nextMode)
        setAnswer(result)
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeq.current) return
        const message =
          err instanceof Error && err.message && !/^AI_/.test(err.message)
            ? err.message
            : t('aiError')
        setError(message)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [canAnalyze, file, name, t],
  )

  React.useEffect(() => {
    setAnswer(null)
    setError(null)
    setCopied(false)
    setQuestion('')
    setMode('summary')
    if (autoRun && canAnalyze) void run('summary')
    // 只在文件身份变化时重置;run 的依赖已覆盖文件内容。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, name, canAnalyze])

  React.useEffect(() => {
    return () => {
      requestSeq.current += 1
      abortRef.current?.abort()
    }
  }, [])

  const copy = async () => {
    if (!answer?.answer) return
    try {
      await navigator.clipboard.writeText(answer.answer)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时静默,不打断阅读 */
    }
  }

  if (!canAnalyze) {
    return (
      <div
        className={cn('rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground', className)}
      >
        {t('aiUnsupported')}
      </div>
    )
  }

  const tabs: Array<{ id: AiAnalyzeMode; label: string }> = [
    { id: 'summary', label: t('aiSummary') },
    { id: 'keypoints', label: t('aiKeypoints') },
    { id: 'qa', label: t('aiAsk') },
  ]

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-violet-200/70 bg-gradient-to-b from-violet-50/80 via-background to-background dark:border-violet-900/60 dark:from-violet-950/30',
        className,
      )}
      aria-label={t('aiTitle')}
    >
      <header className="flex items-start justify-between gap-2 border-b border-violet-200/60 px-3 py-2.5 dark:border-violet-900/50">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 rounded-lg bg-violet-600 p-1.5 text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-5">{t('aiTitle')}</h3>
            <p className="truncate text-[11px] text-muted-foreground">{name}</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('aiClose')}
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-3 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={loading}
            onClick={() => {
              setMode(tab.id)
              if (tab.id !== 'qa') void run(tab.id)
            }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              mode === tab.id
                ? 'border-violet-500 bg-violet-600 text-white'
                : 'border-border bg-background text-muted-foreground hover:border-violet-300 hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('aiReading')}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 rounded border border-destructive/30 px-2 py-1 text-[11px] hover:bg-destructive/10"
              onClick={() => void run(mode, question)}
            >
              {t('retry')}
            </button>
          </div>
        ) : null}

        {answer?.answer ? (
          <>
            <div className="rounded-xl border bg-background/80 p-3 shadow-sm">
              <MarkdownBody
                content={answer.answer}
                className="prose-sm max-w-none text-xs leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{t('aiSource', { chars: answer.extractedChars })}</span>
              {answer.truncated ? <span>{t('aiTruncated')}</span> : null}
              {answer.model ? <span className="truncate">{answer.model}</span> : null}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted"
                onClick={() => void copy()}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? t('aiCopied') : t('aiCopy')}
              </button>
            </div>
          </>
        ) : null}

        {!loading && !answer && !error ? (
          <div className="space-y-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <p>{t('aiHint')}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-violet-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-violet-700"
              onClick={() => void run('summary')}
            >
              <Sparkles className="h-3 w-3" />
              {t('aiStart')}
            </button>
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-border/60 p-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!question.trim() || loading) return
          void run('qa', question)
        }}
      >
        <div className="flex items-center gap-1.5 rounded-lg border bg-background p-1.5 focus-within:border-violet-400">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('aiQuestionPlaceholder')}
            className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
            maxLength={800}
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-600 text-white transition-opacity disabled:opacity-40"
            aria-label={t('aiSend')}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
      </form>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
