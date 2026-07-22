/**
 * PDF 处理工具(合并 / 拆分 / 水印)。
 * 基于 pdf-lib(轻量纯 JS),对已有 PDF Buffer 做真实处理。
 * 纯函数:输入 Buffer,输出 Buffer,不做任何文件 I/O。
 */
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'

/** 合并多个 PDF Buffer 为单个 PDF。 */
export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create()
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf)
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }
  return Buffer.from(await merged.save())
}

/** 按页码范围(如 "1-3,5,7-9")提取指定页面到新 PDF。 */
export async function splitPdf(buffer: Buffer, ranges: string): Promise<Buffer> {
  const src = await PDFDocument.load(buffer)
  const indices = parseRanges(ranges, src.getPageCount())
  if (indices.length === 0) throw new Error('未匹配到任何有效页码')
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, indices)
  for (const page of pages) out.addPage(page)
  return Buffer.from(await out.save())
}

/** 给 PDF 每页添加居中半透明文本水印(旋转 -45°)。 */
export async function watermarkPdf(
  buffer: Buffer,
  text: string,
  opts: { opacity?: number; fontSize?: number; rotation?: number } = {},
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = opts.fontSize ?? 50
  const opacity = opts.opacity ?? 0.25
  const angle = opts.rotation ?? -45
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(angle),
    })
  }
  return Buffer.from(await doc.save())
}

/** 解析 "1-3,5,7-9" 为 0-based 页码索引数组(越界页码自动忽略)。 */
function parseRanges(ranges: string, totalPages: number): number[] {
  const result: number[] = []
  for (const part of ranges.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.includes('-')) {
      const segs = trimmed.split('-')
      const a = parseInt(segs[0] ?? '', 10)
      const b = parseInt(segs[1] ?? '', 10)
      if (Number.isNaN(a) || Number.isNaN(b)) continue
      for (let i = a; i <= b; i++) {
        if (i >= 1 && i <= totalPages) result.push(i - 1)
      }
    } else {
      const n = parseInt(trimmed, 10)
      if (!Number.isNaN(n) && n >= 1 && n <= totalPages) result.push(n - 1)
    }
  }
  return result
}
