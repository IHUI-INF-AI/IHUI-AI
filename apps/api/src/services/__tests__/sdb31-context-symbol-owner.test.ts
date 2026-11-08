// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-39:`searchSymbols` 未传 ownerUuid ⇒ 命中 fail-closed `1=0`,符号检索恒空;
 * 且缓存键不含 userId(修好后会跨用户串结果)。
 *
 * 夹具:mock codebaseIndexService.search,断言内部/路由两条入口都把当前 userId
 * 作为 ownerUuid 透传,并且缓存按用户隔离(不同用户必须各查一次)。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
})

const searchSpy = vi.hoisted(() =>
  vi.fn(async (_opts: { query: string; topK?: number; ownerUuid?: string | null }) => [
    {
      id: 'chunk-1',
      filePath: 'src/a.ts',
      lineStart: 1,
      lineEnd: 10,
      content: 'export function f() {}',
      language: 'typescript',
      symbolName: 'f',
      symbolType: 'function',
      score: 0.9,
    },
  ]),
)

vi.mock('../codebase-index-service.js', () => ({
  codebaseIndexService: { search: searchSpy },
}))

vi.mock('../../db/index.js', () => ({
  db: { execute: vi.fn(async () => []) },
}))

vi.mock('../../db/file-queries.js', () => ({
  findRecentFiles: vi.fn(async () => []),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
}))

vi.mock('../../utils/internal-jwt.js', () => ({
  mintInternalJwt: vi.fn(async () => 'token'),
}))

import { contextEngineService } from '../context-engine-service.js'

beforeEach(() => {
  searchSpy.mockClear()
})

describe('SDB-39 符号检索必须透传 ownerUuid', () => {
  it('searchSymbols 把调用者 userId 作为 ownerUuid 传入 codebaseIndexService', async () => {
    await contextEngineService.searchSymbols('sdb39-alpha', 5, 'user-a')
    expect(searchSpy).toHaveBeenCalledTimes(1)
    const opts = searchSpy.mock.calls[0]![0]
    expect(opts.ownerUuid).toBe('user-a')
  })

  it('缓存按用户隔离:同一 query 两个用户各查一次', async () => {
    await contextEngineService.searchSymbols('sdb39-beta', 5, 'user-a')
    await contextEngineService.searchSymbols('sdb39-beta', 5, 'user-b')
    expect(searchSpy).toHaveBeenCalledTimes(2)
    expect(searchSpy.mock.calls[0]![0].ownerUuid).toBe('user-a')
    expect(searchSpy.mock.calls[1]![0].ownerUuid).toBe('user-b')
  })

  it('统一检索入口 search(type=symbol)把 userId 透传给 searchSymbols', async () => {
    await contextEngineService.search({
      query: 'sdb39-gamma',
      type: 'symbol',
      userId: 'user-x',
      limit: 3,
    })
    expect(searchSpy).toHaveBeenCalledTimes(1)
    expect(searchSpy.mock.calls[0]![0].ownerUuid).toBe('user-x')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
