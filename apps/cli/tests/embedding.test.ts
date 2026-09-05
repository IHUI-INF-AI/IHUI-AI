// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * embedding.ts 单元测试(真实化链路)。
 *
 * 覆盖:
 * - MockEmbeddingProvider:确定性 / 8 维 / 不同输入不同输出
 * - ApiEmbeddingProvider:请求体与鉴权头 / 分批 / 429 重试后成功 / 4xx 立即抛 / 重试耗尽
 * - BackendEmbeddingProvider:URL 拼接 /v1/llm/embeddings / API Key 注入
 * - detectEmbeddingProvider:五级优先级探测 + 未配置返回 undefined
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiEmbeddingProvider,
  BackendEmbeddingProvider,
  MockEmbeddingProvider,
  detectEmbeddingProvider,
} from '../src/memory/embedding.js'

// =============================================================================
// MockEmbeddingProvider
// =============================================================================

describe('MockEmbeddingProvider', () => {
  it('dimensions 为 8,modelName 为 mock-sha256-8d', () => {
    const p = new MockEmbeddingProvider()
    expect(p.dimensions()).toBe(8)
    expect(p.modelName()).toBe('mock-sha256-8d')
  })

  it('同输入同输出(确定性)', async () => {
    const p = new MockEmbeddingProvider()
    const a = await p.embedBatch(['hello world'])
    const b = await p.embedBatch(['hello world'])
    expect(a).toEqual(b)
  })

  it('不同输入产出不同向量,且每维落在 [-1, 1]', async () => {
    const p = new MockEmbeddingProvider()
    const [a] = await p.embedBatch(['alpha'])
    const [b] = await p.embedBatch(['beta'])
    expect(a).not.toEqual(b)
    expect(a).toHaveLength(8)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('批量输入返回等长结果', async () => {
    const p = new MockEmbeddingProvider()
    const out = await p.embedBatch(['a', 'b', 'c'])
    expect(out).toHaveLength(3)
  })
})

// =============================================================================
// ApiEmbeddingProvider
// =============================================================================

describe('ApiEmbeddingProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const okResponse = (vectors: number[][]) =>
    new Response(JSON.stringify({ data: vectors.map((e, i) => ({ index: i, embedding: e })) }), {
      status: 200,
    })

  it('默认 model/dimensions/batchSize', () => {
    const p = new ApiEmbeddingProvider({ apiBase: 'https://api.example.com/v1', apiKey: 'k' })
    expect(p.modelName()).toBe('text-embedding-3-small')
    expect(p.dimensions()).toBe(1536)
  })

  it('embedBatch 调用 OpenAI 兼容端点并携带 Bearer 鉴权', async () => {
    fetchMock.mockResolvedValueOnce(okResponse([[0.1, 0.2]]))
    const p = new ApiEmbeddingProvider({ apiBase: 'https://api.example.com/v1/', apiKey: 'sk-x' })
    const out = await p.embedBatch(['hi'])
    expect(out).toEqual([[0.1, 0.2]])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/embeddings') // 尾斜杠已去除
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-x')
    expect(JSON.parse(init.body)).toEqual({
      model: 'text-embedding-3-small',
      input: ['hi'],
      dimensions: 1536,
    })
  })

  it('超过 batchSize 自动分批请求', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse([[1], [2]]))
      .mockResolvedValueOnce(okResponse([[3]]))
    const p = new ApiEmbeddingProvider({
      apiBase: 'https://api.example.com/v1',
      apiKey: 'k',
      batchSize: 2,
    })
    const out = await p.embedBatch(['a', 'b', 'c'])
    expect(out).toEqual([[1], [2], [3]])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toEqual(['a', 'b'])
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).input).toEqual(['c'])
  })

  it('429 后重试成功(指数退避)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(okResponse([[0.5]]))
    const p = new ApiEmbeddingProvider({
      apiBase: 'https://api.example.com/v1',
      apiKey: 'k',
      maxRetries: 3,
    })
    const out = await p.embedBatch(['hi'])
    expect(out).toEqual([[0.5]])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('4xx(非 429)立即抛出不重试', async () => {
    fetchMock.mockResolvedValue(new Response('bad key', { status: 401 }))
    const p = new ApiEmbeddingProvider({
      apiBase: 'https://api.example.com/v1',
      apiKey: 'k',
      maxRetries: 3,
    })
    await expect(p.embedBatch(['hi'])).rejects.toThrow(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('重试耗尽后抛出最后一次错误', async () => {
    fetchMock.mockResolvedValue(new Response('overloaded', { status: 503 }))
    const p = new ApiEmbeddingProvider({
      apiBase: 'https://api.example.com/v1',
      apiKey: 'k',
      maxRetries: 2,
    })
    await expect(p.embedBatch(['hi'])).rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// =============================================================================
// BackendEmbeddingProvider
// =============================================================================

describe('BackendEmbeddingProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.9] }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('URL 拼接为 {aiServiceUrl}/v1/llm/embeddings,API Key 来自环境变量', async () => {
    vi.stubEnv('IHUI_AI_SERVICE_API_KEY', 'gw-key')
    const p = new BackendEmbeddingProvider('http://127.0.0.1:8803/')
    expect(p.modelName()).toBe('text-embedding-3-small')
    const out = await p.embedBatch(['doc'])
    expect(out).toEqual([[0.9]])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8803/v1/llm/embeddings')
    expect(init.headers.Authorization).toBe('Bearer gw-key')
  })

  it('可自定义模型名', () => {
    const p = new BackendEmbeddingProvider('http://127.0.0.1:8803', 'BAAI/bge-m3')
    expect(p.modelName()).toBe('BAAI/bge-m3')
  })
})

// =============================================================================
// detectEmbeddingProvider 环境探测优先级
// =============================================================================

describe('detectEmbeddingProvider', () => {
  it('全未配置返回 undefined', () => {
    expect(detectEmbeddingProvider({})).toBeUndefined()
  })

  it('IHUI_EMBEDDING_* 显式配置优先级最高', () => {
    const p = detectEmbeddingProvider({
      IHUI_EMBEDDING_API_BASE: 'https://emb.example.com/v1',
      IHUI_EMBEDDING_API_KEY: 'k1',
      IHUI_EMBEDDING_MODEL: 'custom-emb',
      OPENAI_API_KEY: 'k2',
    })
    expect(p).toBeInstanceOf(ApiEmbeddingProvider)
    expect(p?.modelName()).toBe('custom-emb')
  })

  it('IHUI_EMBEDDING_API_BASE 缺 KEY 时不命中第一优先级', () => {
    const p = detectEmbeddingProvider({
      IHUI_EMBEDDING_API_BASE: 'https://emb.example.com/v1',
      OPENAI_API_KEY: 'k2',
    })
    expect(p?.modelName()).toBe('text-embedding-3-small') // 走 OpenAI 分支
  })

  it('OPENAI_API_KEY → text-embedding-3-small @ api.openai.com', () => {
    const p = detectEmbeddingProvider({ OPENAI_API_KEY: 'k' })
    expect(p).toBeInstanceOf(ApiEmbeddingProvider)
    expect(p?.modelName()).toBe('text-embedding-3-small')
    expect(p?.dimensions()).toBe(1536)
  })

  it('OPENAI_API_BASE 覆盖 OpenAI 端点', () => {
    const p = detectEmbeddingProvider({
      OPENAI_API_KEY: 'k',
      OPENAI_API_BASE: 'https://proxy.example.com/v1',
    }) as ApiEmbeddingProvider
    // 通过 embedBatch 的请求 URL 验证
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    return p.embedBatch(['x']).then(() => {
      expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.example.com/v1/embeddings')
      vi.unstubAllGlobals()
    })
  })

  it('DASHSCOPE_API_KEY → 通义 text-embedding-v3 1024 维', () => {
    const p = detectEmbeddingProvider({ DASHSCOPE_API_KEY: 'k' })
    expect(p).toBeInstanceOf(ApiEmbeddingProvider)
    expect(p?.modelName()).toBe('text-embedding-v3')
    expect(p?.dimensions()).toBe(1024)
  })

  it('SILICONCLOUD_API_KEY → 硅基流动 BAAI/bge-m3 1024 维', () => {
    const p = detectEmbeddingProvider({ SILICONCLOUD_API_KEY: 'k' })
    expect(p).toBeInstanceOf(ApiEmbeddingProvider)
    expect(p?.modelName()).toBe('BAAI/bge-m3')
    expect(p?.dimensions()).toBe(1024)
  })

  it('IHUI_AI_SERVICE_URL → BackendEmbeddingProvider(OpenAI 系均未配置时)', () => {
    const p = detectEmbeddingProvider({ IHUI_AI_SERVICE_URL: 'http://127.0.0.1:8803' })
    expect(p).toBeInstanceOf(BackendEmbeddingProvider)
  })

  it('OPENAI_API_KEY 存在时优先于 IHUI_AI_SERVICE_URL', () => {
    const p = detectEmbeddingProvider({
      OPENAI_API_KEY: 'k',
      IHUI_AI_SERVICE_URL: 'http://127.0.0.1:8803',
    })
    expect(p).toBeInstanceOf(ApiEmbeddingProvider)
    expect(p).not.toBeInstanceOf(BackendEmbeddingProvider)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
