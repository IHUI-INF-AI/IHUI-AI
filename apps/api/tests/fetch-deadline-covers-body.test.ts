// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账号 G-814420 —— fetch deadline 必须罩住「响应体消费」的回归测试。
//
// 立因(上游证据,已整读到体):
//   .ihui-agent/tmp/zcode-study/zcode/packages/services/src/bots/providers/providerRequest.ts:34-40 / :53-57
//   原文写明:fetch() 在**响应头到达时**就 resolve,若此时 clearTimeout 并返回裸 Response,
//   服务端「headers 之后停滞」这条请求会永久占住串行队列(没有 deadline、没有 abort、永不结束)。
//
// 本套件用可控 fake fetch + fake body(模拟 undici 语义:signal 触发 abort 时,
// 尚未完成的 body 读取以 signal.reason 拒绝),配合 vitest 假计时器推进,钉四件事:
//   ① headers 已到、body 停滞 ⇒ deadline 仍在计时,body 读必须被 abort(不永挂)
//   ② 正常路径 ⇒ body 读完后不留未 clear 的定时器
//   ③ 传输层抛错路径 ⇒ 同样不留定时器(不得只在成功分支 clear)
//   ④ withBody() 显式出口 ⇒ 收完即解除 deadline
// 纯单元,不发网络请求、不连库(§5 测试隔离铁律)。
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { fetchWithinDeadline, withBody } from '../src/utils/fetch-deadline.js'

/** fake body 停滞的响应:json()/text() 返回「只在 abort 时拒绝、否则永不 resolve」的 Promise(逐字模拟 undici)。 */
function makeStallingResponse(signal: AbortSignal | undefined): Response {
  const stall = (): Promise<never> =>
    new Promise<never>((_resolve, reject) => {
      if (!signal) return
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      // 故意不 resolve:模拟服务端发完 headers 后不再吐 body 字节
    })
  return {
    ok: true,
    status: 200,
    json: stall,
    text: stall,
    arrayBuffer: stall,
  } as unknown as Response
}

/** 正常响应:headers 与 body 都立即可得。 */
function makeOkResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

const asFetch = (fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
  fn as unknown as typeof fetch

describe('fetchWithinDeadline:deadline 覆盖到响应体消费结束', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('① headers 已到、body 停滞 ⇒ deadline 不因 headers 解除,且 body 读被 abort(不永挂)', async () => {
    const timeoutMs = 1_000
    const fetchImpl = asFetch(async (_input, init) => makeStallingResponse(init?.signal ?? undefined))

    const res = await fetchWithinDeadline('https://vendor.example/stalled', {}, {
      timeoutMs,
      label: '停滞源',
      fetchImpl,
    })

    // headers 已返回:此刻定时器必须**还在**(旧写法在这里就已经 clearTimeout 了)
    expect(vi.getTimerCount()).toBe(1)

    // 开始读 body,并确认它在 deadline 之前不会自行结束
    const pending = res.json()
    let pendingSettled = false
    void pending.then(
      () => {
        pendingSettled = true
      },
      () => {
        pendingSettled = true
      },
    )
    await vi.advanceTimersByTimeAsync(timeoutMs - 1)
    expect(pendingSettled).toBe(false)

    // 推进到 deadline:停滞的 body 读必须被 abort,而不是永久占住调用方
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).rejects.toThrow(/停滞源/)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('② 正常路径 ⇒ body 读完后不留下未 clear 的定时器', async () => {
    const fetchImpl = asFetch(async () => makeOkResponse({ ok: true }))

    const res = await fetchWithinDeadline('https://vendor.example/ok', {}, {
      timeoutMs: 5_000,
      label: '正常源',
      fetchImpl,
    })
    expect(vi.getTimerCount()).toBe(1) // 尚未读 body:deadline 仍生效

    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(vi.getTimerCount()).toBe(0) // 收完即解除,不留挂起定时器
  })

  it('③ 传输层抛错路径 ⇒ 同样不留定时器(异常分支也必须 clear)', async () => {
    const fetchImpl = asFetch(async () => {
      throw new Error('socket hang up')
    })

    await expect(
      fetchWithinDeadline('https://vendor.example/boom', {}, { timeoutMs: 5_000, fetchImpl }),
    ).rejects.toThrow('socket hang up')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('④ withBody() 显式出口 ⇒ 消费函数返回即收口(含抛错路径)', async () => {
    const fetchImpl = asFetch(async () => makeOkResponse({ items: [1, 2] }))

    const res = await fetchWithinDeadline('https://vendor.example/with-body', {}, {
      timeoutMs: 3_000,
      label: 'withBody',
      fetchImpl,
    })
    const payload = await withBody(res, async (r) => (await r.json()) as { items: number[] })
    expect(payload).toEqual({ items: [1, 2] })
    expect(vi.getTimerCount()).toBe(0)

    // body 读抛错同样收口(否则失败路径又把定时器留在队列里)
    const stalling = asFetch(async (_input, init) => makeStallingResponse(init?.signal ?? undefined))
    const res2 = await fetchWithinDeadline('https://vendor.example/with-body-fail', {}, {
      timeoutMs: 1_000,
      label: 'withBody 失败',
      fetchImpl: stalling,
    })
    const reading = withBody(res2, (r) => r.text())
    // 立刻挂 handler:否则「reject 发生在推进计时器那一刻、断言在之后」会被 Node 记成
    // unhandledRejection(vitest 据此判整个套件红,即使 4 条断言全过)。
    let readSettled = false
    void reading.then(
      () => {
        readSettled = true
      },
      () => {
        readSettled = true
      },
    )
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(reading).rejects.toThrow(/withBody 失败/)
    expect(readSettled).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

// ============================================================================
// 台账号 G-815411 —— 路由层把 deadline abort 与「空响应」分流(ai-audio 端到端)。
//
// 旧形态:`await resp.json().catch(() => ({}))` 先读 body、`if (!resp.ok)` 后判 ——
// headers 200 + body 停滞时,deadline abort 把 json() 的拒绝折叠成 data={},请求走进
// 「空结果」正常分支:网络故障被伪装成空数据/成功(§5e 失败必须响)。
// 本套件钉四件事:
//   ① 停滞 ⇒ /audio/speech 回 502,错误文案与日志都点名 label
//   ② 正常 200 + 完整 body ⇒ 行为逐字不变(反例约束)
//   ③ HTTP 错误 + message ⇒ 502 且 message 透传(!ok 分支重排后不退化)
//   ④ /audio/chat 的 ASR 前置步停滞 ⇒ 502,不得被读成 400「语音识别未获取到有效文本」
// 纯 app.inject,不发网络请求、不连库(§5 测试隔离铁律)。
// ============================================================================

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn().mockResolvedValue(true),
}))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ sub: 'test-user' }),
}))

import { aiAudioRoutes } from '../src/routes/ai-audio.js'

describe('G-815411:路由层把 deadline abort 与「空响应」分流(ai-audio 端到端)', () => {
  const REAL_FETCH = globalThis.fetch
  const savedKey = process.env.DASHSCOPE_API_KEY
  let app: FastifyInstance
  let logErrors: string[]

  /** 路由级 fake 响应:可控 headers/payload,或带停滞 body(abort 时以 signal.reason 拒绝)。 */
  function makeRouteResponse(opts: {
    ok?: boolean
    status?: number
    headers?: Record<string, string>
    payload?: unknown
    stallSignal?: AbortSignal
  }): Response {
    const stall = (): Promise<never> =>
      new Promise<never>((_resolve, reject) => {
        const signal = opts.stallSignal
        if (!signal) return
        if (signal.aborted) {
          reject(signal.reason)
          return
        }
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      headers: { get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null },
      json: opts.stallSignal ? stall : async () => opts.payload,
      text: opts.stallSignal ? stall : async () => JSON.stringify(opts.payload ?? {}),
      arrayBuffer: opts.stallSignal ? stall : async () => new ArrayBuffer(0),
    } as unknown as Response
  }

  function installStallingFetch(): void {
    ;(globalThis as { fetch: unknown }).fetch = (async (_input, init) =>
      makeRouteResponse({
        headers: { 'content-type': 'application/json' },
        stallSignal: init?.signal,
      })) as unknown as typeof fetch
  }

  beforeAll(async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key'
    logErrors = []
    // pino 窄桩:只收 error 流(断言「日志点名 label」用),其余静默。
    const logger: Record<string, unknown> = {
      level: 'error',
      fatal: () => {},
      error: (obj: unknown, msg?: unknown) => {
        logErrors.push(`${String(msg ?? '')} ${JSON.stringify(obj)}`)
      },
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      child: () => logger,
    }
    app = Fastify({ loggerInstance: logger as never })
    await app.register(aiAudioRoutes, { prefix: '/api/ai' })
    await app.ready()
  })

  afterAll(async () => {
    process.env.DASHSCOPE_API_KEY = savedKey
    await app.close()
  })

  afterEach(() => {
    ;(globalThis as { fetch: unknown }).fetch = REAL_FETCH
  })

  /** 等 handler 真正跑到「注册 deadline 定时器」那一步(setImmediate 不在 fake 名单,真跑)。 */
  async function waitForDeadlineArmed(): Promise<void> {
    for (let i = 0; i < 100 && vi.getTimerCount() === 0; i++) {
      await new Promise((r) => setImmediate(r))
    }
    expect(vi.getTimerCount()).toBe(1)
  }

  it('① headers 200 + body 停滞 ⇒ /audio/speech 回 502,错误文案与日志都点名 label(不再折叠成空结果)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    installStallingFetch()

    const pending = app.inject({
      method: 'POST',
      url: '/api/ai/audio/speech',
      payload: { text: '你好' },
    })
    await waitForDeadlineArmed()
    await vi.advanceTimersByTimeAsync(120_000)
    const res = await pending

    expect(res.statusCode).toBe(502)
    expect(res.body).toContain('ai-audio→DashScope 出站请求')
    expect(res.body).toContain('响应体消费阶段')
    expect(logErrors.some((line) => line.includes('ai-audio→DashScope 出站请求'))).toBe(true)
  })

  it('② 正常 200 + 完整 body ⇒ 行为逐字不变(200 + task_id 透传)', async () => {
    ;(globalThis as { fetch: unknown }).fetch = (async () =>
      makeRouteResponse({
        headers: { 'content-type': 'application/json' },
        payload: { output: { task_id: 't-1', task_status: 'PENDING' } },
      })) as unknown as typeof fetch

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/audio/speech',
      payload: { text: '你好' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { task_id: 't-1', status: 'PENDING' },
    })
  })

  it('③ HTTP 500 + message ⇒ 502 且 message 透传(!ok 分支重排后不退化)', async () => {
    ;(globalThis as { fetch: unknown }).fetch = (async () =>
      makeRouteResponse({
        ok: false,
        status: 500,
        headers: { 'content-type': 'application/json' },
        payload: { message: '配额不足' },
      })) as unknown as typeof fetch

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/audio/speech',
      payload: { text: '你好' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.body).toContain('配额不足')
    expect(res.body).toContain('语音合成失败')
  })

  it('④ /audio/chat 的 ASR 前置步 body 停滞 ⇒ 502,不得被读成 400「语音识别未获取到有效文本」', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    installStallingFetch()

    const pending = app.inject({
      method: 'POST',
      url: '/api/ai/audio/chat',
      payload: { audio_base64: 'aGVsbG8=' },
    })
    await waitForDeadlineArmed()
    await vi.advanceTimersByTimeAsync(120_000)
    const res = await pending

    expect(res.statusCode).toBe(502)
    expect(res.body).not.toContain('语音识别未获取到有效文本')
    expect(res.body).toContain('响应体消费阶段')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
