// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** G-1058632(2026-10-05 立):usage 帧的 prompt 缓存两维必须在**读侧解析面**接住。
 *
 * 立项前的真实状态:tryParseUsage 只取 prompt/completion/total(+reasoning/timing/model/cost),
 * 缓存两维从未被解析,于是三个消费端只能恒传 null —— 界面显示"没有缓存",
 * 而事实是"我们没采到"。这两句话必须是两个结论。
 *
 * 本文件的**唯一不可替换**的断言是 U2/U3 那一对:
 *   上游回报 0 ⇒ 必须得到 0(它是"一次都没命中"这个读数本身);
 *   上游缺字段 ⇒ 必须得到 null(它是"未采到"),不得被兜成 0。
 * 少了这一对,本票就退化成"把 null 改个名字",没有任何东西证明没退化。 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl, parseUsageCacheTokens } from '../src/client.js'
import type { UsageEvent } from '../src/client.js'

/** 构造一段 SSE 流的 Response mock(参照 stream-chat-usage.test.ts 模式) */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(`${chunk}\n`))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: { get: () => null },
    text: async () => '',
  } as unknown as Response
}

/** 把一段 data 行喂进 streamChat,回读 onUsage 收到的载荷 */
async function captureUsage(dataLines: string[]): Promise<UsageEvent> {
  const fetchMock = vi.fn().mockResolvedValue(sseResponse([...dataLines, '', 'data: [DONE]', '']))
  vi.stubGlobal('fetch', fetchMock)
  const onUsage = vi.fn()
  await streamChat({
    model: 'test-model',
    messages: [{ role: 'user', content: 'hi' }],
    onDelta: vi.fn(),
    onUsage,
  })
  expect(onUsage).toHaveBeenCalledTimes(1)
  return onUsage.mock.calls[0][0] as UsageEvent
}

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('parseUsageCacheTokens(键名取自现读出处,两态不并桶)', () => {
  it('U1 空 usage ⇒ 两个 null,不是 0(本函数不得造默认值)', () => {
    expect(parseUsageCacheTokens({})).toEqual({
      cacheReadTokens: null,
      cacheWriteTokens: null,
    })
  })

  it('U2 回报 0 ⇒ 得到 0(未采到 ≠ 0 —— 本票唯一能证明没退化的断言)', () => {
    expect(parseUsageCacheTokens({ cached_tokens: 0, cache_creation_tokens: 0 })).toEqual({
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })

  it('U3 缺字段 ⇒ 得到 null(与 U2 同一条判据的反面:两者必须不同形)', () => {
    // 只带 prompt/total(即今天 ai-service 命名帧的实际形态)
    const r = parseUsageCacheTokens({ prompt_tokens: 100, total_tokens: 130 })
    expect(r.cacheReadTokens).toBeNull()
    expect(r.cacheWriteTokens).toBeNull()
    // 关键:不能被读成 0
    expect(r.cacheReadTokens).not.toBe(0)
  })

  it('U4 归一契约键(cached_tokens / cache_creation_tokens)被接住', () => {
    expect(parseUsageCacheTokens({ cached_tokens: 4096, cache_creation_tokens: 512 })).toEqual({
      cacheReadTokens: 4096,
      cacheWriteTokens: 512,
    })
  })

  it('U5 OpenAI 原生嵌套 prompt_tokens_details.cached_tokens 被接住', () => {
    expect(
      parseUsageCacheTokens({ prompt_tokens_details: { cached_tokens: 1024 } }).cacheReadTokens,
    ).toBe(1024)
  })

  it('U6 Anthropic / DeepSeek 原生别名被接住(逐字取自 usage_cache.py 的别名表)', () => {
    expect(
      parseUsageCacheTokens({
        cache_read_input_tokens: 2048,
        cache_creation_input_tokens: 256,
      }),
    ).toEqual({ cacheReadTokens: 2048, cacheWriteTokens: 256 })
    expect(parseUsageCacheTokens({ prompt_cache_hit_tokens: 64 }).cacheReadTokens).toBe(64)
  })

  it('U7 非数字/NaN/负结构外值一律算未采到,不当读数', () => {
    expect(parseUsageCacheTokens({ cached_tokens: '1x' }).cacheReadTokens).toBeNull()
    expect(parseUsageCacheTokens({ cached_tokens: Number.NaN }).cacheReadTokens).toBeNull()
    // 0 是合法读数,与 NaN 必须不同判
    expect(parseUsageCacheTokens({ cached_tokens: 0 }).cacheReadTokens).toBe(0)
  })

  it('U8 camelCase 与 snake_case 同视(与本包 prompt_tokens ?? promptTokens 同一习惯)', () => {
    expect(parseUsageCacheTokens({ cacheReadTokens: 7, cacheCreationTokens: 3 })).toEqual({
      cacheReadTokens: 7,
      cacheWriteTokens: 3,
    })
  })

  it('U9 details 非对象不得抛错(上游形态各异,计量失败绝不阻塞主链路)', () => {
    expect(parseUsageCacheTokens({ prompt_tokens_details: 'oops' }).cacheReadTokens).toBeNull()
    expect(parseUsageCacheTokens({ prompt_tokens_details: null }).cacheReadTokens).toBeNull()
  })
})

describe('streamChat usage 帧的缓存两维端到端(解析面 → onUsage 载荷)', () => {
  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('S1 OpenAI 协议 verbatim 路径:嵌套 cached_tokens 走到 onUsage(今天真有数据的那条路)', async () => {
    const u = await captureUsage([
      'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":1000,"completion_tokens":5,"total_tokens":1005,"prompt_tokens_details":{"cached_tokens":800}}}',
    ])
    expect(u.promptTokens).toBe(1000)
    expect(u.cacheReadTokens).toBe(800)
    // 上游没回报写入 ⇒ 未采到,不得读成 0
    expect(u.cacheWriteTokens).toBeNull()
  })

  it('S2 回报 0 的缓存命中:载荷必须是 0,不是 null(界面据此才能说"一次都没命中")', async () => {
    const u = await captureUsage([
      'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105,"cached_tokens":0,"cache_creation_tokens":0}}',
    ])
    expect(u.cacheReadTokens).toBe(0)
    expect(u.cacheWriteTokens).toBe(0)
  })

  it('S3 帧不带缓存两键(旧帧代际差/旧 OpenAI 无名帧)⇒ null,不是 0', async () => {
    // 载荷 = app/routers/llm.py 的 _usage_frame 在 G-403 之前的形态:usage 只有四个键
    const u = await captureUsage([
      'event: usage',
      'data: {"type":"usage","messageId":"m-1","usage":{"promptTokens":100,"completionTokens":30,"totalTokens":130,"reasoningTokens":12},"timing":{"firstTokenMs":420,"durationMs":3400},"model":"deepseek-chat","costUsd":0.0021}',
    ])
    expect(u.totalTokens).toBe(130)
    expect(u.cacheReadTokens).toBeNull()
    expect(u.cacheWriteTokens).toBeNull()
  })

  it('S7 命名帧带缓存两键(G-403 后 llm.py 补发的线格式)⇒ camelCase 键被接住', async () => {
    // 载荷键名与 llm.py _usage_frame 补发后的线格式逐字对齐(cacheReadTokens/cacheWriteTokens)
    const u = await captureUsage([
      'event: usage',
      'data: {"type":"usage","messageId":"m-1","usage":{"promptTokens":1000,"completionTokens":30,"totalTokens":1030,"reasoningTokens":0,"cacheReadTokens":800,"cacheWriteTokens":50},"timing":{"firstTokenMs":420,"durationMs":3400},"model":"deepseek-chat","costUsd":0.0021}',
    ])
    expect(u.cacheReadTokens).toBe(800)
    expect(u.cacheWriteTokens).toBe(50)
  })

  it('S8 命名帧缓存两键为 null(上游没采到,发射端 has_cache_signals 判空)⇒ 原样 null,不得读成 0', async () => {
    const u = await captureUsage([
      'event: usage',
      'data: {"type":"usage","messageId":"m-1","usage":{"promptTokens":1000,"completionTokens":30,"totalTokens":1030,"cacheReadTokens":null,"cacheWriteTokens":null},"timing":{"firstTokenMs":420,"durationMs":3400},"model":"deepseek-chat","costUsd":null}',
    ])
    expect(u.cacheReadTokens).toBeNull()
    expect(u.cacheWriteTokens).toBeNull()
    expect(u.cacheReadTokens).not.toBe(0)
  })

  it('S4 Anthropic 原生别名经 streamChat 也被接住', async () => {
    const u = await captureUsage([
      'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":900,"completion_tokens":9,"total_tokens":909,"cache_read_input_tokens":700,"cache_creation_input_tokens":200}}',
    ])
    expect(u.cacheReadTokens).toBe(700)
    expect(u.cacheWriteTokens).toBe(200)
  })

  it('S5 接入缓存两维不得改变既有字段(与 stream-chat-usage.test.ts 同一口径)', async () => {
    const u = await captureUsage([
      'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
    ])
    expect(u.totalTokens).toBe(15)
    expect(u.messageId).toBeNull()
    expect(u.timing).toBeNull()
    expect(u.model).toBeNull()
    expect(u.reasoningTokens).toBeNull()
  })

  it('S6 既有 baseOpts 形态仍可单独调用(回归:改动没把 usage 帧分流搞坏)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
          '',
          'data: [DONE]',
          '',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)
    const onUsage = vi.fn()
    await streamChat({ ...baseOpts, onDelta: vi.fn(), onUsage })
    expect(onUsage).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
