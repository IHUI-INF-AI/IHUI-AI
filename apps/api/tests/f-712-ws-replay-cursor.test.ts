// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-712 回归：WS 回放游标不能用毫秒时间戳独占。
 *
 * 要防的失败模式：同一毫秒内 RPUSH 两条消息（流式分片常见），客户端游标是该毫秒值，
 * 旧实现 `env.ts > since` 对同刻所有消息都为假 ⇒ 断线重连整批漏帧。
 *
 * 判据全部走真实工具模块，只把 ioredis 换成内存替身（不连 Redis）：
 * - envelope 带进程内单调序号 seq；
 * - 新游标 {ts, seq}：同毫秒用 seq 破平，只取游标之后的那条；
 * - 旧游标只给 ts：走 `>=`，同刻消息全部返回（宁重勿漏，客户端按 id 去重）；
 * - 回放窗口裁剪/TTL/上限逻辑不回归。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

/** 内存替身：pipeline 把 rpush 的值按序存进 list，lrange 原样返回 */
const store = vi.hoisted(() => ({
  list: [] as string[],
  rpushCalls: [] as Array<{ key: string; value: string }>,
  ltrimCalls: [] as Array<{ key: string; start: number; stop: number }>,
  expireCalls: [] as Array<{ key: string; ttl: number }>,
  reset(): void {
    store.list.length = 0
    store.rpushCalls.length = 0
    store.ltrimCalls.length = 0
    store.expireCalls.length = 0
  },
}))

vi.mock('ioredis', () => {
  class FakeRedis {
    on(): void {
      /* error 监听在替身下不产事件 */
    }
    async quit(): Promise<string> {
      return 'OK'
    }
    async lrange(_key: string, _start: number, _stop: number): Promise<string[]> {
      return [...store.list]
    }
    pipeline(): {
      rpush: (key: string, value: string) => unknown
      ltrim: (key: string, start: number, stop: number) => unknown
      expire: (key: string, ttl: number) => unknown
      exec: () => Promise<Array<[null, unknown]>>
    } {
      const p = {
        rpush: (key: string, value: string): unknown => {
          store.rpushCalls.push({ key, value })
          store.list.push(value)
          return p
        },
        ltrim: (key: string, start: number, stop: number): unknown => {
          store.ltrimCalls.push({ key, start, stop })
          return p
        },
        expire: (key: string, ttl: number): unknown => {
          store.expireCalls.push({ key, ttl })
          return p
        },
        exec: async (): Promise<Array<[null, unknown]>> => [[null, 1]],
      }
      return p
    }
  }
  return { default: FakeRedis }
})

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://localhost' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { bufferMessage, replayMessages, _resetReplayClient } from '../src/utils/ws-replay-buffer.js'

/** 读取第 n 条写入的 envelope */
function envelopeAt(n: number): { ts: number; seq?: number; data: unknown } {
  return JSON.parse(store.rpushCalls[n]!.value) as { ts: number; seq?: number; data: unknown }
}

describe('F-712 ws-replay-buffer 游标', () => {
  beforeEach(() => {
    _resetReplayClient()
    store.reset()
  })

  it('envelope 携带单调递增 seq，且键/裁剪/TTL 语义不变', async () => {
    await bufferMessage('room1', { id: 'a' })
    await bufferMessage('room1', { id: 'b' })
    await bufferMessage('room1', { id: 'c' })

    const seqs = [0, 1, 2].map((i) => envelopeAt(i).seq)
    expect(seqs.every((s) => typeof s === 'number')).toBe(true)
    expect(seqs[1]!).toBeGreaterThan(seqs[0]!)
    expect(seqs[2]!).toBeGreaterThan(seqs[1]!)

    // 裁剪/上限/TTL 不回归
    expect(store.rpushCalls[0]!.key).toBe('ws:replay:room1')
    expect(store.ltrimCalls[0]).toEqual({ key: 'ws:replay:room1', start: -500, stop: -1 })
    expect(store.expireCalls[0]).toEqual({ key: 'ws:replay:room1', ttl: 30 * 60 })
  })

  it('同毫秒两条消息：带 {ts, seq} 游标能取回第二条，不漏', async () => {
    await bufferMessage('room1', { id: 'm1' })
    await bufferMessage('room1', { id: 'm2' })
    const [e1, e2] = [envelopeAt(0), envelopeAt(1)]
    // 同一毫秒（构造同刻场景，不依赖真实时钟精度）
    const sameMs = 1_700_000_000_000
    store.list = [
      JSON.stringify({ ts: sameMs, seq: 1, data: { id: 'm1' } }),
      JSON.stringify({ ts: sameMs, seq: 2, data: { id: 'm2' } }),
    ]

    const replay = await replayMessages('room1', sameMs, 1)
    expect(replay).toEqual([{ id: 'm2' }])
    // 反向确认：旧游标两条都会返回，新游标只返回一条（不重复）
    expect(await replayMessages('room1', sameMs, 2)).toEqual([])
    expect(e1.seq).toBeLessThan(e2.seq!)
  })

  it('仅旧 ts 游标：同刻消息按 >= 返回，不丢（宁重勿漏）', async () => {
    const sameMs = 1_700_000_000_500
    store.list = [
      JSON.stringify({ ts: sameMs - 1, seq: 1, data: { id: 'older' } }),
      JSON.stringify({ ts: sameMs, seq: 2, data: { id: 'm1' } }),
      JSON.stringify({ ts: sameMs, seq: 3, data: { id: 'm2' } }),
    ]

    const replay = await replayMessages('room1', sameMs)
    expect(replay).toEqual([{ id: 'm1' }, { id: 'm2' }])
  })

  it('seq 只用于同毫秒破平：进程重启后 seq 回退不吞掉更高 ts 的新消息', async () => {
    store.list = [
      JSON.stringify({ ts: 1000, seq: 9, data: { id: 'before' } }),
      JSON.stringify({ ts: 2000, seq: 1, data: { id: 'after-restart' } }),
    ]
    // 游标 ts=1000 / seq=9；seq 重置后为 1，但 ts 更大 ⇒ 必须补发
    expect(await replayMessages('room1', 1000, 9)).toEqual([{ id: 'after-restart' }])
  })

  it('老版本 envelope 无 seq：同刻时保守补发，不漏', async () => {
    const sameMs = 1_700_000_001_000
    store.list = [
      JSON.stringify({ ts: sameMs, data: { id: 'legacy' } }),
      JSON.stringify({ ts: sameMs, seq: 4, data: { id: 'new' } }),
    ]
    expect(await replayMessages('room1', sameMs, 3)).toEqual([{ id: 'legacy' }, { id: 'new' }])
  })

  it('跨多条消息回放顺序稳定（按写入序升序），since=0 仍回放全部', async () => {
    const ts = 1_700_000_002_000
    store.list = [
      JSON.stringify({ ts, seq: 1, data: { id: 'a' } }),
      JSON.stringify({ ts, seq: 2, data: { id: 'b' } }),
      JSON.stringify({ ts: ts + 1, seq: 3, data: { id: 'c' } }),
    ]
    expect(await replayMessages('room1', 0)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(await replayMessages('room1', ts, 2)).toEqual([{ id: 'c' }])
  })
})
