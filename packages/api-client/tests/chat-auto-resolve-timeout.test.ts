// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autoResolveChat 的传输契约(2026-11-23 加固时立)。
 *
 * 钉两件事:
 *  1. 候选原样进 body、路径是 /api/chat/auto-resolve(服务端 schema 是 strict,字段名漂了会 400);
 *  2. 决策腿有**默认 3s 预算** —— 挂起请求到点必须以失败收束,绝不让发送热路径无限等。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { setTokenProvider } from '../src/client.js'
import { autoResolveChat } from '../src/endpoints/chat.js'
import { setTransport, type Transport } from '../src/transport.js'

function okTransport(): Transport {
  const payload = { code: 0, message: 'ok', data: { channel: 'pool', model: 'cursor/x', source: 'own' } }
  return async () =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    }) as unknown as Awaited<ReturnType<Transport>>
}

/** 挂起型 transport:只有 init.signal 被 abort 才拒绝(模拟上游永不返回) */
function hangingTransport(): Transport {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      const signal = init.signal
      const abort = () => reject(new DOMException('The operation was aborted', 'AbortError'))
      if (signal?.aborted) {
        abort()
        return
      }
      signal?.addEventListener('abort', abort)
    })
}

const input = {
  promptTail: '把这段代码重构成异步',
  promptChars: 12,
  hasTools: false,
  poolCandidates: ['cursor/x', 'kimi-k2.7-code'],
}

describe('autoResolveChat', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    vi.useRealTimers()
  })

  it('候选原样发往 /api/chat/auto-resolve', async () => {
    let seen: { url: string; body: string } | null = null
    setTransport(async (url, init) => {
      seen = { url, body: String(init.body ?? '') }
      return okTransport()(url, init)
    })
    const res = await autoResolveChat(input)
    expect(res.success).toBe(true)
    expect(seen).not.toBeNull()
    expect(seen!.url).toContain('/api/chat/auto-resolve')
    expect(JSON.parse(seen!.body)).toMatchObject({
      promptTail: input.promptTail,
      promptChars: input.promptChars,
      hasTools: false,
      poolCandidates: input.poolCandidates,
    })
  })

  it('默认 3s 预算:挂起请求到点以失败收束(不无限等)', async () => {
    vi.useFakeTimers()
    setTransport(hangingTransport())
    const outcome = autoResolveChat(input)
    await vi.advanceTimersByTimeAsync(3_100)
    const res = await outcome
    expect(res.success).toBe(false)
    if (!res.success) expect(String(res.error)).toContain('请求超时')
  })

  it('调用方可显式收紧预算', async () => {
    vi.useFakeTimers()
    setTransport(hangingTransport())
    const outcome = autoResolveChat(input, { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(110)
    const res = await outcome
    expect(res.success).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
