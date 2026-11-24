// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-413 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/files/:id/extract-assets 只限制源文件 ≤20MB,不限 doc.assets 条数与
 * 累计字节;每次调用都 randomUUID 新文件名,同一文件反复提取 ⇒ 重复落盘、永不回收。
 *
 * 本文件锁:
 *   ① 同一源文件重复调用:内容 sha256 命中缓存,文件名复用,磁盘不新增副本(且不重复解析);
 *   ② 超条数上限:只落盘前 N 条,truncated=true + 原因,磁盘文件数=N;
 *   ③ 超累计字节上限:达到上限即停,truncated=true,磁盘只留有已提取部分;
 *   ④ 落盘中途失败:清理本次已写文件,返回错误,目录不留半份资产。
 *
 * 只 mock anydoc / document-parser / node:fs 的 writeFileSync,用临时目录,不连 DB/网络。
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import type * as NodeFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

interface StubAsset {
  id: number
  mediaType: string
  originPart: string
  data: Buffer
}

const anydocState = vi.hoisted(() => ({
  assets: [] as StubAsset[],
  documents: 0,
}))

vi.mock('@firecrawl/anydoc', () => ({
  toMarkdown: async () => '# mock',
  toMarkdownBytes: async () => '# mock',
  formatFromPath: () => 'docx',
  formatFromBytes: () => 'docx',
  toDocument: async () => {
    anydocState.documents += 1
    return { assets: anydocState.assets, blocks: [], notes: [] }
  },
}))

vi.mock('../src/services/document-parser.js', () => ({
  MAX_FILE_SIZE: 20 * 1024 * 1024,
}))

const fsState = vi.hoisted(() => ({ failOnWrite: 0, writes: 0 }))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>()
  return {
    ...actual,
    writeFileSync: ((...args: Parameters<typeof actual.writeFileSync>) => {
      fsState.writes += 1
      if (fsState.failOnWrite > 0 && fsState.writes === fsState.failOnWrite) {
        throw new Error('mock disk full')
      }
      return actual.writeFileSync(...args)
    }) as typeof actual.writeFileSync,
  }
})

import {
  __resetAssetExtractStateForTests,
  __setAssetExtractLimitsForTests,
  extractDocumentAssets,
} from '../src/services/markdown-converter-service.js'

const PNG = 'image/png'

function stubAsset(id: number, size: number, fill = id): StubAsset {
  return {
    id,
    mediaType: PNG,
    originPart: `word/media/image${id}.png`,
    data: Buffer.alloc(size, fill),
  }
}

describe('F-413 资产提取上限 / 幂等 / 失败回滚', () => {
  let root = ''
  let outDir = ''
  let source = ''

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'f413-'))
    outDir = join(root, 'assets')
    source = join(root, 'source.docx')
    writeFileSync(source, Buffer.from('fake-docx-content'))
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  beforeEach(() => {
    fsState.failOnWrite = 0
    fsState.writes = 0
    anydocState.assets = []
    anydocState.documents = 0
    __resetAssetExtractStateForTests()
    rmSync(outDir, { recursive: true, force: true })
  })

  it('① 同一源文件重复调用:复用缓存文件名,不重复落盘也不重复解析', async () => {
    anydocState.assets = [stubAsset(1, 4), stubAsset(2, 6, 9)]

    const first = await extractDocumentAssets(source, 'source.docx', outDir)
    const second = await extractDocumentAssets(source, 'source.docx', outDir)

    expect(first.error).toBeUndefined()
    expect(first.assets).toHaveLength(2)
    expect(second.assets.map((a) => a.filename)).toEqual(first.assets.map((a) => a.filename))
    expect(second.truncated).toBeUndefined()
    expect(anydocState.documents).toBe(1)
    expect(readdirSync(outDir)).toHaveLength(2)
  })

  it('② 超条数上限:只落盘前 2 条并标注截断', async () => {
    __setAssetExtractLimitsForTests({ maxCount: 2 })
    anydocState.assets = [
      stubAsset(1, 1),
      stubAsset(2, 1, 2),
      stubAsset(3, 1, 3),
      stubAsset(4, 1, 4),
    ]

    const result = await extractDocumentAssets(source, 'source.docx', outDir)

    expect(result.error).toBeUndefined()
    expect(result.assets).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(result.truncatedReason).toContain('2 条上限')
    expect(readdirSync(outDir)).toHaveLength(2)
  })

  it('③ 超累计字节上限:停在超限前,返回已提取部分并标注截断', async () => {
    __setAssetExtractLimitsForTests({ maxTotalBytes: 10 })
    anydocState.assets = [stubAsset(1, 4), stubAsset(2, 4, 2), stubAsset(3, 4, 3)]

    const result = await extractDocumentAssets(source, 'source.docx', outDir)

    expect(result.error).toBeUndefined()
    expect(result.assets.map((a) => a.size)).toEqual([4, 4])
    expect(result.truncated).toBe(true)
    expect(result.truncatedReason).toContain('上限')
    expect(readdirSync(outDir)).toHaveLength(2)
  })

  it('④ 落盘中途失败:清理本次已写文件,返回错误且目录为空', async () => {
    anydocState.assets = [stubAsset(1, 2), stubAsset(2, 2, 2), stubAsset(3, 2, 3)]
    fsState.writes = 0
    fsState.failOnWrite = 2

    const result = await extractDocumentAssets(source, 'source.docx', outDir)

    expect(result.assets).toEqual([])
    expect(result.error).toContain('资产落盘失败')
    expect(readdirSync(outDir)).toHaveLength(0)

    // 失败不写缓存:恢复写盘后再次调用会重新解析
    fsState.failOnWrite = 0
    const retried = await extractDocumentAssets(source, 'source.docx', outDir)
    expect(retried.error).toBeUndefined()
    expect(retried.assets).toHaveLength(3)
    expect(anydocState.documents).toBe(2)
  })
})
