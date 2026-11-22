// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiOrThrow } from '@/lib/api'

import {
  sag2AddDocument,
  sag2Fuse,
  sag2RemoveDocument,
  sag2Retrieve,
  sag2Search,
  sag2Status,
  type Sag2DocumentOutcome,
  type Sag2FuseResult,
  type Sag2RemoveOutcome,
  type Sag2ResultRow,
  type Sag2RetrieveOptions,
  type Sag2RetrieveResult,
  type Sag2SearchResult,
  type Sag2Status,
} from './sag2-lexical'

vi.mock('@/lib/api', () => ({ apiOrThrow: vi.fn() }))

const mocked = vi.mocked(apiOrThrow)

type ApiCall = [string, RequestInit]

function firstCall(): ApiCall {
  return mocked.mock.calls[0] as unknown as ApiCall
}

function jsonBody(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

beforeEach(() => {
  mocked.mockReset()
  mocked.mockResolvedValue({} as never)
})

describe('sag2-lexical API 封装 · 请求构造', () => {
  it('状态端点走 GET 且不带多余参数', async () => {
    await sag2Status()
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith('/api/v1/ai/sag2/status')
  })

  it('登记文档发送 POST JSON 且零模型字段由后端返回', async () => {
    await sag2AddDocument({ path: 'kb/a.txt', content: 'A公司收购了B公司。' })
    const [url, init] = firstCall()
    expect(url).toBe('/api/v1/ai/sag2/documents')
    expect(init.method).toBe('POST')
    expect(jsonBody(init)).toEqual({
      path: 'kb/a.txt',
      content: 'A公司收购了B公司。',
    })
  })

  it('登记文档透传可选分块参数', async () => {
    await sag2AddDocument({
      path: 'kb/b.txt',
      content: '正文',
      title: '标题',
      heading: '小节',
      chunk_size: 800,
      overlap: 100,
    })
    expect(jsonBody(firstCall()[1])).toEqual({
      path: 'kb/b.txt',
      content: '正文',
      title: '标题',
      heading: '小节',
      chunk_size: 800,
      overlap: 100,
    })
  })

  it('移除文档走 DELETE 且路径进 body', async () => {
    await sag2RemoveDocument('kb/a.txt')
    const [url, init] = firstCall()
    expect(url).toBe('/api/v1/ai/sag2/documents')
    expect(init.method).toBe('DELETE')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(jsonBody(init)).toEqual({ path: 'kb/a.txt' })
  })

  it('快速搜索默认分页为 1/20', async () => {
    await sag2Search('收购')
    expect(jsonBody(firstCall()[1])).toEqual({ query: '收购', page: 1, per_page: 20 })
  })

  it('快速搜索自定义分页映射为 per_page', async () => {
    await sag2Search('收购', 3, 50)
    expect(jsonBody(firstCall()[1])).toEqual({ query: '收购', page: 3, per_page: 50 })
  })

  it('多跳检索把选项合进同一个 body', async () => {
    await sag2Retrieve('谁是CTO', { max_hops: 1, top_k: 5 })
    const [url, init] = firstCall()
    expect(url).toBe('/api/v1/ai/sag2/retrieve')
    expect(jsonBody(init)).toEqual({
      query: '谁是CTO',
      max_hops: 1,
      top_k: 5,
    })
  })

  it('多跳检索默认选项时 body 仅含 query', async () => {
    await sag2Retrieve('谁是CTO')
    expect(jsonBody(firstCall()[1])).toEqual({ query: '谁是CTO' })
  })

  it('RRF 融合携带两通道与 k', async () => {
    const rows: Sag2ResultRow[] = [
      { key: 'a', path: 'kb/a.txt', content: 'x', score: 1, bm25: 1, hop: 0 },
    ]
    await sag2Fuse(rows, [{ path: 'kb/b.txt' }], 42)
    const [url, init] = firstCall()
    expect(url).toBe('/api/v1/ai/sag2/fuse')
    expect(jsonBody(init)).toEqual({
      sag2_results: rows,
      rag_sources: [{ path: 'kb/b.txt' }],
      k: 42,
    })
  })

  it('RRF 融合默认 k=60 且 rag_sources 为空数组', async () => {
    const rows: Sag2ResultRow[] = [
      { key: 'a', path: 'kb/a.txt', content: 'x', score: 1, bm25: 1, hop: 0 },
    ]
    await sag2Fuse(rows)
    const [url, init] = firstCall()
    expect(url).toBe('/api/v1/ai/sag2/fuse')
    expect(jsonBody(init)).toEqual({
      sag2_results: rows,
      rag_sources: [],
      k: 60,
    })
  })

  it('所有端点都以 /api/v1/ai/sag2 为前缀', async () => {
    await sag2Status()
    await sag2AddDocument({ path: 'p', content: 'c' })
    await sag2RemoveDocument('p')
    await sag2Search('q')
    await sag2Retrieve('q')
    await sag2Fuse([])
    const calls = mocked.mock.calls as unknown as ApiCall[]
    const urls = calls.map(([url]) => url)
    expect(urls).toHaveLength(6)
    for (const url of urls) expect(url.startsWith('/api/v1/ai/sag2')).toBe(true)
    expect(urls).toEqual([
      '/api/v1/ai/sag2/status',
      '/api/v1/ai/sag2/documents',
      '/api/v1/ai/sag2/documents',
      '/api/v1/ai/sag2/search',
      '/api/v1/ai/sag2/retrieve',
      '/api/v1/ai/sag2/fuse',
    ])
  })

  it('写操作都带 JSON Content-Type 且 body 为 JSON 字符串', async () => {
    await sag2AddDocument({ path: 'p', content: 'c' })
    await sag2RemoveDocument('p')
    await sag2Search('q')
    await sag2Retrieve('q')
    await sag2Fuse([])
    const calls = mocked.mock.calls as unknown as ApiCall[]
    expect(calls).toHaveLength(5)
    for (const [, init] of calls) {
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(typeof init.body).toBe('string')
    }
  })
})

describe('sag2-lexical API 封装 · 结果与错误透传（apiOrThrow 出口）', () => {
  it('成功返回：/status 透传 apiOrThrow 已解包的 data，不二次包装', async () => {
    const data: Sag2Status = {
      version: 3,
      documents: 10,
      chunks: 42,
      terms: 500,
      avg_chunk_length: 120.5,
      ready: true,
      backend: 'bm25',
      judge_provider: 'none',
    }
    mocked.mockResolvedValue(data as never)
    const result = await sag2Status()
    expect(result).toBe(data)
    expect(result).not.toHaveProperty('code')
    expect(result).not.toHaveProperty('data')
  })

  it('/search 返回体解包：完整 Sag2SearchResult 原样透传', async () => {
    const data: Sag2SearchResult = {
      query: '收购',
      mode: 'bm25',
      model_calls: 0,
      total_files: 1,
      page: 1,
      per_page: 20,
      items: [],
      duration_ms: 3,
    }
    mocked.mockResolvedValue(data as never)
    await expect(sag2Search('收购')).resolves.toBe(data)
  })

  it('非 2xx 抛错：带 status 的错误对象原样透传', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 })
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2Status().catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect((rejection as { status?: number }).status).toBe(403)
  })

  it('网络异常：无 status 的 TypeError 原样透传', async () => {
    const err = new TypeError('Failed to fetch')
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2Search('收购').catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect((rejection as { status?: number }).status).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// P1 收口补测：以下用例不改既有 16 用例、不改 vi.mock 结构。
// 钉住的是「封装层」契约——每个导出函数都只是 `return apiOrThrow<T>(...)`，
// 对 apiOrThrow 的返回值零解包、零包装、零改写；错误原样抛出、不被吞。
// ---------------------------------------------------------------------------

describe('sag2-lexical API 封装 · 4 端点成功返回值逐字段透传', () => {
  it('登记文档成功返回：完整 Sag2DocumentOutcome 逐字段透传、不丢字段、不改数值', async () => {
    const data: Sag2DocumentOutcome = {
      changed: true,
      reason: 'created',
      doc_hash: 'sha256:9f2c',
      chunk_count: 5,
      version: 12,
      model_calls: 0,
    }
    mocked.mockResolvedValue(data as never)
    const result = await sag2AddDocument({ path: 'kb/a.txt', content: 'A' })
    expect(result).toBe(data)
    expect(result).toEqual({
      changed: true,
      reason: 'created',
      doc_hash: 'sha256:9f2c',
      chunk_count: 5,
      version: 12,
      model_calls: 0,
    })
    expect(Object.keys(result).sort()).toEqual([
      'changed',
      'chunk_count',
      'doc_hash',
      'model_calls',
      'reason',
      'version',
    ])
  })

  it('移除文档成功返回：完整 Sag2RemoveOutcome 逐字段透传、不丢字段、不改数值', async () => {
    const data: Sag2RemoveOutcome = { removed: 3, version: 13 }
    mocked.mockResolvedValue(data as never)
    const result = await sag2RemoveDocument('kb/a.txt')
    expect(result).toBe(data)
    expect(result).toEqual({ removed: 3, version: 13 })
    expect(Object.keys(result).sort()).toEqual(['removed', 'version'])
  })

  it('多跳检索成功返回：完整 Sag2RetrieveResult（含嵌套数组）逐字段透传、不丢字段、不改数值', async () => {
    const data: Sag2RetrieveResult = {
      query: '谁是CTO',
      status: 'ok',
      degraded: false,
      version: 12,
      duration_ms: 37.5,
      results: [
        {
          key: 'kb/a.txt#L1',
          path: 'kb/a.txt',
          content: 'CTO 是张三',
          score: 0.91,
          bm25: 4.2,
          hop: 1,
        },
      ],
      source_count: 1,
      citations: [
        {
          path: 'kb/a.txt',
          title: '组织手册',
          heading: '管理层',
          doc_hash: 'sha256:ab',
          byte_range: [0, 128],
          start_line: 1,
          end_line: 6,
          passage: 'CTO 是张三',
          score: 0.91,
          bm25: 4.2,
          hop: 1,
        },
      ],
      trace: [
        {
          hop: 1,
          candidates: ['kb/a.txt'],
          terms: [{ term: 'CTO', score: 1.5, kind: 'seed' }],
          evidence: ['kb/a.txt#L1'],
          pool_size: 8,
          judge_mode: 'heuristic',
          judge_executed: false,
          judge_reason: 'skipped',
        },
      ],
      judge: { mode: 'heuristic', executed: false, reason: 'skipped' },
      paths: { 'kb/a.txt': { chunks: 5 } },
    }
    mocked.mockResolvedValue(data as never)
    const result = await sag2Retrieve('谁是CTO')
    expect(result).toBe(data)
    expect(result).toEqual({
      query: '谁是CTO',
      status: 'ok',
      degraded: false,
      version: 12,
      duration_ms: 37.5,
      results: [
        {
          key: 'kb/a.txt#L1',
          path: 'kb/a.txt',
          content: 'CTO 是张三',
          score: 0.91,
          bm25: 4.2,
          hop: 1,
        },
      ],
      source_count: 1,
      citations: [
        {
          path: 'kb/a.txt',
          title: '组织手册',
          heading: '管理层',
          doc_hash: 'sha256:ab',
          byte_range: [0, 128],
          start_line: 1,
          end_line: 6,
          passage: 'CTO 是张三',
          score: 0.91,
          bm25: 4.2,
          hop: 1,
        },
      ],
      trace: [
        {
          hop: 1,
          candidates: ['kb/a.txt'],
          terms: [{ term: 'CTO', score: 1.5, kind: 'seed' }],
          evidence: ['kb/a.txt#L1'],
          pool_size: 8,
          judge_mode: 'heuristic',
          judge_executed: false,
          judge_reason: 'skipped',
        },
      ],
      judge: { mode: 'heuristic', executed: false, reason: 'skipped' },
      paths: { 'kb/a.txt': { chunks: 5 } },
    })
    expect(Object.keys(result).sort()).toEqual([
      'citations',
      'degraded',
      'duration_ms',
      'judge',
      'paths',
      'query',
      'results',
      'source_count',
      'status',
      'trace',
      'version',
    ])
    expect(result.results[0]).toEqual({
      key: 'kb/a.txt#L1',
      path: 'kb/a.txt',
      content: 'CTO 是张三',
      score: 0.91,
      bm25: 4.2,
      hop: 1,
    })
    expect(result.citations[0]!.byte_range).toEqual([0, 128])
    expect(result.trace[0]!.terms[0]).toEqual({ term: 'CTO', score: 1.5, kind: 'seed' })
    expect(result.judge).toEqual({ mode: 'heuristic', executed: false, reason: 'skipped' })
  })

  it('RRF 融合成功返回：完整 Sag2FuseResult 逐字段透传、不丢字段、不改数值', async () => {
    const data: Sag2FuseResult = {
      results: [
        { path: 'kb/a.txt', key: 'a', rrf_score: 0.032, fused_from: 'sag2+rag', extra: 7 },
        { key: 'b', rrf_score: 0.016, fused_from: 'sag2' },
      ],
      channels: ['sag2', 'rag'],
      rrf_k: 60,
    }
    mocked.mockResolvedValue(data as never)
    const result = await sag2Fuse([])
    expect(result).toBe(data)
    expect(result).toEqual({
      results: [
        { path: 'kb/a.txt', key: 'a', rrf_score: 0.032, fused_from: 'sag2+rag', extra: 7 },
        { key: 'b', rrf_score: 0.016, fused_from: 'sag2' },
      ],
      channels: ['sag2', 'rag'],
      rrf_k: 60,
    })
    expect(Object.keys(result).sort()).toEqual(['channels', 'results', 'rrf_k'])
    expect(result.results[0]).toEqual({
      path: 'kb/a.txt',
      key: 'a',
      rrf_score: 0.032,
      fused_from: 'sag2+rag',
      extra: 7,
    })
  })
})

describe('sag2-lexical API 封装 · 4 端点错误分支', () => {
  it('登记文档错误分支：HTTP 500 错误对象原样透传、不被吞', async () => {
    const err = Object.assign(new Error('Internal Server Error'), { status: 500 })
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2AddDocument({ path: 'p', content: 'c' }).catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect((rejection as Error).message).toBe('Internal Server Error')
    expect((rejection as { status?: number }).status).toBe(500)
  })

  it('移除文档错误分支：HTTP 403 错误对象原样透传、不被吞', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 })
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2RemoveDocument('p').catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect((rejection as Error).message).toBe('Forbidden')
    expect((rejection as { status?: number }).status).toBe(403)
  })

  it('多跳检索错误分支：网络 TypeError 原样透传、不被吞', async () => {
    const err = new TypeError('Failed to fetch')
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2Retrieve('q').catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect(rejection).toBeInstanceOf(TypeError)
    expect((rejection as Error).message).toBe('Failed to fetch')
    expect((rejection as { status?: number }).status).toBeUndefined()
  })

  it('RRF 融合错误分支：HTTP 500 错误对象原样透传、不被吞', async () => {
    const err = Object.assign(new Error('Internal Server Error'), { status: 500 })
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2Fuse([]).catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect((rejection as Error).message).toBe('Internal Server Error')
    expect((rejection as { status?: number }).status).toBe(500)
  })

  it('错误不被二次包装：抛出的是同一个 Error 实例，message/status 不变且无 data/code 外壳', async () => {
    const err = Object.assign(new Error('Service Unavailable'), { status: 503 })
    mocked.mockRejectedValueOnce(err)
    const rejection = await sag2Status().catch((e: unknown) => e)
    expect(rejection).toBe(err)
    expect(rejection).toBeInstanceOf(Error)
    expect((rejection as Error).message).toBe('Service Unavailable')
    expect((rejection as { status?: number }).status).toBe(503)
    expect(rejection).not.toHaveProperty('data')
    expect(rejection).not.toHaveProperty('code')
  })
})

describe('sag2-lexical API 封装 · Sag2RetrieveOptions 6 字段透传', () => {
  it('多跳检索透传全部 6 个检索选项（file_limit 有值态），字段逐一进 body', async () => {
    const options: Sag2RetrieveOptions = {
      candidate_k: 50,
      seed_k: 8,
      expansion_term_limit: 12,
      max_hops: 2,
      top_k: 10,
      file_limit: 25,
    }
    await sag2Retrieve('q', options)
    const body = jsonBody(firstCall()[1])
    expect(body).toEqual({ query: 'q', ...options })
    for (const key of [
      'candidate_k',
      'seed_k',
      'expansion_term_limit',
      'max_hops',
      'top_k',
      'file_limit',
    ] as const) {
      expect(body).toHaveProperty(key, options[key])
    }
    expect(body.file_limit).toBe(25)
  })

  it('多跳检索 file_limit: null 显式透传为 null，不被吞成 undefined 或被省略', async () => {
    await sag2Retrieve('q', { file_limit: null })
    const body = jsonBody(firstCall()[1])
    expect(body).toEqual({ query: 'q', file_limit: null })
    expect(body.file_limit).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(body, 'file_limit')).toBe(true)
  })
})

describe('sag2-lexical API 封装 · 边界值透传（title / 分页 / fuse）', () => {
  it('登记文档 title: null 作为 null 透传，不被省略', async () => {
    await sag2AddDocument({ path: 'kb/c.txt', content: 'c', title: null })
    const body = jsonBody(firstCall()[1])
    expect(body).toEqual({ path: 'kb/c.txt', content: 'c', title: null })
    expect(body.title).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(body, 'title')).toBe(true)
  })

  it('快速搜索分页下界 page=1 / per_page=1 原样映射', async () => {
    await sag2Search('q', 1, 1)
    expect(jsonBody(firstCall()[1])).toEqual({ query: 'q', page: 1, per_page: 1 })
  })

  it('快速搜索分页上界大值 page=9999 / per_page=100000 不截断、不改写', async () => {
    await sag2Search('q', 9999, 100000)
    expect(jsonBody(firstCall()[1])).toEqual({ query: 'q', page: 9999, per_page: 100000 })
  })

  it('RRF 融合显式空 rag_sources 与自定义 k=1 透传（区别于默认态）', async () => {
    const rows: Sag2ResultRow[] = [
      { key: 'a', path: 'kb/a.txt', content: 'x', score: 1, bm25: 1, hop: 0 },
      { key: 'b', path: 'kb/b.txt', content: 'y', score: 0.5, bm25: 0.4, hop: 1 },
    ]
    await sag2Fuse(rows, [], 1)
    expect(jsonBody(firstCall()[1])).toEqual({ sag2_results: rows, rag_sources: [], k: 1 })
  })

  it('RRF 融合 k=0 边界值与多元素 rag_sources 逐元素透传', async () => {
    const rag = [{ path: 'kb/x.txt' }, { path: 'kb/y.txt', weight: 2 }]
    await sag2Fuse([], rag, 0)
    const body = jsonBody(firstCall()[1])
    expect(body).toEqual({ sag2_results: [], rag_sources: rag, k: 0 })
    expect(body.k).toBe(0)
    expect(body.rag_sources).toEqual(rag)
  })
})

describe('sag2-lexical API 封装 · GET /status 请求形态', () => {
  it('GET /status 只传 url、不带 body、不带多余 headers、不带 method', async () => {
    await sag2Status()
    expect(mocked).toHaveBeenCalledTimes(1)
    const call = mocked.mock.calls[0] as unknown as [string, Record<string, unknown>?]
    expect(call).toHaveLength(1)
    expect(call[0]).toBe('/api/v1/ai/sag2/status')
    expect(call[1]).toBeUndefined()
    expect(call[1]?.body).toBeUndefined()
    expect(call[1]?.headers).toBeUndefined()
    expect(call[1]?.method).toBeUndefined()
  })
})

// 边界声明：apiOrThrow 已被 vi.mock 整体替换成 vi.fn()，底层把 {code,message,data}
// 解包成 data 的真实逻辑（apps/web/src/lib/api.ts:241-253 的 `return r.data`）在本文件
// 结构上跑不到，本组不声称验证它。本组验证的是「封装层」契约：无论 apiOrThrow 回吐
// 的是完整信封还是已解包的 data，封装层都原样 return，不二次解包、不二次包装、不丢字段。
describe('sag2-lexical API 封装 · 信封对象透传（封装层零解包契约）', () => {
  it('/status 面对完整 {code,message,data} 信封：原样返回整个对象、不把 data 解出来当返回值', async () => {
    const payload: Sag2Status = {
      version: 3,
      documents: 10,
      chunks: 42,
      terms: 500,
      avg_chunk_length: 120.5,
      ready: true,
      backend: 'bm25',
      judge_provider: 'none',
    }
    const envelope = { code: 0, message: 'ok', data: payload }
    mocked.mockResolvedValue(envelope as never)
    const result = await sag2Status()
    expect(result).toBe(envelope)
    expect(result).not.toBe(payload)
    expect(result).toMatchObject({ code: 0, message: 'ok', data: payload })
    expect(Object.keys(result as object).sort()).toEqual(['code', 'data', 'message'])
  })

  it('/search 面对完整信封：code/message/data 三字段不丢不加、逐字段不改值', async () => {
    const payload: Sag2SearchResult = {
      query: 'q',
      mode: 'bm25',
      model_calls: 0,
      total_files: 0,
      page: 1,
      per_page: 20,
      items: [],
      duration_ms: 2,
    }
    const envelope = { code: 200, message: 'success', data: payload }
    mocked.mockResolvedValue(envelope as never)
    const result = await sag2Search('q')
    expect(result).toBe(envelope)
    expect(result).toEqual({ code: 200, message: 'success', data: payload })
    expect(Object.keys(result as object).sort()).toEqual(['code', 'data', 'message'])
    expect((result as unknown as { data: Sag2SearchResult }).data.query).toBe('q')
    expect((result as unknown as { data: Sag2SearchResult }).data.per_page).toBe(20)
  })

  it('6 个端点统一纯透传：喂入完整信封一律原样返回，无一端点二次解包', async () => {
    const invoke: Array<() => Promise<unknown>> = [
      () => sag2Status(),
      () => sag2AddDocument({ path: 'p', content: 'c' }),
      () => sag2RemoveDocument('p'),
      () => sag2Search('q'),
      () => sag2Retrieve('q'),
      () => sag2Fuse([]),
    ]
    for (const [i, fn] of invoke.entries()) {
      const envelope = { code: 0, message: 'ok', data: { seq: i } }
      mocked.mockResolvedValueOnce(envelope as never)
      const result = await fn()
      expect(result).toBe(envelope)
      expect(Object.keys(result as object).sort()).toEqual(['code', 'data', 'message'])
    }
    expect(mocked).toHaveBeenCalledTimes(6)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
