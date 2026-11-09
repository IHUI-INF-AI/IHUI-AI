// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-38「aiServiceFetch 默认无 deadline」不变量测试(2026-11-08 立)。
 *
 * 要回答的问题:
 *  ① 调用方不传 signal 时,helper 必须自己装一个 deadline(而不是裸 fetch 无限等);
 *  ② deadline 到点必须抛**可识别的超时错误**(name=AiServiceTimeoutError / code=AI_SERVICE_TIMEOUT),
 *     不得让调用方把"上游没回"读成业务结果;
 *  ③ 调用方显式 signal 优先:helper 不另起 deadline,调用方 abort 的原错误原样上抛;
 *  ④ 上游 5xx 是**正常 Response**(不抛超时)—— 超时与 5xx 必须是两个可区分结论;
 *  ⑤ 非超时的网络错误(如 TypeError: fetch failed)原样上抛,不得被改写成超时。
 *
 * 另钉一条实现约束:deadline 只覆盖"等响应头",响应拿到后定时器必须清掉 —— 否则
 * SSE 流式响应会在超时点被 abort,长对话流被拦腰砍断(aiServiceFetchStream 复用同一实现)。
 *
 * 夹具只 mock 全局 fetch,不触达真实 ai-service / PG / Redis。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

import * as aiFetch from '../src/utils/ai-service-fetch.js'

/** 只带 Authorization 的假请求:helper 会透传它,避免后台任务分支去取系统 token */
const fakeRequest = {
  headers: { authorization: 'Bearer test-user-token' },
  query: {},
} as unknown as FastifyRequest

const mockFetch = vi.fn<typeof fetch>()

/** 把"没有 deadline"的等待在 300ms 处截断,避免改前红读数跑成 5s 超时 */
function withNoDeadlineSentinel<T>(p: Promise<T>): Promise<T | 'NO_DEADLINE'> {
  return Promise.race([
    p,
    new Promise<'NO_DEADLINE'>((resolve) => setTimeout(() => resolve('NO_DEADLINE'), 300)),
  ])
}

describe('aiServiceFetch 默认 deadline — F-38', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① 不传 signal 时默认装上 deadline(不是裸 fetch),且响应头到达后不再 abort', async () => {
    let seenSignal: AbortSignal | undefined
    mockFetch.mockImplementation((_input, init) => {
      seenSignal = (init as RequestInit | undefined)?.signal ?? undefined
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    const resp = await aiFetch.aiServiceFetch(fakeRequest, '/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(resp.status).toBe(200)
    expect(seenSignal, '默认 deadline 必须体现为 AbortSignal').toBeDefined()

    // 响应已到手:deadline 必须已清掉,不得在超时点把 SSE body 掐断
    await new Promise((r) => setTimeout(r, 80))
    expect(seenSignal?.aborted).toBe(false)
  })

  it('② deadline 到点:抛 AiServiceTimeoutError(code=AI_SERVICE_TIMEOUT),而不是无限等待', async () => {
    mockFetch.mockImplementation((_input, init) => {
      const signal = (init as RequestInit | undefined)?.signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason))
      })
    })

    const outcome = await withNoDeadlineSentinel(
      aiFetch
        .aiServiceFetch(fakeRequest, '/llm/chat', { method: 'POST', timeoutMs: 20 })
        .then(
          () => null,
          (e: unknown) => e,
        ),
    )
    expect(outcome, '不得无限等待(说明默认 deadline 没有生效)').not.toBe('NO_DEADLINE')
    expect(outcome).toBeInstanceOf(Error)
    expect((outcome as Error).name).toBe('AiServiceTimeoutError')
    expect((outcome as { code?: string }).code).toBe('AI_SERVICE_TIMEOUT')
  })

  it('③ 调用方显式 signal 优先:不另起 deadline,调用方 abort 的原错误原样上抛', async () => {
    const controller = new AbortController()
    let seenSignal: AbortSignal | undefined
    mockFetch.mockImplementation((_input, init) => {
      const signal = (init as RequestInit | undefined)?.signal
      seenSignal = signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason))
      })
    })

    const promise = aiFetch.aiServiceFetch(fakeRequest, '/llm/chat', {
      signal: controller.signal,
      timeoutMs: 20,
    })
    controller.abort()

    const err = await promise.then(
      () => null,
      (e: unknown) => e,
    )
    expect(seenSignal).toBe(controller.signal)
    expect(err).toBeInstanceOf(Error)
    // 调用方的 abort 不得被 helper 改写成"上游超时"
    expect((err as Error).name).not.toBe('AiServiceTimeoutError')
  })

  it('④ 上游 5xx 是正常 Response:不抛超时,超时与 5xx 可区分', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(new Response('upstream down', { status: 503 })))
    const resp = await aiFetch.aiServiceFetch(fakeRequest, '/llm/chat', { timeoutMs: 20 })
    expect(resp.status).toBe(503)
  })

  it('⑤ 非超时的网络错误原样上抛,不得被改写成超时', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new TypeError('fetch failed')))
    const err = await aiFetch
      .aiServiceFetch(fakeRequest, '/llm/chat', { timeoutMs: 20 })
      .then(
        () => null,
        (e: unknown) => e,
      )
    expect(err).toBeInstanceOf(TypeError)
    expect((err as Error).name).toBe('TypeError')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
