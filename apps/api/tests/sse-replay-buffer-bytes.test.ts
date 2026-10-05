// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-714(2026-10-05 立)SSE 重放缓冲的「字节水位 + 双放弃条件」取证。
//
// 要防的失败模式:缓冲只数「多少条」(MAX_EVENTS_PER_STREAM=2000),不量「多大」。
// 2000 条 3 KB 的 tool-result 就是 6 MB —— 条数远没撞线、droppedCount 恒为 0,
// 而 isReplayWindowComplete 那三条老判据照旧给出 complete:true。这就是票面点名的
// 「只数条数却冒充完整」。所以每组都是**成对**的:先给「完整该长什么样」的参照,
// 再给「字节越界必须是显式放弃、不许是完整」的正断;最后一组是装车证明(本仓最高频
// 失效型是"机制在、没接上"):生产侧确实把那一帧写到连接上,而且只写一次。
import { EventEmitter } from 'node:events'
import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply } from 'fastify'
import {
  getEventsAfter,
  getReplayWindowStatus,
  hasReplayHole,
  isReplayWindowComplete,
  pushEvent,
  registerStream,
  replayFrameBytes,
  reportReplayPendingBytes,
  takeSaturationEdge,
  REPLAY_HIGH_WATERMARK_BYTES,
  REPLAY_LOW_WATERMARK_BYTES,
  REPLAY_UNACKED_BYTE_CAP,
  REPLAY_UNACKED_GRACE_MS,
  REPLAY_WINDOW_BYTE_CAP,
} from '../src/utils/sse-replay-buffer.js'
import type { ReplayEvent } from '../src/utils/sse-replay-buffer.js'
import { createSession, emitUpstreamLine, finishSession, waitForReplayHeadroom } from '../src/utils/sse-stream-registry.js'

function freshKey(): string {
  return `g714-${Math.random().toString(36).slice(2)}:${Math.random().toString(36).slice(2)}`
}

/**
 * 造一条**重放帧字节数正好等于 frameBytes** 的事件。
 *
 * 补齐方式是「按 replayFrameBytes 现算反推」,不是「条数 × 常数」—— 与本票的字节口径同源
 * (口径 = `id: <id>\n<rawLine>\n\n`,utf8 实测;内容全 ASCII ⇒ 字符数即字节数,可核)。
 */
function makeEvent(id: number, frameBytes: number): ReplayEvent {
  const overhead = replayFrameBytes({ id, rawLine: '' })
  const event: ReplayEvent = {
    id,
    rawLine: `data: ${'x'.repeat(Math.max(1, frameBytes - overhead - 'data: '.length))}`,
  }
  expect(replayFrameBytes(event)).toBe(frameBytes) // 口径自证:实测必等于目标字节
  return event
}

describe('G-714 参照组①:没裁过也没放弃 ⇒ complete:true', () => {
  it('条数与字节都远未撞线 ⇒ complete:true / abandoned:false / recovery:null(与下面各组成对)', () => {
    const key = freshKey()
    registerStream(key)
    for (let i = 1; i <= 20; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    const st = getReplayWindowStatus(key, -1)
    expect(st).toMatchObject({
      known: true,
      complete: true,
      droppedCount: 0,
      abandoned: false,
      abandonReason: null,
      recovery: null,
      saturated: false,
    })
    expect(st.windowBytes).toBeGreaterThan(0) // 字节维确实在计量,不是摆设
    expect(st.windowBytes).toBeLessThan(REPLAY_WINDOW_BYTE_CAP)
    expect(hasReplayHole(key, -1)).toBe(false)
  })
})

describe('G-714 组②:字节越界必须是显式放弃,而不是被冒充的完整', () => {
  it('窗口字节撞穿 REPLAY_WINDOW_BYTE_CAP ⇒ abandoned + complete:false + recovery:resubscribe-from-beginning', () => {
    const key = freshKey()
    registerStream(key)
    for (let i = 1; i <= 3; i++) pushEvent(key, makeEvent(i, 2 * 1024 * 1024)) // 合计 6 MiB > 4 MiB
    const st = getReplayWindowStatus(key, 0)
    expect(st.windowBytes).toBeGreaterThan(REPLAY_WINDOW_BYTE_CAP)
    expect(st.abandoned).toBe(true)
    expect(st.abandonReason).toBe('window-bytes')
    expect(st.recovery).toBe('resubscribe-from-beginning')
    expect(st.complete).toBe(false) // ← 放弃态绝不报完整
    expect(hasReplayHole(key, 0)).toBe(true) // 路由据此走"全量重新生成"= 从头订阅
  })

  it('反向锁:纯判据三条一字未动,放弃闸落在 getReplayWindowStatus 上(同一组输入两种答案)', () => {
    // isReplayWindowComplete(seq, lowestId, droppedCount) 只看这三个数:一条没裁 ⇒ 判完整。
    expect(isReplayWindowComplete(0, 1, 0)).toBe(true)
    expect(isReplayWindowComplete(-1, null, 0)).toBe(true)
    // 而带放弃态的真缓冲必须报 false —— 这一格差异就是本票新增的那一维。
    const key = freshKey()
    registerStream(key)
    for (let i = 1; i <= 3; i++) pushEvent(key, makeEvent(i, 2 * 1024 * 1024))
    expect(getReplayWindowStatus(key, 0).complete).toBe(false)
    expect(getReplayWindowStatus(key, 1).complete).toBe(false) // 换 seq 也不许翻回完整
  })

  it('未确认维度(上游正解①):发送路径内同步判「未确认字节 > 上限」⇒ 放弃(unacked-bytes)', () => {
    const key = freshKey()
    registerStream(key)
    pushEvent(key, { id: 1, rawLine: 'data: 1\n' })
    expect(getReplayWindowStatus(key, 0).windowBytes).toBeLessThan(REPLAY_WINDOW_BYTE_CAP)
    reportReplayPendingBytes(key, REPLAY_UNACKED_BYTE_CAP + 1) // 对端没消费掉的实测字节
    const st = getReplayWindowStatus(key, 0)
    expect(st.abandoned).toBe(true)
    expect(st.abandonReason).toBe('unacked-bytes')
    expect(st.complete).toBe(false)
    expect(hasReplayHole(key, 0)).toBe(true)
  })
})

describe('G-714 组③:条数没超、droppedCount=0,却仍判放弃(本票新增的那一维)', () => {
  it('5 帧 ≈5 MiB ⇒ 条数是上限的 1/400、一条未裁,字节越界照样放弃', () => {
    const key = freshKey()
    registerStream(key)
    for (let i = 1; i <= 5; i++) pushEvent(key, makeEvent(i, 1 * 1024 * 1024 + 1024))
    const buffered = getEventsAfter(key, -1)
    expect(buffered.length).toBe(5)
    expect(buffered.length).toBeLessThan(2000) // 条数维度完全没撞线
    const st = getReplayWindowStatus(key, -1)
    expect(st.droppedCount).toBe(0) // 一条都没裁过头 ⇒ 老判据会说"完整"
    expect(st.windowBytes).toBeGreaterThan(REPLAY_WINDOW_BYTE_CAP)
    expect(st.abandoned).toBe(true)
    expect(st.abandonReason).toBe('window-bytes')
    expect(st.complete).toBe(false)
    // 成对参照:同样的三个入参,纯判据仍然判完整(证明拦截来自放弃态而非裁头)
    expect(isReplayWindowComplete(-1, 1, 0)).toBe(true)
  })

  it('时间维(上游正解②):字节远未撞线,最老未确认超宽限窗 ⇒ 同样放弃;归零也不撤销闩', () => {
    const base = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => base)
    try {
      const key = freshKey()
      registerStream(key)
      pushEvent(key, { id: 1, rawLine: 'data: 1\n' })
      reportReplayPendingBytes(key, 1024) // 只有 1 KiB 在途:字节维不构成放弃
      expect(getReplayWindowStatus(key, 0).abandoned).toBe(false)
      nowSpy.mockImplementation(() => base + REPLAY_UNACKED_GRACE_MS)
      expect(getReplayWindowStatus(key, 0).abandoned).toBe(false) // 判据是严格 > 宽限窗
      nowSpy.mockImplementation(() => base + REPLAY_UNACKED_GRACE_MS + 1)
      const st = getReplayWindowStatus(key, 0)
      expect(st.abandoned).toBe(true)
      expect(st.abandonReason).toBe('unacked-grace')
      expect(st.complete).toBe(false)
      reportReplayPendingBytes(key, 0) // 对端后来消费完了
      const after = getReplayWindowStatus(key, 0)
      expect(after.unackedBytes).toBe(0)
      expect(after.abandoned).toBe(true) // 单向闩:终态不回头
      expect(after.complete).toBe(false)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('只有 registerStream 换代才归零 —— 一次放弃不得被同 key 的下一轮流读成永久放弃', () => {
    const key = freshKey()
    registerStream(key)
    reportReplayPendingBytes(key, REPLAY_UNACKED_BYTE_CAP + 1)
    expect(getReplayWindowStatus(key, 0).abandoned).toBe(true)
    registerStream(key)
    expect(getReplayWindowStatus(key, 0)).toMatchObject({
      abandoned: false,
      abandonReason: null,
      complete: true,
      recovery: null,
      windowBytes: 0,
      unackedBytes: 0,
      saturated: false,
    })
  })
})

describe('G-714 组④:饱和边沿触发 —— 高水位进一次、低水位出一次、抖动不得重复发', () => {
  it('entered 只有一条、exited 只有一条;迟滞带内来回抖动不产生任何边沿', () => {
    const key = freshKey()
    registerStream(key)
    pushEvent(key, { id: 1, rawLine: 'data: 1\n' })
    expect(takeSaturationEdge(key)).toBe(null) // 还没越界

    // 高水位:进入 ⇒ 恰好一条 entered,消费后不重复
    reportReplayPendingBytes(key, REPLAY_HIGH_WATERMARK_BYTES)
    expect(getReplayWindowStatus(key, 0).saturated).toBe(true)
    expect(takeSaturationEdge(key)).toBe('entered')
    expect(takeSaturationEdge(key)).toBe(null)

    // 已饱和时继续上涨(仍在高水位之上)不得再发 entered
    reportReplayPendingBytes(key, REPLAY_HIGH_WATERMARK_BYTES + 256 * 1024)
    expect(getReplayWindowStatus(key, 0).saturated).toBe(true)
    expect(takeSaturationEdge(key)).toBe(null)

    // 回落到迟滞带内(高于低水位)⇒ 不解除饱和,也不发边沿
    reportReplayPendingBytes(key, REPLAY_LOW_WATERMARK_BYTES + 256 * 1024)
    expect(getReplayWindowStatus(key, 0).saturated).toBe(true)
    expect(takeSaturationEdge(key)).toBe(null)

    // 回落到 ≤ 低水位 ⇒ 恰好一条 exited
    reportReplayPendingBytes(key, REPLAY_LOW_WATERMARK_BYTES)
    expect(getReplayWindowStatus(key, 0).saturated).toBe(false)
    expect(takeSaturationEdge(key)).toBe('exited')
    expect(takeSaturationEdge(key)).toBe(null)

    // 带内来回抖动 ⇒ 一条边沿都不许再产生(反复发事件就是本票要防的抖动)
    for (const bytes of [200 * 1024, 900 * 1024, 300 * 1024, 900 * 1024, 200 * 1024]) {
      reportReplayPendingBytes(key, bytes)
      expect(takeSaturationEdge(key)).toBe(null)
    }
    expect(getReplayWindowStatus(key, 0).saturated).toBe(false)
  })

  it('报 0 ⇒ 未确认字节与宽限窗起点一起清空(解除饱和的正是这一格)', () => {
    const key = freshKey()
    registerStream(key)
    reportReplayPendingBytes(key, REPLAY_HIGH_WATERMARK_BYTES)
    expect(getReplayWindowStatus(key, 0).unackedBytes).toBe(REPLAY_HIGH_WATERMARK_BYTES)
    reportReplayPendingBytes(key, 0)
    const st = getReplayWindowStatus(key, 0)
    expect(st.unackedBytes).toBe(0)
    expect(st.saturated).toBe(false)
    expect(st.abandoned).toBe(false)
  })

  it('放弃态不再产生饱和边沿(终态之后的通知没有意义)', () => {
    const key = freshKey()
    registerStream(key)
    reportReplayPendingBytes(key, REPLAY_HIGH_WATERMARK_BYTES)
    expect(takeSaturationEdge(key)).toBe('entered')
    for (let i = 1; i <= 3; i++) pushEvent(key, makeEvent(i, 2 * 1024 * 1024)) // ⇒ window 越界放弃
    expect(getReplayWindowStatus(key, 0).abandoned).toBe(true)
    reportReplayPendingBytes(key, 0) // 试图解除饱和
    expect(takeSaturationEdge(key)).toBe(null)
  })
})

describe('G-714 装车证明:生产侧把「窗口已放弃、请全量重取」写到连接上', () => {
  /** ServerResponse 桩:可编排 socket 写队列长度(writableLength),与真实背压同源。 */
  function mockRawWithQueue(): {
    raw: FastifyReply['raw']
    writes: string[]
    stub: { writableLength: number }
  } {
    const writes: string[] = []
    const stub = {
      writableLength: 0,
      write: (chunk: string) => {
        writes.push(chunk)
        return true
      },
      end: () => {},
      on: () => {},
      off: () => {},
    }
    return { raw: stub as unknown as FastifyReply['raw'], writes, stub }
  }

  it('在途未确认越界那一帧起:连接收到一帧 abandoned/请全量重取,且只收到一帧', () => {
    vi.useFakeTimers()
    try {
      const key = freshKey()
      const { raw, writes, stub } = mockRawWithQueue()
      const session = createSession(raw, new AbortController(), key)
      stub.writableLength = REPLAY_UNACKED_BYTE_CAP + 1 // 实测:对端没消费
      for (let i = 1; i <= 4; i++) emitUpstreamLine(session, `data: {"n":${i}}`)

      const announced = writes.filter((w) => w.includes('replay-window-abandoned'))
      expect(announced).toHaveLength(1) // 单向闩:不得重复告知
      expect(announced[0]).toMatch(/^data: /) // 不编号:不把告知帧塞进可重放序列
      const payload = JSON.parse(
        (announced[0] ?? '').slice('data: '.length).trim(),
      ) as Record<string, unknown>
      expect(payload.action).toBe('resubscribe-from-beginning')
      expect(payload.reason).toBe('unacked-bytes')
      expect(String(payload.message)).toContain('请全量重取')
      // 载荷刻意不带 content / delta / text / sessionId —— 共享解析器
      // (packages/shared/src/utils/sse-parse.ts)尾部有泛化兜底,带上就会被折成
      // chunk/meta,把协议帧喷成正文(那文件已为此记过 D19-A1 / D113 / D151 三次)。
      for (const banned of ['content', 'delta', 'text', 'sessionId']) {
        expect(payload[banned]).toBeUndefined()
      }

      // 闩后不再往已死的窗口里追加:越界当帧已进窗,其后各帧一律不进(不许冒充可重放)
      expect(getEventsAfter(key, 0).map((e) => e.id)).toEqual([1])
      const st = getReplayWindowStatus(key, 0)
      expect(st.abandoned).toBe(true)
      expect(st.complete).toBe(false)
      expect(hasReplayHole(key, 0)).toBe(true)
      finishSession(session)
    } finally {
      vi.useRealTimers()
    }
  })

  it('成对参照:在途字节为 0 的同款流 ⇒ 一帧放弃也不写,四条照旧进窗且窗口 complete', () => {
    const key = freshKey()
    const { raw, writes } = mockRawWithQueue()
    const session = createSession(raw, new AbortController(), key)
    for (let i = 1; i <= 4; i++) emitUpstreamLine(session, `data: {"n":${i}}`)
    expect(writes.filter((w) => w.includes('replay-window-abandoned'))).toEqual([])
    expect(getEventsAfter(key, 0).map((e) => e.id)).toEqual([1, 2, 3, 4])
    const st = getReplayWindowStatus(key, 0)
    expect(st).toMatchObject({ abandoned: false, complete: true, droppedCount: 0, recovery: null })
  })
})

// 装车证明的另一半:④「饱和即暂停 drain」的闸。用真 EventEmitter 当 ServerResponse 桩,
// 这样 'drain' 事件与真实背压同源 —— 假桩只会自证"我调了这个函数",证不了它真会等。
describe('G-714 装车证明:waitForReplayHeadroom 是上游读循环里的暂停闸', () => {
  function mockRawEmitter(): {
    raw: FastifyReply['raw']
    writes: string[]
    bus: EventEmitter & { writableLength: number; write: (c: string) => boolean; end: () => void }
  } {
    const writes: string[] = []
    const bus = Object.assign(new EventEmitter(), {
      writableLength: 0,
      write: (chunk: string) => {
        writes.push(chunk)
        return true
      },
      end: () => {},
    })
    return { raw: bus as unknown as FastifyReply['raw'], writes, bus }
  }

  it('饱和时停在闸前,收到 socket drain 后按实测字节解除饱和并放行(不发放弃帧)', async () => {
    vi.useFakeTimers()
    try {
      const key = freshKey()
      const { raw, writes, bus } = mockRawEmitter()
      const session = createSession(raw, new AbortController(), key)
      bus.writableLength = REPLAY_HIGH_WATERMARK_BYTES // 在途 = 高水位(仍低于放弃上限)
      emitUpstreamLine(session, 'data: {"n":1}')
      expect(getReplayWindowStatus(key, 0).saturated).toBe(true)

      let result: 'clear' | 'abandoned' | null = null
      const gate = waitForReplayHeadroom(session)
      gate.then((r) => {
        result = r
      })
      await Promise.resolve()
      expect(result).toBe(null) // 还没放行:闸确实把 drain 拦住了

      bus.writableLength = 0 // 对端把写队列消费完了
      bus.emit('drain')
      expect(await gate).toBe('clear')
      expect(result).toBe('clear')
      expect(getReplayWindowStatus(key, 0).saturated).toBe(false)
      expect(writes.filter((w) => w.includes('replay-window-abandoned'))).toEqual([])
      finishSession(session)
    } finally {
      vi.useRealTimers()
    }
  })

  it('对端一直不消费 ⇒ 闸到宽限窗为止:落时间维放弃闩、写一帧告知、回 abandoned 让路由停透传', async () => {
    vi.useFakeTimers()
    const base = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => base)
    try {
      const key = freshKey()
      const { raw, writes, bus } = mockRawEmitter()
      const session = createSession(raw, new AbortController(), key)
      bus.writableLength = REPLAY_HIGH_WATERMARK_BYTES
      emitUpstreamLine(session, 'data: {"n":1}')

      const gate = waitForReplayHeadroom(session)
      await Promise.resolve()
      // 对端没消费:宽限窗越过(字节维始终没撞线 ⇒ 只能由时间维放弃)
      nowSpy.mockImplementation(() => base + REPLAY_UNACKED_GRACE_MS + 1)
      await vi.advanceTimersByTimeAsync(REPLAY_UNACKED_GRACE_MS + 1)

      expect(await gate).toBe('abandoned')
      const announced = writes.filter((w) => w.includes('replay-window-abandoned'))
      expect(announced).toHaveLength(1)
      expect(String(JSON.parse((announced[0] ?? '').slice(6).trim()).reason)).toBe('unacked-grace')
      expect(getReplayWindowStatus(key, 0)).toMatchObject({
        abandoned: true,
        abandonReason: 'unacked-grace',
        complete: false,
      })
      finishSession(session)
    } finally {
      nowSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
