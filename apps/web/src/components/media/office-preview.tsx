// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PreviewAnnotationPin } from '@/lib/document-annotations'
import { AnnotationAnchorCapture } from '@/components/chat/annotation-anchor'
import {
  PreviewSourceText,
  PreviewViewSwitch,
  PREVIEW_SOURCE_MAX_CHARS,
  truncationDisclosed,
  type PreviewSourceAvailability,
  type PreviewSourceText as SourceTextValue,
  type PreviewViewMode,
} from './preview-view-switch'
import { PptxPreview } from './pptx-visual'
import type { WorkBook } from 'xlsx'
import type * as XlsxTypes from 'xlsx'

/**
 * OfficePreview — Office 消息内富预览(D41,2026-09-24 立)。
 *
 * 分发层在 markdown-stream 的 MarkdownLink(isOfficeLink 分支):非流式时把
 * docx/xlsx/xls/pptx 链接升级为本组件(与 PdfEmbed/CsvPreview 同思路)。
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
 *  - xlsx/xls → SheetJS 读工作簿,sheet 切换 tab + 前 N 行(默认 200)表格 + 选区行列号(只读)
 *  - pptx → `pptx-visual` 解析 OOXML:按 slide 顺序还原文本框/图片/表格/背景,
 *           并保留"文字大纲"作为兜底与辅助视图。任务不再只做文本大纲。
 */

/** 超过该体积不自动加载,等用户点"加载预览"(默认 10MB)。 */
export const OFFICE_LAZY_THRESHOLD = 10 * 1024 * 1024
/** 超过该体积直接判"过大",不再给出内联预览(默认 50MB)。 */
export const OFFICE_HARD_MAX = 50 * 1024 * 1024
/** xlsx 表格默认最多渲染行数(防巨表)。 */
export const XLSX_PREVIEW_MAX_ROWS = 200

/** 支持富预览的扩展名(小写、不带点)。
 *  D76(2026-09-24 立)导出供 artifact-turn-badge 分型判据 import 复用——
 *  docx/xlsx/xls/pptx 四型的 kind 判据唯一真相源在此,禁止第二套。 */
export const SUPPORTED_EXTS = new Set(['docx', 'xlsx', 'xls', 'pptx'])

export type OfficePreviewStatus =
  'probing' | 'lazy' | 'loading' | 'ready' | 'too-large' | 'expired' | 'unsupported'

/**
 * 状态机 ↔ 源码视图的显式关系(D41 唯一还没钉成判据的一格)。
 *
 * 只有 ready(手里真的已有字节)才可切源码;too-large / expired / unsupported 三态**内容从未
 * 取回**,源码档只能是"禁用 + 说明",既不能隐藏(可发现面被抹掉),也不能"切过去是空白"。
 * probing / lazy / loading 是"还没拿到",同一 reason 通道,不给第二种说法。
 */
export function officeSourceAvailability(status: OfficePreviewStatus): PreviewSourceAvailability {
  switch (status) {
    case 'ready':
      return { available: true }
    case 'too-large':
      return { available: false, reason: 'previewSourceUnavailableTooLarge' }
    case 'expired':
      return { available: false, reason: 'previewSourceUnavailableExpired' }
    case 'unsupported':
      return { available: false, reason: 'previewSourceUnavailableUnsupported' }
    case 'probing':
    case 'lazy':
    case 'loading':
      return { available: false, reason: 'previewSourceUnavailableLoad' }
  }
}

/** OOXML 里可当文本读的部件(其余是图片/字体等二进制,倒进源码视图只会是乱码)。 */
const OOXML_TEXT_PART_RE = /\.(xml|rels|txt)$/i

/**
 * 从**已在手里的** ArrayBuffer 派生 OOXML 部件原文(docx/xlsx/pptx 同为 zip 容器)。
 *
 * 这里一次 fetch 都没有 —— jszip 只在内存字节上解包,`import('jszip')` 走 pptx-visual
 * 的 loadZip 已建立的同一份模块缓存。切视图因此结构上不可能触发新取数,而不是"记得没写 fetch"。
 */
export async function extractOfficeSourceText(
  data: ArrayBuffer,
  maxChars: number = PREVIEW_SOURCE_MAX_CHARS,
): Promise<SourceTextValue> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(data)
  const parts: string[] = []
  zip.forEach((relPath, file) => {
    if (!file.dir && OOXML_TEXT_PART_RE.test(relPath)) parts.push(relPath)
  })
  parts.sort()

  const chunks: string[] = []
  let used = 0
  let truncated = false
  // G-647(2026-09-29 立):披露判据是 shown<total,total 必须是真全文长 —— 触发截断后
  // 余下部件也要把长度数完(只计长、不再蓄正文),拿 maxChars 充 total 是谎报。
  let totalChars = 0
  let seen = 0
  for (const part of parts) {
    const entry = zip.file(part)
    if (!entry) continue
    const body = await entry.async('string')
    const header = `--- ${part} ---\n`
    totalChars += header.length + body.length
    seen += 1
    if (truncated) continue
    if (used + header.length + body.length > maxChars) {
      chunks.push(header + body.slice(0, Math.max(0, maxChars - used - header.length)))
      truncated = true
      continue
    }
    chunks.push(header + body)
    used += header.length + body.length
  }
  // join('\n') 的分隔符一并计入全文总长;未截断时 shown === total,判据自然不念。
  return { text: chunks.join('\n'), truncated, totalChars: totalChars + Math.max(0, seen - 1) }
}

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

interface XlsxMergeSpan {
  readonly rowSpan: number
  readonly colSpan: number
}

/** ARGB / RGB 都归一成 CSS 可用色值;无法识别时交给上层忽略。 */
function xlsxColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  const hex = value.replace(/^#/, '').trim()
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(-6)}`
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`
  return undefined
}

/** 单元格样式只在 SheetJS 真解析出 `s` 时生效;没有样式就完全沿用表格默认样式。 */
export function xlsxCellCss(
  cell: XlsxTypes.CellObject | undefined,
): React.CSSProperties | undefined {
  const style = cell?.s as
    | {
        fill?: { fgColor?: { rgb?: string } }
        font?: { bold?: boolean; color?: { rgb?: string }; sz?: number }
        alignment?: { horizontal?: string }
      }
    | undefined
  if (!style) return undefined
  const background = xlsxColor(style.fill?.fgColor?.rgb)
  const color = xlsxColor(style.font?.color?.rgb)
  const align = style.alignment?.horizontal
  return {
    backgroundColor: background,
    color,
    fontWeight: style.font?.bold ? 700 : undefined,
    fontSize: style.font?.sz ? `${style.font.sz}px` : undefined,
    textAlign: align === 'center' || align === 'right' ? align : undefined,
  }
}

/** Excel 列宽优先用 px/wch,老式 width 单位按 7px 近似;只为可视对齐,不承诺像素级。 */
function xlsxColumnWidths(sheet: XlsxTypes.WorkSheet | undefined): (string | undefined)[] {
  const cols = sheet?.['!cols'] as
    readonly { wpx?: number; wch?: number; width?: number }[] | undefined
  if (!cols) return []
  return cols.map((col) => {
    if (typeof col?.wpx === 'number' && col.wpx > 0) return `${Math.round(col.wpx)}px`
    if (typeof col?.wch === 'number' && col.wch > 0) return `${Math.round(col.wch)}ch`
    if (typeof col?.width === 'number' && col.width > 0) return `${Math.round(col.width * 7)}px`
    return undefined
  })
}

/** 合并单元格索引:起点带 span,被覆盖格不再重复渲染。行号一律 1 基。 */
function xlsxMergeMaps(merges: readonly XlsxTypes.Range[] | undefined): {
  readonly starts: ReadonlyMap<string, XlsxMergeSpan>
  readonly covered: ReadonlySet<string>
} {
  const starts = new Map<string, XlsxMergeSpan>()
  const covered = new Set<string>()
  for (const merge of merges ?? []) {
    const rowSpan = merge.e.r - merge.s.r + 1
    const colSpan = merge.e.c - merge.s.c + 1
    if (rowSpan <= 0 || colSpan <= 0) continue
    starts.set(`${merge.s.r + 1}:${merge.s.c}`, { rowSpan, colSpan })
    for (let r = merge.s.r; r <= merge.e.r; r += 1) {
      for (let c = merge.s.c; c <= merge.e.c; c += 1) {
        if (r === merge.s.r && c === merge.s.c) continue
        covered.add(`${r + 1}:${c}`)
      }
    }
  }
  return { starts, covered }
}

// eslint 的 consistent-type-imports 禁止 `typeof import('xlsx')` 这种 import() 类型标注;
// 类型面用 `import type * as` 拿同一份声明,值面仍走下面 loadXlsx 的动态 import(不进主包)。
type XlsxModule = typeof XlsxTypes
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

  // D91 选区采集:mouseup 时取 window 选区,锚定所在段落(1 起)与文本摘要。
  // 监听器挂在容器上(addEventListener)而不是 JSX 的 onMouseUp:这一处不是"可点交互",
  // 而是选区读取,写在 JSX 上会被 jsx-a11y 判成非交互元素带鼠标事件(要么静态元素要么
  // 非交互元素,两条规则互相把这条路堵死),而给它加 role 是替 D91 的功能改语义。
  React.useEffect(() => {
    const container = ref.current
    if (!container) return
    const handleDocxMouseUp = (): void => {
      const sel = document.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (!sel || sel.isCollapsed || !text) {
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
    container.addEventListener('mouseup', handleDocxMouseUp)
    return () => {
      container.removeEventListener('mouseup', handleDocxMouseUp)
    }
  }, [])

  if (failed) {
    return <p className="p-3 text-label text-muted-foreground">{t('officeFailed')}</p>
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
        data-testid="docx-body"
        className="max-h-[420px] overflow-auto bg-white p-3 text-body"
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
        const book = mod.read(data, { type: 'array', cellStyles: true })
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
  // 解构提到 effect 外:本 effect 自己会 setState 产出新 `state` 对象,
  // 依赖数组若直接写 `state` 即自触发死循环(setState→新对象→effect 重跑→再 setState)。
  // book 是解析结果引用、active 是字符串,二者仅在真正换文档/换 tab 时变化,
  // 与原先的 `state.book`/`state.active` 成员依赖逐次等值,重跑时机不变。
  const { book, active } = state
  React.useEffect(() => {
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
  }, [book, active, maxRows])

  if (failed) {
    return <p className="p-3 text-label text-muted-foreground">{t('officeFailed')}</p>
  }
  if (!state.book) {
    return (
      <p className="flex items-center gap-1.5 p-3 text-label text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('officeLoading')}
      </p>
    )
  }

  const header = state.rows[0] ?? []
  const bodyRows = state.rows.slice(1)
  const sheet = state.book.Sheets[state.active]
  const mergeMaps = xlsxMergeMaps(sheet?.['!merges'])
  const columnWidths = xlsxColumnWidths(sheet)
  const selectedRef = state.selected
    ? `${xlsxColumnRef(state.selected.col)}${state.selected.row + 1}`
    : null
  const selectedCell = selectedRef ? sheet?.[selectedRef] : undefined
  const formulaText = selectedCell?.f ? `=${selectedCell.f}` : null
  const valueText =
    selectedCell?.w ??
    (selectedCell?.v === undefined || selectedCell?.v === null ? '' : String(selectedCell.v))

  return (
    <div className="max-h-[420px] overflow-auto" data-testid="xlsx-grid">
      <div className="flex flex-wrap items-center gap-1 bg-muted/30 px-2 py-1">
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
              'rounded-md px-1.5 py-0.5 text-[10px] transition-colors',
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
            <span data-testid="xlsx-selection">
              {t('officeSelectedCell', { cell: selectedRef })}
            </span>
          )}
          {/* G-647:行截断披露只认 shown<total(与源码档共用 truncationDisclosed 这一份判据),
              不认布尔标志 —— shown === total 时,行数一个不少就不许喊"仅展示"。 */}
          {truncationDisclosed(state.rows.length, state.total) && (
            <span data-testid="xlsx-truncated">
              {t('officeRowsTruncated', { rows: state.rows.length })}
            </span>
          )}
        </span>
      </div>
      {selectedRef ? (
        <div
          className="flex items-center gap-2 border-b bg-background px-2 py-1 text-[10px]"
          data-testid="xlsx-formula"
        >
          <span className="w-14 shrink-0 rounded bg-muted px-1 py-0.5 text-center tabular-nums">
            {selectedRef}
          </span>
          <span className="min-w-0 truncate" data-testid="xlsx-formula-value">
            {formulaText ?? valueText}
          </span>
        </div>
      ) : null}
      <table className="w-full border-collapse text-label" data-testid="xlsx-table">
        <thead>
          <tr>
            {header.map((h, i) => {
              if (mergeMaps.covered.has(`1:${i}`)) return null
              const span = mergeMaps.starts.get(`1:${i}`)
              const cell = sheet?.[`${xlsxColumnRef(i)}1`]
              return (
                <th
                  key={`h-${i}`}
                  colSpan={span?.colSpan}
                  rowSpan={span?.rowSpan}
                  style={{ ...xlsxCellCss(cell), width: columnWidths[i] }}
                  className="border border-border bg-muted/50 px-2 py-1 text-left font-medium"
                >
                  {h}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((r, ri) => (
            <tr key={`r-${ri}`}>
              {r.map((c, ci) => {
                const rowNo = ri + 2
                if (mergeMaps.covered.has(`${rowNo}:${ci}`)) return null
                const span = mergeMaps.starts.get(`${rowNo}:${ci}`)
                const cell = sheet?.[`${xlsxColumnRef(ci)}${rowNo}`]
                return (
                  <td
                    key={`c-${ci}`}
                    data-testid="xlsx-cell"
                    colSpan={span?.colSpan}
                    rowSpan={span?.rowSpan}
                    style={{ ...xlsxCellCss(cell), width: columnWidths[ci] }}
                    onClick={() => {
                      setAnchorCell({
                        sheet: state.active,
                        range: `${xlsxColumnRef(ci)}${ri + 1}`,
                      })
                      setState((prev) => ({ ...prev, selected: { row: ri + 1, col: ci } }))
                    }}
                    className="cursor-pointer border border-border px-2 py-1 hover:bg-muted/50"
                  >
                    {c}
                  </td>
                )
              })}
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

// ------------------------------------------------------------- dispatcher ----

export interface OfficePreviewProps {
  readonly src: string
  /** 扩展名(小写、不带点),由分发层从 URL 推出。 */
  readonly ext: string
  readonly className?: string
  readonly lazyThreshold?: number
  readonly hardMax?: number
  readonly maxRows?: number
  /** 源码视图字符上限(默认 PREVIEW_SOURCE_MAX_CHARS);超出即截断并如实说明。 */
  readonly sourceMaxChars?: number
  /** 文档中心下发的 PPTX 元素级批注 pin(docx/xlsx 暂不参与页内标记)。 */
  readonly annotationPins?: readonly PreviewAnnotationPin[]
  readonly focusedAnnotationId?: string | null
  readonly onAnnotationSelect?: (id: string) => void
}

/** 源码文本的解析进度形态:idle = 还没开始(只有切到源码档才解析)。
 *  G-647:渲染态只携带 shown/total 两个真维度,布尔 truncated 不进渲染面。 */
type OfficeSourceState = Readonly<{
  status: 'idle' | 'extracting' | 'ready' | 'failed'
  text: string
  totalChars: number
}>

const IDLE_OFFICE_SOURCE: OfficeSourceState = { status: 'idle', text: '', totalChars: 0 }

export function OfficePreview({
  src,
  ext,
  className,
  lazyThreshold = OFFICE_LAZY_THRESHOLD,
  hardMax = OFFICE_HARD_MAX,
  maxRows = XLSX_PREVIEW_MAX_ROWS,
  sourceMaxChars = PREVIEW_SOURCE_MAX_CHARS,
  annotationPins,
  focusedAnnotationId = null,
  onAnnotationSelect,
}: OfficePreviewProps) {
  const t = useTranslations('chat')
  const kind = ext.toLowerCase().replace(/^\./, '')
  const [status, setStatus] = React.useState<OfficePreviewStatus>(() =>
    SUPPORTED_EXTS.has(kind) ? 'probing' : 'unsupported',
  )
  const [data, setData] = React.useState<ArrayBuffer | null>(null)
  const [view, setView] = React.useState<PreviewViewMode>('preview')
  const [source, setSource] = React.useState<OfficeSourceState>(IDLE_OFFICE_SOURCE)

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
      if (buf.byteLength > hardMax) {
        setStatus('too-large')
        return
      }
      setData(buf)
      setStatus('ready')
    } catch {
      setStatus('expired')
    }
  }, [src, hardMax])

  // 探针:HEAD 先行,拿到 content-length 再决定直接加载 / 懒加载 / 过大
  React.useEffect(() => {
    if (status !== 'probing') return
    // 预览器(文档中心 / 项目文件 / IDE)交来的是 blob: 地址,已持有字节:
    // blob URL 上的 HEAD 在部分浏览器不可用(会直接抛 TypeError),探测等于必然 expired。
    // 直接 GET;体积阈值改在 arrayBuffer 之后按实际 byteLength 判(见 load)。
    if (src.startsWith('blob:')) {
      void load()
      return
    }
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

  // 换产物(含 src 变更导致 data 复位)⇒ 视图与源码文本一起退回「渲染视图 + 未解析」,
  // 否则旧产物的源码会留在屏幕上,读起来像新产物的内容(内容身份错位)
  const extractedFor = React.useRef<ArrayBuffer | null>(null)
  React.useEffect(() => {
    setView('preview')
    setSource(IDLE_OFFICE_SOURCE)
    extractedFor.current = null
  }, [data])

  // 源码档的文本只在①已切到源码 ②状态 ready ③手里有字节 ④这份字节还没解析过 时派生一次。
  // 依赖刻意不含 source.status,也不带 cleanup 的 cancelled 旗:含它会让本 effect 在置 extracting
  // 后立刻重跑,而上一轮的 cleanup 把 cancelled 置真 ⇒ 在途解析的 then 被吞,视图永久停在「正在解析」。
  // 依赖里没有 fetch/load ⇒ "切视图不触发新取数"是结构保证,不是记得没写 fetch。
  React.useEffect(() => {
    if (view !== 'source' || status !== 'ready' || !data) return
    if (extractedFor.current === data) return
    extractedFor.current = data
    setSource((prev) => (prev.status === 'idle' ? { ...prev, status: 'extracting' } : prev))
    extractOfficeSourceText(data, sourceMaxChars)
      .then((r) => {
        setSource({ status: 'ready', text: r.text, totalChars: r.totalChars })
      })
      .catch(() => {
        // 落 failed(不是退回 idle):退回 idle 会让一次解析失败变成反复重试
        setSource({ status: 'failed', text: '', totalChars: 0 })
      })
  }, [view, status, data, sourceMaxChars])

  const sourceAvailability: PreviewSourceAvailability =
    kind === 'xls'
      ? { available: false, reason: 'previewSourceUnavailableUnsupported' }
      : officeSourceAvailability(status)

  return (
    <div
      className={cn('my-0 overflow-hidden rounded-md border border-border', className)}
      data-testid="office-preview"
      data-office-state={status}
      data-preview-view={view}
      data-artifact-preview-kind={kind}
    >
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {kind.toUpperCase()}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <PreviewViewSwitch mode={view} onModeChange={setView} source={sourceAvailability} />
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="office-download"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            <span>{t('officeDownload')}</span>
          </a>
        </span>
      </div>
      {view === 'source' && status === 'ready' ? (
        <PreviewSourceText
          status={source.status === 'idle' ? 'extracting' : source.status}
          text={source.text}
          totalChars={source.totalChars}
          maxChars={sourceMaxChars}
        />
      ) : (
        <>
          {status === 'unsupported' && (
            <p className="p-3 text-label text-muted-foreground" data-testid="office-unsupported">
              {t('officeUnsupported')}
            </p>
          )}
          {status === 'too-large' && (
            <p className="p-3 text-label text-muted-foreground" data-testid="office-too-large">
              {t('officeTooLarge')}
            </p>
          )}
          {status === 'expired' && (
            <p className="p-3 text-label text-muted-foreground" data-testid="office-expired">
              {t('officeExpired')}
            </p>
          )}
          {status === 'lazy' && (
            <div className="flex items-center justify-center p-6">
              <button
                type="button"
                data-testid="office-lazy-btn"
                onClick={() => void load()}
                className="rounded-md border border-border px-2.5 py-1 text-label text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span>{t('officeLazyLoad')}</span>
              </button>
            </div>
          )}
          {status === 'loading' && (
            <p className="flex items-center gap-1.5 p-3 text-label text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{t('officeLoading')}</span>
            </p>
          )}
          {status === 'ready' && data && kind === 'docx' && <DocxBody data={data} />}
          {status === 'ready' && data && (kind === 'xlsx' || kind === 'xls') && (
            <XlsxGrid data={data} maxRows={maxRows} />
          )}
          {status === 'ready' && data && kind === 'pptx' && (
            <PptxPreview
              data={data}
              annotationPins={annotationPins}
              focusedAnnotationId={focusedAnnotationId}
              onAnnotationSelect={onAnnotationSelect}
            />
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
