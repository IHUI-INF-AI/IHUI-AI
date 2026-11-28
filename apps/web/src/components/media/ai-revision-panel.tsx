// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 修订稿面板(2026-11-28 立,统一查看器里的「AI 修订」)。
 *
 * 产品语义不是“再生成一段文字”,而是把 AI 的修订变成**可签署的动作**:
 *  - 左原文 / 右修订稿双栏对齐,改动逐 hunk 高亮;
 *  - 每个 hunk 可单独接受或驳回,默认全接受(一键确认);
 *  - 导出时按原格式落地:docx 写回原文段落(保样式),文本保扩展名,
 *    其余格式明确降级为 Markdown,不谎称“Office 已被改写”。
 */

'use client'

import * as React from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  Copy,
  Download,
  Loader2,
  RotateCcw,
  Rows2,
  Save,
  Wand2,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { fetchApi, getBaseUrl, getToken } from '@/lib/api'
import { toast } from '@/components/common'
import {
  allHunkIds,
  buildRevisionDiff,
  exportRevision,
  extOfRevisionName,
  inlineDiffSegments,
  mergeRevision,
  revisionStats,
  type InlineSegments,
} from '@/lib/document-revision'
import type { DiffHunk, HunkDiff } from '@/lib/hunk-diff'

const MAX_FILE_BYTES = 20 * 1024 * 1024
/** 与服务端同步:整篇修订只接受 1.2 万字符以内;更长的文档先拆。 */
const MAX_REVISE_CHARS = 12_000
/** 单次渲染上限:文档通常 < 600 行,这里只防病态输入把主线程拖死。 */
const MAX_RENDER_ROWS = 3000
const REVISE_TIMEOUT_MS = 130_000

type SuspicionCode = 'possibly-truncated' | null

interface RevisionApiResult {
  instruction: string
  originalText: string
  revisedText: string
  extractedChars: number
  suspicious: SuspicionCode
  model: string | null
}

interface Props {
  file: Blob
  name: string
  className?: string
  onClose?: () => void
  /** 预填修订指令(对话侧发起时带过来的一句话要求);空则用默认指令。 */
  initialInstruction?: string
  /** 挂载后自动按 initialInstruction 生成一次(对话侧"点一下就出稿"场景)。 */
  autoRun?: boolean
  /** 所属项目 id:有值时提供「保存回文档中心」,按项目文件接口上传修订稿。 */
  projectId?: string
}

async function requestRevision(options: {
  file: Blob
  name: string
  instruction: string
  signal: AbortSignal
}): Promise<RevisionApiResult> {
  const form = new FormData()
  // 必须排在 file 之前:@fastify/multipart 在读到文件时就停止解析字段。
  form.append('instruction', options.instruction)
  form.append('file', options.file, options.name)

  const token = getToken()
  const res = await fetch(`${getBaseUrl()}/api/office/revise`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
    credentials: 'include',
    signal: options.signal,
  })

  const payload = (await res.json().catch(() => null)) as {
    code?: number
    data?: RevisionApiResult
    message?: string
    error?: string
  } | null
  if (!res.ok || !payload || payload.code !== 0 || !payload.data) {
    throw new Error(payload?.message || payload?.error || `REVISE_HTTP_${res.status}`)
  }
  return payload.data
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 把 hunk 条挂在它最后一行之后,避免把操作条插进未改动的段落中间。 */
function hunkBarAnchors(diff: HunkDiff): Map<number, DiffHunk> {
  const map = new Map<number, DiffHunk>()
  for (const hunk of diff.hunks) {
    if (hunk.rowEnd > hunk.rowStart) map.set(hunk.rowEnd - 1, hunk)
  }
  return map
}

export function AiRevisionPanel({
  file,
  name,
  className,
  onClose,
  initialInstruction,
  autoRun = false,
  projectId,
}: Props) {
  const t = useTranslations('docs.projectFiles')
  const ext = extOfRevisionName(name)
  const [instruction, setInstruction] = React.useState(
    () => initialInstruction?.trim() || t('reviseDefaultInstruction'),
  )
  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<RevisionApiResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [accepted, setAccepted] = React.useState<Set<number>>(new Set())
  // 窄屏(手机/分屏一半)双栏会横向溢出:默认落单栏,桌面仍双栏对照。
  const [viewMode, setViewMode] = React.useState<'split' | 'unified'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'unified' : 'split',
  )
  const [exporting, setExporting] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  // 对话附件没有项目归属:保存前先让用户选一个项目(项目文件查看器已带 projectId,直接存)。
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [projects, setProjects] = React.useState<Array<{ id: string; name: string }> | null>(null)
  const [pickerProjectId, setPickerProjectId] = React.useState('')
  const [loadingProjects, setLoadingProjects] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  // 多轮修订:baseText 非空 ⇒ 下一轮以"上一轮已接受的合并稿"为输入,而不是原文件;
  // rootOriginal 始终保留第一轮原文 —— docx 回写要靠它与原文件段落 1:1 对齐。
  const [baseText, setBaseText] = React.useState<string | null>(null)
  const [rootOriginal, setRootOriginal] = React.useState<string | null>(null)
  const [roundNo, setRoundNo] = React.useState(1)
  // 长文逐处审阅:当前定位到第几处改动(0 基),上一处/下一处负责滚动与高亮。
  const [activeHunkIndex, setActiveHunkIndex] = React.useState(0)

  const abortRef = React.useRef<AbortController | null>(null)
  const timerRef = React.useRef<number | null>(null)
  const bytesRef = React.useRef<Uint8Array | null>(null)
  const requestSeq = React.useRef(0)
  const autoRanRef = React.useRef(false)
  const panelRef = React.useRef<HTMLElement | null>(null)

  const diff = React.useMemo(
    () => (result ? buildRevisionDiff(result.originalText, result.revisedText) : null),
    [result],
  )
  const stats = React.useMemo(() => (diff ? revisionStats(diff) : null), [diff])
  const anchors = React.useMemo(() => (diff ? hunkBarAnchors(diff) : new Map()), [diff])

  React.useEffect(() => {
    setResult(null)
    setAccepted(new Set())
    setError(null)
    setInstruction(initialInstruction?.trim() || t('reviseDefaultInstruction'))
    bytesRef.current = null
    setBaseText(null)
    setRootOriginal(null)
    setRoundNo(1)
    // 文件名/字节变化才重置;t 只影响默认文案,不参与身份判定。
    autoRanRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, name, initialInstruction])

  React.useEffect(() => {
    return () => {
      requestSeq.current += 1
      abortRef.current?.abort()
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  // 每次出新的 diff 都从第一处开始;定位变化时把对应 hunk 滚到视野中间。
  React.useEffect(() => {
    setActiveHunkIndex(0)
  }, [diff])

  React.useEffect(() => {
    if (!diff || diff.hunks.length === 0) return
    const hunk = diff.hunks[Math.min(activeHunkIndex, diff.hunks.length - 1)]
    if (!hunk) return
    const target = panelRef.current?.querySelector<HTMLElement>(`[data-hunk-id="${hunk.id}"]`)
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeHunkIndex, diff])

  const stop = () => {
    abortRef.current?.abort()
  }

  const run = async (overrideInstruction?: string) => {
    const sourceName = baseText ? `${name.replace(/\.[^.]+$/, '')}.txt` : name
    const sourceBlob: Blob = baseText
      ? new File([baseText], sourceName, { type: 'text/plain' })
      : file
    if (sourceBlob.size > MAX_FILE_BYTES) {
      setError(t('reviseTooLarge'))
      return
    }
    const seq = ++requestSeq.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => controller.abort(), REVISE_TIMEOUT_MS)

    setRunning(true)
    setError(null)
    setResult(null)
    setAccepted(new Set())
    try {
      const data = await requestRevision({
        file: sourceBlob,
        name: sourceName,
        instruction: (overrideInstruction ?? instruction).trim(),
        signal: controller.signal,
      })
      if (seq !== requestSeq.current) return
      if (data.originalText.length > MAX_REVISE_CHARS) {
        setError(t('reviseTooLong', { chars: data.originalText.length }))
        return
      }
      const nextDiff = buildRevisionDiff(data.originalText, data.revisedText)
      // 第一轮才记根原文;后续轮次的 data.originalText 是上一轮合并稿,不能拿来对齐 docx。
      if (!baseText) setRootOriginal(data.originalText)
      setResult(data)
      setAccepted(allHunkIds(nextDiff))
    } catch (err) {
      if (seq !== requestSeq.current) return
      if (controller.signal.aborted) {
        if (controller === abortRef.current) setError(t('reviseAborted'))
        return
      }
      const message = err instanceof Error ? err.message : ''
      setError(message && !message.startsWith('REVISE_HTTP_') ? message : t('reviseError'))
    } finally {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (seq === requestSeq.current) setRunning(false)
    }
  }

  // 对话侧发起:挂载后按带过来的指令自动出一版(只跑一次;file/name 变化会在上面的
  // 重置 effect 里把 autoRanRef 复位,重开对话框才会再自动跑)。
  const runRef = React.useRef(run)
  runRef.current = run
  React.useEffect(() => {
    if (!autoRun || autoRanRef.current) return
    autoRanRef.current = true
    void runRef.current(initialInstruction)
  }, [autoRun, initialInstruction, file, name])

  const mergedText = React.useMemo(() => {
    if (!result || !diff) return ''
    return mergeRevision(result.originalText, diff, accepted)
  }, [result, diff, accepted])

  const toggleHunk = (id: number, next: boolean) => {
    setAccepted((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }

  /** 把本轮"已接受的合并稿"顶成下一轮输入:再改一版,导出仍以第一轮原文对齐 docx。 */
  const continueRevision = () => {
    if (!mergedText) return
    setBaseText(mergedText)
    setRoundNo((prev) => prev + 1)
    setResult(null)
    setAccepted(new Set())
    setError(null)
  }

  const copyMerged = async () => {
    if (!mergedText) return
    try {
      await navigator.clipboard.writeText(mergedText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  /**
   * 把当前"已接受的合并稿"按原格式落地(导出与保存共用同一份字节)。
   * docx 才需要读原文件字节:段级回写要靠它与原段落 1:1 对齐。
   */
  const buildExport = async () => {
    if (!result || !diff || accepted.size === 0) return null
    let originalBytes: Uint8Array | null = null
    if (ext === 'docx') {
      if (!bytesRef.current) {
        bytesRef.current = new Uint8Array(await file.arrayBuffer())
      }
      originalBytes = bytesRef.current
    }
    return exportRevision({
      name,
      originalText: rootOriginal ?? result.originalText,
      mergedText,
      originalBytes,
    })
  }

  const exportFile = async () => {
    if (!result || !diff || accepted.size === 0) return
    setExporting(true)
    try {
      const exported = await buildExport()
      if (!exported) return
      downloadBlob(exported.blob, exported.filename)
      toast.success(t('reviseExportDone', { name: exported.filename }))
      if (exported.mode === 'markdown' && exported.fallbackReason) {
        toast.warning(t('reviseExportFallback'))
      }
    } catch {
      toast.error(t('reviseExportFailed'))
    } finally {
      setExporting(false)
    }
  }

  /**
   * 保存回文档中心(2026-11-28):修订稿不再只能下载到本地 —— 上传成当前项目的新文件,
   * 文档中心「我的项目文件」立即可见。刻意不覆盖原文件:修订稿是**另一份**候选版本,
   * 原文件保持可对照;等版本链落地后再改成同一文件的版本关系。
   */
  const saveToDocs = async (targetProjectId?: string) => {
    const pid = targetProjectId ?? projectId
    if (!pid || !result || !diff || accepted.size === 0) return
    setSaving(true)
    try {
      const exported = await buildExport()
      if (!exported) return
      const form = new FormData()
      // 用显式 File 而不是 append(blob, filename):部分环境忽略第三参,服务端会收到 "blob"
      form.append(
        'file',
        new File([exported.blob], exported.filename, { type: exported.blob.type }),
      )
      const res = await fetchApi<{ file?: { id: string; name: string } }>(
        `/api/workspace/projects/${encodeURIComponent(pid)}/files`,
        { method: 'POST', body: form },
      )
      if (!res.success) throw new Error(res.error || 'SAVE_FAILED')
      toast.success(t('reviseSavedToDocs', { name: exported.filename }))
      setPickerOpen(false)
    } catch {
      toast.error(t('reviseSaveToDocsFailed'))
    } finally {
      setSaving(false)
    }
  }

  /**
   * 保存入口:项目文件查看器已带 projectId 直接上传;对话附件没有归属,先拉项目列表让用户选。
   * 只读当前用户的项目(接口按 userId 过滤),不缓存 —— 选错项目会把修订稿传进别人的项目。
   */
  const startSave = async () => {
    if (projectId) {
      await saveToDocs(projectId)
      return
    }
    setPickerOpen(true)
    if (projects !== null || loadingProjects) return
    setLoadingProjects(true)
    try {
      const res = await fetchApi<{ projects?: Array<{ id: string; name: string }> }>(
        '/api/workspace/projects',
      )
      const list = res.success ? (res.data?.projects ?? []) : []
      setProjects(list)
      setPickerProjectId((prev) => prev || (list[0]?.id ?? ''))
    } catch {
      setProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }

  const rows = React.useMemo(() => diff?.rows ?? [], [diff])
  const capped = rows.length > MAX_RENDER_ROWS
  const visibleRows = capped ? rows.slice(0, MAX_RENDER_ROWS) : rows
  const totalHunks = diff?.hunks.length ?? 0
  // 行内高亮:同一 hunk 里第 k 条删除行 ↔ 第 k 条新增行配对,切出真正改动的那一截。
  // 配不上对(批量增删)就不加重,保持整行底色;拼回原文对不上时 HighlightedLine 直接回落整行。
  const inlineSegments = React.useMemo(() => {
    const map = new Map<number, InlineSegments>()
    if (!diff) return map
    for (const hunk of diff.hunks) {
      const dels: number[] = []
      const adds: number[] = []
      for (let index = hunk.rowStart; index < hunk.rowEnd; index += 1) {
        const row = rows[index]
        if (row?.op === 'delete') dels.push(index)
        else if (row?.op === 'insert') adds.push(index)
      }
      const pairs = Math.min(dels.length, adds.length)
      for (let k = 0; k < pairs; k += 1) {
        const oldIndex = dels[k]!
        const newIndex = adds[k]!
        const oldText = rows[oldIndex]?.oldLine?.text ?? ''
        const newText = rows[newIndex]?.newLine?.text ?? ''
        if (oldText === newText) continue
        const segments = inlineDiffSegments(oldText, newText)
        if (!segments.oldChanged && !segments.newChanged) continue
        map.set(oldIndex, segments)
        map.set(newIndex, segments)
      }
    }
    return map
  }, [diff, rows])

  return (
    <section
      ref={panelRef}
      data-testid="revision-panel"
      aria-label={t('reviseTitle')}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-violet-200/70 bg-gradient-to-b from-violet-50/70 via-background to-background dark:border-violet-900/60 dark:from-violet-950/25',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-violet-200/60 px-3 py-2.5 dark:border-violet-900/50">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 rounded-lg bg-violet-600 p-1.5 text-white shadow-sm">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-5">{t('reviseTitle')}</h3>
            <p className="truncate text-[11px] text-muted-foreground">{name}</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('reviseClose')}
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </header>

      <div className="space-y-2 border-b border-border/60 px-3 py-2.5">
        {baseText ? (
          <p
            data-testid="revision-base-hint"
            className="rounded-md bg-violet-100/70 px-2 py-1 text-[11px] text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          >
            {t('reviseContinueBase', { round: roundNo - 1 })}
          </p>
        ) : null}
        <label
          htmlFor="ai-revision-instruction"
          className="block text-[11px] font-medium text-muted-foreground"
        >
          {t('reviseInstructionLabel')}
        </label>
        <textarea
          id="ai-revision-instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={2}
          maxLength={800}
          placeholder={t('reviseInstructionPlaceholder')}
          className="w-full resize-y rounded-lg border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-violet-400"
        />

        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'compliance', text: t('revisePresetCompliance') },
            { key: 'concise', text: t('revisePresetConcise') },
            { key: 'evidence', text: t('revisePresetEvidence') },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={running}
              onClick={() => setInstruction(preset.text)}
              className="rounded-full border border-violet-200/70 bg-violet-50/60 px-2 py-0.5 text-[11px] text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-100 disabled:opacity-40 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
            >
              {preset.text.length > 18 ? `${preset.text.slice(0, 18)}…` : preset.text}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : result ? (
              <RotateCcw className="h-3 w-3" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {running ? t('reviseRunning') : result ? t('reviseRegenerate') : t('reviseRun')}
          </button>
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              {t('reviseStop')}
            </button>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{t('reviseLimit')}</span>
        </div>
      </div>

      {error ? (
        <div className="m-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 rounded border border-destructive/30 px-2 py-1 text-[11px] hover:bg-destructive/10"
            onClick={() => void run()}
          >
            {t('retry')}
          </button>
        </div>
      ) : null}

      {running ? (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('reviseReading')}
        </div>
      ) : null}

      {!running && !result && !error ? (
        <div className="m-3 space-y-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <p>{t('reviseHint')}</p>
          <p className="text-[11px]">{t('reviseSteps')}</p>
        </div>
      ) : null}

      {result && diff && stats ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2 text-[11px]">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              +{stats.added}
            </span>
            <span className="font-medium text-rose-600 dark:text-rose-400">−{stats.removed}</span>
            <span className="text-muted-foreground">
              {t('reviseHunkCount', { count: stats.hunks })}
            </span>
            <span className="text-muted-foreground">
              {t('reviseAcceptedCount', { accepted: accepted.size, total: stats.hunks })}
            </span>
            {result.model ? (
              <span className="truncate text-muted-foreground">{result.model}</span>
            ) : null}
            {result.suspicious ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {t('reviseSuspicious')}
              </span>
            ) : null}
            {totalHunks > 0 ? (
              <span className="ml-auto flex items-center gap-0.5 text-muted-foreground">
                <button
                  type="button"
                  aria-label={t('revisePrevHunk')}
                  disabled={activeHunkIndex <= 0}
                  onClick={() => setActiveHunkIndex((prev) => Math.max(0, prev - 1))}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <span data-testid="revision-hunk-position" className="tabular-nums">
                  {t('reviseHunkPosition', {
                    current: Math.min(activeHunkIndex, totalHunks - 1) + 1,
                    total: totalHunks,
                  })}
                </span>
                <button
                  type="button"
                  aria-label={t('reviseNextHunk')}
                  disabled={activeHunkIndex >= totalHunks - 1}
                  onClick={() => setActiveHunkIndex((prev) => Math.min(totalHunks - 1, prev + 1))}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            <div className="flex items-center gap-1 rounded-full border p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                aria-pressed={viewMode === 'split'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                  viewMode === 'split' ? 'bg-violet-600 text-white' : 'text-muted-foreground',
                )}
              >
                <Columns2 className="h-3 w-3" />
                {t('reviseViewSplit')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                aria-pressed={viewMode === 'unified'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                  viewMode === 'unified' ? 'bg-violet-600 text-white' : 'text-muted-foreground',
                )}
              >
                <Rows2 className="h-3 w-3" />
                {t('reviseViewUnified')}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {viewMode === 'split' ? (
              <div className="min-w-[42rem]">
                <div className="sticky top-0 z-10 grid grid-cols-2 gap-px border-b bg-background/95 text-[11px] font-medium text-muted-foreground backdrop-blur">
                  <div className="px-3 py-1.5">{t('reviseOriginal')}</div>
                  <div className="px-3 py-1.5">{t('reviseRevised')}</div>
                </div>
                {visibleRows.map((row, index) => {
                  const hunk = anchors.get(index)
                  return (
                    <React.Fragment key={`${row.op}-${index}`}>
                      <div
                        className={cn(
                          'grid grid-cols-2 gap-px border-b border-border/40 text-xs leading-relaxed',
                          row.op === 'delete' && 'bg-rose-50/80 dark:bg-rose-950/20',
                          row.op === 'insert' && 'bg-emerald-50/80 dark:bg-emerald-950/20',
                        )}
                      >
                        <div className="flex gap-2 px-3 py-1">
                          <span className="w-8 shrink-0 select-none text-right text-[10px] tabular-nums text-muted-foreground/70">
                            {row.oldNum ?? ''}
                          </span>
                          {row.op === 'delete' ? (
                            <span className="whitespace-pre-wrap break-words text-rose-700 dark:text-rose-300">
                              <HighlightedLine
                                text={row.oldLine?.text ?? ''}
                                segments={inlineSegments.get(index)}
                                side="old"
                                tone="rose"
                              />
                            </span>
                          ) : row.op === 'equal' ? (
                            <span className="whitespace-pre-wrap break-words text-muted-foreground">
                              {row.oldLine?.text ?? ''}
                            </span>
                          ) : (
                            <span className="text-transparent">·</span>
                          )}
                        </div>
                        <div className="flex gap-2 px-3 py-1">
                          <span className="w-8 shrink-0 select-none text-right text-[10px] tabular-nums text-muted-foreground/70">
                            {row.newNum ?? ''}
                          </span>
                          {row.op === 'insert' ? (
                            <span className="whitespace-pre-wrap break-words text-emerald-700 dark:text-emerald-300">
                              <HighlightedLine
                                text={row.newLine?.text ?? ''}
                                segments={inlineSegments.get(index)}
                                side="new"
                                tone="emerald"
                              />
                            </span>
                          ) : row.op === 'equal' ? (
                            <span className="whitespace-pre-wrap break-words text-muted-foreground">
                              {row.newLine?.text ?? ''}
                            </span>
                          ) : (
                            <span className="text-transparent">·</span>
                          )}
                        </div>
                      </div>
                      {hunk ? (
                        <HunkBar
                          hunk={hunk}
                          accepted={accepted.has(hunk.id)}
                          onAccept={() => toggleHunk(hunk.id, true)}
                          onReject={() => toggleHunk(hunk.id, false)}
                          label={t('reviseHunkAt', {
                            start: hunk.oldStartLine,
                            end: Math.max(hunk.oldStartLine, hunk.oldEndLine),
                          })}
                          acceptLabel={t('reviseAccept')}
                          rejectLabel={t('reviseReject')}
                          active={hunk.id === diff.hunks[activeHunkIndex]?.id}
                        />
                      ) : null}
                    </React.Fragment>
                  )
                })}
              </div>
            ) : (
              <div className="min-w-0">
                {visibleRows.map((row, index) => {
                  const hunk = anchors.get(index)
                  return (
                    <React.Fragment key={`${row.op}-u-${index}`}>
                      <div
                        className={cn(
                          'flex gap-2 border-b border-border/40 px-3 py-1 text-xs leading-relaxed',
                          row.op === 'delete' && 'bg-rose-50/80 dark:bg-rose-950/20',
                          row.op === 'insert' && 'bg-emerald-50/80 dark:bg-emerald-950/20',
                        )}
                      >
                        <span className="w-4 shrink-0 select-none text-center font-mono text-[10px] text-muted-foreground/70">
                          {row.op === 'insert' ? '+' : row.op === 'delete' ? '−' : ' '}
                        </span>
                        <span
                          className={cn(
                            'whitespace-pre-wrap break-words',
                            row.op === 'delete' && 'text-rose-700 dark:text-rose-300',
                            row.op === 'insert' && 'text-emerald-700 dark:text-emerald-300',
                            row.op === 'equal' && 'text-muted-foreground',
                          )}
                        >
                          <HighlightedLine
                            text={
                              (row.op === 'insert' ? row.newLine?.text : row.oldLine?.text) ?? ''
                            }
                            segments={inlineSegments.get(index)}
                            side={row.op === 'insert' ? 'new' : 'old'}
                            tone={row.op === 'insert' ? 'emerald' : 'rose'}
                          />
                        </span>
                      </div>
                      {hunk ? (
                        <HunkBar
                          hunk={hunk}
                          accepted={accepted.has(hunk.id)}
                          onAccept={() => toggleHunk(hunk.id, true)}
                          onReject={() => toggleHunk(hunk.id, false)}
                          label={t('reviseHunkAt', {
                            start: hunk.oldStartLine,
                            end: Math.max(hunk.oldStartLine, hunk.oldEndLine),
                          })}
                          acceptLabel={t('reviseAccept')}
                          rejectLabel={t('reviseReject')}
                          active={hunk.id === diff.hunks[activeHunkIndex]?.id}
                          compact
                        />
                      ) : null}
                    </React.Fragment>
                  )
                })}
              </div>
            )}
            {capped ? (
              <p className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                {t('reviseRenderCapped', { rows: MAX_RENDER_ROWS })}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setAccepted(allHunkIds(diff))}
              disabled={accepted.size === totalHunks}
              className="rounded-md border px-2.5 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
            >
              {t('reviseAcceptAll')}
            </button>
            <button
              type="button"
              onClick={() => setAccepted(new Set())}
              disabled={accepted.size === 0}
              className="rounded-md border px-2.5 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
            >
              {t('reviseRejectAll')}
            </button>
            <button
              type="button"
              onClick={() => void copyMerged()}
              disabled={accepted.size === 0}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('reviseCopied') : t('reviseCopy')}
            </button>
            {result && mergedText ? (
              <button
                type="button"
                onClick={continueRevision}
                className="rounded-md border border-violet-300/70 px-2.5 py-1 text-[11px] text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
              >
                {t('reviseContinue')}
              </button>
            ) : null}
            {totalHunks > 0 ? (
              <button
                type="button"
                onClick={() => void startSave()}
                disabled={accepted.size === 0 || saving || exporting}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-violet-300/70 px-3 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {saving ? t('reviseSavingToDocs') : t('reviseSaveToDocs')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void exportFile()}
              disabled={accepted.size === 0 || exporting || saving}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50',
                totalHunks === 0 && 'ml-auto',
              )}
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {exporting ? t('reviseExporting') : t('reviseExport')}
            </button>
          </footer>
          {pickerOpen ? (
            <div
              data-testid="revision-project-picker"
              className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2 text-[11px]"
            >
              <span className="text-muted-foreground">{t('revisePickProject')}</span>
              {loadingProjects ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('reviseLoadingProjects')}
                </span>
              ) : projects && projects.length > 0 ? (
                <>
                  <select
                    aria-label={t('revisePickProject')}
                    value={pickerProjectId}
                    onChange={(event) => setPickerProjectId(event.target.value)}
                    className="min-w-0 max-w-[16rem] rounded-md border bg-background px-2 py-1 text-[11px]"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void saveToDocs(pickerProjectId)}
                    disabled={!pickerProjectId || saving}
                    className="rounded-md bg-violet-600 px-2.5 py-1 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {t('reviseSaveConfirm')}
                  </button>
                </>
              ) : (
                <span className="text-muted-foreground">{t('reviseNoProjects')}</span>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="ml-auto rounded-md border px-2.5 py-1 text-muted-foreground hover:bg-muted"
              >
                {t('reviseClose')}
              </button>
            </div>
          ) : null}
          {totalHunks === 0 ? (
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">{t('reviseNoChanges')}</p>
          ) : accepted.size === 0 ? (
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">
              {t('reviseNothingAccepted')}
            </p>
          ) : (
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">
              {ext === 'docx' ? t('reviseExportDocxNote') : t('reviseExportNote')}
            </p>
          )}
        </>
      ) : null}
    </section>
  )
}

interface HighlightedLineProps {
  text: string
  segments?: InlineSegments
  side: 'old' | 'new'
  tone: 'rose' | 'emerald'
}

/**
 * 行内高亮渲染(2026-11-28 二轮):只在真正改动的那一截加一层深底色,
 * 公共前缀/后缀保持原样。拼回去与整行不逐字一致时(配对错位/含制表符折叠)
 * 直接回落整行文本 —— 高亮可以少,绝不能标错位置。
 */
function HighlightedLine({ text, segments, side, tone }: HighlightedLineProps) {
  if (!segments || !text) return <>{text}</>
  const changed = side === 'old' ? segments.oldChanged : segments.newChanged
  if (!changed) return <>{text}</>
  const rebuilt = `${segments.prefix}${changed}${segments.suffix}`
  if (rebuilt !== text) return <>{text}</>
  return (
    <>
      {segments.prefix}
      <span
        data-inline-change={side}
        className={cn(
          'rounded-sm px-0.5',
          tone === 'rose'
            ? 'bg-rose-200/90 text-rose-900 dark:bg-rose-500/35 dark:text-rose-50'
            : 'bg-emerald-200/90 text-emerald-900 dark:bg-emerald-500/35 dark:text-emerald-50',
        )}
      >
        {changed}
      </span>
      {segments.suffix}
    </>
  )
}

interface HunkBarProps {
  hunk: DiffHunk
  accepted: boolean
  onAccept: () => void
  onReject: () => void
  label: string
  acceptLabel: string
  rejectLabel: string
  compact?: boolean
  /** 当前"上一处/下一处"定位到的那一处:加一圈描边,方便在长文里一眼找到。 */
  active?: boolean
}

function HunkBar({
  hunk,
  accepted,
  onAccept,
  onReject,
  label,
  acceptLabel,
  rejectLabel,
  compact = false,
  active = false,
}: HunkBarProps) {
  return (
    <div
      data-hunk-id={hunk.id}
      data-accepted={accepted ? 'true' : 'false'}
      data-active={active ? 'true' : 'false'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-y border-violet-200/70 bg-violet-50/70 px-3 py-1.5 text-[11px] dark:border-violet-900/50 dark:bg-violet-950/25',
        compact && 'pl-9',
        active && 'ring-2 ring-inset ring-violet-500/70',
      )}
    >
      <span className="text-violet-700 dark:text-violet-300">
        {label} · <span className="text-emerald-700 dark:text-emerald-400">+{hunk.added}</span>{' '}
        <span className="text-rose-600 dark:text-rose-400">−{hunk.removed}</span>
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-pressed={accepted}
          onClick={onAccept}
          className={cn(
            'rounded border px-2 py-0.5 transition-colors',
            accepted
              ? 'border-emerald-500 bg-emerald-600 text-white'
              : 'border-border bg-background text-muted-foreground hover:border-emerald-400',
          )}
        >
          {acceptLabel}
        </button>
        <button
          type="button"
          aria-pressed={!accepted}
          onClick={onReject}
          className={cn(
            'rounded border px-2 py-0.5 transition-colors',
            !accepted
              ? 'border-rose-500 bg-rose-600 text-white'
              : 'border-border bg-background text-muted-foreground hover:border-rose-400',
          )}
        >
          {rejectLabel}
        </button>
      </span>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
