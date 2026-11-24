// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  EMBEDDING_REQUEST_TIMEOUT_MS,
  getEmbeddingProvider,
  __resetEmbeddingProviderForTests,
} from '../src/services/embedding-provider.js'

/**
 * F-144 回归锁(2026-11-13)。
 *
 * 病灶:embedding provider 三处裸 `fetch`(DashScope / OpenAI / MiniMax)未带 signal、无超时,
 * 上游不回包时 Promise 永不 settle —— 每轮聊天的 RAG 检索与每条 chunk 入库都能被单个
 * 慢请求无限拖住,socket/内存被耗尽,聊天首包超时。
 *
 * 本文件锁:
 *   ① 三家 provider 每次出站都带 signal(不再是无约束的裸 fetch);
 *   ② 上游 hang 住 → 在时限内以明确错误结束(喂假时钟,不真等 15s),绝不静默返回空向量;
 *   ③ 上游非 2xx → 仍如实失败(超时兜底不得把 HTTP 错误吞成成功)。
 *
 * 只替换全局 fetch,不触达真实上游、PG、Redis。
 */
describe('F-144 embedding 出站请求必须有超时中断', () => {
  const ORIGINAL_ENV = { ...process.env }
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    __resetEmbeddingProviderForTests()
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.MINIMAX_API_KEY
    delete process.env.MINIMAX_EMBEDDING_URL
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    process.env = { ...ORIGINAL_ENV }
    __resetEmbeddingProviderForTests()
  })

  function providerOf(name: 'dashscope' | 'openai' | 'minimax') {
    // 工厂按 DashScope > OpenAI > Minimax 选, 同一用例内轮换时必须先清干净
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.MINIMAX_API_KEY
    if (name === 'dashscope') process.env.DASHSCOPE_API_KEY = 'sk-test'
    if (name === 'openai') process.env.OPENAI_API_KEY = 'sk-test'
    if (name === 'minimax') process.env.MINIMAX_API_KEY = 'eyJ-test'
    __resetEmbeddingProviderForTests()
    const provider = getEmbeddingProvider()
    if (!provider) throw new Error(`期望 ${name} provider, 实际 null`)
    expect(provider.name).toBe(name)
    return provider
  }

  /** 各家 200 应答的最小合法形态 (1 条带对齐键的向量) */
  function okBody(name: 'dashscope' | 'openai' | 'minimax'): unknown {
    return name === 'dashscope'
      ? { output: { embeddings: [{ text_index: 0, embedding: [0.1, 0.2] }] } }
      : { data: [{ index: 0, embedding: [0.1, 0.2] }] }
  }

  const okResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  it('① 三家 provider 每次出站都带 signal', async () => {
    for (const name of ['dashscope', 'openai', 'minimax'] as const) {
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(okResponse(okBody(name)))

      const provider = providerOf(name)
      await provider.embed(['需要向量化的文本'])

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [, init] = fetchMock.mock.calls[0]!
      const signal = (init as RequestInit).signal
      expect(signal).toBeInstanceOf(AbortSignal)
      // 正常完成后 signal 仍是活的(不是预先已 abort 的哑对象)
      expect((signal as AbortSignal).aborted).toBe(false)
    }
  })

  it('② 上游 hang 住 → 在时限内被中断并以明确错误结束, 不返回空向量', async () => {
    vi.useFakeTimers()
    const provider = providerOf('openai')
    let aborted = false
    let capturedSignal: AbortSignal | undefined

    fetchMock.mockImplementationOnce(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal
          capturedSignal = signal
          expect(signal).toBeInstanceOf(AbortSignal)
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
              reject((signal as AbortSignal & { reason?: unknown }).reason ?? new Error('aborted'))
            },
            { once: true },
          )
        }),
    )

    const pending = provider.embed(['hang'])
    // 先挂上断言: 否则 rejection 会在 advance 之前被判为 unhandled
    const assertion = expect(pending).rejects.toThrow(
      new RegExp(`未在 ${EMBEDDING_REQUEST_TIMEOUT_MS}ms 内完成`),
    )

    await vi.advanceTimersByTimeAsync(EMBEDDING_REQUEST_TIMEOUT_MS - 1)
    expect(aborted).toBe(false) // 时限未到: 仍在等上游, 不能被提前掐断

    await vi.advanceTimersByTimeAsync(1)
    await assertion

    expect(aborted).toBe(true)
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('③ 上游非 2xx → 三家都如实失败, 超时兜底不吞成成功', async () => {
    const cases = [
      { name: 'dashscope', message: 'DashScope embedding HTTP 503' },
      { name: 'openai', message: 'OpenAI embedding HTTP 503' },
      { name: 'minimax', message: 'MiniMax embedding HTTP 503' },
    ] as const

    for (const c of cases) {
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(new Response('upstream down', { status: 503 }))

      const provider = providerOf(c.name)
      await expect(provider.embed(['a'])).rejects.toThrow(c.message)
    }
  })
})
