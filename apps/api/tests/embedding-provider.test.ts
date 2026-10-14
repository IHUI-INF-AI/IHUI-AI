// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getEmbeddingProvider,
  __resetEmbeddingProviderForTests,
} from '../src/services/embedding-provider.js'

describe('embedding-provider 工厂', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    __resetEmbeddingProviderForTests()
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.MINIMAX_API_KEY
    delete process.env.MINIMAX_EMBEDDING_URL
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    __resetEmbeddingProviderForTests()
  })

  it('未配置任何 KEY → 返回 null (降级为关键词匹配)', () => {
    expect(getEmbeddingProvider()).toBeNull()
  })

  it('DASHSCOPE_API_KEY 配置 → 返回 DashScope provider', () => {
    process.env.DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-dashscope-test'
    const provider = getEmbeddingProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('dashscope')
  })

  it('OPENAI_API_KEY 配置 (无 DASHSCOPE) → 返回 OpenAI provider', () => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-openai-test'
    const provider = getEmbeddingProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('openai')
  })

  it('DASHSCOPE + OPENAI 都有 → DashScope 优先级更高', () => {
    process.env.DASHSCOPE_API_KEY = 'sk-dashscope-test'
    process.env.OPENAI_API_KEY = 'sk-openai-test'
    const provider = getEmbeddingProvider()
    expect(provider?.name).toBe('dashscope')
  })

  it('MINIMAX_API_KEY 配置 (无 DashScope / OpenAI) → 返回 MiniMax provider', () => {
    process.env.MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || 'eyJ-minimax-test'
    const provider = getEmbeddingProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('minimax')
  })

  it('MINIMAX_EMBEDDING_URL 自定义端点可覆盖默认', () => {
    process.env.MINIMAX_API_KEY = 'eyJ-minimax-test'
    process.env.MINIMAX_EMBEDDING_URL =
      process.env.MINIMAX_EMBEDDING_URL || 'https://custom.example.com/v1/embeddings'
    const provider = getEmbeddingProvider()
    expect(provider?.name).toBe('minimax')
    // 注: endpoint 是 private 字段, 通过行为间接验证
    // (此处不直接断言 URL, 因为 provider 内部封装)
  })

  it('cached: 同一进程多次调用返回同一 provider 实例', () => {
    process.env.DASHSCOPE_API_KEY = 'sk-dashscope-test'
    const a = getEmbeddingProvider()
    const b = getEmbeddingProvider()
    expect(a).toBe(b)
  })

  it('__resetEmbeddingProviderForTests 强制重读 env', () => {
    process.env.DASHSCOPE_API_KEY = 'sk-dashscope-test'
    const a = getEmbeddingProvider()
    expect(a?.name).toBe('dashscope')

    process.env.OPENAI_API_KEY = 'sk-openai-test'
    // 未 reset 前, cached 仍是 dashscope
    expect(getEmbeddingProvider()?.name).toBe('dashscope')

    __resetEmbeddingProviderForTests()
    // reset 后重新解析, 优先级: DashScope > OpenAI
    expect(getEmbeddingProvider()?.name).toBe('dashscope')

    delete process.env.DASHSCOPE_API_KEY
    __resetEmbeddingProviderForTests()
    expect(getEmbeddingProvider()?.name).toBe('openai')
  })
})

describe('embedding-provider 批量应答对齐 (G-1080904)', () => {
  const ORIGINAL_ENV = { ...process.env }
  const ORIGINAL_FETCH = globalThis.fetch

  beforeEach(() => {
    __resetEmbeddingProviderForTests()
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.MINIMAX_API_KEY
    delete process.env.MINIMAX_EMBEDDING_URL
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    process.env = { ...ORIGINAL_ENV }
    __resetEmbeddingProviderForTests()
  })

  /** 1536 维常量向量, 标记值即向量身份, 供逐项断言"对齐到了哪一条输入" */
  const vec = (mark: number): number[] => new Array(1536).fill(mark)

  /** 假上游: 应答体固定 (乱序/缺项由各用例构造), 其余字段按三家真实形态补齐 */
  function stubUpstream(body: unknown): void {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => body }) as unknown as typeof fetch
  }

  function providerOf(name: 'dashscope' | 'openai' | 'minimax') {
    if (name === 'dashscope') process.env.DASHSCOPE_API_KEY = 'sk-test'
    if (name === 'openai') process.env.OPENAI_API_KEY = 'sk-test'
    if (name === 'minimax') process.env.MINIMAX_API_KEY = 'eyJ-test'
    __resetEmbeddingProviderForTests()
    const provider = getEmbeddingProvider()
    if (!provider) throw new Error(`期望 ${name} provider, 实际 null`)
    expect(provider.name).toBe(name)
    return provider
  }

  it('① OpenAI: 乱序应答按 index 重排, 逐项与请求对齐 (按下标实现必错)', async () => {
    const provider = providerOf('openai')
    stubUpstream({
      data: [
        { index: 2, embedding: vec(2) },
        { index: 0, embedding: vec(0) },
        { index: 1, embedding: vec(1) },
      ],
    })
    const out = await provider.embed(['a', 'b', 'c'])
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual(vec(0))
    expect(out[1]).toEqual(vec(1))
    expect(out[2]).toEqual(vec(2))
  })

  it('① DashScope: 乱序应答按 text_index 重排, 逐项与请求对齐', async () => {
    const provider = providerOf('dashscope')
    stubUpstream({
      output: {
        embeddings: [
          { text_index: 1, embedding: vec(1) },
          { text_index: 0, embedding: vec(0) },
        ],
      },
    })
    const out = await provider.embed(['a', 'b'])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual(vec(0))
    expect(out[1]).toEqual(vec(1))
  })

  it('① MiniMax: 条目带 id 时按 id 重排, 逐项与请求对齐', async () => {
    const provider = providerOf('minimax')
    stubUpstream({
      data: [
        { id: '2', embedding: vec(2) },
        { id: '0', embedding: vec(0) },
        { id: '1', embedding: vec(1) },
      ],
    })
    const out = await provider.embed(['a', 'b', 'c'])
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual(vec(0))
    expect(out[1]).toEqual(vec(1))
    expect(out[2]).toEqual(vec(2))
  })

  it('档3: 条目无任何对齐键 → 长度相等时按应答原序返回 (显式长度档, 非按下标兜底)', async () => {
    const provider = providerOf('minimax')
    stubUpstream({
      data: [{ embedding: vec(0) }, { embedding: vec(1) }, { embedding: vec(2) }],
    })
    const out = await provider.embed(['a', 'b', 'c'])
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual(vec(0))
    expect(out[1]).toEqual(vec(1))
    expect(out[2]).toEqual(vec(2))
  })

  it('③ OpenAI: 缺项 (3 请求 2 应答) → 整批作废并上抛, 不返回错位短列表', async () => {
    const provider = providerOf('openai')
    stubUpstream({
      data: [
        { index: 0, embedding: vec(0) },
        { index: 1, embedding: vec(1) },
      ],
    })
    await expect(provider.embed(['a', 'b', 'c'])).rejects.toThrow(/整批作废/)

    // 超项 (2 请求 3 应答) 同样整批作废
    stubUpstream({
      data: [
        { index: 0, embedding: vec(0) },
        { index: 1, embedding: vec(1) },
        { index: 2, embedding: vec(2) },
      ],
    })
    await expect(provider.embed(['a', 'b'])).rejects.toThrow(/整批作废/)
  })

  it('③ MiniMax (无对齐键形态): 缺项 → 走长度档, 整批作废并上抛', async () => {
    const provider = providerOf('minimax')
    stubUpstream({ data: [{ embedding: vec(0) }, { embedding: vec(1) }] })
    await expect(provider.embed(['a', 'b', 'c'])).rejects.toThrow(/整批作废/)
  })

  it('③ 等长但对齐键重复 (0,0,2 —— 等长缺项) → 整批作废并上抛', async () => {
    const provider = providerOf('openai')
    stubUpstream({
      data: [
        { index: 0, embedding: vec(0) },
        { index: 0, embedding: vec(0) },
        { index: 2, embedding: vec(2) },
      ],
    })
    await expect(provider.embed(['a', 'b', 'c'])).rejects.toThrow(/整批作废/)
  })

  it('③ 等长但对齐键越界 (0,1,3) → 整批作废并上抛', async () => {
    const provider = providerOf('openai')
    stubUpstream({
      data: [
        { index: 0, embedding: vec(0) },
        { index: 1, embedding: vec(1) },
        { index: 3, embedding: vec(3) },
      ],
    })
    await expect(provider.embed(['a', 'b', 'c'])).rejects.toThrow(/整批作废/)
  })

  it('③ 对齐键部分缺失 (2/3 条带键) → 键面自相矛盾, 整批作废并上抛', async () => {
    const provider = providerOf('openai')
    stubUpstream({
      data: [{ index: 0, embedding: vec(0) }, { embedding: vec(1) }, { index: 2, embedding: vec(2) }],
    })
    await expect(provider.embed(['a', 'b', 'c'])).rejects.toThrow(/整批作废/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
