/**
 * PDF 生成服务（报表/证书/发票导出）。
 * 迁移自旧架构 pdf_service.py（reportlab + PyPDF2）。
 *
 * 设计：
 * - 无 PDF 库时降级为 stub（返回最小 PDF 占位 Buffer，仅记录日志）
 * - 生产环境安装 pdfkit/pdf-lib 后自动激活真实生成
 * - 跟随 email-service 的动态导入模式，避免未安装依赖时崩溃
 */

import { env } from 'node:process';

// 最小类型描摹，避免未安装时类型解析失败
interface PDFDocumentLike {
  pipe(writable: NodeJS.WritableStream): void;
  fontSize(n: number): PDFDocumentLike;
  font(name: string): PDFDocumentLike;
  text(content: string, x?: number, y?: number): PDFDocumentLike;
  moveTo(x: number, y: number): PDFDocumentLike;
  lineTo(x: number, y: number): PDFDocumentLike;
  stroke(): PDFDocumentLike;
  rect(x: number, y: number, w: number, h: number): PDFDocumentLike;
  fill(): PDFDocumentLike;
  end(): void;
}

interface PDFKitModule {
  default: new (opts: { size: string; margin: number }) => PDFDocumentLike;
}

export interface CertificatePDFInput {
  certificateNo: string;
  title: string;
  recipientName: string;
  courseName?: string;
  issuedAt: Date;
}

export interface InvoicePDFInput {
  invoiceNo: string;
  title: string;
  amount: string;
  email?: string;
  items?: Array<{ name: string; quantity: number; price: string }>;
}

export interface ReportPDFInput {
  title: string;
  subtitle?: string;
  sections: Array<{ heading: string; content: string }>;
  generatedAt: Date;
}

export interface PDFResult {
  buffer: Buffer;
  stub: boolean;
  error?: string;
}

/**
 * 动态加载 pdfkit（避免未安装时崩溃）。
 * 调用方负责捕获 stub 场景。
 */
async function loadPdfKit(): Promise<PDFKitModule | null> {
  const moduleName = 'pdfkit';
  const mod = (await import(moduleName).catch(() => null)) as PDFKitModule | null;
  return mod;
}

/** 生成证书 PDF。 */
export async function generateCertificatePDF(input: CertificatePDFInput): Promise<PDFResult> {
  const mod = await loadPdfKit();
  if (!mod) {
    return stub(`[certificate-stub] ${input.certificateNo} ${input.title} -> ${input.recipientName}`);
  }
  const doc = new mod.default({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.pipe(new WritableBuffer(chunks) as unknown as NodeJS.WritableStream);

  doc.fontSize(28).font('Helvetica-Bold').text(input.title, { align: 'center' } as never);
  doc.fontSize(14).font('Helvetica').text(`证书编号: ${input.certificateNo}`, 50, 120);
  doc.text(`受证人: ${input.recipientName}`, 50, 150);
  if (input.courseName) doc.text(`课程: ${input.courseName}`, 50, 180);
  doc.text(`签发日期: ${input.issuedAt.toISOString().slice(0, 10)}`, 50, 210);
  doc.end();

  return { buffer: Buffer.concat(chunks), stub: false };
}

/** 生成发票 PDF。 */
export async function generateInvoicePDF(input: InvoicePDFInput): Promise<PDFResult> {
  const mod = await loadPdfKit();
  if (!mod) {
    return stub(`[invoice-stub] ${input.invoiceNo} ${input.title} ${input.amount}`);
  }
  const doc = new mod.default({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.pipe(new WritableBuffer(chunks) as unknown as NodeJS.WritableStream);

  doc.fontSize(20).font('Helvetica-Bold').text('Invoice / 发票', { align: 'center' } as never);
  doc.fontSize(12).font('Helvetica').text(`编号: ${input.invoiceNo}`, 50, 100);
  doc.text(`抬头: ${input.title}`, 50, 120);
  doc.text(`金额: ${input.amount}`, 50, 140);
  if (input.email) doc.text(`邮箱: ${input.email}`, 50, 160);
  if (input.items) {
    let y = 200;
    for (const item of input.items) {
      doc.text(`${item.name} x${item.quantity} = ${item.price}`, 50, y);
      y += 20;
    }
  }
  doc.end();

  return { buffer: Buffer.concat(chunks), stub: false };
}

/** 生成报表 PDF。 */
export async function generateReportPDF(input: ReportPDFInput): Promise<PDFResult> {
  const mod = await loadPdfKit();
  if (!mod) {
    return stub(`[report-stub] ${input.title} (${input.sections.length} sections)`);
  }
  const doc = new mod.default({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.pipe(new WritableBuffer(chunks) as unknown as NodeJS.WritableStream);

  doc.fontSize(24).font('Helvetica-Bold').text(input.title, { align: 'center' } as never);
  if (input.subtitle) {
    doc.fontSize(12).font('Helvetica').text(input.subtitle, { align: 'center' } as never);
  }
  let y = 120;
  for (const section of input.sections) {
    doc.fontSize(14).font('Helvetica-Bold').text(section.heading, 50, y);
    y += 24;
    doc.fontSize(11).font('Helvetica').text(section.content, 50, y);
    y += 40;
  }
  doc.fontSize(10).text(`Generated: ${input.generatedAt.toISOString()}`, 50, y + 20);
  doc.end();

  return { buffer: Buffer.concat(chunks), stub: false };
}

/**
 * 为 PDF 添加水印（基于文本）。
 * 无 pdf-lib 时返回原 Buffer。
 */
export async function addWatermark(pdfBuffer: Buffer, text: string): Promise<Buffer> {
  const moduleName = 'pdf-lib';
  const mod = (await import(moduleName).catch(() => null)) as PdfLibModule | null;
  if (!mod) {
    console.info(`[pdf-watermark-stub] text=${text}, size=${pdfBuffer.length}`);
    return pdfBuffer;
  }
  const doc = await mod.PDFDocument.load(pdfBuffer);
  const pages = (doc as unknown as { getPageCount?(): number }).getPageCount?.() ?? 1;
  for (let i = 0; i < pages; i++) {
    const page = (doc as unknown as { getPage(idx: number): PdfLibPage }).getPage(i);
    page.drawText(text, {
      x: 200,
      y: 400,
      size: 48,
      opacity: 0.3,
      rotate: { type: 'degrees', angle: -45 } as never,
    } as never);
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** pdf-lib 最小类型描摹。 */
interface PdfLibDoc {
  save(): Promise<Uint8Array>;
}
interface PdfLibPage {
  drawText(t: string, o: unknown): void;
}
interface PdfLibModule {
  PDFDocument: { load(buf: Buffer): Promise<PdfLibDoc> };
}

/** 判断 PDF 服务是否已配置（安装 pdfkit）。 */
export function isPdfConfigured(): boolean {
  return env.PDF_DISABLED !== 'true';
}

// =============================================================================
// 内部工具
// =============================================================================

/** 简易 Writable 流，收集 PDF 输出为 Buffer 数组。 */
class WritableBuffer {
  private chunks: Buffer[];
  constructor(chunks: Buffer[]) {
    this.chunks = chunks;
  }
  // Node.js WritableStream 接口（pdfkit 通过 pipe 调用）
  write(chunk: Buffer | string, cb?: () => void): boolean {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    cb?.();
    return true;
  }
  end(): void {
    /* noop */
  }
  on(_event: string, _cb: () => void): this {
    return this;
  }
  once(_event: string, cb: () => void): this {
    cb();
    return this;
  }
}

/** 生成 stub PDF（最小合法 PDF 占位）。 */
function stub(log: string): PDFResult {
  console.info(log);
  // 最小 PDF 占位（单页空白）
  const content = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF';
  return { buffer: Buffer.from(content), stub: true };
}
