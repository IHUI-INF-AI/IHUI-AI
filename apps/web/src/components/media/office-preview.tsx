// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  reviewDocumentBlocks,
  saveAiFindings,
  type AiReviewBlock,
  type AiReviewFinding,
  type PreviewAnnotationPin,
} from '@/lib/document-annotations'
import { toast } from '@/components/common'
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

/** AI 全文预审上限与服务端 `readReviewInput` 同一口径;超出部分必须明说而不是假装已通读。 */
export const OFFICE_REVIEW_MAX_BLOCKS = 20
export const OFFICE_REVIEW_MAX_CHARS = 30_000
const OFFICE_REVIEW_BLOCK_CHARS = 6_000
/** 一个 block 最多覆盖的段落数;否则 118 段会被并成 1 块,pin 只能落在第 1 段,失去定位价值。 */
const OFFICE_REVIEW_MAX_BLOCK_PARAGRAPHS = 8

/**
 * DOCX 段落 → 可定位 block。docx-preview 没有页码,段落序号就是它与正文、pin 的唯一共同坐标。
 * 相邻短段落合并成一个 block,避免 30 段小标题把 20 个 block 名额吃光;anchor 记录首尾段。
 */
export function buildDocxReviewBlocks(
  paragraphs: readonly string[],
): { blocks: AiReviewBlock[]; truncated: boolean } {
  const blocks: AiReviewBlock[] = []
  let start = 0
  let buffer: string[] = []
  let chars = 0
  let lastNonEmpty = -1
  let stoppedEarly = false
  const flush = (endExclusive: number): void => {
    const text = buffer.join('\n').trim()
    if (text.length >= 10) {
      blocks.push({
        anchor: {
          kind: 'docx',
          paragraph: start + 1,
          paragraphEnd: Math.max(start + 1, endExclusive),
        },
        text,
      })
    }
    buffer = []
    chars = 0
  }
  for (let i = 0; i < paragraphs.length; i += 1) {
    const text = paragraphs[i]?.trim() ?? ''
    if (!text) continue
    lastNonEmpty = i
    if (!buffer.length) start = i
    if (
      buffer.length &&
      (buffer.length >= OFFICE_REVIEW_MAX_BLOCK_PARAGRAPHS ||
        chars + text.length > OFFICE_REVIEW_BLOCK_CHARS)
    ) {
      flush(i)
      start = i
    }
    buffer.push(text)
    chars += text.length + 1
    if (blocks.length >= OFFICE_REVIEW_MAX_BLOCKS) {
      stoppedEarly = i + 1 < paragraphs.length
      break
    }
  }
  if (buffer.length) flush(lastNonEmpty + 1)
  const coveredEnd = Number(blocks[blocks.length - 1]?.anchor.paragraphEnd ?? 0)
  let truncated = stoppedEarly || (lastNonEmpty >= 0 && coveredEnd < lastNonEmpty + 1)
  let total = 0
  const capped: AiReviewBlock[] = []
  for (const block of blocks) {
    if (total + block.text.length > OFFICE_REVIEW_MAX_CHARS) {
      truncated = true
      break
    }
    capped.push(block)
    total += block.text.length
  }
  return { blocks: capped.slice(0, OFFICE_REVIEW_MAX_BLOCKS), truncated }
}

/**
 * XLSX 行 → 可定位 block。anchor 带 sheet+range;pin 取 range 起点格落点,
 * 因此 AI 结论必须和“哪张表、哪一段行”一起回来,不能只给一句泛泛建议。
 */
export function buildXlsxReviewBlocks(
  sheet: string,
  rows: readonly (readonly string[])[],
  totalRows: number = rows.length,
): { blocks: AiReviewBlock[]; truncated: boolean } {
  const blocks: AiReviewBlock[] = []
  let startRow = 0
  let endRow = 0
  let buffer: string[] = []
  let chars = 0
  let lastNonEmptyRow = -1
  let stoppedEarly = false
  const flush = (): void => {
    const text = buffer.join('\n').trim()
    if (text.length >= 10 && sheet) {
      const lastCol = xlsxColumnRef(Math.max(0, ...buffer.map((line) => line.split(' | ').length - 1)))
      blocks.push({
        anchor: {
          kind: 'xlsx',
          sheet,
          range: `A${startRow + 1}:${lastCol}${endRow + 1}`,
        },
        text,
      })
    }
    buffer = []
    chars = 0
  }
  for (let row = 0; row < rows.length; row += 1) {
    const values = (rows[row] ?? []).map((value) => String(value ?? ''))
    if (values.every((value) => !value.trim())) continue
    lastNonEmptyRow = row
    if (!buffer.length) {
      startRow = row
      endRow = row
    }
    const line = `${row + 1}: ${values.map((value, col) => `${xlsxColumnRef(col)}${row + 1}=${value}`).join(' | ')}`
    if (buffer.length && chars + line.length > OFFICE_REVIEW_BLOCK_CHARS) {
      flush()
      startRow = row
      endRow = row
    }
    buffer.push(line)
    endRow = row
    chars += line.length + 1
    if (blocks.length >= OFFICE_REVIEW_MAX_BLOCKS) {
      stoppedEarly = row + 1 < rows.length
      break
    }
  }
  if (buffer.length) flush()
  const coveredEnd = Number(/([1-9]\d*)$/.exec(String(blocks[blocks.length - 1]?.anchor.range ?? ''))?.[1] ?? 0)
  let truncated =
    stoppedEarly ||
    (lastNonEmptyRow >= 0 && coveredEnd < lastNonEmptyRow + 1) ||
    totalRows > rows.length
  let total = 0
  const capped: AiReviewBlock[] = []
  for (const block of blocks) {
    if (total + block.text.length > OFFICE_REVIEW_MAX_CHARS) {
      truncated = true
      break
    }
    capped.push(block)
    total += block.text.length
  }
  return { blocks: capped.slice(0, OFFICE_REVIEW_MAX_BLOCKS), truncated }
}

/** 一个工作表参与 AI 全文预审的行快照;total 是未按预览上限截断前的真实行数。 */
export interface XlsxReviewSheet {
  readonly sheet: string
  readonly rows: readonly string[][]
  readonly total: number
}

/**
 * 工作簿 → 跨 sheet 的预审 blocks。AI 必须知道每个结论落在哪张表哪段行,
 * 所以这里按 sheet 分块,而不是把多张表拼成一段无坐标的文本。
 */
export function buildXlsxWorkbookReviewBlocks(
  sheets: readonly XlsxReviewSheet[],
): { blocks: AiReviewBlock[]; truncated: boolean } {
  const blocks: AiReviewBlock[] = []
  let truncated = false
  let totalChars = 0
  for (const item of sheets) {
    const built = buildXlsxReviewBlocks(item.sheet, item.rows, item.total)
    if (built.truncated) truncated = true
    for (const block of built.blocks) {
      if (blocks.length >= OFFICE_REVIEW_MAX_BLOCKS) {
        truncated = true
        break
      }
      if (totalChars + block.text.length > OFFICE_REVIEW_MAX_CHARS) {
        truncated = true
        break
      }
      blocks.push(block)
      totalChars += block.text.length
    }
    if (blocks.length >= OFFICE_REVIEW_MAX_BLOCKS) break
  }
  return { blocks, truncated }
}

function officeReviewLabel(kind: 'docx' | 'xlsx', block: AiReviewBlock): string {
  if (kind === 'docx') {
    const start = Number(block.anchor.paragraph)
    const end = Number(block.anchor.paragraphEnd)
    if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
      return `文档第 ${start}-${end} 段 · AI 全文`
    }
    return `文档第 ${start} 段 · AI 全文`
  }
  return `${String(block.anchor.sheet ?? '')} · ${String(block.anchor.range ?? '')} · AI 全文`
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

interface DocxBodyProps {
  readonly data: ArrayBuffer
  readonly annotationPins?: readonly PreviewAnnotationPin[]
  readonly focusedAnnotationId?: string | null
  readonly onAnnotationSelect?: (id: string) => void
  /** 渲染完成后的段落文本;AI 全文预审与 paragraph pin 共用这一份坐标。 */
  readonly onParagraphsChange?: (paragraphs: readonly string[]) => void
}

function DocxBody({
  data,
  annotationPins = [],
  focusedAnnotationId = null,
  onAnnotationSelect,
  onParagraphsChange,
}: DocxBodyProps) {
  const t = useTranslations('chat')
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [rendered, setRendered] = React.useState(0)
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
      .then(({ renderAsync }) =>
        renderAsync(data, container, undefined, { inWrapper: false }).then(() => {
          if (cancelled) return
          setRendered((value) => value + 1)
          const paragraphs = Array.from(container.querySelectorAll('p')).map(
            (p) => p.textContent?.trim() ?? '',
          )
          onParagraphsChange?.(paragraphs)
        }),
      )
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [data, onParagraphsChange])

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

  // 段落 pin:docx-preview 输出第三方 DOM,React 不能直接插入子节点;
  // 用受控 DOM marker + cleanup 把批注落到具体段落,点击仍走 onAnnotationSelect。
  React.useEffect(() => {
    const container = ref.current
    if (!container || rendered === 0) return
    const markers: { marker: HTMLElement; paragraph: HTMLElement; position: string }[] = []
    const paragraphs = Array.from(container.querySelectorAll('p'))
    for (const pin of annotationPins) {
      if (pin.kind !== 'docx' || !pin.paragraph) continue
      const paragraph = paragraphs[pin.paragraph - 1]
      if (!paragraph) continue
      const position = paragraph.style.position
      if (getComputedStyle(paragraph).position === 'static') paragraph.style.position = 'relative'
      const marker = document.createElement('button')
      marker.type = 'button'
      marker.dataset.testid = 'docx-annotation-pin'
      marker.dataset.annotationId = pin.id
      marker.setAttribute('aria-label', `查看批注：${pin.label}`)
      marker.title = `${pin.label} · ${pin.body}`
      marker.textContent = '●'
      marker.style.cssText = [
        'position:absolute',
        'right:2px',
        'top:2px',
        'z-index:2',
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'width:16px',
        'height:16px',
        'border-radius:9999px',
        'border:1px solid rgba(124,58,237,.55)',
        'background:#ede9fe',
        'color:#6d28d9',
        'font-size:9px',
        'line-height:1',
        'cursor:pointer',
        pin.id === focusedAnnotationId ? 'box-shadow:0 0 0 2px rgba(124,58,237,.45)' : '',
      ].join(';')
      marker.addEventListener('click', (event) => {
        event.stopPropagation()
        onAnnotationSelect?.(pin.id)
      })
      paragraph.appendChild(marker)
      if (pin.id === focusedAnnotationId) {
        paragraph.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      markers.push({ marker, paragraph, position })
    }
    return () => {
      for (const item of markers) {
        item.marker.remove()
        item.paragraph.style.position = item.position
      }
    }
  }, [annotationPins, focusedAnnotationId, onAnnotationSelect, rendered])

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
  readonly sheets: readonly XlsxReviewSheet[]
  readonly rows: readonly string[][]
  readonly total: number
  readonly selected: { readonly row: number; readonly col: number } | null
}

const INITIAL_XLSX_STATE: XlsxGridState = {
  book: null,
  active: '',
  sheets: [],
  rows: [],
  total: 0,
  selected: null,
}

interface XlsxGridProps {
  readonly data: ArrayBuffer
  readonly maxRows: number
  readonly annotationPins?: readonly PreviewAnnotationPin[]
  readonly focusedAnnotationId?: string | null
  readonly onAnnotationSelect?: (id: string) => void
  /** 当前 sheet 与已渲染行;AI 全文预审按 sheet+range 回指位置。 */
  readonly onRowsChange?: (value: {
    readonly activeSheet: string
    readonly sheets: readonly XlsxReviewSheet[]
  }) => void
}

/** XLSX range(如 A2:C9)→ 起点单元格;解析失败返回 null,绝不猜位置。 */
export function xlsxRangeStart(
  range: string | undefined,
): { readonly row: number; readonly col: number } | null {
  const match = /^([A-Za-z]+)([1-9]\d*)/.exec(range?.trim() ?? '')
  if (!match) return null
  let col = 0
  for (const char of (match[1] ?? '').toUpperCase()) col = col * 26 + (char.charCodeAt(0) - 64)
  return { row: Number(match[2]), col: col - 1 }
}

function XlsxGrid({
  data,
  maxRows,
  annotationPins = [],
  focusedAnnotationId = null,
  onAnnotationSelect,
  onRowsChange,
}: XlsxGridProps) {
  const t = useTranslations('chat')
  const [state, setState] = React.useState<XlsxGridState>(INITIAL_XLSX_STATE)
  const [failed, setFailed] = React.useState(false)
  const gridRef = React.useRef<HTMLDivElement>(null)
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
      const sheets: XlsxReviewSheet[] = []
      for (const name of book.SheetNames) {
        const ws = book.Sheets[name]
        if (!ws) continue
        const all = mod.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          blankrows: false,
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        }) as unknown as string[][]
        sheets.push({ sheet: name, rows: all.slice(0, maxRows), total: all.length })
      }
      if (cancelled) return
      const activeSheet = sheets.find((item) => item.sheet === active) ?? sheets[0]
      setState((prev) => ({
        ...prev,
        sheets,
        rows: activeSheet?.rows ?? [],
        total: activeSheet?.total ?? 0,
        selected: null,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [book, active, maxRows])

  React.useEffect(() => {
    if (!state.book || !state.active || state.sheets.length === 0) return
    onRowsChange?.({ activeSheet: state.active, sheets: state.sheets })
  }, [state.book, state.active, state.sheets, onRowsChange])

  // 右侧线程面板选中 pin ⇒ 把对应单元格滚进视野;表格横向滚动时也成立。
  React.useEffect(() => {
    if (!focusedAnnotationId) return
    const container = gridRef.current
    if (!container) return
    const target = Array.from(container.querySelectorAll<HTMLElement>('[data-annotation-id]')).find(
      (element) => element.dataset.annotationId === focusedAnnotationId,
    )
    target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [focusedAnnotationId, annotationPins, state.active])

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

  const pinsAt = (row: number, col: number): readonly PreviewAnnotationPin[] =>
    annotationPins.filter((pin) => {
      if (pin.kind !== 'xlsx' || pin.sheet !== state.active) return false
      const start = xlsxRangeStart(pin.range)
      return start?.row === row && start.col === col
    })
  const pinButton = (pin: PreviewAnnotationPin): React.ReactNode => (
    <button
      key={pin.id}
      type="button"
      data-testid="xlsx-annotation-pin"
      data-annotation-id={pin.id}
      aria-label={`查看批注：${pin.label}`}
      title={`${pin.label} · ${pin.body}`}
      onClick={(event) => {
        event.stopPropagation()
        onAnnotationSelect?.(pin.id)
      }}
      className={cn(
        'ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-violet-500/60 bg-violet-100 text-[9px] leading-none text-violet-700',
        pin.id === focusedAnnotationId && 'ring-2 ring-violet-500/50',
      )}
    >
      ●
    </button>
  )

  return (
    <div ref={gridRef} className="max-h-[420px] overflow-auto" data-testid="xlsx-grid">
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
              const cellPins = pinsAt(1, i)
              return (
                <th
                  key={`h-${i}`}
                  colSpan={span?.colSpan}
                  rowSpan={span?.rowSpan}
                  style={{ ...xlsxCellCss(cell), width: columnWidths[i] }}
                  className={cn(
                    'border border-border bg-muted/50 px-2 py-1 text-left font-medium',
                    cellPins.some((pin) => pin.id === focusedAnnotationId) &&
                      'ring-2 ring-inset ring-violet-500/60',
                  )}
                >
                  {h}
                  {cellPins.map(pinButton)}
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
                const cellPins = pinsAt(rowNo, ci)
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
                    className={cn(
                      'cursor-pointer border border-border px-2 py-1 hover:bg-muted/50',
                      cellPins.some((pin) => pin.id === focusedAnnotationId) &&
                        'bg-violet-50 ring-2 ring-inset ring-violet-500/60 dark:bg-violet-950/20',
                    )}
                  >
                    {c}
                    {cellPins.map(pinButton)}
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
  /** 文档中心下发的批注 pin(PDF/PPTX/DOCX 段落/XLSX 单元格均可定位)。 */
  readonly annotationPins?: readonly PreviewAnnotationPin[]
  readonly focusedAnnotationId?: string | null
  readonly onAnnotationSelect?: (id: string) => void
  readonly documentId?: string
  readonly documentName?: string
  readonly onAnnotationsMutated?: () => void
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
  documentId,
  documentName,
  onAnnotationsMutated,
}: OfficePreviewProps) {
  const t = useTranslations('chat')
  const kind = ext.toLowerCase().replace(/^\./, '')
  const [status, setStatus] = React.useState<OfficePreviewStatus>(() =>
    SUPPORTED_EXTS.has(kind) ? 'probing' : 'unsupported',
  )
  const [data, setData] = React.useState<ArrayBuffer | null>(null)
  const [view, setView] = React.useState<PreviewViewMode>('preview')
  const [source, setSource] = React.useState<OfficeSourceState>(IDLE_OFFICE_SOURCE)
  const [docxParagraphs, setDocxParagraphs] = React.useState<readonly string[]>([])
  const [xlsxSheets, setXlsxSheets] = React.useState<readonly XlsxReviewSheet[]>([])
  const [aiReviewBusy, setAiReviewBusy] = React.useState(false)

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
    setDocxParagraphs([])
    setXlsxSheets([])
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

  const reviewPayload = React.useMemo(() => {
    if (kind === 'docx') return buildDocxReviewBlocks(docxParagraphs)
    if (kind === 'xlsx' || kind === 'xls') {
      return xlsxSheets.length > 0
        ? buildXlsxWorkbookReviewBlocks(xlsxSheets)
        : { blocks: [] as AiReviewBlock[], truncated: false }
    }
    return { blocks: [] as AiReviewBlock[], truncated: false }
  }, [docxParagraphs, kind, xlsxSheets])

  const runOfficeFullReview = React.useCallback(async () => {
    if (!documentId || aiReviewBusy || reviewPayload.blocks.length === 0) return
    if (kind !== 'docx' && kind !== 'xlsx' && kind !== 'xls') return
    const reviewKind = kind === 'docx' ? 'docx' : 'xlsx'
    setAiReviewBusy(true)
    try {
      const findings = await reviewDocumentBlocks({
        title: documentName || (reviewKind === 'docx' ? 'Word 文档' : 'Excel 工作簿'),
        blocks: reviewPayload.blocks,
      })
      if (findings.length === 0) {
        toast.success(
          `AI 已通读 ${reviewPayload.blocks.length} 个位置：没有发现需要标注的问题${
            reviewPayload.truncated ? '（文档过长，仅审阅前段）' : ''
          }`,
        )
        return
      }
      const groups = new Map<number, AiReviewFinding[]>()
      for (const finding of findings) {
        const blockNumber = finding.block
        if (!blockNumber || blockNumber < 1 || blockNumber > reviewPayload.blocks.length) continue
        const group = groups.get(blockNumber) ?? []
        group.push(finding)
        groups.set(blockNumber, group)
      }
      let created = 0
      for (const [blockNumber, group] of groups) {
        const block = reviewPayload.blocks[blockNumber - 1]
        if (!block) continue
        const saved = await saveAiFindings({
          documentId,
          label: officeReviewLabel(reviewKind, block),
          anchorKind: reviewKind,
          anchor: block.anchor,
          findings: group.slice(0, 5),
        })
        created += saved.created.length
      }
      onAnnotationsMutated?.()
      toast.success(
        created > 0
          ? `AI 已通读 ${reviewPayload.blocks.length} 个位置，发现 ${created} 条新意见${
              reviewPayload.truncated ? '（文档过长，仅审阅前段）' : ''
            }`
          : 'AI 已通读全文：同一位置的意见已存在',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 全文预审失败，请稍后重试')
    } finally {
      setAiReviewBusy(false)
    }
  }, [aiReviewBusy, documentId, documentName, kind, onAnnotationsMutated, reviewPayload])

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
          {documentId && (kind === 'docx' || kind === 'xlsx' || kind === 'xls') ? (
            <button
              type="button"
              data-testid="office-ai-full-review"
              onClick={() => void runOfficeFullReview()}
              disabled={aiReviewBusy || reviewPayload.blocks.length === 0}
              aria-label="AI 全文预审"
              title={
                reviewPayload.truncated
                  ? 'AI 通读全文并把结论落到段落/单元格；文档过长时只审阅前段'
                  : 'AI 通读全文并把结论落到段落/单元格'
              }
              className="flex items-center gap-1 rounded-md border border-violet-300 px-2 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
            >
              {aiReviewBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>AI 全文预审</span>
            </button>
          ) : null}
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
          {status === 'ready' && data && kind === 'docx' && (
            <DocxBody
              data={data}
              annotationPins={annotationPins}
              focusedAnnotationId={focusedAnnotationId}
              onAnnotationSelect={onAnnotationSelect}
              onParagraphsChange={setDocxParagraphs}
            />
          )}
          {status === 'ready' && data && (kind === 'xlsx' || kind === 'xls') && (
            <XlsxGrid
              data={data}
              maxRows={maxRows}
              annotationPins={annotationPins}
              focusedAnnotationId={focusedAnnotationId}
              onAnnotationSelect={onAnnotationSelect}
              onRowsChange={(value) => setXlsxSheets(value.sheets)}
            />
          )}
          {status === 'ready' && data && kind === 'pptx' && (
            <PptxPreview
              data={data}
              annotationPins={annotationPins}
              focusedAnnotationId={focusedAnnotationId}
              onAnnotationSelect={onAnnotationSelect}
              documentId={documentId}
              documentName={documentName}
              onAnnotationsMutated={onAnnotationsMutated}
            />
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
