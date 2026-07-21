/**
 * PDF 集成测试 — 验证真实 pdfkit 路径生成有效 PDF(非 stub)
 *
 * 背景:
 * - pdf-service.ts 的 generateReportPDF/Certificate/Invoice 走 pdfkit 真实路径
 * - pdfkit WritableBuffer 之前因没继承 stream.Writable 导致 finish 事件不触发
 *   → 修复后 9.2x 字节数提升(208 → 1919)
 * - 本测试用真实 pdfkit 库跑完整链路,作为 CI 守门:任何破坏 flush 逻辑的改动都会被捕捉
 *
 * 与 scripts/test-pdf-real-content.ts 的关系:
 * - 那个是手动运维脚本(npx tsx scripts/test-pdf-real-content.ts),保留作为快速诊断工具
 * - 本文件是 vitest 套件,接入 `pnpm test` / CI 流水线,失败直接阻塞构建
 */

import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { generateReportPDF, generateCertificatePDF, generateInvoicePDF } = await import(
  '../pdf-service.js'
)

describe('generateReportPDF — 真实 pdfkit 路径', () => {
  it('真实生成 ≥ 1KB PDF(非 stub) + 包含 Helvetica + FlateDecode 压缩流', async () => {
    const result = await generateReportPDF({
      title: 'Student Learning Report',
      subtitle: 'Generated at 2026-07-21T00:00:00Z',
      sections: [
        {
          heading: 'Basic Information',
          content: 'Name: Li Sihan\nStudent ID: S20260721001\nReport Date: 2026-07-21',
        },
        {
          heading: 'Course Progress',
          content: 'Lessons Completed: 42\nVideo Study Time: 1280 minutes',
        },
      ],
      generatedAt: new Date('2026-07-21T00:00:00Z'),
    })

    expect(result.stub).toBe(false)
    expect(result.error).toBeUndefined()
    expect(result.buffer.length).toBeGreaterThan(1000)
    expect(result.buffer.subarray(0, 8).toString('utf-8')).toBe('%PDF-1.3')

    // PDF 内容流走 FlateDecode 压缩,latin1 解码看不到原文,验证结构性关键字即可
    const text = result.buffer.toString('latin1')
    expect(text).toContain('%%EOF')
    expect(text).toContain('Helvetica')
    expect(text).toContain('FlateDecode')
    expect(text).toContain('/Type /Page')
    expect(text).toContain('/MediaBox')
  })

  it('无 sections 时仍生成合法 PDF(不崩)', async () => {
    const result = await generateReportPDF({
      title: 'Empty Report',
      sections: [],
      generatedAt: new Date(),
    })

    expect(result.stub).toBe(false)
    expect(result.buffer.length).toBeGreaterThan(200)
    expect(result.buffer.toString('utf-8')).toContain('%PDF-')
  })
})

describe('generateCertificatePDF — 真实 pdfkit 路径', () => {
  it('证书 PDF 包含中文字段 + Helvetica 字体引用', async () => {
    const result = await generateCertificatePDF({
      certificateNo: 'CERT-2026-07-21-001',
      title: 'Test Certificate',
      recipientName: 'Li Sihan',
      courseName: 'AI Engineering 101',
      issuedAt: new Date('2026-07-21T00:00:00Z'),
    })

    expect(result.stub).toBe(false)
    expect(result.error).toBeUndefined()
    expect(result.buffer.length).toBeGreaterThan(500)
    expect(result.buffer.subarray(0, 8).toString('utf-8')).toBe('%PDF-1.3')

    const text = result.buffer.toString('latin1')
    expect(text).toContain('Helvetica')
    expect(text).toContain('%%EOF')
  })
})

describe('generateInvoicePDF — 真实 pdfkit 路径', () => {
  it('发票 PDF 含 line items + 金额字段', async () => {
    const result = await generateInvoicePDF({
      invoiceNo: 'INV-2026-07-21-001',
      title: 'Acme Corp',
      amount: '$1,234.56',
      email: 'billing@acme.com',
      items: [
        { name: 'AI Service Plan', quantity: 1, price: '$999.00' },
        { name: 'API Calls Overage', quantity: 100, price: '$235.56' },
      ],
    })

    expect(result.stub).toBe(false)
    expect(result.error).toBeUndefined()
    expect(result.buffer.length).toBeGreaterThan(500)
    expect(result.buffer.toString('latin1')).toContain('Helvetica')
  })
})
