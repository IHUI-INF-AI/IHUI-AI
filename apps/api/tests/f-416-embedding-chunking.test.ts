// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-416 回归锁(2026-11-13)。
 *
 * 病灶:大仓库索引时 indexChunks 把全部待嵌入文本一次性交给 provider.embed,
 * provider 再整包发给上游。超过上游单批上限(25 条 / token 预算)后整批非 2xx,
 * 失败被吞 ⇒ 所有切片以 embedding=NULL 入库, 语义检索静默退化为关键词匹配。
 *
 * 本文件锁:
 *   ① 超过条数上限自动分片, 分片拼接后与输入逐项相等(条数守恒);
 *   ② 条数未超但 token 预算超限时继续分片;
 *   ③ 上游按批收到请求(60 条 → 25/25/10), 返回向量按输入顺序守恒;
 *   ④ 单批失败按指数退避重试, 重试成功后结果完整;
 *   ⑤ 重试耗尽必须抛错, 不得返回空/截断结果冒充成功。
 *
 * 不连真实网络/DB:UPSTREAM 用 vi.stubGlobal('fetch') 的替身(按请求批返回,
 * 可指定第 N 批报错), sleep 注入为空函数, 重试不产生真实等待。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import {
  EMBEDDING_BATCH_RETRY_BASE_DELAY_MS,
  EMBEDDING_MAX_BATCH_ITEMS,
  estimateEmbeddingTokens,
  getEmbeddingProvider,
  planEmbeddingBatches,
  __resetEmbeddingProviderForTests,
  type EmbeddingProvider,
} from '../src/services/embedding-provider.js'

/** 与 codebase-index-service 的 CODEBASE_EMBEDDING_MAX_ATTEMPTS 同一预算 */
const RETRY_ATTEMPTS = 3

const SAVED_ENV = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
}

function restoreEnv(key: keyof typeof SAVED_ENV, value: string | undefined): void {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

function textIndexOf(text: string): number {
  const matched = /^t-(\d+)$/.exec(text)
  return matched ? Number(matched[1]) : -1
}

function parseInput(init: RequestInit | undefined): string[] {
  const body = JSON.parse(String(init?.body ?? '{}')) as { input?: string[] }
  return body.input ?? []
}

/** 上游替身:按请求批返回, 每条向量首元素 = 该文本序号, 便于验证顺序与守恒 */
function upstreamOk(input: string[]): Response {
  return new Response(
    JSON.stringify({
      data: input.map((text, index) => ({ index, embedding: [textIndexOf(text)] })),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function requireProvider(): EmbeddingProvider {
  const provider = getEmbeddingProvider()
  if (!provider) throw new Error('embedding provider 未按测试预期创建')
  return provider
}

function textsOf(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `t-${i}`)
}

describe('F-416 批量 embedding 必须按上游上限分片且失败不静默', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (_input, init) => upstreamOk(parseInput(init)))
    // 固定走 OpenAI 分支: 清掉优先级更高的 key, 并重置进程级 provider 缓存
    delete process.env.DASHSCOPE_API_KEY
    delete process.env.MINIMAX_API_KEY
    process.env.OPENAI_API_KEY = 'f416-test-key'
    __resetEmbeddingProviderForTests()
  })

  afterEach(() => {
    restoreEnv('DASHSCOPE_API_KEY', SAVED_ENV.DASHSCOPE_API_KEY)
    restoreEnv('OPENAI_API_KEY', SAVED_ENV.OPENAI_API_KEY)
    restoreEnv('MINIMAX_API_KEY', SAVED_ENV.MINIMAX_API_KEY)
    __resetEmbeddingProviderForTests()
  })

  it('① 超过条数上限自动分片, 拼接后与输入逐项相等', () => {
    const texts = textsOf(60)
    const batches = planEmbeddingBatches(texts)

    expect(EMBEDDING_MAX_BATCH_ITEMS).toBe(25)
    expect(batches.map((batch) => batch.length)).toEqual([25, 25, 10])
    expect(batches.flat()).toEqual(texts)
  })

  it('② 条数未超但 token 预算超限时继续分片', () => {
    const longText = 'a'.repeat(400) // 估算 100 token
    const texts = [longText, longText, longText]
    const batches = planEmbeddingBatches(texts, { maxItems: 25, maxTokens: 150 })

    expect(batches).toHaveLength(3)
    expect(batches.flat()).toEqual(texts)
    for (const batch of batches) {
      const tokens = batch.reduce((sum, text) => sum + estimateEmbeddingTokens(text), 0)
      expect(tokens).toBeLessThanOrEqual(150)
    }
  })

  it('③ 上游按 25 条/批收到请求, 返回向量顺序与条数守恒', async () => {
    const texts = textsOf(60)
    const embeddings = await requireProvider().embed(texts, { sleep: async () => {} })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const requestSizes = fetchMock.mock.calls.map((call) => parseInput(call[1]).length)
    expect(requestSizes).toEqual([25, 25, 10])
    expect(requestSizes.every((size) => size <= EMBEDDING_MAX_BATCH_ITEMS)).toBe(true)

    expect(embeddings).toHaveLength(texts.length)
    expect(embeddings.map((vec) => vec[0])).toEqual(texts.map((_, i) => i))
    expect(embeddings.every((vec) => vec.length === 1536)).toBe(true)
  })

  it('④ 单批失败按退避重试后成功, 结果完整', async () => {
    let upstreamCalls = 0
    fetchMock.mockImplementation(async (_input, init) => {
      upstreamCalls++
      // 第 2 批的首次尝试报错, 重试后成功
      if (upstreamCalls === 2) return new Response('rate limited', { status: 429 })
      return upstreamOk(parseInput(init))
    })

    const sleeps: number[] = []
    const texts = textsOf(60)
    const embeddings = await requireProvider().embed(texts, {
      maxAttempts: RETRY_ATTEMPTS,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })

    expect(upstreamCalls).toBe(4)
    expect(sleeps).toEqual([EMBEDDING_BATCH_RETRY_BASE_DELAY_MS])
    expect(embeddings.map((vec) => vec[0])).toEqual(texts.map((_, i) => i))
  })

  it('⑤ 重试耗尽必须抛错, 不返回空/截断结果', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      const batch = parseInput(init)
      if (batch.includes('t-25')) return new Response('upstream rejected', { status: 400 })
      return upstreamOk(batch)
    })

    const texts = textsOf(60)
    const pending = requireProvider().embed(texts, {
      maxAttempts: RETRY_ATTEMPTS,
      sleep: async () => {},
    })

    await expect(pending).rejects.toThrow(
      new RegExp(`第 2/3 批\\(25 条\\)共尝试 ${RETRY_ATTEMPTS} 次后仍失败`),
    )
    // 第 1 批 1 次 + 第 2 批 3 次(首次 + 2 次重试), 第 3 批不会发出
    expect(fetchMock).toHaveBeenCalledTimes(1 + RETRY_ATTEMPTS)
  })
})
