// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-693(2026-10-01)验收尺子 —— 流式「空闲超时」与「总超时」分离的唯一出口
 * `packages/shared/src/utils/stream-idle.ts`,以及它在 `provider/local.ts` 读环的装车证明。
 *
 * 三条硬断言(缺一条就不算"加了守卫"):
 *  1. 假流「发一块后永挂」⇒ 在 idleMs 内 reject 且 `code === 'MODEL_STREAM_IDLE'`;
 *  2. 先 abort ⇒ 抛的是 `signal.reason` **原物**(引用相等),不是自造的空闲错;
 *  3. 1 与 2 必须**互相区分** —— 同一条假流,只换"是否先取消",结论必须相反。
 *
 * 计时口径:用**极小真实 idleMs(40ms)**+ 真实推进,不用 vitest 假定时器 ——
 * 竞速实现走 setTimeout,而假定时器与 `ReadableStream` 的内部微任务队列不同步,
 * 会把"竞速没跑"伪装成"竞速通过"(本仓有"被时钟判红"的教训,反向同理)。
 * 断言里同时量**墙钟耗时上限**,这才排除"其实在等总超时 120s"。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DEFAULT_STREAM_IDLE_MS,
  MODEL_STREAM_IDLE_CODE,
  isModelStreamIdleError,
  raceStreamNext,
  raceStreamRead,
  resolveStreamIdleMs,
} from '@ihui/shared/utils/stream-idle'
import { streamOpenAiCompatible, type OpenAiStreamOptions } from '../src/provider/local.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

/** 同一条判例表与 packages/api-client/tests/g-693-stream-idle-parity.test.ts 逐字同形 */
const IDLE_CASES = [
  { name: '未配置回落默认档', raw: undefined, want: DEFAULT_STREAM_IDLE_MS },
  { name: '0=显式关闭', raw: 0, want: 0 },
  { name: '显式小值原样保留', raw: 40, want: 40 },
  { name: '负数是脏值不是关闭', raw: -1, want: DEFAULT_STREAM_IDLE_MS },
  { name: 'NaN 是脏值', raw: Number.NaN, want: DEFAULT_STREAM_IDLE_MS },
  { name: 'Infinity 是脏值', raw: Number.POSITIVE_INFINITY, want: DEFAULT_STREAM_IDLE_MS },
] as const

describe('G-693 空闲档解析(resolveStreamIdleMs)', () => {
  it('判例表非空且脏值/关闭/正常三类都在(空表=对账空转)', () => {
    expect(IDLE_CASES.length).toBeGreaterThanOrEqual(6)
    expect(IDLE_CASES.filter((c) => c.want === DEFAULT_STREAM_IDLE_MS).length).toBeGreaterThanOrEqual(3)
    expect(IDLE_CASES.filter((c) => c.want === 0).length).toBe(1)
  })

  for (const c of IDLE_CASES) {
    it(`resolve: ${c.name}`, () => {
      expect(resolveStreamIdleMs(c.raw)).toBe(c.want)
    })
  }
})

describe('G-693 三路竞速(raceStreamRead)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('假流"发一块后永挂"⇒ idleMs 内 reject 且 code=MODEL_STREAM_IDLE', async () => {
    const encoder = new TextEncoder()
    let n = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        n += 1
        if (n === 1) {
          controller.enqueue(encoder.encode('data: {"type":"text","content":"partial"}\n\n'))
          return
        }
        // 第二次 read 之后既不 enqueue 也不 close ⇒ 这条流"开着但不再送字节"
      },
    })
    const reader = stream.getReader()
    const t0 = Date.now()
    await expect(reader.read()).resolves.toMatchObject({ done: false })

    let caught: unknown
    try {
      await raceStreamRead(reader.read(), { idleMs: 40, label: 'unit' })
    } catch (e) {
      caught = e
    }
    const elapsed = Date.now() - t0
    expect(isModelStreamIdleError(caught)).toBe(true)
    expect((caught as { code?: string }).code).toBe(MODEL_STREAM_IDLE_CODE)
    expect(elapsed).toBeLessThan(5_000) // 排除"其实在等总超时"
    expect(elapsed).toBeGreaterThanOrEqual(30) // 没提前判死(不得小于 idle 档)
  })

  it('先 abort ⇒ 抛 signal.reason 原物(引用相等),且不被判成空闲', async () => {
    const controller = new AbortController()
    const reason = new Error('用户主动取消')
    controller.abort(reason)
    let caught: unknown
    try {
      await raceStreamRead(new Promise<never>(() => {}), {
        idleMs: 40,
        signal: controller.signal,
        label: 'unit',
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBe(reason) // 原物,不是新造的错误
    expect(isModelStreamIdleError(caught)).toBe(false)
  })

  it('竞速赢家是数据时原样递出,不留悬空定时器', async () => {
    await expect(raceStreamRead(Promise.resolve('chunk'), { idleMs: 1_000 })).resolves.toBe('chunk')
  })

  it('判别联合:raceStreamNext 三路各自定案,abort 一支带 reason 原物', async () => {
    await expect(raceStreamNext(Promise.resolve('v'), { idleMs: 1_000 })).resolves.toEqual({
      kind: 'value',
      value: 'v',
    })
    await expect(raceStreamNext(new Promise<never>(() => {}), { idleMs: 20 })).resolves.toEqual({
      kind: 'idle',
    })
    const controller = new AbortController()
    const reason = { code: 'user-cancel' }
    controller.abort(reason)
    const outcome = await raceStreamNext(new Promise<never>(() => {}), {
      idleMs: 1_000,
      signal: controller.signal,
    })
    expect(outcome.kind).toBe('abort')
    // 判别收窄后 reason 必须逐字是 abort() 传入的那个对象(引用相等,不是拷贝)
    expect(outcome.kind === 'abort' && outcome.reason).toBe(reason)
  })

  it('反向对照:idleMs=0(显式关闭)时同一条永挂 promise 不得被判死', async () => {
    // 没有这条,上面那支可能被"任何情况都 reject"的实现蒙过 —— 判据必须有方向。
    const never = new Promise<string>(() => {})
    const verdict = await Promise.race([
      raceStreamRead(never, { idleMs: 0 }).then(
        () => 'resolved' as const,
        () => 'rejected' as const,
      ),
      new Promise<'pending'>((r) => {
        setTimeout(() => r('pending'), 120)
      }),
    ])
    expect(verdict).toBe('pending')
  })
})

/** 造一条"第一块正常、之后永挂"的 Response(local provider 只读 ok/status/body/text) */
function hangingAfterFirstChunkResponse(): Response {
  const encoder = new TextEncoder()
  let served = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      served += 1
      if (served === 1) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'))
      }
      // 之后永挂:不 close、不 enqueue
    },
  })
  return {
    ok: true,
    status: 200,
    body,
    text: async () => '',
  } as unknown as Response
}

function baseOpts(): OpenAiStreamOptions {
  return {
    url: 'http://127.0.0.1:1/chat/completions',
    model: 'test-model',
    messages: [{ role: 'user', content: 'hi' }],
  }
}

describe('G-693 provider/local.ts 读环装车', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('死流在 idleMs 内以 MODEL_STREAM_IDLE 收口(不是吊到总超时)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingAfterFirstChunkResponse()))
    const t0 = Date.now()
    const got = await streamOpenAiCompatible({ ...baseOpts(), idleTimeoutMs: 40 })
    const elapsed = Date.now() - t0

    expect(elapsed).toBeLessThan(10_000)
    expect(got.finishReason).toBe('error')
    // 错误身份必须可识别:码在位,不得只留一句文案
    expect(got.error ?? '').toContain(MODEL_STREAM_IDLE_CODE)
    // 空闲前已收到的增量不得丢
    expect(got.text).toBe('partial')
  })

  it('反向对照:idleTimeoutMs=0 时同一条死流不得被产出空闲码(证明上一条的红来自判据本身)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingAfterFirstChunkResponse()))
    const pending = streamOpenAiCompatible({ ...baseOpts(), idleTimeoutMs: 0, timeoutMs: 5_000 })
    const verdict = await Promise.race([
      pending.then((r) => ({ settled: true, r }) as const),
      new Promise<{ settled: false }>((res) => {
        setTimeout(() => res({ settled: false }), 300)
      }),
    ])
    expect(verdict.settled).toBe(false) // 关闭判据 ⇒ 仍然"只等总超时"(改动前形态)
  })

  it('同一条死流但先取消 ⇒ 走 aborted 且不得带空闲码(两案互斥)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingAfterFirstChunkResponse()))
    const controller = new AbortController()
    controller.abort(new Error('用户取消'))

    const got = await streamOpenAiCompatible({
      ...baseOpts(),
      idleTimeoutMs: 40,
      signal: controller.signal,
    })

    expect(got.finishReason).toBe('abort')
    expect(got.error).toBe('aborted')
    expect(got.error ?? '').not.toContain(MODEL_STREAM_IDLE_CODE)
  })

  it('对照:正常收尾的流不受空闲判据影响(零回归)', async () => {    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, body, text: async () => '' }) as unknown as Response),
    )

    const got = await streamOpenAiCompatible({ ...baseOpts(), idleTimeoutMs: 5_000 })
    expect(got.error ?? '').toBe('')
    expect(got.text).toBe('ok')
  })

  it('通路锁:local.ts 真的引唯一出口并在读环里竞速(只建文件不接线=没有修)', () => {
    const src = readFileSync(resolve(REPO, 'apps/cli/src/provider/local.ts'), 'utf8')
    expect(src).toContain("'@ihui/shared/utils/stream-idle'")
    expect(src).toMatch(/await raceStreamRead\(reader\.read\(\)/u)
    // 反向锁:读环不得再留"裸 await reader.read()"的旧形态
    expect(src).not.toMatch(/await reader\.read\(\)/u)
  })

  it('禁 any 面:出口与调用点不得引入 any(本仓 TS 零技术债约束)', () => {
    const texts: Array<[string, string]> = [
      ['stream-idle.ts', readFileSync(resolve(REPO, 'packages/shared/src/utils/stream-idle.ts'), 'utf8')],
      ['local.ts', readFileSync(resolve(REPO, 'apps/cli/src/provider/local.ts'), 'utf8')],
    ]
    for (const [name, text] of texts) {
      expect(text, `${name} 不得含 : any`).not.toMatch(/:\s*any\b/u)
      expect(text, `${name} 不得含 as any`).not.toMatch(/\bas any\b/u)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
