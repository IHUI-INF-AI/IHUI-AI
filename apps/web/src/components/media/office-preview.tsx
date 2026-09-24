// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnnotationAnchorCapture } from '@/components/chat/annotation-anchor'
import type { WorkBook } from 'xlsx'

/**
 * OfficePreview — Office 消息内富预览(D41,2026-09-24 立)。
 *
 * 分发层在 markdown-stream 的 MarkdownLink(isOfficeLink 分支):非流式时把
 * docx/xlsx/pptx 链接升级为本组件(与 PdfEmbed/CsvPreview 同思路)。
 *
 * 四态(硬验收):
 *  - 可用:正常渲染
 *  - 过大:HEAD 探到 content-length 超硬阈值(默认 50MB)→ "文件过大,下载查看"
 *  - 过期:产物 URL 拉取失败(HEAD/GET 非 2xx 或网络异常)→ "文件链接已失效"
 *  - 不支持:未知扩展名(分发层只会送入三种,但组件自身兜底)
 *
 * 大文件不内联:超懒加载阈值(默认 10MB)不自动出流量,点"加载预览"再拉取解析。
 *
 * 渲染实现(均为动态 import,不进主包):
 *  - docx → docx-preview.renderAsync(保真渲染)
 *  - xlsx → SheetJS 读工作簿,sheet 切换 tab + 前 N 行(默认 200)表格 + 选区行列号(只读)
 *  - pptx → jszip 解 XML 降级:逐 slide 提取 <a:t> 文本 + notesSlide 讲者备注,
 *           渲染为"文本+备注大纲"(任务已授权不做幻灯片视觉渲染)
 */

/** 超过该体积不自动加载,等用户点"加载预览"(默认 10MB)。 */
export const OFFICE_LAZY_THRESHOLD = 10 * 1024 * 1024
/** 超过该体积直接判"过大",不再给出内联预览(默认 50MB)。 */
export const OFFICE_HARD_MAX = 50 * 1024 * 1024
/** xlsx 表格默认最多渲染行数(防巨表)。 */
export const XLSX_PREVIEW_MAX_ROWS = 200

/** 支持富预览的扩展名(小写、不带点)。
 *  D76(2026-09-24 立)导出供 artifact-turn-badge 分型判据 import 复用——
 *  docx/xlsx/pptx 三型的 kind 判据唯一真相源在此,禁止第二套。 */
export const SUPPORTED_EXTS = new Set(['docx', 'xlsx', 'pptx'])

export type OfficePreviewStatus =
  | 'probing'
  | 'lazy'
  | 'loading'
  | 'ready'
  | 'too-large'
  | 'expired'
  | 'unsupported'

/** 0 基列号 → 表格列标(A/B/…/Z/AA/…)。 */
export function xlsxColumnRef(col: number): string {
  let s = ''
  let c = col
  while (c >= 0) {
    s = String.fromCharCode((c % 26) + 65) + s
    c = Math.floor(c / 26) - 1
  }
  return s
}

type XlsxModule = typeof import('xlsx')
let xlsxModPromise: Promise<XlsxModule> | null = null
function loadXlsx(): Promise<XlsxModule> {
  xlsxModPromise ??= import('xlsx')
  return xlsxModPromise
}

// ---------------------------------------------------------------- docx ----

function DocxBody({ data }: { data: ArrayBuffer }) {
  const t = useTranslations('chat')
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = React.useState(false)
  // D91(2026-09-24 立):渲染 DOM 文本选区 → 段落序号锚,经 AnnotationAnchorCapture
  // 走 D22 事件族派发(docx-preview 无页码概念,按任务规格锚段落序号/文本摘要)。
  const [selection, setSelection] = React.useState<{
    readonly paragraph: number
    readonly excerpt: string
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const container = ref.current
    if (!container) return
    import('docx-preview')
      .then(({ renderAsync }) => renderAsync(data, container, undefined, { inWrapper: false }))
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [data])

  if (failed) {
    return <p className="p-3 text-xs text-muted-foreground">{t('officeFailed')}</p>
  }
  // D91 选区采集:mouseup 时取 window 选区,锚定所在段落(1 起)与文本摘要
  const handleDocxMouseUp = (): void => {
    const container = ref.current
    const sel = document.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (!container || !sel || sel.isCollapsed || !text) {
      setSelection(null)
      return
    }
    const node = sel.anchorNode
    if (!node || !container.contains(node)) {
      setSelection(null)
      return
    }
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
    const p = el?.closest('p') ?? null
    const paragraphs = container.querySelectorAll('p')
    const index = p ? Array.prototype.indexOf.call(paragraphs, p) : -1
    if (index < 0) {
      setSelection(null)
      return
    }
    setSelection({ paragraph: index + 1, excerpt: text.slice(0, 200) })
  }

  return (
    <>
      {selection && (
        <AnnotationAnchorCapture
          anchor={{ kind: 'docx' }}
          docxParagraph={selection.paragraph}
          initialNote={selection.excerpt}
          source="docx-selection"
          onDispose={() => setSelection(null)}
          data-testid="docx-anchor-capture"
        />
      )}
      <div
        ref={ref}
        onMouseUp={handleDocxMouseUp}
        data-testid="docx-body"
        className="max-h-[420px] overflow-auto bg-white p-3 text-sm"
      />
    </>
  )
}

// ---------------------------------------------------------------- xlsx ----

interface XlsxGridState {
  readonly book: WorkBook | null
  readonly active: string
  readonly rows: readonly string[][]
  readonly total: number
  readonly selected: { readonly row: number; readonly col: number } | null
}

const INITIAL_XLSX_STATE: XlsxGridState = {
  book: null,
  active: '',
  rows: [],
  total: 0,
  selected: null,
}

function XlsxGrid({ data, maxRows }: { data: ArrayBuffer; maxRows: number }) {
  const t = useTranslations('chat')
  const [state, setState] = React.useState<XlsxGridState>(INITIAL_XLSX_STATE)
  const [failed, setFailed] = React.useState(false)
  // D91(2026-09-24 立):单元格选区 → {sheet, range} 批注锚(AnnotationAnchorCapture
  // 走 D22 事件族派发;左上角 officeSelectedCell 只读展示保持不变)
  const [anchorCell, setAnchorCell] = React.useState<{
    readonly sheet: string
    readonly range: string
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setFailed(false)
    setState(INITIAL_XLSX_STATE)
    loadXlsx()
      .then((mod) => {
        const book = mod.read(data, { type: 'array' })
        const active = book.SheetNames[0] ?? ''
        if (cancelled) return
        setState((prev) => ({ ...prev, book, active }))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [data])

  // 切 tab 时重算当前 sheet 的行(从已解析的 book 取,不重新拉文件)
  React.useEffect(() => {
    const { book, active } = state
    if (!book || !active) return
    let cancelled = false
    loadXlsx().then((mod) => {
      const ws = book.Sheets[active]
      if (!ws || cancelled) return
      const all = mod.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        blankrows: false,
        defval: '',
      }) as unknown as string[][]
      setState((prev) => ({
        ...prev,
        rows: all.slice(0, maxRows),
        total: all.length,
        selected: null,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [state.book, state.active, maxRows])

  if (failed) {
    return <p className="p-3 text-xs text-muted-foreground">{t('officeFailed')}</p>
  }
  if (!state.book) {
    return (
      <p className="flex items-center gap-1.5 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('officeLoading')}
      </p>
    )
  }

  const header = state.rows[0] ?? []
  const bodyRows = state.rows.slice(1)
  const truncated = state.total > state.rows.length
  const selectedRef = state.selected
    ? `${xlsxColumnRef(state.selected.col)}${state.selected.row + 1}`
    : null

  return (
    <div className="max-h-[420px] overflow-auto" data-testid="xlsx-grid">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
        {state.book.SheetNames.map((name) => (
          <button
            key={name}
            type="button"
            data-testid="xlsx-sheet-tab"
            data-active={name === state.active}
            onClick={() => {
              setAnchorCell(null)
              setState((prev) => ({ ...prev, active: name }))
            }}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] transition-colors',
              name === state.active
                ? 'bg-primary/10 font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {name}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          {selectedRef && (
            <span data-testid="xlsx-selection">{t('officeSelectedCell', { cell: selectedRef })}</span>
          )}
          {truncated && (
            <span data-testid="xlsx-truncated">
              {t('officeRowsTruncated', { rows: state.rows.length })}
            </span>
          )}
        </span>
      </div>
      <table className="w-full border-collapse text-xs" data-testid="xlsx-table">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th
                key={`h-${i}`}
                className="border border-border bg-muted/50 px-2 py-1 text-left font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((r, ri) => (
            <tr key={`r-${ri}`}>
              {r.map((c, ci) => (
                <td
                  key={`c-${ci}`}
                  data-testid="xlsx-cell"
                  onClick={() => {
                    setAnchorCell({ sheet: state.active, range: `${xlsxColumnRef(ci)}${ri + 1}` })
                    setState((prev) => ({ ...prev, selected: { row: ri + 1, col: ci } }))
                  }}
                  className="cursor-pointer border border-border px-2 py-1 hover:bg-muted/50"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {anchorCell && (
        <AnnotationAnchorCapture
          anchor={{ kind: 'xlsx', sheet: anchorCell.sheet, range: anchorCell.range }}
          source="xlsx-selection"
          onDispose={() => setAnchorCell(null)}
          data-testid="xlsx-anchor-capture"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- pptx ----

interface PptxSlide {
  readonly text: string
  readonly notes: string | null
}

/** 逐 slide 提取 <a:t> 文本与 notesSlide 备注(按编号对齐,OOXML 实际以关系映射,
 *  但主流生成器编号一致,降级大纲可接受)。 */
export async function parsePptx(buffer: ArrayBuffer): Promise<PptxSlide[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)

  const slidePaths: { n: number; path: string }[] = []
  const notePaths = new Map<number, string>()
  zip.forEach((relPath, file) => {
    if (file.dir) return
    const sm = /^ppt\/slides\/slide(\d+)\.xml$/.exec(relPath)
    if (sm) slidePaths.push({ n: Number(sm[1]), path: relPath })
    const nm = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/.exec(relPath)
    if (nm) notePaths.set(Number(nm[1]), relPath)
  })
  slidePaths.sort((a, b) => a.n - b.n)

  const slides: PptxSlide[] = []
  for (const s of slidePaths) {
    const file = zip.file(s.path)
    if (!file) continue
    const xml = await file.async('string')
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])
    let notes: string | null = null
    const notePath = notePaths.get(s.n)
    if (notePath) {
      const noteFile = zip.file(notePath)
      if (noteFile) {
        const nxml = await noteFile.async('string')
        const ntexts = [...nxml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])
        if (ntexts.length > 0) notes = ntexts.join(' ')
      }
    }
    slides.push({ text: texts.join(' '), notes })
  }
  return slides
}

function PptxOutline({ data }: { data: ArrayBuffer }) {
  const t = useTranslations('chat')
  const [slides, setSlides] = React.useState<PptxSlide[] | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setFailed(false)
    parsePptx(data)
      .then((s) => {
        if (!cancelled) setSlides(s)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [data])

  if (failed) {
    return <p className="p-3 text-xs text-muted-foreground">{t('officeFailed')}</p>
  }
  if (!slides) {
    return (
      <p className="flex items-center gap-1.5 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('officeLoading')}
      </p>
    )
  }
  return (
    <ol className="max-h-[420px] overflow-auto p-3 text-sm" data-testid="pptx-outline">
      {slides.map((s, i) => (
        <li key={i} data-testid="pptx-slide" className="mb-2">
          <p className="font-medium">{`#${i + 1} ${s.text || '—'}`}</p>
          {s.notes && (
            <p className="mt-0.5 text-xs text-muted-foreground" data-testid="pptx-notes">
              {t('pptxNotes')}: {s.notes}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

// ------------------------------------------------------------- dispatcher ----

export interface OfficePreviewProps {
  readonly src: string
  /** 扩展名(小写、不带点),由分发层从 URL 推出。 */
  readonly ext: string
  readonly className?: string
  readonly lazyThreshold?: number
  readonly hardMax?: number
  readonly maxRows?: number
}

export function OfficePreview({
  src,
  ext,
  className,
  lazyThreshold = OFFICE_LAZY_THRESHOLD,
  hardMax = OFFICE_HARD_MAX,
  maxRows = XLSX_PREVIEW_MAX_ROWS,
}: OfficePreviewProps) {
  const t = useTranslations('chat')
  const kind = ext.toLowerCase().replace(/^\./, '')
  const [status, setStatus] = React.useState<OfficePreviewStatus>(() =>
    SUPPORTED_EXTS.has(kind) ? 'probing' : 'unsupported',
  )
  const [data, setData] = React.useState<ArrayBuffer | null>(null)

  const load = React.useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch(src)
      if (!res.ok) {
        setStatus('expired')
        return
      }
      const len = res.headers.get('content-length')
      if (len && Number(len) > hardMax) {
        setStatus('too-large')
        return
      }
      const buf = await res.arrayBuffer()
      setData(buf)
      setStatus('ready')
    } catch {
      setStatus('expired')
    }
  }, [src, hardMax])

  // 探针:HEAD 先行,拿到 content-length 再决定直接加载 / 懒加载 / 过大
  React.useEffect(() => {
    if (status !== 'probing') return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(src, { method: 'HEAD' })
        if (!res.ok) {
          if (!cancelled) setStatus('expired')
          return
        }
        const len = res.headers.get('content-length')
        const size = len ? Number(len) : null
        if (size !== null && size > hardMax) {
          if (!cancelled) setStatus('too-large')
          return
        }
        if (size !== null && size > lazyThreshold) {
          if (!cancelled) setStatus('lazy')
          return
        }
        if (!cancelled) void load()
      } catch {
        if (!cancelled) setStatus('expired')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, src, hardMax, lazyThreshold, load])

  return (
    <div
      className={cn('my-0 overflow-hidden rounded-md border border-border', className)}
      data-testid="office-preview"
      data-office-state={status}
    >
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {kind.toUpperCase()}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="office-download"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          {t('officeDownload')}
        </a>
      </div>
      {status === 'unsupported' && (
        <p className="p-3 text-xs text-muted-foreground" data-testid="office-unsupported">
          {t('officeUnsupported')}
        </p>
      )}
      {status === 'too-large' && (
        <p className="p-3 text-xs text-muted-foreground" data-testid="office-too-large">
          {t('officeTooLarge')}
        </p>
      )}
      {status === 'expired' && (
        <p className="p-3 text-xs text-muted-foreground" data-testid="office-expired">
          {t('officeExpired')}
        </p>
      )}
      {status === 'lazy' && (
        <div className="flex items-center justify-center p-6">
          <button
            type="button"
            data-testid="office-lazy-btn"
            onClick={() => void load()}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t('officeLazyLoad')}
          </button>
        </div>
      )}
      {status === 'loading' && (
        <p className="flex items-center gap-1.5 p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('officeLoading')}
        </p>
      )}
      {status === 'ready' && data && kind === 'docx' && <DocxBody data={data} />}
      {status === 'ready' && data && kind === 'xlsx' && <XlsxGrid data={data} maxRows={maxRows} />}
      {status === 'ready' && data && kind === 'pptx' && <PptxOutline data={data} />}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
