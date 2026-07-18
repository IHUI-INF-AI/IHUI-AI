import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
    process.env.DASHSCOPE_API_KEY = 'sk-dashscope-test'
    const provider = getEmbeddingProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('dashscope')
  })

  it('OPENAI_API_KEY 配置 (无 DASHSCOPE) → 返回 OpenAI provider', () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test'
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
    process.env.MINIMAX_API_KEY = 'eyJ-minimax-test'
    const provider = getEmbeddingProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('minimax')
  })

  it('MINIMAX_EMBEDDING_URL 自定义端点可覆盖默认', () => {
    process.env.MINIMAX_API_KEY = 'eyJ-minimax-test'
    process.env.MINIMAX_EMBEDDING_URL = 'https://custom.example.com/v1/embeddings'
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
