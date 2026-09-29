// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815413 / G-815415 / G-815416 / G-815417 的回归(im-gateway 投递诚实性)。
 *
 * 每条判据都成对:正例 + "旧写法会怎样"的反例。只留前者的话,门可能只是把功能改坏了
 * 而账面看不出来(AGENTS §22c「镜像测试只复读实现就是复读机」同一条禁令)。
 *
 * 零连接:数据库整体桩掉(`vi.mock('../src/db/index.js')`),网络用注入的假 fetch,
 * 时间用假定时器 —— 用例不得对生产 PG 8810 / Redis 8811 产生任何副作用(§5 隔离铁律)。
 */
import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
}))

import { doFetch, attachWebhookRawBody, readWebhookRawBody } from '../src/routes/im-gateway.js'
import {
  INBOUND_DEDUP_TTL_MS,
  OUTBOUND_BACKOFF_BASE_MS,
  OUTBOUND_BACKOFF_CAP_MS,
  OUTBOUND_CIRCUIT_FAILURE_THRESHOLD,
  OUTBOUND_CIRCUIT_OPEN_MS,
  OUTBOUND_HARD_CUT_MARK,
  OUTBOUND_MAX_CHARS_PER_SEGMENT,
  OUTBOUND_MAX_SEGMENTS_PER_SEND,
  OUTBOUND_REQUEST_TIMEOUT_MS,
  OUTBOUND_RETRY_MAX_ATTEMPTS,
  OutboundCircuitBreaker,
  applyFoldToOutcome,
  buildInboundDedupKey,
  computeBackoffDelayMs,
  createMemoryDedupStore,
  createRedisDedupStore,
  deliverWithPolicy,
  deriveInboundMessageId,
  interpretPlatformResponse,
  planOutboundMessages,
  planTextSegments,
  renderOutboundSegments,
  runInboundIntake,
  type InboundDedupStore,
} from '../src/services/im-outbound-policy.js'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** 剥掉注释(源锁判据不得把注释里的字面量当成代码命中 —— 本仓门 131 同型)。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** headers 立即到达、响应体**永不 settle** 的假平台(体绑定到 fetch 收到的 signal)。 */
function hangingBodyFetch(): typeof globalThis.fetch {
  return (_input: string | URL | Request, init?: RequestInit) => {
    const signal = (init?.signal ?? null) as AbortSignal | null
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: () =>
        new Promise<string>((resolve, reject) => {
          if (signal?.aborted) reject(signal.reason ?? new Error('body 阶段超时'))
          signal?.addEventListener('abort', () =>
            reject(signal?.reason ?? new Error('body 阶段超时')),
          )
          void resolve
        }),
    } as unknown as Response
    return Promise.resolve(response)
  }
}

/** 逐条记录 claim/release 的夹具存储(不重写判据,只记录调用)。 */
function spyStore(claimResult: 'claimed' | 'duplicate' | 'unknown' = 'claimed') {
  const calls = { claim: 0, release: 0 }
  const store: InboundDedupStore = {
    claim: async () => {
      calls.claim += 1
      return claimResult
    },
    release: async () => {
      calls.release += 1
    },
  }
  return { store, calls }
}

// ============================================================================
// G-815413 — deadline 必须罩住响应体消费
// ============================================================================

describe('G-815413 出站 deadline 罩到响应体消费结束', () => {
  it('正例:headers 到达而响应体停滞 ⇒ 到点撤罩并回可分辨的超时结论', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingBodyFetch())

    const pending = doFetch('https://platform.example/hook', { method: 'POST' }, 'test-label')
    await vi.advanceTimersByTimeAsync(OUTBOUND_REQUEST_TIMEOUT_MS - 1)
    // 反向对照:没到点就判失败是另一型错(把慢响应误杀成超时)
    const early = await Promise.race([
      pending.then(() => 'settled' as const),
      Promise.resolve('pending' as const),
    ])
    expect(early).toBe('pending')

    await vi.advanceTimersByTimeAsync(OUTBOUND_REQUEST_TIMEOUT_MS + 10)
    const out = await pending
    expect(out.ok).toBe(false)
    expect(out.status).toBe('transport-error')
    expect(out.reason).toContain('超时')
    expect(out.retryable).toBe(true)
  })

  it('反例对照:旧写法(headers 一到就 clearTimeout 且不读体)在同一夹具下把这条判成"已投递"', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingBodyFetch())

    // 改造前 doFetch 的逐字形状(不是"我们估计旧写法会怎样")
    const legacy = await (async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      const resp = await fetch('https://platform.example/hook', {
        method: 'POST',
        signal: controller.signal,
      })
      clearTimeout(timer)
      return { sent: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` }
    })()
    expect(legacy.sent).toBe(true) // ← 旧账面的"已投递",而响应体一个字节都没落地

    const pending = doFetch('https://platform.example/hook', { method: 'POST' }, 'test-label')
    await vi.advanceTimersByTimeAsync(OUTBOUND_REQUEST_TIMEOUT_MS + 10)
    const modern = await pending
    expect(modern.ok).toBe(false) // 同一夹具、同一位置:新写法不认这张空支票
  })

  it('正向对照:响应体正常读完 ⇒ delivered(超时罩子不得把快响应误杀)', async () => {
    vi.stubGlobal('fetch', (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ code: 0, message_id: 'om_1' })),
      } as unknown as Response)) as unknown as typeof globalThis.fetch)
    const out = await doFetch('https://platform.example/hook', { method: 'POST' }, 'test-label')
    expect(out.ok).toBe(true)
    expect(out.providerMessageId).toBe('om_1')
  })
})

// ============================================================================
// G-815416 ① — 可分辨的投递结论
// ============================================================================

describe('G-815416 结论可分辨(2xx ≠ 已投递)', () => {
  const legacySentFromHttp = (status: number): boolean => status >= 200 && status < 300

  it('200 但业务码非 0 ⇒ business-rejected(旧写法按 resp.ok 记成 sent:true)', () => {
    const out = interpretPlatformResponse(
      200,
      JSON.stringify({ code: 230002, msg: 'bot not in chat' }),
    )
    expect(out.ok).toBe(false)
    expect(out.status).toBe('business-rejected')
    expect(out.retryable).toBe(false)
    expect(out.reason).toContain('230002')
    // 这一行就是"旧写法会怎样":旧档在这一格是绿的 ⇒ 新旧结论确有分叉,用例不是恒真
    expect(legacySentFromHttp(200)).toBe(true)
  })

  it('200 且 code=0 但没回 message_id ⇒ no-receipt(算失败,且不许自动重试)', () => {
    const out = interpretPlatformResponse(200, JSON.stringify({ code: 0 }))
    expect(out.ok).toBe(false)
    expect(out.status).toBe('no-receipt')
    expect(out.retryable).toBe(false)
    expect(legacySentFromHttp(200)).toBe(true)
  })

  it('正向对照:200 + code=0 + message_id ⇒ delivered 并带回执 id', () => {
    const out = interpretPlatformResponse(
      200,
      JSON.stringify({ code: 0, data: { message_id: 'om_9' } }),
    )
    expect(out).toMatchObject({ ok: true, status: 'delivered', providerMessageId: 'om_9' })
  })

  it('HTTP 档:5xx/429 可重试、400 不可重试(把"暂时不行"和"永远不行"分开)', () => {
    expect(interpretPlatformResponse(503, '')).toMatchObject({
      status: 'http-error',
      retryable: true,
    })
    expect(interpretPlatformResponse(429, '')).toMatchObject({ retryable: true })
    expect(interpretPlatformResponse(400, '')).toMatchObject({ retryable: false })
  })

  it('非 JSON 正文(通用 webhook 常回 "ok")⇒ 记 delivered 但不伪造回执', () => {
    const out = interpretPlatformResponse(200, 'ok')
    expect(out.ok).toBe(true)
    expect(out.providerMessageId).toBeUndefined()
  })
})

// ============================================================================
// G-815416 ②③ — 有界退避 + 熔断 + 唯一编排
// ============================================================================

describe('G-815416 退避有界', () => {
  it('指数递增、封顶在 CAP、非法 attempt 不等待', () => {
    expect([1, 2, 3, 4, 5].map((a) => computeBackoffDelayMs(a))).toEqual([
      OUTBOUND_BACKOFF_BASE_MS,
      OUTBOUND_BACKOFF_BASE_MS * 2,
      OUTBOUND_BACKOFF_BASE_MS * 4,
      OUTBOUND_BACKOFF_BASE_MS * 8,
      OUTBOUND_BACKOFF_CAP_MS,
    ])
    expect(computeBackoffDelayMs(0)).toBe(0)
    expect(computeBackoffDelayMs(Number.NaN)).toBe(0)
    expect(OUTBOUND_BACKOFF_CAP_MS).toBeLessThan(OUTBOUND_REQUEST_TIMEOUT_MS)
  })

  it('传输层失败最多实际发出 OUTBOUND_RETRY_MAX_ATTEMPTS 次,等待序列就是那一条', async () => {
    const sleeps: number[] = []
    let calls = 0
    const report = await deliverWithPolicy([1], {
      circuit: new OutboundCircuitBreaker({ now: () => 0 }),
      circuitKey: 'u::p',
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      sendItem: async () => {
        calls += 1
        return { ok: false, status: 'transport-error', reason: 'x', retryable: true, attempts: 1 }
      },
    })
    expect(calls).toBe(OUTBOUND_RETRY_MAX_ATTEMPTS)
    expect(report.attempts).toBe(OUTBOUND_RETRY_MAX_ATTEMPTS)
    expect(sleeps).toEqual([OUTBOUND_BACKOFF_BASE_MS, OUTBOUND_BACKOFF_BASE_MS * 2])
  })

  it('业务拒绝只发 1 次(把"平台已明确说不"当可重试 ⇒ 对平台的轰炸)', async () => {
    let calls = 0
    await deliverWithPolicy([1], {
      circuit: new OutboundCircuitBreaker(),
      circuitKey: 'u::p',
      sleep: async () => undefined,
      sendItem: async () => {
        calls += 1
        return interpretPlatformResponse(200, JSON.stringify({ code: 9 }))
      },
    })
    expect(calls).toBe(1)
  })
})

describe('G-815416 熔断(连续 N 次失败转熔断)', () => {
  it('到阈值即打开,打开期内一个请求都不发;半开只放一次探测', () => {
    let clock = 1_000
    const breaker = new OutboundCircuitBreaker({
      failureThreshold: OUTBOUND_CIRCUIT_FAILURE_THRESHOLD,
      openMs: OUTBOUND_CIRCUIT_OPEN_MS,
      now: () => clock,
    })
    const key = 'u::p'
    for (let i = 0; i < OUTBOUND_CIRCUIT_FAILURE_THRESHOLD - 1; i += 1) {
      breaker.recordFailure(key)
      expect(breaker.decision(key).allowed).toBe(true) // 没到阈值不得提前熔断
    }
    breaker.recordFailure(key)
    const d = breaker.decision(key)
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.retryAfterMs).toBeGreaterThan(0)

    clock += OUTBOUND_CIRCUIT_OPEN_MS
    const probe = breaker.decision(key)
    expect(probe.allowed).toBe(true)
    if (probe.allowed) expect(probe.halfOpen).toBe(true)
    // 探测在飞 ⇒ 第二个仍按打开处理(否则故障期会瞬间放进一整批)
    expect(breaker.decision(key).allowed).toBe(false)
  })

  it('正向对照:一次成功把连续失败计数清零(否则偶发失败会攒成永久熔断)', () => {
    const breaker = new OutboundCircuitBreaker({ failureThreshold: 3, openMs: 1000, now: () => 0 })
    breaker.recordFailure('k')
    breaker.recordFailure('k')
    breaker.recordSuccess('k')
    expect(breaker.snapshot('k')).toEqual({ consecutiveFailures: 0, opened: false })
    breaker.recordFailure('k')
    expect(breaker.snapshot('k').opened).toBe(false)
  })

  it('deliverWithPolicy 在熔断态直接回 circuit-open 且 sendItem 零调用', async () => {
    const breaker = new OutboundCircuitBreaker({
      failureThreshold: 1,
      openMs: 60_000,
      now: () => 0,
    })
    let calls = 0
    const sendItem = async () => {
      calls += 1
      return interpretPlatformResponse(500, '')
    }
    // maxAttempts:1 —— 本用例判的是"熔断后不再发请求",不是重试次数(那一维另有用例)
    const first = await deliverWithPolicy([1], {
      circuit: breaker,
      circuitKey: 'u::p',
      maxAttempts: 1,
      sendItem,
    })
    expect(calls).toBe(1)
    expect(first.outcome.status).toBe('http-error')

    const second = await deliverWithPolicy([1], {
      circuit: breaker,
      circuitKey: 'u::p',
      maxAttempts: 1,
      sendItem,
    })
    expect(calls).toBe(1) // 第二次连请求都没发出去
    expect(second.outcome.status).toBe('circuit-open')
    expect(second.outcome.attempts).toBe(0)
  })
})

// ============================================================================
// G-815417 — 分段:边界优先、不丢尾、硬切必须有标记、折叠必须报剩余数
// ============================================================================

describe('G-815417 分段', () => {
  const limit = 20

  it('不变量:分段是无损划分(join 逐字等于原文)且每段不超上限', () => {
    const samples = [
      'x'.repeat(55),
      '第一行\n第二行\n第三行\n' + 'y'.repeat(40),
      'a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3',
      '带感叹号!!!的句子'.repeat(4) + '!',
      '',
      '短到不需要切',
    ]
    for (const s of samples) {
      const plan = planTextSegments(s, limit)
      expect(plan.segments.map((x) => x.text).join('')).toBe(s)
      for (const seg of plan.segments) expect(seg.text.length).toBeLessThanOrEqual(limit)
    }
  })

  it('边界优先:有换行就断在换行后,没有换行断在空格后,都没有才硬切', () => {
    const withNewline = planTextSegments('a'.repeat(10) + '\n' + 'b'.repeat(15), limit)
    expect(withNewline.hardCutCount).toBe(0)
    expect(withNewline.segments[1]?.seam).toBe('newline')

    const withSpace = planTextSegments('a'.repeat(10) + ' ' + 'b'.repeat(15), limit)
    expect(withSpace.hardCutCount).toBe(0)
    expect(withSpace.segments[1]?.seam).toBe('space')

    const unbreakable = planTextSegments('!'.repeat(50), limit)
    expect(unbreakable.hardCutCount).toBeGreaterThan(0)
  })

  it('硬切必须带标记(票面点名"不得无标记硬切"):剥掉标记后才等于原文', () => {
    const plan = planTextSegments('!'.repeat(50), limit)
    const rendered = renderOutboundSegments(plan)
    expect(rendered.messages.length).toBeGreaterThan(1)
    const marked = rendered.messages.filter((m) => m.includes(OUTBOUND_HARD_CUT_MARK))
    expect(marked.length).toBe(plan.hardCutCount)
    const restored = rendered.messages.map((m) => m.split(OUTBOUND_HARD_CUT_MARK).join('')).join('')
    expect(restored).toBe('!'.repeat(50))
  })

  it('折叠:超出单次上限时末段写明"剩余 N 段未发送",绝不静默丢尾', () => {
    const plan = {
      segments: Array.from({ length: 12 }, (_unused, i) => ({ text: `s${i}`, seam: null })),
      hardCutCount: 0,
    }
    const rendered = renderOutboundSegments(plan)
    expect(rendered.messages.length).toBe(OUTBOUND_MAX_SEGMENTS_PER_SEND)
    expect(rendered.complete).toBe(false)
    expect(rendered.omittedSegmentCount).toBe(2)
    expect(rendered.messages[rendered.messages.length - 1]).toContain('剩余 2 段')
  })

  it('正向对照:没超上限 ⇒ complete=true 且一个字都不加', () => {
    const rendered = renderOutboundSegments(planTextSegments('正常的一条消息', limit))
    expect(rendered.complete).toBe(true)
    expect(rendered.omittedSegmentCount).toBe(0)
    expect(rendered.messages).toEqual(['正常的一条消息'])
  })

  it('planOutboundMessages:短文本/非文本原样一份(载荷不被改坏),长文本才分段', () => {
    const short = planOutboundMessages({ messageType: 'text', text: 'hi', chatId: 'c' })
    expect(short.items).toEqual([{ messageType: 'text', text: 'hi', chatId: 'c' }])
    expect(short.rendered).toBeNull()

    const card = planOutboundMessages({ messageType: 'card', card: { a: 1 }, chatId: 'c' })
    expect(card.items.length).toBe(1)
    expect(card.items[0]).toEqual({ messageType: 'card', card: { a: 1 }, chatId: 'c' })

    const long = planOutboundMessages({
      messageType: 'text',
      text: 'z'.repeat(OUTBOUND_MAX_CHARS_PER_SEGMENT * 2 + 5),
    })
    expect(long.items.length).toBeGreaterThan(1)
    for (const item of long.items) {
      expect((item.text ?? '').length).toBeLessThanOrEqual(
        OUTBOUND_MAX_CHARS_PER_SEGMENT + OUTBOUND_HARD_CUT_MARK.length,
      )
    }
  })
})

// ============================================================================
// G-815415 — 去重键 + TTL + 失败撤回
// ============================================================================

describe('G-815415 去重键', () => {
  it('平台没带消息 id:同一句话重投得到**同一个**键(旧写法 randomUUID 每次都是新键)', () => {
    const input = {
      platform: 'webhook',
      userId: 'u1',
      chatId: 'c1',
      fromUserId: 'f1',
      text: '重投的同一条',
    }
    expect(buildInboundDedupKey(input)).toBe(buildInboundDedupKey(input))
    expect(deriveInboundMessageId(input)).toBe(deriveInboundMessageId(input))
    // 旧写法的形状:两次随机 id 必不相等 ⇒ 二次落库、二次入队、LLM 回两遍
    expect(randomUUID() === randomUUID()).toBe(false)
  })

  it('正文不同 / 换会话 / 换归属用户 ⇒ 键不同(不能把别人的消息判成重复)', () => {
    const base = { platform: 'webhook', userId: 'u1', chatId: 'c1', fromUserId: 'f1', text: 'A' }
    expect(buildInboundDedupKey({ ...base, text: 'B' })).not.toBe(buildInboundDedupKey(base))
    expect(buildInboundDedupKey({ ...base, chatId: 'other' })).not.toBe(buildInboundDedupKey(base))
    expect(buildInboundDedupKey({ ...base, userId: 'u2' })).not.toBe(buildInboundDedupKey(base))
  })

  it('平台带了消息 id ⇒ 用它;没有会话时退到发送者而不是全平台共用一个桶', () => {
    const withId = buildInboundDedupKey({
      platform: 'feishu',
      userId: 'u1',
      chatId: 'c1',
      platformMessageId: 'om_1',
      text: 'x',
    })
    expect(withId).toContain('msg:om_1')
    const noChat = buildInboundDedupKey({
      platform: 'feishu',
      userId: 'u1',
      fromUserId: 'f9',
      text: 'x',
    })
    expect(noChat).toContain('::f9::')
  })

  it('TTL 与上游一致(2min)', () => {
    expect(INBOUND_DEDUP_TTL_MS).toBe(120_000)
  })
})

describe('G-815415 去重存储', () => {
  it('内存档:首次 claimed、重投 duplicate、**撤回后**重投又能 claimed', async () => {
    const store = createMemoryDedupStore({ now: () => 0 })
    expect(await store.claim('k', 1000)).toBe('claimed')
    expect(await store.claim('k', 1000)).toBe('duplicate')
    await store.release('k')
    expect(await store.claim('k', 1000)).toBe('claimed')
  })

  it('内存档:TTL 到点自动放行(标记不得变成永久屏蔽)', async () => {
    let clock = 0
    const store = createMemoryDedupStore({ now: () => clock })
    await store.claim('k', 1000)
    clock += 1500
    expect(await store.claim('k', 1000)).toBe('claimed')
  })

  it('Redis 档:SET NX 返回值决定 claimed/duplicate;命令抛错 ⇒ **unknown**(既不当重复也不当首次)', async () => {
    const seen: Array<Record<string, unknown>> = []
    const okStore = createRedisDedupStore({
      set: (key: string, value: string, mode: string, ttl: number, flag: string) => {
        seen.push({ key, value, mode, ttl, flag })
        return Promise.resolve('OK')
      },
      del: () => Promise.resolve(1),
    })
    expect(await okStore.claim('k', 2000)).toBe('claimed')
    expect(seen[0]).toEqual({ key: 'k', value: '1', mode: 'PX', ttl: 2000, flag: 'NX' })

    const dup = createRedisDedupStore({
      set: () => Promise.resolve(null),
      del: () => Promise.resolve(0),
    })
    expect(await dup.claim('k', 2000)).toBe('duplicate')

    const broken = createRedisDedupStore({
      set: () => Promise.reject(new Error('connection reset')),
      del: () => Promise.resolve(0),
    })
    expect(await broken.claim('k', 2000)).toBe('unknown')
    // 反向锁:判不出不得被洗成"重复"(那等于静默丢消息)
    expect(await broken.claim('k', 2000)).not.toBe('duplicate')
  })
})

describe('G-815415 流程:失败撤回(漏了它等于把重试路堵死)', () => {
  it('落库抛错 ⇒ 标记被撤回并原样上抛(平台重投进得来)', async () => {
    const { store, calls } = spyStore('claimed')
    await expect(
      runInboundIntake(store, 'k', 1000, {
        persist: async () => {
          throw new Error('db down')
        },
        handoff: async () => ({ queued: true }),
      }),
    ).rejects.toThrow('db down')
    expect(calls.claim).toBe(1)
    expect(calls.release).toBe(1)
  })

  it('正向对照:落库成功而入队失败 ⇒ **不**撤回(行已在库里,撤回会让重投再落一行),但 queued=false', async () => {
    const { store, calls } = spyStore('claimed')
    const res = await runInboundIntake(store, 'k', 1000, {
      persist: async () => undefined,
      handoff: async () => ({ queued: false, reason: 'Redis 未就绪' }),
    })
    expect(res).toMatchObject({ disposition: 'accepted', queued: false, dedupUndetermined: false })
    expect(calls.release).toBe(0)
  })

  it('duplicate ⇒ persist/handoff 都不被执行(重投不二次落库、不二次入队)', async () => {
    const { store } = spyStore('duplicate')
    let persisted = 0
    let handed = 0
    const res = await runInboundIntake(store, 'k', 1000, {
      persist: async () => {
        persisted += 1
      },
      handoff: async () => {
        handed += 1
        return { queued: true }
      },
    })
    expect(res.disposition).toBe('duplicate')
    expect(persisted).toBe(0)
    expect(handed).toBe(0)
  })

  it('unknown ⇒ 放行并挂 dedupUndetermined(判不出不等于重复,静默吞消息更糟)', async () => {
    const { store } = spyStore('unknown')
    let persisted = 0
    const res = await runInboundIntake(store, 'k', 1000, {
      persist: async () => {
        persisted += 1
      },
      handoff: async () => ({ queued: true }),
    })
    expect(persisted).toBe(1)
    expect(res.dedupUndetermined).toBe(true)
  })
})

// ============================================================================
// G-815418 ②(补的最后一格)— 原始字节的**承载对象**
// ============================================================================

describe('G-815418 ② rawBody 的写侧与读侧必须落在同一个对象上', () => {
  it('正例:写在 request、读 request ⇒ 取回真字节', () => {
    const carrier: Record<string, unknown> = {}
    attachWebhookRawBody(carrier, '{"a": 1,"b":2.0}')
    expect(readWebhookRawBody(carrier)).toBe('{"a": 1,"b":2.0}')
  })

  it('反例(那一版落地时的实际坏法):fastify 给 parser 的第一实参是 request 而不是 request.raw ⇒ 读侧恒 undefined', () => {
    // 逐字复刻 fastify v5 `lib/content-type-parser.js:305` 的实参形状:parser.fn(request, body, done)
    const raw: Record<string, unknown> = {}
    const request: Record<string, unknown> = { raw }
    attachWebhookRawBody(request, '{"a": 1,"b":2.0}')
    // 旧读侧取的是 request.raw —— 那里从来没有值,于是 HMAC 每一次都在算**再序列化结果**
    expect(readWebhookRawBody(raw)).toBeUndefined()
    // 新读侧取 request 本身 —— 才拿得到真字节
    expect(readWebhookRawBody(request)).toBe('{"a": 1,"b":2.0}')
  })

  it('正向对照(闭环到判据):真字节取回来才能过 HMAC;取回来的是再序列化结果就必拒', () => {
    const raw = '{"a": 1,"b":2.0}'
    const sig = createHmac('sha256', 'secret-A').update(raw).digest('hex')
    const carrier: Record<string, unknown> = {}
    attachWebhookRawBody(carrier, raw)
    const carried = readWebhookRawBody(carrier) as string
    expect(createHmac('sha256', 'secret-A').update(carried).digest('hex')).toBe(sig)
    // 旧写法退回再序列化 ⇒ 同一枚合法签名算不出同一个 MAC(方向是"误拒合法请求")
    const reserialized = JSON.stringify(JSON.parse(raw))
    expect(createHmac('sha256', 'secret-A').update(reserialized).digest('hex')).not.toBe(sig)
  })
})

// ============================================================================
// 接线反向锁(判据在而没人调用 = 没有)
// ============================================================================

describe('路由与渠道侧接线', () => {
  const routeSrc = stripComments(
    readFileSync(fileURLToPath(new URL('../src/routes/im-gateway.ts', import.meta.url)), 'utf8'),
  )
  const channelSrc = stripComments(
    readFileSync(
      fileURLToPath(new URL('../src/services/clawdbot/channels.ts', import.meta.url)),
      'utf8',
    ),
  )

  it('im-gateway 必须真走 fetch-deadline 出口并消费响应体(不得留裸 fetch)', () => {
    expect(routeSrc.includes('fetchWithinDeadline(')).toBe(true)
    expect(routeSrc.includes('withBody(')).toBe(true)
    expect(routeSrc.includes('await fetch(')).toBe(false)
    expect(routeSrc.includes('interpretPlatformResponse(')).toBe(true)
  })

  it('出站编排必须只有一处:路由调 planOutboundMessages + deliverWithPolicy,不自抄退避/定时器', () => {
    expect(routeSrc.includes('planOutboundMessages(')).toBe(true)
    expect(routeSrc.includes('deliverWithPolicy(')).toBe(true)
    expect(routeSrc.includes('applyFoldToOutcome(')).toBe(true)
    expect(routeSrc.includes('setTimeout(')).toBe(false)
  })

  it('入站不得再伪造 randomUUID 当消息 id,且必须走 runInboundIntake', () => {
    expect(routeSrc.includes('?? randomUUID()')).toBe(false)
    expect(routeSrc.includes('runInboundIntake(')).toBe(true)
    expect(routeSrc.includes('buildInboundDedupKey(')).toBe(true)
    // randomUUID 仍用于 Matrix txnId(那是幂等事务号,与本票无关)
    expect(routeSrc.includes('const txnId = randomUUID()')).toBe(true)
  })

  it('rawBody 的读侧必须挂在 request 上,不得再读 request.raw(那一版就是在这格静默失效)', () => {
    expect(routeSrc.includes('readWebhookRawBody(request)')).toBe(true)
    expect(routeSrc.includes('attachWebhookRawBody(req')).toBe(true)
    expect(routeSrc.includes('request.raw as unknown as')).toBe(false)
  })

  it('applyFoldToOutcome:被折叠 ⇒ 结论不得是 delivered(前段发出去了也不能代表整条发完了)', async () => {
    const delivered = {
      ok: true,
      status: 'delivered' as const,
      providerMessageId: 'm1',
      retryable: false,
      attempts: 1,
    }
    const folded = applyFoldToOutcome(delivered, 2)
    expect(folded.ok).toBe(false)
    expect(folded.status).toBe('partial')
    expect(folded.reason).toContain('剩余 2 段')
    // 正向对照:没有折叠时结论逐字不变(不得把成功改判成失败)
    expect(applyFoldToOutcome(delivered, 0)).toEqual(delivered)
    // 已经失败的那一支:折叠信息追加进原因,但不改原有失败档
    const failed = applyFoldToOutcome(
      { ok: false, status: 'no-receipt', reason: '没回 id', retryable: false, attempts: 1 },
      3,
    )
    expect(failed.status).toBe('no-receipt')
    expect(failed.reason).toContain('没回 id')
    expect(failed.reason).toContain('剩余 3 段')
  })

  it('路由返回的响应仍带 api-client 契约里的 sent 字段(新增字段只能是追加)', () => {
    // 这一条是"既有面不破"的最小守卫:契约 SendImMessageResult 要求 sent/platform/chatId
    expect(routeSrc.includes('sent: result.ok')).toBe(true)
    expect(routeSrc.includes('status: result.status')).toBe(true)
  })

  it('clawdbot/channels.ts:8 处出站全部走同一超时出口,不得留裸 await fetch', () => {
    const outboundCalls = (channelSrc.match(/channelFetch\(/g) ?? []).length - 1 // 减去定义本身
    expect(outboundCalls).toBe(8)
    expect(channelSrc.includes('await fetch(')).toBe(false)
    expect(channelSrc.includes('fetchWithinDeadline(')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
