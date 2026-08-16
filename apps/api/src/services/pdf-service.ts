/**
 * PDF 生成服务（报表/证书/发票导出）。
 * 迁移自旧架构 pdf_service.py（reportlab + PyPDF2）。
 *
 * 设计：
 * - 无 PDF 库时降级为 stub（返回最小 PDF 占位 Buffer，仅记录日志）
 * - 生产环境安装 pdfkit/pdf-lib 后自动激活真实生成
 * - 跟随 email-service 的动态导入模式，避免未安装依赖时崩溃
 */

import { env } from 'node:process'
import { existsSync } from 'node:fs'
import { Writable, type WritableOptions } from 'node:stream'

import { logger } from '../utils/logger.js'

// 中文字体探测(2026-08-01 立:修复 PDF 中文乱码,Helvetica 不含中文字符集)
// Windows 优先 .ttf 格式(pdfkit 0.19 对 .ttc 集合格式解析失败,doc.font() 时抛错)
// 仿宋(simfang)做正文 + 黑体(simhei)做标题,中文文档标准搭配
// Linux wqy(文泉驿),Mac PingFang(.ttc,pdfkit 可能支持,失败则 fallback)
// 全部不存在 → fallback Helvetica(英文,中文会显示方块,但至少不报错)
const CN_FONT_CANDIDATES = [
  {
    regular: 'C:/Windows/Fonts/simfang.ttf',
    bold: 'C:/Windows/Fonts/simhei.ttf',
    name: 'cnsong',
  },
  {
    regular: 'C:/Windows/Fonts/simhei.ttf',
    bold: 'C:/Windows/Fonts/simhei.ttf',
    name: 'cnhei',
  },
  {
    regular: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    bold: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    name: 'wqy',
  },
  {
    regular: '/System/Library/Fonts/PingFang.ttc',
    bold: '/System/Library/Fonts/PingFang.ttc',
    name: 'pingfang',
  },
]

const cnFont = CN_FONT_CANDIDATES.find((f) => existsSync(f.regular) && existsSync(f.bold)) ?? null

/** 注册中文字体到 pdfkit 文档(注册后可用 doc.font(name) 切换)。 */
function registerChineseFonts(doc: PDFDocumentLike): void {
  if (!cnFont) return
  // PDFDocumentLike 接口未声明 registerFont,用类型断言扩展
  const d = doc as PDFDocumentLike & {
    registerFont(name: string, path: string): void
  }
  try {
    d.registerFont(cnFont.name, cnFont.regular)
    d.registerFont(`${cnFont.name}-bold`, cnFont.bold)
  } catch (err) {
    // ttc 字体注册失败时降级 Helvetica(中文会显示方块,但不阻塞导出)
    logger.warn('[pdf-service] registerFont failed, fallback to Helvetica', {
      err: (err as Error).message,
    })
  }
}

/** 获取正文字体名(有中文字体用中文字体,否则 Helvetica)。 */
function bodyFont(): string {
  return cnFont?.name ?? 'Helvetica'
}

/** 获取粗体字体名(有中文字体用中文字体 bold,否则 Helvetica-Bold)。 */
function boldFont(): string {
  return cnFont ? `${cnFont.name}-bold` : 'Helvetica-Bold'
}

// 最小类型描摹，避免未安装时类型解析失败
type PDFTextOptions = {
  align?: 'left' | 'center' | 'right' | 'justify'
  width?: number
  height?: number
  lineBreak?: boolean
  ellipsis?: boolean | string
}

interface PDFDocumentLike {
  pipe(writable: NodeJS.WritableStream): void
  fontSize(n: number): PDFDocumentLike
  font(name: string): PDFDocumentLike
  fillColor(color: string): PDFDocumentLike
  strokeColor(color: string): PDFDocumentLike
  lineWidth(n: number): PDFDocumentLike
  text(content: string, x?: number, y?: number, options?: PDFTextOptions): PDFDocumentLike
  moveTo(x: number, y: number): PDFDocumentLike
  lineTo(x: number, y: number): PDFDocumentLike
  stroke(): PDFDocumentLike
  rect(x: number, y: number, w: number, h: number): PDFDocumentLike
  fill(color?: string): PDFDocumentLike
  addPage(): PDFDocumentLike
  end(): void
  on(event: 'end' | 'finish' | 'error', cb: () => void): PDFDocumentLike
}

interface PDFKitModule {
  default: new (opts: { size: string; margin: number }) => PDFDocumentLike
}

export interface CertificatePDFInput {
  certificateNo: string
  title: string
  recipientName: string
  courseName?: string
  issuedAt: Date
}

export interface InvoicePDFInput {
  invoiceNo: string
  title: string
  amount: string
  email?: string
  items?: Array<{ name: string; quantity: number; price: string }>
}

export interface ReportPDFInput {
  title: string
  subtitle?: string
  sections: Array<{ heading: string; content: string }>
  generatedAt: Date
}

export interface PDFResult {
  buffer: Buffer
  stub: boolean
  error?: string
}

/**
 * 动态加载 pdfkit（避免未安装时崩溃）。
 * 调用方负责捕获 stub 场景。
 */
async function loadPdfKit(): Promise<PDFKitModule | null> {
  const moduleName = 'pdfkit'
  const mod = (await import(moduleName).catch(() => null)) as PDFKitModule | null
  return mod
}

/** 生成证书 PDF。 */
export async function generateCertificatePDF(input: CertificatePDFInput): Promise<PDFResult> {
  const mod = await loadPdfKit()
  if (!mod) {
    return stub(
      `[certificate-stub] ${input.certificateNo} ${input.title} -> ${input.recipientName}`,
    )
  }
  return new Promise<PDFResult>((resolve) => {
    try {
      const doc = new mod.default({ size: 'A4', margin: 50 })
      const buf = new WritableBuffer()
      buf.on('finish', () => resolve({ buffer: buf.getBuffer(), stub: false }))
      doc.pipe(buf as unknown as NodeJS.WritableStream)

      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(input.title, { align: 'center' } as never)
      doc.fontSize(14).font('Helvetica').text(`证书编号: ${input.certificateNo}`, 50, 120)
      doc.text(`受证人: ${input.recipientName}`, 50, 150)
      if (input.courseName) doc.text(`课程: ${input.courseName}`, 50, 180)
      doc.text(`签发日期: ${input.issuedAt.toISOString().slice(0, 10)}`, 50, 210)
      doc.end()
    } catch (err) {
      logger.error('[pdf-service] generateCertificatePDF error:', { err: err as Error })
      resolve(stub(`[certificate-stub-error] ${input.certificateNo} ${input.title}`))
    }
  })
}

/** 生成发票 PDF。 */
export async function generateInvoicePDF(input: InvoicePDFInput): Promise<PDFResult> {
  const mod = await loadPdfKit()
  if (!mod) {
    return stub(`[invoice-stub] ${input.invoiceNo} ${input.title} ${input.amount}`)
  }
  return new Promise<PDFResult>((resolve) => {
    try {
      const doc = new mod.default({ size: 'A4', margin: 50 })
      const buf = new WritableBuffer()
      buf.on('finish', () => resolve({ buffer: buf.getBuffer(), stub: false }))
      doc.pipe(buf as unknown as NodeJS.WritableStream)

      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('Invoice / 发票', { align: 'center' } as never)
      doc.fontSize(12).font('Helvetica').text(`编号: ${input.invoiceNo}`, 50, 100)
      doc.text(`抬头: ${input.title}`, 50, 120)
      doc.text(`金额: ${input.amount}`, 50, 140)
      if (input.email) doc.text(`邮箱: ${input.email}`, 50, 160)
      if (input.items) {
        let y = 200
        for (const item of input.items) {
          doc.text(`${item.name} x${item.quantity} = ${item.price}`, 50, y)
          y += 20
        }
      }
      doc.end()
    } catch (err) {
      logger.error('[pdf-service] generateInvoicePDF error:', { err: err as Error })
      resolve(stub(`[invoice-stub-error] ${input.invoiceNo} ${input.title}`))
    }
  })
}

/** 生成报表 PDF(2026-08-01 重写:中文字体支持 + 精美排版)。 */
export async function generateReportPDF(input: ReportPDFInput): Promise<PDFResult> {
  const mod = await loadPdfKit()
  if (!mod) {
    return stub(`[report-stub] ${input.title} (${input.sections.length} sections)`)
  }
  return new Promise<PDFResult>((resolve) => {
    try {
      // A4 = 595 x 842 pt,margin 50,可用宽度 495
      const doc = new mod.default({ size: 'A4', margin: 50 })
      const buf = new WritableBuffer()
      buf.on('finish', () => resolve({ buffer: buf.getBuffer(), stub: false }))
      doc.pipe(buf as unknown as NodeJS.WritableStream)

      // 注册中文字体(注册后 doc.font(name) 切换)
      registerChineseFonts(doc as unknown as PDFDocumentLike)

      // 品牌色(深蓝 #1e40af 主色 + 浅蓝 #dbeafe 强调 + 灰色 #6b7280 次要)
      const COLOR_PRIMARY = '#1e40af'
      const COLOR_ACCENT = '#dbeafe'
      const COLOR_TEXT = '#1f2937'
      const COLOR_MUTED = '#6b7280'
      const COLOR_BORDER = '#e5e7eb'

      // ====================== 封面页 ======================
      // 顶部品牌色横带(高 6pt,贯穿整宽)
      doc.rect(0, 800, 595, 42).fill(COLOR_PRIMARY).fillColor('#ffffff')

      // 主标题(居中,微软雅黑 Bold 28pt)
      doc
        .fontSize(28)
        .font(boldFont())
        .fillColor(COLOR_TEXT)
        .text(input.title, 50, 320, { align: 'center', width: 495 } as never)

      // 副标题(居中,微软雅黑 13pt 灰色)
      if (input.subtitle) {
        doc
          .fontSize(13)
          .font(bodyFont())
          .fillColor(COLOR_MUTED)
          .text(input.subtitle, 50, 370, { align: 'center', width: 495 } as never)
      }

      // 中间装饰横线(品牌色,120pt 宽,居中)
      doc.rect(237, 410, 120, 2).fill(COLOR_PRIMARY)

      // 底部品牌署名
      doc
        .fontSize(11)
        .font(bodyFont())
        .fillColor(COLOR_MUTED)
        .text('IHUI AI 平台 · 智能生涯指导', 50, 760, {
          align: 'center',
          width: 495,
        } as never)

      // ====================== 内容页(每个 section 一段) ======================
      doc.addPage()

      let y = 60
      const pageBottom = 760
      for (const section of input.sections) {
        // 分页检查:剩余空间不足 120pt → 新页
        if (y > pageBottom - 120) {
          doc.addPage()
          y = 60
        }

        // 章节卡片背景(浅蓝底色,高度自适应估算:每 25 字符 +1 行,行高 18pt)
        const contentLines = Math.ceil(section.content.length / 35)
        const cardHeight = Math.min(220, 40 + contentLines * 18 + 16)
        doc
          .rect(50, y - 8, 495, cardHeight)
          .fill(COLOR_ACCENT)
          .fillColor(COLOR_TEXT)

        // 左侧品牌色竖线(3pt 宽,与卡片同高)
        doc.rect(50, y - 8, 3, cardHeight).fill(COLOR_PRIMARY)

        // 章节标题(微软雅黑 Bold 14pt 品牌色)
        doc
          .fontSize(14)
          .font(boldFont())
          .fillColor(COLOR_PRIMARY)
          .text(section.heading, 66, y, { width: 470 } as never)
        y += 26

        // 章节内容(微软雅黑 11pt 深灰,行高 1.6)
        doc
          .fontSize(11)
          .font(bodyFont())
          .fillColor(COLOR_TEXT)
          .text(section.content, 66, y, {
            width: 470,
            lineGap: 4,
          } as never)

        // 估算内容高度,移动 y(每行 ~18pt,最少 40pt 间距)
        const estimatedHeight = contentLines * 18 + 16
        y += Math.max(estimatedHeight, 60)
      }

      // ====================== 页脚(最后一页) ======================
      // 顶部细分隔线
      doc
        .moveTo(50, y + 10)
        .lineTo(545, y + 10)
        .strokeColor(COLOR_BORDER)
        .lineWidth(0.5)
        .stroke()
      // 页脚文字
      doc
        .fontSize(9)
        .font(bodyFont())
        .fillColor(COLOR_MUTED)
        .text(
          `本报告由 IHUI AI 平台生成 · ${input.generatedAt.toISOString().slice(0, 10)}`,
          50,
          y + 18,
          { align: 'center', width: 495 } as never,
        )

      doc.end()
    } catch (err) {
      // pdfkit 实例化/调用失败(字体缺失/WritableBuffer 接口不全等),降级到 stub 避免阻塞导出链路
      logger.error('[pdf-service] generateReportPDF error:', { err: err as Error })
      resolve(stub(`[report-stub-error] ${input.title} (${input.sections.length} sections)`))
    }
  })
}

/**
 * 为 PDF 添加水印（基于文本）。
 * 无 pdf-lib 时返回原 Buffer。
 */
export async function addWatermark(pdfBuffer: Buffer, text: string): Promise<Buffer> {
  const moduleName = 'pdf-lib'
  const mod = (await import(moduleName).catch(() => null)) as PdfLibModule | null
  if (!mod) {
    console.info(`[pdf-watermark-stub] text=${text}, size=${pdfBuffer.length}`)
    return pdfBuffer
  }
  const doc = await mod.PDFDocument.load(pdfBuffer)
  const pages = (doc as unknown as { getPageCount?(): number }).getPageCount?.() ?? 1
  for (let i = 0; i < pages; i++) {
    const page = (doc as unknown as { getPage(idx: number): PdfLibPage }).getPage(i)
    page.drawText(text, {
      x: 200,
      y: 400,
      size: 48,
      opacity: 0.3,
      rotate: { type: 'degrees', angle: -45 } as never,
    } as never)
  }
  const bytes = await doc.save()
  return Buffer.from(bytes)
}

/** pdf-lib 最小类型描摹。 */
interface PdfLibDoc {
  save(): Promise<Uint8Array>
}
interface PdfLibPage {
  drawText(t: string, o: unknown): void
}
interface PdfLibModule {
  PDFDocument: { load(buf: Buffer): Promise<PdfLibDoc> }
}

/** 判断 PDF 服务是否已配置（安装 pdfkit）。 */
export function isPdfConfigured(): boolean {
  return env.PDF_DISABLED !== 'true'
}

// =============================================================================
// 内部工具
// =============================================================================

/**
 * 简易 Writable 流，收集 PDF 输出为 Buffer 数组。
 * 继承 node:stream.Writable 正确实现 pipe 协议,让 pdfkit 触发 'finish' 事件。
 * 之前版本(自实现 write/end/on/once)的 end() 是 noop,导致 pdfkit 误以为"流已 flush",
 * 最终 chunk 永远不刷出,只返回 208 字节 stub PDF。
 */
class WritableBuffer extends Writable {
  private chunks: Buffer[] = []

  constructor(opts: WritableOptions = {}) {
    super(opts)
  }

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    cb: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    cb()
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.chunks)
  }
}

/** 生成 stub PDF（最小合法 PDF 占位）。 */
function stub(log: string): PDFResult {
  console.info(log)
  // 最小 PDF 占位（单页空白）
  const content =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF'
  return { buffer: Buffer.from(content), stub: true }
}
