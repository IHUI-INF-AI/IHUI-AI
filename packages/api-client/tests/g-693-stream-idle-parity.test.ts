// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-693(2026-10-01)api-client 侧尺子 —— 零依赖移植的**双面同形对账** + 读环装车证明。
 *
 * 为什么有一份移植而不是 import @ihui/shared:本包 dependencies 为空,而 @ihui/shared 的
 * sse 层反向依赖本包(import 过去即成环)。同形先例:frame-watermark.ts、error-serialize.ts。
 * "两份实现"只有在**机器强制它不能漂**时才不构成第二份真相,所以本文件三条锁:
 *  1. 行为判例表与 apps/cli/tests/g-693-stream-idle.test.ts 逐字同表(改一侧必须两侧同改);
 *  2. 哨兵之间那段源码**逐字节比对**(不是"看起来一样");
 *  3. 通路锁:executeAgentStream 的读环真的走 raceStreamRead,且假流"发一块后永挂"
 *     ⇒ onError 递出 code=MODEL_STREAM_IDLE;先取消 ⇒ 走 onDone 且**不得**带空闲码。
 *
 * 计时口径:极小真实 idleMs(40ms)+ 真实推进,不用假定时器(理由见 cli 侧同名测试头注)。
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
} from '../src/stream-idle.js'
import { executeAgentStream } from '../src/endpoints/agent-runtime.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

// ⚠️ 本表与 apps/cli/tests/g-693-stream-idle.test.ts 的表**逐字同表**(不是平行判例):
// 改任何一侧判例必须两侧同改,否则对账降级成自证。
const IDLE_CASES = [
  { name: '未配置回落默认档', raw: undefined, want: DEFAULT_STREAM_IDLE_MS },
  { name: '0=显式关闭', raw: 0, want: 0 },
  { name: '显式小值原样保留', raw: 40, want: 40 },
  { name: '负数是脏值不是关闭', raw: -1, want: DEFAULT_STREAM_IDLE_MS },
  { name: 'NaN 是脏值', raw: Number.NaN, want: DEFAULT_STREAM_IDLE_MS },
  { name: 'Infinity 是脏值', raw: Number.POSITIVE_INFINITY, want: DEFAULT_STREAM_IDLE_MS },
] as const

describe('G-693 移植侧档位判据 = 共享判例表', () => {
  it('判例表非空且正反例都有(空表/全正例 ⇒ 对账空转)', () => {
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

describe('G-693 移植侧三路竞速(与 canonical 同判据)', () => {
  it('假流"发一块后永挂"⇒ idleMs 内 reject 且 code=MODEL_STREAM_IDLE', async () => {
    const encoder = new TextEncoder()
    let n = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        n += 1
        if (n === 1) {
          controller.enqueue(encoder.encode('data: {"type":"text","content":"partial"}\n\n'))
        }
        // 之后既不 enqueue 也不 close ⇒ 第二次 read 永不 settle
      },
    })
    const reader = stream.getReader()
    await expect(reader.read()).resolves.toMatchObject({ done: false })

    const t0 = Date.now()
    let caught: unknown
    try {
      await raceStreamRead(reader.read(), { idleMs: 40, label: 'unit' })
    } catch (e) {
      caught = e
    }
    const elapsed = Date.now() - t0
    expect(isModelStreamIdleError(caught)).toBe(true)
    expect((caught as { code?: string }).code).toBe(MODEL_STREAM_IDLE_CODE)
    expect(elapsed).toBeLessThan(5_000)
  })

  it('先 abort ⇒ 抛 signal.reason 原物(引用相等)且不被判成空闲', async () => {
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
    expect(caught).toBe(reason)
    expect(isModelStreamIdleError(caught)).toBe(false)
  })

  it('判别联合(与 cli 侧同表):raceStreamNext 三路各自定案,abort 一支带 reason 原物', async () => {
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
    expect(outcome.kind === 'abort' && outcome.reason).toBe(reason)
  })

  it('反向对照(与 cli 侧同表):idleMs=0 时同一条永挂 promise 不得被判死', async () => {
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

  it('空闲先定案后,next 的迟到 rejection 不得冒成 unhandledRejection', async () => {
    const seen: unknown[] = []
    const onUnhandled = (err: unknown): void => {
      seen.push(err)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      let rejectLate!: (err: unknown) => void
      const late = new Promise<never>((_, reject) => {
        rejectLate = reject
      })
      await expect(raceStreamRead(late, { idleMs: 20 })).rejects.toThrow()
      // 竞速已由 idle 定案,这条迟到的 rejection 必须被出口内部吞掉(挂了 handler)
      rejectLate(new Error('late rejection after idle settled'))
      await new Promise<void>((r) => {
        setTimeout(r, 40)
      })
      expect(seen).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('G-693 双面同形对账', () => {
  const BEGIN = '// ==== G-693 共用出口实现('

  it('两侧哨兵都在位(哨兵缺失=整段比对退化成空串自证)', () => {
    const shared = readFileSync(resolve(REPO, 'packages/shared/src/utils/stream-idle.ts'), 'utf8')
    const port = readFileSync(resolve(REPO, 'packages/api-client/src/stream-idle.ts'), 'utf8')
    expect(shared).toContain(BEGIN)
    expect(port).toContain(BEGIN)
  })

  it('哨兵到文件末尾那段**逐字节同形**(漂移即红,不看"看起来一样")', () => {
    const segment = (p: string): string => {
      const text = readFileSync(resolve(REPO, p), 'utf8').replace(/\r\n/g, '\n')
      const i = text.indexOf(BEGIN)
      expect(i, `${p} 缺 BEGIN 哨兵`).toBeGreaterThanOrEqual(0)
      const seg = text.slice(i).trimEnd()
      expect(seg.length, `${p} 哨兵段过短(疑似被清空)`).toBeGreaterThan(1_000)
      return seg
    }
    expect(segment('packages/api-client/src/stream-idle.ts')).toBe(
      segment('packages/shared/src/utils/stream-idle.ts'),
    )
  })

  it('通路锁:executeAgentStream 的读环真走唯一出口,且不再留裸 reader.read()', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/endpoints/agent-runtime.ts'), 'utf8')
    expect(src).toContain("from '../stream-idle.js'")
    // 只裁 executeAgentStream 这一段(同文件另一条流 executeAgentRuntimeStream 未在本票射程)
    const start = src.indexOf('export async function executeAgentStream(')
    const end = src.indexOf('export async function sendToolApprovalResponse(')
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const body = src.slice(start, end)
    expect(body).toMatch(/await raceStreamRead\(reader\.read\(\)/u)
    expect(body).not.toMatch(/await reader\.read\(\)/u)
    expect(body).toContain('MODEL_STREAM_IDLE_CODE')
  })
})

/** 造一条"第一块正常、之后永挂"的 SSE Response */
function hangingAfterFirstChunkResponse(): Response {
  const encoder = new TextEncoder()
  let served = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      served += 1
      if (served === 1) {
        controller.enqueue(encoder.encode('data: {"type":"text","content":"partial"}\n\n'))
      }
      // 之后永挂:不 close、不 enqueue
    },
  })
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body,
    json: async () => {
      throw new Error('not json')
    },
    text: async () => '',
  } as unknown as Response
}

// AgentExecuteRequest 只要求 goal(string),不需要任何断言逃逸
const PARAMS = { goal: 'g-693 空闲超时验收' }

describe('G-693 executeAgentStream 读环装车', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('死流在 idleMs 内以 MODEL_STREAM_IDLE 收口,且不得伪装成 done', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingAfterFirstChunkResponse()))
    const onError = vi.fn()
    const onDone = vi.fn()
    const t0 = Date.now()

    await executeAgentStream(
      PARAMS,
      { onError, onDone },
      { baseUrl: 'http://127.0.0.1:1', streamIdleMs: 40 },
    )

    expect(Date.now() - t0).toBeLessThan(10_000)
    expect(onDone).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    // 身份必须随错误一起递出(第二参是码,不是文案)
    expect(onError.mock.calls[0]?.[1]).toBe(MODEL_STREAM_IDLE_CODE)
  })

  it('同一条死流但先取消 ⇒ 走 onDone 且不得带空闲码(两案互斥)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingAfterFirstChunkResponse()))
    const onError = vi.fn()
    const onDone = vi.fn()
    const controller = new AbortController()
    // 用字符串 reason:旧写法(isAbortError)会把这种取消读成"网络异常"
    controller.abort('用户切换会话')

    await executeAgentStream(PARAMS, { onError, onDone }, {
      baseUrl: 'http://127.0.0.1:1',
      streamIdleMs: 40,
      signal: controller.signal,
    })

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('反向对照:streamIdleMs=0 时同一条死流不得被递出空闲码(红必须来自判据本身)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingAfterFirstChunkResponse()))
    const onError = vi.fn()
    const settled = await Promise.race([
      executeAgentStream(PARAMS, { onError }, {
        baseUrl: 'http://127.0.0.1:1',
        streamIdleMs: 0,
      }).then(() => true),
      new Promise<false>((r) => {
        setTimeout(() => r(false), 300)
      }),
    ])
    expect(settled).toBe(false) // 关闭判据 ⇒ 仍停在"只等下一次 read"的旧形态
    expect(onError).not.toHaveBeenCalled()
  })

  it('对照:正常收尾的流不受空闲判据影响(零回归)', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            body,
            json: async () => ({}),
            text: async () => '',
          }) as unknown as Response,
      ),
    )
    const onError = vi.fn()
    const onDone = vi.fn()

    await executeAgentStream(PARAMS, { onError, onDone }, {
      baseUrl: 'http://127.0.0.1:1',
      streamIdleMs: 5_000,
    })

    expect(onError).not.toHaveBeenCalled()
  })

  it('禁 any 面:移植与调用点不得引入 any(本仓 TS 零技术债约束)', () => {
    const texts: Array<[string, string]> = [
      ['api-client/stream-idle.ts', readFileSync(resolve(REPO, 'packages/api-client/src/stream-idle.ts'), 'utf8')],
      ['agent-runtime.ts', readFileSync(resolve(REPO, 'packages/api-client/src/endpoints/agent-runtime.ts'), 'utf8')],
    ]
    for (const [name, text] of texts) {
      expect(text, `${name} 不得含 : any`).not.toMatch(/:\s*any\b/u)
      expect(text, `${name} 不得含 as any`).not.toMatch(/\bas any\b/u)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
