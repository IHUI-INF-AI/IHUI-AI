// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-39:符号检索必须携带 ownerUuid,且缺参数时不得先付 embedding 成本。
 *
 * 钉三件事:
 * ① searchSymbols 把调用者 userId 作为 ownerUuid 透传给 codebaseIndexService.search
 *    (漏传 ⇒ fail-closed `1=0`,符号检索恒空);
 * ② 缺 ownerUuid 时显式拒绝 / 受控空结果,且 embedding 一次都不调(成本不空跑);
 * ③ 上下文缓存键含 ownerUuid,不同用户同一 query 不得命中彼此的缓存。
 *
 * 夹具:mock db / embedding-provider;对真实 codebaseIndexService 实例用 spyOn
 * 截获 search 入参,这样 ② 的"embedding 未被调用"可在同一文件内对真实现断言。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { embedSpy } = vi.hoisted(() => ({
  embedSpy: vi.fn(async (_texts: string[]) => [new Array(1536).fill(0.1)]),
}))

vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: () => ({ embed: embedSpy }),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn(async () => []) },
}))

vi.mock('../src/db/file-queries.js', () => ({
  findRecentFiles: vi.fn(async () => []),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
}))

vi.mock('../src/utils/internal-jwt.js', () => ({
  mintInternalJwt: vi.fn(async () => 'token'),
}))

import { contextEngineService } from '../src/services/context-engine-service.js'
import { codebaseIndexService } from '../src/services/codebase-index-service.js'
import type { SearchResult } from '../src/services/codebase-index-service.js'

function chunk(symbolName: string): SearchResult {
  return {
    id: `chunk-${symbolName}`,
    filePath: `src/${symbolName}.ts`,
    lineStart: 1,
    lineEnd: 10,
    content: `export function ${symbolName}() {}`,
    language: 'typescript',
    symbolName,
    symbolType: 'function',
    score: 0.9,
    embeddingProvider: 'remote',
  }
}

const activeSpies: Array<{ mockRestore: () => void }> = []

function stubSearch(rows: SearchResult[]) {
  const spy = vi.spyOn(codebaseIndexService, 'search').mockResolvedValue(rows)
  activeSpies.push(spy)
  return spy
}

beforeEach(() => {
  embedSpy.mockClear()
})

afterEach(() => {
  while (activeSpies.length > 0) activeSpies.pop()?.mockRestore()
})

describe('SDB-39 符号检索归属', () => {
  it('① 传 ownerUuid 后 codebaseIndexService.search 收到该参数', async () => {
    const spy = stubSearch([chunk('alpha')])

    const out = await contextEngineService.searchSymbols('sdb39-owner-pass', 5, 'user-a')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      query: 'sdb39-owner-pass',
      topK: 5,
      ownerUuid: 'user-a',
    })
    expect(out.map((s) => s.symbolName)).toEqual(['alpha'])
  })

  it('② 缺 ownerUuid 时不检索、不调 embedding,并显式拒绝', async () => {
    const spy = stubSearch([chunk('beta')])

    await expect(
      contextEngineService.searchSymbols('sdb39-missing-owner', 5, ''),
    ).rejects.toThrow(/ownerUuid/)
    expect(spy).not.toHaveBeenCalled()
    expect(embedSpy).not.toHaveBeenCalled()
  })

  it('② 服务层缺 ownerUuid:返回受控空结果且不调 embedding', async () => {
    const out = await codebaseIndexService.search({ query: 'sdb39-missing-owner-real' })
    expect(out).toEqual([])
    expect(embedSpy).not.toHaveBeenCalled()
  })

  it('② 正向对照:带 ownerUuid 才消耗 embedding', async () => {
    await codebaseIndexService.search({ query: 'sdb39-with-owner', ownerUuid: 'user-a' })
    expect(embedSpy).toHaveBeenCalledTimes(1)
  })

  it('③ 不同 userId 缓存不互串,同一 userId 命中缓存', async () => {
    const spy = stubSearch([chunk('gamma')])

    await contextEngineService.searchSymbols('sdb39-cache-isolation', 5, 'user-a')
    await contextEngineService.searchSymbols('sdb39-cache-isolation', 5, 'user-b')

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[0]?.[0].ownerUuid).toBe('user-a')
    expect(spy.mock.calls[1]?.[0].ownerUuid).toBe('user-b')

    // 同一用户重复调用 ⇒ 缓存命中,不再检索
    await contextEngineService.searchSymbols('sdb39-cache-isolation', 5, 'user-a')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
