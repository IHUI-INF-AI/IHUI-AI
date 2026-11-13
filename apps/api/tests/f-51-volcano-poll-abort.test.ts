// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-51 回归:火山异步生图轮询的「可中断 + 有界」。
 *
 * 票面:`_shared.pollVolcengineTask` 在 HTTP 请求线程内默认 60 次 × 5s(单次超时 60s),
 * 既不感知客户端断开,也没有整段 deadline。修复后:
 *   1) reply.raw 的提前 close(已写完的 close 视为正常结束)即中止 sleep 与在途请求,
 *      且不再发下一次、不再写 reply;
 *   2) 总时长 / 单次超时 / 次数三层上界集中定义在 VOLCENGINE_POLL_LIMITS;
 *   3) 正常完成与超时 504 的对外行为不变(同步返回形态未改)。
 *
 * 上游由 proxy-dispatcher 的三处出站入口整体替身,不建立真实网络连接。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { FastifyReply } from 'fastify'

const { upstream } = vi.hoisted(() => ({ upstream: vi.fn() }))

vi.mock('../src/utils/proxy-dispatcher.js', () => ({
  collectEgressFacts: () => ({ proxied: false }),
  directEgressFetch: (...args: unknown[]) => upstream(...args),
  proxiedFetch: (...args: unknown[]) => upstream(...args),
}))

import {
  pollVolcengineTask,
  VOLCENGINE_POLL_LIMITS,
  VOLCENGINE_POLL_MAX_POLLS,
} from '../src/routes/ai-vendors/_shared.js'

/** 只需 json(),fetchWithTimeout 的其余行为与本票无关。 */
function jsonResponse(payload: unknown): Response {
  return { json: async () => payload } as unknown as Response
}

type ReplyMock = FastifyReply & {
  raw: EventEmitter & { writableEnded: boolean }
  log: { warn: ReturnType<typeof vi.fn> }
  status: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

function makeReply(): ReplyMock {
  const raw = Object.assign(new EventEmitter(), { writableEnded: false })
  const reply = {
    raw,
    log: { warn: vi.fn() },
    status: vi.fn(),
    send: vi.fn(),
  }
  reply.status.mockReturnValue(reply)
  reply.send.mockReturnValue(reply)
  return reply as unknown as ReplyMock
}

async function waitFor(cond: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now()
  while (!cond()) {
    if (Date.now() - started > timeoutMs) throw new Error('waitFor 超时')
    await new Promise((r) => setTimeout(r, 5))
  }
}

afterEach(() => {
  vi.useRealTimers()
  upstream.mockReset()
})

describe('F-51 火山异步任务轮询:客户端断开即中止', () => {
  it('断开后不再轮询、不再请求上游、不写 reply,并留痕日志', async () => {
    upstream.mockImplementation(async () => jsonResponse({ data: { status: 'running' } }))
    const reply = makeReply()
    const pending = pollVolcengineTask('ak', 'sk', 'jimeng_t2i_v40', 'task-abort', reply, 100, 10)

    await waitFor(() => upstream.mock.calls.length === 1)
    reply.raw.emit('close')

    const result = await pending
    const callsAtAbort = upstream.mock.calls.length
    expect(result).toBeNull()
    expect(reply.status).not.toHaveBeenCalled()
    expect(reply.send).not.toHaveBeenCalled()
    expect(reply.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reqKey: 'jimeng_t2i_v40', taskId: 'task-abort' }),
      expect.stringContaining('客户端断开'),
    )

    await new Promise((r) => setTimeout(r, 60))
    expect(upstream.mock.calls.length).toBe(callsAtAbort)
    expect(reply.raw.listenerCount('close')).toBe(0)
  })

  it('响应已写完的 close 属正常结束,不中止轮询', async () => {
    upstream.mockImplementation(async () => jsonResponse({ data: { status: 'running' } }))
    const reply = makeReply()
    reply.raw.writableEnded = true
    const pending = pollVolcengineTask('ak', 'sk', 'jimeng_t2i_v40', 'task-done', reply, 3, 5)

    reply.raw.emit('close')
    const result = await pending

    expect(result).toBeNull()
    expect(upstream).toHaveBeenCalledTimes(3)
    expect(reply.status).toHaveBeenCalledWith(504)
    expect(reply.log.warn).not.toHaveBeenCalled()
  })
})

describe('F-51 火山异步任务轮询:有界与正常完成', () => {
  it('正常完成路径不变:看到 done 即返回,不发 504', async () => {
    let polls = 0
    upstream.mockImplementation(async () => {
      polls += 1
      return jsonResponse({
        data: { status: polls < 3 ? 'running' : 'done', image_urls: ['https://x/1.png'] },
      })
    })
    const reply = makeReply()

    const result = await pollVolcengineTask('ak', 'sk', 'jimeng_t2i_v40', 'task-ok', reply, 10, 1)

    expect(result).toMatchObject({ data: { status: 'done' } })
    expect(upstream).toHaveBeenCalledTimes(3)
    expect(reply.status).not.toHaveBeenCalled()
    expect(reply.send).not.toHaveBeenCalled()
    expect(reply.raw.listenerCount('close')).toBe(0)
  })

  it('上界生效:默认参数最多 24 轮(120s)后 504,不再无限打上游', async () => {
    vi.useFakeTimers()
    upstream.mockImplementation(async () => jsonResponse({ data: { status: 'running' } }))
    const reply = makeReply()

    const pending = pollVolcengineTask('ak', 'sk', 'jimeng_t2i_v40', 'task-timeout', reply)
    for (let i = 0; i < VOLCENGINE_POLL_MAX_POLLS; i++) {
      await vi.advanceTimersByTimeAsync(VOLCENGINE_POLL_LIMITS.intervalMs)
    }
    const result = await pending

    expect(result).toBeNull()
    expect(upstream).toHaveBeenCalledTimes(VOLCENGINE_POLL_MAX_POLLS)
    expect(reply.status).toHaveBeenCalledWith(504)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 504, message: '异步任务轮询超时' }),
    )
    expect(reply.raw.listenerCount('close')).toBe(0)

    // 上界本身也要被钉住:总时长 ≤ 120s、单次 < 原 60s、次数与总时长自洽。
    expect(VOLCENGINE_POLL_LIMITS.maxTotalMs).toBeLessThanOrEqual(120_000)
    expect(VOLCENGINE_POLL_LIMITS.requestTimeoutMs).toBeLessThan(60_000)
    expect(VOLCENGINE_POLL_MAX_POLLS).toBe(
      Math.ceil(VOLCENGINE_POLL_LIMITS.maxTotalMs / VOLCENGINE_POLL_LIMITS.intervalMs),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
