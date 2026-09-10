// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌⁠

/**
 * extractDocumentAssets(文档内嵌资产提取)单元测试。
 *
 * 覆盖:
 * 1. 文件不存在 → 返回 error
 * 2. 纯文本(txt)无文档模型 → 返回 error
 * 3. pdf 无文档模型 → 返回 unsupported:true
 * 4. docx(mock toDocument)→ 资产落盘到 writeToDir + 文件名自生成(UUID+扩展)
 * 5. 自生成文件名不复用 originPart(防路径穿越)
 */

import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@firecrawl/anydoc', () => {
  const toDocument = vi.fn()
  return {
    toMarkdown: vi.fn(async () => ''),
    toMarkdownBytes: vi.fn(async () => ''),
    formatFromPath: vi.fn((p: string) => (p.toLowerCase().endsWith('.docx') ? 'docx' : null)),
    formatFromBytes: vi.fn(() => 'docx'),
    toDocument,
  } as Record<string, unknown>
})

const { extractDocumentAssets } = await import('../markdown-converter-service.js')
const mocked = await import('@firecrawl/anydoc')
const mockedToDocument = mocked.toDocument as ReturnType<typeof vi.fn>

let outDir: string

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'anydoc-extract-'))
  mockedToDocument.mockReset()
})

afterEach(() => {
  mockedToDocument.mockReset()
})

function makeTmpFile(name: string, content = 'x'): string {
  const p = join(outDir, `src-${name}`)
  writeFileSync(p, content)
  return p
}

describe('extractDocumentAssets — 基础路径', () => {
  it('文件不存在 → 返回 error', async () => {
    const r = await extractDocumentAssets(join(outDir, 'no-such.docx'), undefined, outDir)
    expect(r.error).toBeTruthy()
    expect(r.assets).toEqual([])
    expect(r.unsupported).toBeUndefined()
  })

  it('纯文本(txt)无文档模型 → 返回 error', async () => {
    const p = makeTmpFile('a.txt', 'hello')
    const r = await extractDocumentAssets(p, 'a.txt', outDir)
    expect(r.error).toContain('不支持')
    expect(r.assets).toEqual([])
  })

  it('pdf 无文档模型 → unsupported:true', async () => {
    const p = makeTmpFile('a.pdf', 'not a real pdf but name works')
    const r = await extractDocumentAssets(p, 'a.pdf', outDir)
    expect(r.unsupported).toBe(true)
    expect(r.assets).toEqual([])
    // pdf 判定发生在加载 anydoc 之前
    expect(mockedToDocument).not.toHaveBeenCalled()
  })

  it('docx(mock)资产落盘 + 文件名自生成(UUID+扩展)', async () => {
    const p = makeTmpFile('doc.docx', 'docx-bytes')
    mockedToDocument.mockResolvedValue({
      assets: [
        {
          id: 0,
          mediaType: 'image/png',
          originPart: 'word/media/image1.png',
          data: Buffer.from([1, 2, 3]),
        },
        {
          id: 1,
          mediaType: 'application/octet-stream',
          originPart: 'word/embeddings/obj1.bin',
          data: Buffer.from([9]),
        },
      ],
      blocks: [],
      notes: [],
    })
    const r = await extractDocumentAssets(p, 'doc.docx', outDir)
    expect(r.error).toBeUndefined()
    expect(r.unsupported).toBeUndefined()
    expect(r.assets).toHaveLength(2)

    const png = r.assets[0]!
    const bin = r.assets[1]!
    // 扩展名由 MIME 推导
    expect(png.extension).toBe('png')
    expect(bin.extension).toBe('bin')
    // 文件名自生成(UUID),绝不使用 originPart
    expect(png.filename).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(png.filename).not.toContain('media')
    // 已落盘且文件存在于 writeToDir
    expect(existsSync(join(outDir, png.filename))).toBe(true)
    expect(existsSync(join(outDir, bin.filename))).toBe(true)
    // 无 writeToDir 时仍返回清单但不写盘
  })

  it('不传 writeToDir 时只返回清单不落盘', async () => {
    const p = makeTmpFile('doc2.docx', 'docx-bytes')
    mockedToDocument.mockResolvedValue({
      assets: [
        { id: 0, mediaType: 'image/jpeg', originPart: 'word/media/x.jpg', data: Buffer.from([5]) },
      ],
      blocks: [],
      notes: [],
    })
    const r = await extractDocumentAssets(p, 'doc2.docx')
    expect(r.assets).toHaveLength(1)
    expect(existsSync(join(outDir, 'src-doc2.docx'))).toBe(true)
    // writeToDir 未指定 → 不额外生成资产文件
    expect(readdirSync(outDir).filter((n) => !n.startsWith('src-'))).toHaveLength(0)
  })
})
