// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import type JSZip from 'jszip'
import { Loader2, MessageSquare, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AiReviewFinding, PreviewAnnotationPin } from '@/lib/document-annotations'
import {
  reviewDocumentBlocks,
  reviewDocumentFragment,
  saveAiFindings,
} from '@/lib/document-annotations'
import { AnnotationAnchorCapture } from '@/components/chat/annotation-anchor'
import { toast } from '@/components/common'

/**
 * PPTX 版式化预览(2026-11-26 立)。
 *
 * 立因:原实现只把每页 `<a:t>` 文本拉成大纲,用户看不到标题层级、文本框位置、图片与
 * 背景,PPT 预览与 WPS / 飞书差距最大。这里不引第三方渲染器,直接解 OOXML:
 *  - slide 顺序以 `presentation.xml` 的 sldIdLst + rels 为准(按编号排序只作兜底);
 *  - 位置取 `p:spPr/a:xfrm`,缺失时从 slideLayout 同名占位符继承,再退化为启发式版式;
 *  - 文本支持字号/粗体/斜体/下划线/颜色/对齐/项目符号,颜色会按 theme + clrMap 解析;
 *  - 形状支持纯色/线性或径向渐变填充与描边,按 `rot` 还原旋转;
 *  - slide/layout/master 的纯色或图片背景均可还原;
 *  - 图片按 slide rels 映射到 `ppt/media/*`,以 data URL 内联,不第二次取件;
 *  - 表格按 `a:tbl` 渲染为只读网格。
 *
 * 边界:这是"结构级版式还原",不是像素级 Office 排版引擎——主题字体、SmartArt、
 * 图表、动画不还原;拿不到版式的页会保留文字大纲兜底。
 */

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const DEFAULT_CX = 12192000
const DEFAULT_CY = 6858000
/** 版式坐标系基准宽度:1pt 恰好 1px,字号用 cqw 随容器等比缩放。 */
const SLIDE_BASE_PX = 960

interface PptxBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** 旋转角度(度,顺时针;DrawingML rot 60000 单位已归一化)。 */
  readonly rotation?: number
  /** OOXML `cNvPr/@name`;批注锚点优先用它,缺失时渲染层用稳定序号兜底。 */
  readonly name?: string
}

interface PptxRun {
  readonly text: string
  readonly sizePt: number
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly color?: string
}

interface PptxParagraph {
  readonly align: 'left' | 'center' | 'right' | 'justify'
  readonly bullet: string | null
  readonly runs: readonly PptxRun[]
}

interface PptxTextShape extends PptxBox {
  readonly kind: 'text'
  readonly paragraphs: readonly PptxParagraph[]
  readonly fill?: string
  readonly line?: string
  readonly lineWidth?: number
  readonly radius?: number | string
  readonly alignY: 'top' | 'center' | 'bottom'
  readonly color: string
}

interface PptxImageShape extends PptxBox {
  readonly kind: 'image'
  readonly src: string
}

interface PptxTableShape extends PptxBox {
  readonly kind: 'table'
  readonly rows: readonly (readonly string[])[]
}

type PptxVisualShape = PptxTextShape | PptxImageShape | PptxTableShape

export interface PptxVisualSlide {
  readonly index: number
  readonly background: string
  readonly backgroundImage?: string
  readonly shapes: readonly PptxVisualShape[]
  readonly notes: string | null
}

export interface PptxVisualDeck {
  readonly cx: number
  readonly cy: number
  readonly slides: readonly PptxVisualSlide[]
}

interface RelTarget {
  readonly target: string
  readonly type: string
}

interface ColorContext {
  readonly theme: ReadonlyMap<string, string> | null
  readonly clrMap: ReadonlyMap<string, string>
}

const DEFAULT_CLR_MAP: ReadonlyMap<string, string> = new Map([
  ['bg1', 'lt1'],
  ['tx1', 'dk1'],
  ['bg2', 'lt2'],
  ['tx2', 'dk2'],
  ['accent1', 'accent1'],
  ['accent2', 'accent2'],
  ['accent3', 'accent3'],
  ['accent4', 'accent4'],
  ['accent5', 'accent5'],
  ['accent6', 'accent6'],
  ['hlink', 'hlink'],
  ['folHlink', 'folHlink'],
])

const DEFAULT_COLOR_CONTEXT: ColorContext = {
  theme: null,
  clrMap: DEFAULT_CLR_MAP,
}

interface RawBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

function parseXml(xml: string): Document | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return descendants(doc.documentElement, 'parsererror').length > 0 ? null : doc
}

function descendants(root: Element | Document, localName: string): Element[] {
  const all = root.getElementsByTagName('*')
  return Array.from(all).filter((el) => el.localName === localName)
}

function kids(root: Element, localName: string): Element[] {
  return Array.from(root.children).filter((el) => el.localName === localName)
}

function firstKid(root: Element | undefined, localName: string): Element | undefined {
  return root ? kids(root, localName)[0] : undefined
}

function firstDesc(root: Element | undefined, localName: string): Element | undefined {
  return root ? descendants(root, localName)[0] : undefined
}

function numAttr(el: Element | undefined, name: string): number | null {
  const raw = el?.getAttribute(name)
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function boolAttr(el: Element | undefined, name: string): boolean {
  const raw = el?.getAttribute(name)
  return raw === '1' || raw === 'true'
}

function relAttr(el: Element | undefined, localName: 'id' | 'embed'): string | null {
  if (!el) return null
  const byNs = Array.from(el.attributes).find(
    (attr) => attr.localName === localName && attr.namespaceURI === R_NS,
  )
  const byPrefixed = Array.from(el.attributes).find((attr) => attr.name === `r:${localName}`)
  return byNs?.value ?? byPrefixed?.value ?? null
}

function resolvePart(baseDir: string, target: string): string {
  const out = baseDir.split('/').filter(Boolean)
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

async function readRels(
  zip: JSZip,
  relPath: string,
  baseDir: string,
): Promise<Map<string, RelTarget>> {
  const map = new Map<string, RelTarget>()
  const file = zip.file(relPath)
  if (!file) return map
  const doc = parseXml(await file.async('string'))
  if (!doc) return map
  for (const rel of descendants(doc.documentElement, 'Relationship')) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    const type = rel.getAttribute('Type') ?? ''
    const external = rel.getAttribute('TargetMode') === 'External'
    if (!id || !target || external) continue
    map.set(id, { target: resolvePart(baseDir, target), type })
  }
  return map
}

let zipPromise: ReturnType<typeof importZip> | null = null
async function importZip() {
  const mod = await import('jszip')
  return mod.default
}
function loadZip() {
  zipPromise ??= importZip()
  return zipPromise
}

function normalizeHex(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const hex = value.replace(/^#/, '').trim()
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : undefined
}

function parseThemeColors(doc: Document | null): Map<string, string> {
  const colors = new Map<string, string>()
  if (!doc) return colors
  const scheme = firstDesc(doc.documentElement, 'clrScheme')
  if (!scheme) return colors
  for (const slot of Array.from(scheme.children)) {
    const srgb = normalizeHex(firstKid(slot, 'srgbClr')?.getAttribute('val'))
    const sys = normalizeHex(firstKid(slot, 'sysClr')?.getAttribute('lastClr'))
    const value = srgb ?? sys
    if (value) colors.set(slot.localName, value)
  }
  return colors
}

function parseClrMap(doc: Document | null): ReadonlyMap<string, string> {
  const clrMap = doc ? firstDesc(doc.documentElement, 'clrMap') : undefined
  if (!clrMap) return DEFAULT_CLR_MAP
  const map = new Map(DEFAULT_CLR_MAP)
  for (const attr of Array.from(clrMap.attributes)) map.set(attr.name, attr.value)
  return map
}

async function readThemeDoc(zip: JSZip): Promise<Document | null> {
  const candidates = ['ppt/theme/theme1.xml']
  const themeFile = candidates.map((path) => zip.file(path)).find(Boolean)
  if (!themeFile) return null
  return parseXml(await themeFile.async('string'))
}

function schemeColor(
  val: string | null,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): string | undefined {
  if (!val) return undefined
  const mapped = context.clrMap.get(val) ?? val
  const themeColor = context.theme?.get(mapped) ?? context.theme?.get(val)
  if (themeColor) return themeColor
  // 主题部件缺失/损坏时的稳定兜底:预览仍要成形,不能因为配色表不见就白屏。
  const palette: Record<string, string> = {
    tx1: '#111827',
    dk1: '#111827',
    tx2: '#374151',
    dk2: '#374151',
    bg1: '#FFFFFF',
    lt1: '#FFFFFF',
    bg2: '#F3F4F6',
    lt2: '#F3F4F6',
    accent1: '#2563EB',
    accent2: '#DC2626',
    accent3: '#16A34A',
    accent4: '#F59E0B',
    accent5: '#7C3AED',
    accent6: '#0891B2',
    hlink: '#2563EB',
    folHlink: '#7C3AED',
  }
  return palette[val]
}

function colorOfFill(
  fill: Element | undefined,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): string | undefined {
  if (!fill) return undefined
  const srgb = normalizeHex(firstKid(fill, 'srgbClr')?.getAttribute('val'))
  if (srgb) return srgb
  const sys = normalizeHex(firstKid(fill, 'sysClr')?.getAttribute('lastClr'))
  if (sys) return sys
  const scheme = schemeColor(firstKid(fill, 'schemeClr')?.getAttribute('val') ?? null, context)
  if (scheme) return scheme
  const preset = firstKid(fill, 'prstClr')?.getAttribute('val')
  switch (preset) {
    case 'black':
      return '#000000'
    case 'white':
      return '#FFFFFF'
    case 'red':
      return '#FF0000'
    case 'green':
      return '#008000'
    case 'blue':
      return '#0000FF'
    default:
      return undefined
  }
}

function solidFillOf(
  root: Element | undefined,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): string | undefined {
  return colorOfFill(firstKid(root, 'solidFill'), context)
}

function gradientFillCss(
  fill: Element,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): string | undefined {
  const stops = kids(fill, 'gsLst').flatMap((list) =>
    kids(list, 'gs').map((stop) => {
      const color = colorOfFill(stop, context)
      const pos = Math.max(0, Math.min(100, (numAttr(stop, 'pos') ?? 0) / 1000))
      return color ? { color, pos } : null
    }),
  )
  const valid = stops.filter((stop): stop is { color: string; pos: number } => stop !== null)
  if (valid.length === 0) return undefined
  valid.sort((a, b) => a.pos - b.pos)
  const colorStops = valid.map((stop) => `${stop.color} ${stop.pos.toFixed(1)}%`).join(', ')
  const lin = firstKid(fill, 'lin')
  if (lin) {
    // DrawingML 的 0° 是左→右,而 CSS 的 0° 是下→上;+90° 做一次坐标系对齐。
    const deg = (numAttr(lin, 'ang') ?? 0) / 60000 + 90
    return `linear-gradient(${Math.round(deg)}deg, ${colorStops})`
  }
  return `radial-gradient(circle, ${colorStops})`
}

async function pictureFillCss(
  blipFill: Element,
  zip: JSZip | undefined,
  rels: Map<string, RelTarget> | undefined,
): Promise<string | undefined> {
  if (!zip || !rels) return undefined
  const embed = relAttr(firstDesc(blipFill, 'blip'), 'embed')
  if (!embed) return undefined
  const rel = rels.get(embed)
  if (!rel) return undefined
  const file = zip.file(rel.target)
  if (!file) return undefined
  const base64 = await file.async('base64')
  return `url("data:${mimeOfPath(rel.target)};base64,${base64}") center / cover no-repeat`
}

/** 形状填充 → 可直接放进 CSS `background` 的值(solid / gradient / picture / transparent)。 */
async function fillOf(
  root: Element | undefined,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
  zip?: JSZip,
  rels?: Map<string, RelTarget>,
): Promise<string | undefined> {
  if (!root) return undefined
  const solid = solidFillOf(root, context)
  if (solid) return solid
  const gradient = firstKid(root, 'gradFill')
  if (gradient) {
    const css = gradientFillCss(gradient, context)
    if (css) return css
  }
  const picture = firstKid(root, 'blipFill')
  if (picture) {
    const css = await pictureFillCss(picture, zip, rels)
    if (css) return css
  }
  return firstKid(root, 'noFill') ? 'transparent' : undefined
}

function isDark(hex: string | undefined): boolean {
  if (!hex) return false
  const value = hex.replace('#', '')
  if (value.length !== 6) return false
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 132
}

function readBackground(
  doc: Document | null,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): string | undefined {
  if (!doc) return undefined
  const cSld = descendants(doc.documentElement, 'cSld')[0]
  const bg = firstKid(cSld, 'bg')
  const bgPr = firstKid(bg, 'bgPr')
  return solidFillOf(bgPr, context)
}

async function readBackgroundImage(
  doc: Document | null,
  zip: JSZip,
  rels: Map<string, RelTarget>,
): Promise<string | undefined> {
  if (!doc) return undefined
  const cSld = descendants(doc.documentElement, 'cSld')[0]
  const bg = firstKid(cSld, 'bg')
  const bgPr = firstKid(bg, 'bgPr')
  const blip = firstDesc(bgPr, 'blip')
  const embed = relAttr(blip, 'embed')
  if (!embed) return undefined
  const rel = rels.get(embed)
  if (!rel) return undefined
  const file = zip.file(rel.target)
  if (!file) return undefined
  const base64 = await file.async('base64')
  return `url("data:${mimeOfPath(rel.target)};base64,${base64}")`
}

function readBox(el: Element | undefined): RawBox | null {
  const xfrm = firstDesc(el, 'xfrm')
  const off = firstKid(xfrm, 'off')
  const ext = firstKid(xfrm, 'ext')
  const x = numAttr(off, 'x')
  const y = numAttr(off, 'y')
  const w = numAttr(ext, 'cx')
  const h = numAttr(ext, 'cy')
  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

function rotationOf(el: Element | undefined): number | undefined {
  const rot = numAttr(firstDesc(el, 'xfrm'), 'rot')
  return rot === null ? undefined : rot / 60000
}

function toBox(raw: RawBox, cx: number, cy: number): PptxBox | null {
  if (cx <= 0 || cy <= 0) return null
  const w = raw.w / cx
  const h = raw.h / cy
  if (w <= 0 || h <= 0) return null
  return {
    x: raw.x / cx,
    y: raw.y / cy,
    w,
    h,
  }
}

function placeholderKey(sp: Element): string | null {
  const ph = firstDesc(sp, 'ph')
  if (!ph) return null
  return `${ph.getAttribute('type') ?? 'body'}:${ph.getAttribute('idx') ?? '0'}`
}

function defaultPtFor(phType: string | null): number {
  switch (phType) {
    case 'title':
    case 'ctrTitle':
      return 40
    case 'subTitle':
      return 24
    case 'ftr':
    case 'sldNum':
    case 'dt':
      return 12
    default:
      return 18
  }
}

function heuristicBox(phType: string | null, idx: string): PptxBox | null {
  switch (phType) {
    case 'title':
    case 'ctrTitle':
      return { x: 0.07, y: 0.06, w: 0.86, h: 0.18 }
    case 'subTitle':
      return { x: 0.12, y: 0.62, w: 0.76, h: 0.18 }
    case 'body':
    case 'obj':
      return { x: 0.08, y: 0.27 + Math.max(0, Number(idx) || 0) * 0.03, w: 0.84, h: 0.58 }
    default:
      return null
  }
}

function firstRunSize(root: Element): number | null {
  const rPr = descendants(root, 'rPr')[0]
  const sz = numAttr(rPr, 'sz')
  return sz && sz > 0 ? sz / 100 : null
}

function parseParagraphs(
  root: Element,
  defaultPt: number,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): PptxParagraph[] {
  const txBody = firstDesc(root, 'txBody')
  if (!txBody) return []
  const paragraphs: PptxParagraph[] = []
  for (const p of kids(txBody, 'p')) {
    const pPr = firstKid(p, 'pPr')
    const alignRaw = pPr?.getAttribute('algn')
    const align: PptxParagraph['align'] =
      alignRaw === 'ctr'
        ? 'center'
        : alignRaw === 'r'
          ? 'right'
          : alignRaw === 'just'
            ? 'justify'
            : 'left'
    const buChar = firstDesc(p, 'buChar')?.getAttribute('char')
    const bullet = buChar ? `${buChar} ` : firstDesc(p, 'buAutoNum') ? '• ' : null
    const runs: PptxRun[] = []
    for (const child of Array.from(p.children)) {
      if (child.localName === 'br') {
        runs.push({
          text: '\n',
          sizePt: defaultPt,
          bold: false,
          italic: false,
          underline: false,
        })
        continue
      }
      if (child.localName !== 'r' && child.localName !== 'fld') continue
      const text = descendants(child, 't')
        .map((t) => t.textContent ?? '')
        .join('')
      if (!text) continue
      const rPr = firstKid(child, 'rPr')
      const size = numAttr(rPr, 'sz')
      runs.push({
        text,
        sizePt: size && size > 0 ? size / 100 : defaultPt,
        bold: boolAttr(rPr, 'b'),
        italic: boolAttr(rPr, 'i'),
        underline: (() => {
          const u = rPr?.getAttribute('u')
          return !!u && u !== 'none'
        })(),
        color: solidFillOf(rPr, context),
      })
    }
    if (runs.length > 0) paragraphs.push({ align, bullet, runs })
  }
  return paragraphs
}

function lineStyle(
  spPr: Element | undefined,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
): Pick<PptxTextShape, 'line' | 'lineWidth'> {
  const ln = firstKid(spPr, 'ln')
  const color = solidFillOf(ln, context)
  if (!color) return {}
  const w = numAttr(ln, 'w') ?? 12700
  return { line: color, lineWidth: Math.max(1, Math.round(w / 12700)) }
}

function shapeRadius(spPr: Element | undefined): number | string | undefined {
  const preset = firstDesc(spPr, 'prstGeom')?.getAttribute('prst')
  if (preset === 'ellipse') return '50%'
  if (preset === 'roundRect') return 10
  return undefined
}

/** PPTX 自带的形状名(通常为“标题 1”“文本框 2”等),用于稳定批注锚点。 */
function shapeName(el: Element): string | undefined {
  const name = firstDesc(el, 'cNvPr')?.getAttribute('name')?.trim()
  return name || undefined
}

async function parseTextShape(
  sp: Element,
  layoutPlaceholders: Map<string, { box: RawBox; fontSize: number | null }>,
  cx: number,
  cy: number,
  context: ColorContext = DEFAULT_COLOR_CONTEXT,
  zip?: JSZip,
  rels?: Map<string, RelTarget>,
): Promise<PptxTextShape | null> {
  const spPr = firstKid(sp, 'spPr')
  const ph = firstDesc(sp, 'ph')
  // `p:ph` 的 type 可省略;PowerPoint 默认模板的正文占位符常只写 idx。
  // 若把缺失 type 当成“无版式”,整页正文会被吞掉,AI 全文预审也读不到。
  const phType = ph ? (ph.getAttribute('type') ?? 'body') : null
  const phKey = placeholderKey(sp)
  const inherited = phKey ? layoutPlaceholders.get(phKey) : undefined
  const raw = readBox(spPr) ?? inherited?.box ?? null
  const box = raw ? toBox(raw, cx, cy) : heuristicBox(phType, ph?.getAttribute('idx') ?? '0')
  if (!box) return null
  const defaultPt = firstRunSize(sp) ?? inherited?.fontSize ?? defaultPtFor(phType)
  const paragraphs = parseParagraphs(sp, defaultPt, context)
  if (paragraphs.length === 0) return null
  const fill = await fillOf(spPr, context, zip, rels)
  const bodyPr = firstDesc(sp, 'bodyPr')
  const anchor = bodyPr?.getAttribute('anchor')
  return {
    kind: 'text',
    ...box,
    name: shapeName(sp),
    rotation: rotationOf(spPr),
    paragraphs,
    fill,
    ...lineStyle(spPr, context),
    radius: shapeRadius(spPr),
    alignY: anchor === 'ctr' ? 'center' : anchor === 'b' ? 'bottom' : 'top',
    color: isDark(fill) ? '#f8fafc' : '#111827',
  }
}

function mimeOfPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  return 'image/png'
}

async function parsePictureShape(
  zip: JSZip,
  pic: Element,
  rels: Map<string, RelTarget>,
  cx: number,
  cy: number,
): Promise<PptxImageShape | null> {
  const raw = readBox(pic)
  const box = raw ? toBox(raw, cx, cy) : null
  if (!box) return null
  const blip = firstDesc(pic, 'blip')
  const embed = relAttr(blip, 'embed')
  if (!embed) return null
  const rel = rels.get(embed)
  if (!rel) return null
  const file = zip.file(rel.target)
  if (!file) return null
  const base64 = await file.async('base64')
  return {
    kind: 'image',
    ...box,
    name: shapeName(pic),
    rotation: rotationOf(pic),
    src: `data:${mimeOfPath(rel.target)};base64,${base64}`,
  }
}

function parseTableShape(frame: Element, cx: number, cy: number): PptxTableShape | null {
  const raw = readBox(frame)
  const box = raw ? toBox(raw, cx, cy) : null
  if (!box) return null
  const table = firstDesc(frame, 'tbl')
  if (!table) return null
  const rows = kids(table, 'tr').map((tr) =>
    kids(tr, 'tc').map((tc) =>
      descendants(tc, 't')
        .map((t) => t.textContent ?? '')
        .join(' '),
    ),
  )
  if (rows.length === 0) return null
  return { kind: 'table', ...box, name: shapeName(frame), rotation: rotationOf(frame), rows }
}

export async function parsePptxVisual(buffer: ArrayBuffer): Promise<PptxVisualDeck> {
  const JSZip = await loadZip()
  const zip = await JSZip.loadAsync(buffer)

  const presFile = zip.file('ppt/presentation.xml')
  const presXml = presFile ? await presFile.async('string') : ''
  const presDoc = presXml ? parseXml(presXml) : null
  const presRels = await readRels(zip, 'ppt/_rels/presentation.xml.rels', 'ppt')
  const themeDoc = await readThemeDoc(zip)
  const theme = parseThemeColors(themeDoc)

  let cx = DEFAULT_CX
  let cy = DEFAULT_CY
  const sldSz = presDoc ? firstDesc(presDoc.documentElement, 'sldSz') : undefined
  const rawCx = numAttr(sldSz, 'cx')
  const rawCy = numAttr(sldSz, 'cy')
  if (rawCx && rawCy && rawCx > 0 && rawCy > 0) {
    cx = rawCx
    cy = rawCy
  }

  const ordered: string[] = []
  const sldIds = presDoc ? descendants(presDoc.documentElement, 'sldId') : []
  for (const sldId of sldIds) {
    const rid = relAttr(sldId, 'id')
    const target = rid ? presRels.get(rid)?.target : undefined
    if (target) ordered.push(target)
  }
  // 某些 XML 解析器(含测试环境的 happy-dom)会丢弃带命名空间前缀的属性,
  // 这里按原始 XML 再抽一次 r:id;真实浏览器通常走上面的 DOM 分支。
  if (ordered.length === 0 && presXml) {
    for (const match of presXml.matchAll(/<p:sldId[^>]*\br:id="([^"]+)"/g)) {
      const target = presRels.get(match[1] ?? '')?.target
      if (target) ordered.push(target)
    }
  }
  if (ordered.length === 0) {
    zip.forEach((path, file) => {
      if (!file.dir && /^ppt\/slides\/slide\d+\.xml$/.test(path)) ordered.push(path)
    })
    ordered.sort((a, b) => {
      const an = Number(/slide(\d+)\.xml/.exec(a)?.[1] ?? 0)
      const bn = Number(/slide(\d+)\.xml/.exec(b)?.[1] ?? 0)
      return an - bn
    })
  }

  const slides: PptxVisualSlide[] = []
  for (let i = 0; i < ordered.length; i += 1) {
    const slidePath = ordered[i]
    if (!slidePath) continue
    const slideFile = zip.file(slidePath)
    if (!slideFile) continue
    const slideDoc = parseXml(await slideFile.async('string'))
    if (!slideDoc) continue
    const baseName = slidePath.slice(slidePath.lastIndexOf('/') + 1)
    const relPath = `ppt/slides/_rels/${baseName}.rels`
    const rels = await readRels(zip, relPath, 'ppt/slides')

    let layoutDoc: Document | null = null
    let layoutPath: string | undefined
    let layoutRels: Map<string, RelTarget> = new Map()
    let masterDoc: Document | null = null
    let masterRels: Map<string, RelTarget> = new Map()
    let notesPath: string | undefined
    for (const rel of rels.values()) {
      if (/\/slideLayout$/.test(rel.type)) {
        layoutPath = rel.target
        const file = zip.file(rel.target)
        if (file) layoutDoc = parseXml(await file.async('string'))
      } else if (/\/notesSlide$/.test(rel.type)) {
        notesPath = rel.target
      }
    }
    if (layoutPath) {
      const layoutBase = layoutPath.slice(layoutPath.lastIndexOf('/') + 1)
      layoutRels = await readRels(
        zip,
        `ppt/slideLayouts/_rels/${layoutBase}.rels`,
        'ppt/slideLayouts',
      )
      for (const rel of layoutRels.values()) {
        if (/\/slideMaster$/.test(rel.type)) {
          const file = zip.file(rel.target)
          if (file) masterDoc = parseXml(await file.async('string'))
          const masterBase = rel.target.slice(rel.target.lastIndexOf('/') + 1)
          masterRels = await readRels(
            zip,
            `ppt/slideMasters/_rels/${masterBase}.rels`,
            'ppt/slideMasters',
          )
          break
        }
      }
    }

    const placeholderMap = new Map<string, { box: RawBox; fontSize: number | null }>()
    if (layoutDoc) {
      for (const sp of descendants(layoutDoc.documentElement, 'sp')) {
        const key = placeholderKey(sp)
        const box = readBox(firstKid(sp, 'spPr'))
        if (key && box) placeholderMap.set(key, { box, fontSize: firstRunSize(sp) })
      }
    }

    const colorContext: ColorContext = { theme, clrMap: parseClrMap(masterDoc) }
    const background =
      readBackground(slideDoc, colorContext) ??
      readBackground(layoutDoc, colorContext) ??
      readBackground(masterDoc, colorContext) ??
      '#ffffff'
    const backgroundImage =
      (await readBackgroundImage(slideDoc, zip, rels)) ??
      (await readBackgroundImage(layoutDoc, zip, layoutRels)) ??
      (await readBackgroundImage(masterDoc, zip, masterRels))
    const shapes: PptxVisualShape[] = []
    for (const sp of descendants(slideDoc.documentElement, 'sp')) {
      const shape = await parseTextShape(sp, placeholderMap, cx, cy, colorContext, zip, rels)
      if (shape) shapes.push(shape)
    }
    for (const pic of descendants(slideDoc.documentElement, 'pic')) {
      const shape = await parsePictureShape(zip, pic, rels, cx, cy)
      if (shape) shapes.push(shape)
    }
    for (const frame of descendants(slideDoc.documentElement, 'graphicFrame')) {
      const shape = parseTableShape(frame, cx, cy)
      if (shape) shapes.push(shape)
    }

    let notes: string | null = null
    if (notesPath) {
      const notesFile = zip.file(notesPath)
      if (notesFile) {
        const notesDoc = parseXml(await notesFile.async('string'))
        const texts = notesDoc
          ? descendants(notesDoc.documentElement, 't')
              .map((t) => t.textContent ?? '')
              .filter(Boolean)
          : []
        if (texts.length > 0) notes = texts.join(' ')
      }
    }

    slides.push({ index: i + 1, background, backgroundImage, shapes, notes })
  }

  return { cx, cy, slides }
}

// ---------------------------------------------------------------- outline ----

export interface PptxOutlineSlide {
  readonly text: string
  readonly notes: string | null
}

/** 逐 slide 提取 <a:t> 文本与 notesSlide 备注(按编号对齐,OOXML 实际以关系映射,
 *  但主流生成器编号一致,降级大纲可接受)。 */
export async function parsePptx(buffer: ArrayBuffer): Promise<PptxOutlineSlide[]> {
  const JSZip = await loadZip()
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

  const slides: PptxOutlineSlide[] = []
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

export function PptxOutline({ data }: { data: ArrayBuffer }) {
  const t = useTranslations('chat')
  const [slides, setSlides] = React.useState<PptxOutlineSlide[] | null>(null)
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
    return <p className="p-3 text-label text-muted-foreground">{t('officeFailed')}</p>
  }
  if (!slides) {
    return (
      <p className="flex items-center gap-1.5 p-3 text-label text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('officeLoading')}
      </p>
    )
  }
  return (
    <ol className="max-h-[420px] overflow-auto p-3 text-body" data-testid="pptx-outline">
      {slides.map((s, i) => (
        <li key={i} data-testid="pptx-slide" className="mb-2">
          <p className="font-medium">{`#${i + 1} ${s.text || '—'}`}</p>
          {s.notes && (
            <p className="mt-0.5 text-label text-muted-foreground" data-testid="pptx-notes">
              {t('pptxNotes')}: {s.notes}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

// --------------------------------------------------------------- renderer ----

function shapeStyle(shape: PptxTextShape): React.CSSProperties {
  return {
    left: `${shape.x * 100}%`,
    top: `${shape.y * 100}%`,
    width: `${shape.w * 100}%`,
    height: `${shape.h * 100}%`,
    background: shape.fill,
    border: shape.line ? `${shape.lineWidth ?? 1}px solid ${shape.line}` : undefined,
    borderRadius: shape.radius,
    color: shape.color,
    transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
    alignItems:
      shape.alignY === 'center' ? 'center' : shape.alignY === 'bottom' ? 'flex-end' : 'flex-start',
  }
}

function TextShapeView({ shape }: { shape: PptxTextShape }) {
  return (
    <div
      className="absolute flex overflow-hidden"
      style={{
        ...shapeStyle(shape),
        padding: '0.8cqw',
        fontFamily:
          '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif',
      }}
    >
      <div className="w-full">
        {shape.paragraphs.map((paragraph, pi) => (
          <div
            key={pi}
            style={{
              textAlign: paragraph.align,
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {paragraph.bullet ? <span>{paragraph.bullet}</span> : null}
            {paragraph.runs.map((run, ri) => (
              <span
                key={ri}
                style={{
                  fontSize: `${(run.sizePt * 100) / SLIDE_BASE_PX}cqw`,
                  fontWeight: run.bold ? 700 : 400,
                  fontStyle: run.italic ? 'italic' : undefined,
                  textDecoration: run.underline ? 'underline' : undefined,
                  color: run.color,
                }}
              >
                {run.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TableShapeView({ shape }: { shape: PptxTableShape }) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${shape.x * 100}%`,
        top: `${shape.y * 100}%`,
        width: `${shape.w * 100}%`,
        height: `${shape.h * 100}%`,
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
      }}
    >
      <table className="h-full w-full table-fixed border-collapse">
        <tbody>
          {shape.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="overflow-hidden border border-slate-300 px-[0.5cqw] py-[0.3cqw] align-top"
                  style={{ fontSize: `${(12 * 100) / SLIDE_BASE_PX}cqw`, lineHeight: 1.2 }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function shapeNameOf(shape: PptxVisualShape, index: number): string {
  return shape.name || `#${index + 1}`
}

function shapeTextOf(shape: PptxVisualShape): string {
  if (shape.kind === 'text') {
    return shape.paragraphs
      .map((paragraph) =>
        paragraph.runs
          .map((run) => run.text)
          .join('')
          .trim(),
      )
      .filter(Boolean)
      .join('\n')
  }
  if (shape.kind === 'table') {
    return shape.rows.map((row) => row.join(' | ')).join('\n')
  }
  return ''
}

function ShapeHit({
  shape,
  label,
  slide,
  onSelect,
}: {
  shape: PptxVisualShape
  label: string
  slide: number
  onSelect: (slide: number, element: string) => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="absolute z-20 rounded-sm border-0 bg-transparent p-0 transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      style={{
        left: `${shape.x * 100}%`,
        top: `${shape.y * 100}%`,
        width: `${shape.w * 100}%`,
        height: `${shape.h * 100}%`,
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
      }}
      onClick={() => onSelect(slide, label)}
      data-testid="pptx-shape-hit"
      data-pptx-element={label}
    />
  )
}

function VisualSlideView({
  slide,
  cx,
  cy,
  onSelect,
  annotationPins = [],
  focusedAnnotationId = null,
  onAnnotationSelect,
  onAiReview,
  aiReviewBusy = false,
}: {
  slide: PptxVisualSlide
  cx: number
  cy: number
  onSelect?: (slide: number, element: string) => void
  annotationPins?: readonly PreviewAnnotationPin[]
  focusedAnnotationId?: string | null
  onAnnotationSelect?: (id: string) => void
  onAiReview?: () => void
  aiReviewBusy?: boolean
}) {
  const slidePins = annotationPins.filter((pin) => pin.kind === 'pptx' && pin.slide === slide.index)
  const pinsByShape = new Map<number, PreviewAnnotationPin[]>()
  for (const pin of slidePins) {
    const shapeIndex = pin.element
      ? slide.shapes.findIndex((shape, index) => shapeNameOf(shape, index) === pin.element)
      : -1
    if (shapeIndex < 0) continue
    const list = pinsByShape.get(shapeIndex) ?? []
    list.push(pin)
    pinsByShape.set(shapeIndex, list)
  }
  const stacks = new Map<string, number>()

  return (
    <figure data-testid="pptx-visual-slide" className="mx-auto w-full max-w-[880px]">
      <div
        className="relative w-full overflow-hidden rounded-sm shadow-sm ring-1 ring-border"
        style={
          {
            aspectRatio: `${cx} / ${cy}`,
            backgroundColor: slide.background,
            backgroundImage: slide.backgroundImage,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            containerType: 'inline-size',
          } as React.CSSProperties
        }
      >
        {slide.shapes.map((shape, index) => {
          if (shape.kind === 'text') return <TextShapeView key={index} shape={shape} />
          if (shape.kind === 'table') return <TableShapeView key={index} shape={shape} />
          return (
            // 版式画布里的图片是 PPTX 内联的 data URL,尺寸/位置由 OOXML 决定,next/image 无法优化
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={shape.src}
              alt=""
              className="absolute object-contain"
              style={{
                left: `${shape.x * 100}%`,
                top: `${shape.y * 100}%`,
                width: `${shape.w * 100}%`,
                height: `${shape.h * 100}%`,
                transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
              }}
            />
          )
        })}
        {onSelect
          ? slide.shapes.map((shape, index) => (
              <ShapeHit
                key={`hit-${index}`}
                shape={shape}
                label={shapeNameOf(shape, index)}
                slide={slide.index}
                onSelect={onSelect}
              />
            ))
          : null}
        {Array.from(pinsByShape.entries()).map(([shapeIndex, pins]) => {
          const shape = slide.shapes[shapeIndex]
          if (!shape) return null
          const hasOpen = pins.some((pin) => pin.status === 'open')
          return (
            <div
              key={`annotation-shape-${shapeIndex}`}
              className={
                hasOpen
                  ? 'pointer-events-none absolute z-10 border-2 border-violet-500/80 bg-violet-500/5'
                  : 'pointer-events-none absolute z-10 border-2 border-emerald-500/70 bg-emerald-500/5'
              }
              style={{
                left: `${shape.x * 100}%`,
                top: `${shape.y * 100}%`,
                width: `${shape.w * 100}%`,
                height: `${shape.h * 100}%`,
                transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
              }}
              data-testid="pptx-annotation-shape"
            />
          )
        })}
        {slidePins.map((pin) => {
          const stackKey = pin.element ?? `slide-${slide.index}`
          const stack = stacks.get(stackKey) ?? 0
          stacks.set(stackKey, stack + 1)
          const shapeIndex = pin.element
            ? slide.shapes.findIndex((shape, index) => shapeNameOf(shape, index) === pin.element)
            : -1
          const shape = shapeIndex >= 0 ? slide.shapes[shapeIndex] : undefined
          const left = shape ? Math.min(96, Math.max(2, (shape.x + shape.w) * 100)) : 96
          const top = shape
            ? Math.min(88, Math.max(4, shape.y * 100 + 2 + stack * 6))
            : 6 + stack * 7
          return (
            <button
              key={pin.id}
              type="button"
              aria-label={`${pin.label}: ${pin.body}`}
              title={pin.body}
              onClick={(event) => {
                event.stopPropagation()
                onAnnotationSelect?.(pin.id)
              }}
              data-testid="pptx-annotation-pin"
              data-annotation-id={pin.id}
              data-annotation-status={pin.status}
              data-annotation-focused={focusedAnnotationId === pin.id ? 'true' : undefined}
              className={[
                'absolute z-30 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] font-semibold text-white shadow-md ring-2 ring-white/80 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500',
                pin.status === 'resolved' ? 'bg-emerald-600' : 'bg-violet-600',
                focusedAnnotationId === pin.id ? 'ring-4 ring-violet-300' : '',
              ].join(' ')}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="tabular-nums">{stack + 1}</span>
            </button>
          )
        })}
        {slide.shapes.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-label text-muted-foreground">
            —
          </p>
        ) : null}
      </div>
      <div className="mt-1 flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
        <span>第 {slide.index} 张</span>
        {onAiReview ? (
          <button
            type="button"
            onClick={onAiReview}
            disabled={aiReviewBusy}
            className="flex items-center gap-1 rounded bg-violet-600 px-1.5 py-0.5 font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
            aria-label={`AI 预审第 ${slide.index} 张`}
          >
            {aiReviewBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            AI 预审
          </button>
        ) : null}
      </div>
      {(slide.notes || slide.index > 0) && (
        <figcaption className="mt-1 flex items-start gap-2 px-1 text-label text-muted-foreground">
          <span className="shrink-0 tabular-nums">#{slide.index}</span>
          {slide.notes ? <span className="line-clamp-2">{slide.notes}</span> : null}
        </figcaption>
      )}
    </figure>
  )
}

export function PptxPreview({
  data,
  annotationPins = [],
  focusedAnnotationId = null,
  onAnnotationSelect,
  documentId,
  documentName,
  onAnnotationsMutated,
}: {
  data: ArrayBuffer
  annotationPins?: readonly PreviewAnnotationPin[]
  focusedAnnotationId?: string | null
  onAnnotationSelect?: (id: string) => void
  documentId?: string
  documentName?: string
  onAnnotationsMutated?: () => void
}) {
  const t = useTranslations('chat')
  const [deck, setDeck] = React.useState<PptxVisualDeck | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [aiReviewSlide, setAiReviewSlide] = React.useState<number | null>(null)
  const [aiFullReviewBusy, setAiFullReviewBusy] = React.useState(false)
  const [selected, setSelected] = React.useState<{
    readonly slide: number
    readonly element: string
  } | null>(null)

  const runAiReview = React.useCallback(
    async (slide: PptxVisualSlide) => {
      if (!documentId || aiReviewSlide !== null || aiFullReviewBusy) return
      const elements = slide.shapes
        .map((shape, index) => ({ name: shapeNameOf(shape, index), text: shapeTextOf(shape) }))
        .filter((item) => item.text)
      const text = elements.map((item) => `[${item.name}]\n${item.text}`).join('\n\n')
      if (text.length < 20) {
        toast.error('这张幻灯片没有可审阅的文字')
        return
      }
      setAiReviewSlide(slide.index)
      try {
        const findings = await reviewDocumentFragment({
          title: documentName || 'PPTX 演示文稿',
          anchor: { kind: 'pptx', slide: slide.index },
          text: text.slice(0, 12_000),
          elements,
        })
        if (findings.length === 0) {
          toast.success('AI 预审完成：这张没有发现需要标注的问题')
          return
        }
        const fallback = elements[0]?.name
        const groups = new Map<string, AiReviewFinding[]>()
        for (const finding of findings) {
          const element =
            finding.element && elements.some((item) => item.name === finding.element)
              ? finding.element
              : fallback
          if (!element) continue
          const group = groups.get(element) ?? []
          group.push(finding)
          groups.set(element, group)
        }
        let created = 0
        for (const [element, group] of groups) {
          const saved = await saveAiFindings({
            documentId,
            label: `第 ${slide.index} 张 · ${element} · AI 预审`,
            anchorKind: 'pptx',
            anchor: { kind: 'pptx', slide: slide.index, element },
            findings: group,
          })
          created += saved.created.length
        }
        onAnnotationsMutated?.()
        toast.success(
          created > 0 ? `AI 预审发现 ${created} 条新意见` : 'AI 预审没有新增意见（同一位置已去重）',
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'AI 预审失败，请稍后重试')
      } finally {
        setAiReviewSlide(null)
      }
    },
    [aiFullReviewBusy, aiReviewSlide, documentId, documentName, onAnnotationsMutated],
  )

  const runFullAiReview = React.useCallback(async () => {
    if (!documentId || !deck || aiReviewSlide !== null || aiFullReviewBusy) return
    setAiFullReviewBusy(true)
    try {
      const blocks: {
        anchor: Record<string, unknown>
        text: string
        elements: { name: string; text: string }[]
      }[] = []
      let totalChars = 0
      for (const slide of deck.slides.slice(0, 20)) {
        if (totalChars >= 30_000) break
        const elements = slide.shapes
          .map((shape, index) => ({ name: shapeNameOf(shape, index), text: shapeTextOf(shape) }))
          .filter((item) => item.text)
        const text = elements.map((item) => `[${item.name}]\n${item.text}`).join('\n\n')
        if (text.length < 20) continue
        const remaining = 30_000 - totalChars
        blocks.push({
          anchor: { kind: 'pptx', slide: slide.index },
          text: text.slice(0, remaining),
          elements,
        })
        totalChars += Math.min(text.length, remaining)
      }
      if (blocks.length === 0) {
        toast.error('这份演示文稿没有可审阅的文字')
        return
      }
      const findings = await reviewDocumentBlocks({
        title: documentName || 'PPTX 演示文稿',
        blocks,
      })
      if (findings.length === 0) {
        toast.success(`AI 已通读 ${blocks.length} 张幻灯片：没有发现需要标注的问题`)
        return
      }
      const groups = new Map<
        string,
        { slide: PptxVisualSlide; element: string; items: AiReviewFinding[] }
      >()
      for (const finding of findings) {
        const blockNumber = finding.block
        if (!blockNumber || blockNumber < 1 || blockNumber > blocks.length) continue
        const block = blocks[blockNumber - 1]
        if (!block) continue
        const slide = deck.slides.find((item) => item.index === Number(block.anchor.slide))
        if (!slide) continue
        const elements = block.elements
        const element =
          finding.element && elements.some((item) => item.name === finding.element)
            ? finding.element
            : elements[0]?.name
        if (!element) continue
        const key = `${slide.index}:${element}`
        const group = groups.get(key) ?? { slide, element, items: [] }
        group.items.push(finding)
        groups.set(key, group)
      }
      let created = 0
      for (const { slide, element, items } of groups.values()) {
        const saved = await saveAiFindings({
          documentId,
          label: `第 ${slide.index} 张 · ${element} · AI 全文`,
          anchorKind: 'pptx',
          anchor: { kind: 'pptx', slide: slide.index, element },
          findings: items,
        })
        created += saved.created.length
      }
      onAnnotationsMutated?.()
      toast.success(
        created > 0
          ? `AI 已通读 ${blocks.length} 张幻灯片，发现 ${created} 条新意见`
          : `AI 已通读 ${blocks.length} 张幻灯片：同一位置的意见已存在`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 全文预审失败，请稍后重试')
    } finally {
      setAiFullReviewBusy(false)
    }
  }, [aiFullReviewBusy, aiReviewSlide, deck, documentId, documentName, onAnnotationsMutated])

  React.useEffect(() => {
    let cancelled = false
    setFailed(false)
    setSelected(null)
    parsePptxVisual(data)
      .then((d) => {
        if (!cancelled) setDeck(d)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [data])

  if (failed || !deck) {
    if (failed) {
      return (
        <div>
          <p className="p-3 text-label text-muted-foreground">{t('officeFailed')}</p>
          <PptxOutline data={data} />
        </div>
      )
    }
    return (
      <p className="flex items-center gap-1.5 p-3 text-label text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('officeLoading')}
      </p>
    )
  }

  return (
    <div data-testid="pptx-visual-deck">
      {selected ? (
        <div className="border-b bg-background p-2" data-testid="pptx-anchor-capture">
          <AnnotationAnchorCapture
            anchor={{ kind: 'pptx', slide: selected.slide, element: selected.element }}
            source="pptx-element"
            onDispose={() => setSelected(null)}
          />
        </div>
      ) : null}
      {documentId && deck.slides.length > 1 ? (
        <div className="flex justify-end border-b bg-background px-3 py-1.5">
          <button
            type="button"
            onClick={() => void runFullAiReview()}
            disabled={aiReviewSlide !== null || aiFullReviewBusy}
            aria-label="AI 全文预审"
            className="flex items-center gap-1 rounded-md border border-violet-300 px-2 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            {aiFullReviewBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI 全文预审
          </button>
        </div>
      ) : null}
      <div className="max-h-[480px] space-y-4 overflow-auto bg-muted/30 p-3">
        {deck.slides.map((slide) => (
          <VisualSlideView
            key={slide.index}
            slide={slide}
            cx={deck.cx}
            cy={deck.cy}
            onSelect={(slideNumber, element) => setSelected({ slide: slideNumber, element })}
            annotationPins={annotationPins}
            focusedAnnotationId={focusedAnnotationId}
            onAnnotationSelect={onAnnotationSelect}
            onAiReview={documentId ? () => void runAiReview(slide) : undefined}
            aiReviewBusy={aiReviewSlide === slide.index}
          />
        ))}
      </div>
      <details className="border-t bg-background px-3 py-2 text-label text-muted-foreground">
        <summary className="cursor-pointer select-none">{t('pptxOutline')}</summary>
        <div className="mt-2">
          <PptxOutline data={data} />
        </div>
      </details>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
