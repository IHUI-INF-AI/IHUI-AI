// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * preview-envelope 单元测试 — J2:Qoder previewEngine + previewFallback 复现。
 *
 * 覆盖:
 * 1. taxonomy 常量对齐 Qoder 实测值(codec/object/resource + pptx-*-unavailable 等)
 * 2. classifyAnydocError 单源映射:needsOcr/malformed/encrypted/resourceLimit/missingPart/io → 结构化 fallback
 * 3. 未知 code → null(调用方自行决定)
 * 4. 纯文本走 parseDocumentWithEnvelope → previewEngine='raw-text',fallbacks=[],elapsedMs>=0
 * 5. envelope 与 parseDocument 文本完全一致(信封只是包装,不改文本)
 */

import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { FALLBACK_CATEGORY, FALLBACK_CODE, classifyAnydocError } =
  await import('../src/services/preview-envelope.js')
const { parseDocumentWithEnvelope, parseDocument } =
  await import('../src/services/document-parser.js')

describe('preview-envelope taxonomy', () => {
  it('FALLBACK_CATEGORY 对齐 Qoder office-render-worker 实测 category', () => {
    expect(FALLBACK_CATEGORY.Codec).toBe('codec')
    expect(FALLBACK_CATEGORY.Object).toBe('object')
    expect(FALLBACK_CATEGORY.Resource).toBe('resource')
    expect(FALLBACK_CATEGORY.NeedsOcr).toBe('needs-ocr')
  })

  it('FALLBACK_CODE 对齐 Qoder 实测 code', () => {
    expect(FALLBACK_CODE.SmartartUnavailable).toBe('pptx-smartart-preview-unavailable')
    expect(FALLBACK_CODE.OleUnavailable).toBe('pptx-ole-preview-unavailable')
    expect(FALLBACK_CODE.ResourceTooLarge).toBe('pptx-resource-too-large')
    expect(FALLBACK_CODE.NeedsOcr).toBe('doc-needs-ocr')
  })
})

describe('classifyAnydocError', () => {
  it('needsOcr → needs-ocr 分类', () => {
    const fb = classifyAnydocError('needsOcr', 'scan without text layer')
    expect(fb).not.toBeNull()
    expect(fb!.category).toBe('needs-ocr')
    expect(fb!.code).toBe('doc-needs-ocr')
    expect(fb!.detail).toBe('scan without text layer')
  })

  it('encrypted → encrypted 分类', () => {
    const fb = classifyAnydocError('encrypted', 'password')
    expect(fb!.category).toBe('encrypted')
    expect(fb!.code).toBe('doc-encrypted')
  })

  it('missingPart → malformed 分类(归档不完整)', () => {
    const fb = classifyAnydocError('missingPart', 'zip incomplete')
    expect(fb!.category).toBe('malformed')
    expect(fb!.code).toBe('doc-missing-part')
  })

  it('未知 code → null(不臆造分类)', () => {
    expect(classifyAnydocError('some-new-code', 'x')).toBeNull()
    expect(classifyAnydocError(undefined, 'x')).toBeNull()
  })
})

describe('parseDocumentWithEnvelope', () => {
  it('纯文本 → raw-text 引擎,无降级,文本一致', async () => {
    const buf = Buffer.from('hello envelope world', 'utf8')
    const env = await parseDocumentWithEnvelope({
      buffer: buf,
      mimeType: 'text/plain',
      filename: 'a.txt',
    })
    const legacy = await parseDocument({ buffer: buf, mimeType: 'text/plain', filename: 'a.txt' })
    expect(env.previewEngine).toBe('raw-text')
    expect(env.fallbacks).toEqual([])
    expect(env.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(env.text).toBe(legacy)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
