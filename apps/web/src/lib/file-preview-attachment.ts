// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 富预览附件判型与解析(V3 #70,2026-09-27 立)。
 *
 * 平台特有:纯函数,只在浏览器宿主渲染层使用(依赖 fetch 响应头由调用方传入),
 * 不依赖 DOM,可被 vitest 直接判。
 *
 * 为什么住在端内而不是 packages/shared:它判的是 **web 渲染层的降级语义**
 * (哪一型给错误卡、哪一型给下载出口),跨端不共用一套文案,不适合共享(AGENTS §3)。
 *
 * 三条设计约束:
 *  1. 逗号分隔的唯一实现仍是 `csv-preview.ts` 的 `parseCsv`(本模块只**转发**,不复制),
 *     制表符分隔是新增的第二型 —— 两者由 `__tests__/file-preview-attachment.test.ts`
 *     的逐字奇偶用例钉住,防止"同一个 CSV 两种命运"(本仓同族事故:`_TOOL_ALIASES` 两份)。
 *  2. 判型表不得与 `office-preview.tsx` 的 `SUPPORTED_EXTS` 竞争真相:本模块只回答
 *     "是不是 office 那一族",具体支持哪几个扩展名由 OfficePreview 自己判。
 *  3. 一切截断必须回报 `truncated`,不得静默变短(AGENTS §26 邻近的"静默变短等于伪造完整性")。
 */

import { parseCsv } from './csv-preview'

/** 文本型预览的字节上限(超出即判"过大"错误卡;与 office 侧 10MB 软门同源思路,按文本量收紧)。 */
export const RICH_PREVIEW_MAX_TEXT_BYTES = 2 * 1024 * 1024

/** 列宽自适应的单列上限(单位 ch,防止一个超长单元格把整表挤成一列)。 */
export const COLUMN_WIDTH_MAX_CH = 42
/** 列宽自适应的单列下限(保证窄列仍有可点击的宽度)。 */
export const COLUMN_WIDTH_MIN_CH = 6

export type DelimitedFormat = 'csv' | 'tsv'

/** 富预览判型结果(封闭集,调用方不得自增分支)。 */
export type RichPreviewKind =
  | { readonly kind: 'pdf' }
  | { readonly kind: 'delimited'; readonly format: DelimitedFormat; readonly delimiter: string }
  | { readonly kind: 'office' }
  | { readonly kind: 'unsupported'; readonly ext: string }

/** 取 href 的扩展名(去掉 query/hash;无扩展名返回空串)。 */
export function previewExtFromHref(href: string): string {
  const tail = href.split('?')[0]?.split('#')[0] ?? ''
  const seg = tail.split('/').pop() ?? ''
  const dot = seg.lastIndexOf('.')
  return dot > 0 ? seg.slice(dot + 1).toLowerCase() : ''
}

/**
 * 扩展名 → 富预览判型。
 *
 * 唯一判型表:`pdf` 走 pdf.js 真渲染,`csv|tsv` 走分隔符表格,office 那一族交给
 * OfficePreview(它自带 `SUPPORTED_EXTS` 与四态降级),其余判"不支持 + 下载出口"。
 */
export function richPreviewKindOf(ext: string): RichPreviewKind {
  const normalized = ext.toLowerCase()
  if (normalized === 'pdf') return { kind: 'pdf' }
  if (normalized === 'csv') return { kind: 'delimited', format: 'csv', delimiter: ',' }
  if (normalized === 'tsv') return { kind: 'delimited', format: 'tsv', delimiter: '\t' }
  if (OFFICEISH_EXTS.has(normalized)) return { kind: 'office' }
  return { kind: 'unsupported', ext: normalized }
}

/**
 * 交给 OfficePreview 的扩展名候选(不是"支持清单",只是"这一族")。
 * 真正的支持判定在 `office-preview.tsx` 的 `SUPPORTED_EXTS`,本表只负责"要不要转交",
 * 所以这里宽一点不会造成第二个真相源 —— 转交过去后 OfficePreview 会自己判"不支持"。
 */
const OFFICEISH_EXTS: ReadonlySet<string> = new Set([
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
])

/** 分隔符文本预览的失败态(封闭集;每一态都对应一张明确的错误卡,不得合并成"失败")。 */
export type DelimitedFailure = 'tooLarge' | 'binary' | 'empty'

/**
 * 在解析**之前**判失败态。
 *
 * @param byteLength 优先取响应 `Content-Length`(实测值),取不到则用正文长度兜底。
 * @returns 失败态;正常可解析时返回 null。
 */
export function classifyDelimitedText(
  text: string,
  byteLength: number | null,
): DelimitedFailure | null {
  const size = byteLength ?? new TextEncoder().encode(text).length
  if (size > RICH_PREVIEW_MAX_TEXT_BYTES) return 'tooLarge'
  // 类型不符:扩展名写着 csv/tsv 而正文是二进制(含 NUL 即判,误伤面极小)
  if (text.includes('\0')) return 'binary'
  if (text.trim().length === 0) return 'empty'
  return null
}

/**
 * 解析分隔符文本为二维表。
 *
 * `,` 一律转发既有 `parseCsv`(唯一实现,行为逐字不变);`\t` 走同语义状态机
 * (RFC 4180 的引号转义对制表符同样成立:引号字段内可以有逗号)。
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  if (delimiter === ',') return parseCsv(text)
  return parseDelimitedGeneric(text, delimiter)
}

function parseDelimitedGeneric(text: string, delimiter: string): string[][] {
  if (!text) return []
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i] ?? ''
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delimiter) {
      pushCell()
      i++
      continue
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      pushRow()
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      i++
      continue
    }
    cell += ch
    i++
  }

  if (cell !== '' || row.length > 0) pushRow()

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * 列宽自适应:按每列最长内容算 ch 宽,夹在 [min, max]。
 *
 * 只算宽度不猜语义:超长列被夹到上限后由 CSS 换行兜住(不裁内容,不静默变短)。
 */
export function columnWidthsInCh(
  rows: readonly (readonly string[])[],
  opts: { readonly maxCh?: number; readonly minCh?: number } = {},
): number[] {
  const maxCh = opts.maxCh ?? COLUMN_WIDTH_MAX_CH
  const minCh = opts.minCh ?? COLUMN_WIDTH_MIN_CH
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, col) => {
      // CJK 字形约 2ch 宽,按码位非 ASCII 计双宽,否则中文列会被挤成竖排
      const w = displayWidthOf(cell)
      widths[col] = Math.max(widths[col] ?? 0, w)
    })
  }
  return widths.map((w) => Math.min(maxCh, Math.max(minCh, w + 1)))
}

/** 显示宽度:ASCII 记 1,其余(CJK/全角)记 2。 */
export function displayWidthOf(text: string): number {
  let w = 0
  for (const ch of text) {
    w += ch.codePointAt(0)! > 0x7f ? 2 : 1
  }
  return w
}

/** 预览行数裁剪结果(与 csv-preview 的 clipCsvRows 同形,total 永远是全量行数)。 */
export interface ClippedRows {
  readonly rows: string[][]
  readonly total: number
  readonly shown: number
  readonly truncated: boolean
}

/**
 * 裁剪预览行数并**如实回报**截断(供 UI 拼"共 N 行 / 仅预览前 M 行")。
 *
 * 与 `clipCsvRows` 的差别只有一个:`shown` 显式回传,让渲染层不必自己 `.length` 再算一遍
 * (那是本仓"请求侧长度当命中数"那一型失真的最小组合)。
 */
export function clipPreviewRows(rows: readonly string[][], maxRows: number): ClippedRows {
  const total = rows.length
  const clipped = rows.slice(0, maxRows)
  return { rows: clipped, total, shown: clipped.length, truncated: total > clipped.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
