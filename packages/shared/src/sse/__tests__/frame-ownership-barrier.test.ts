// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816030:帧归属屏障成对测试(判据源 packages/shared/src/sse/frame-ownership-barrier.ts)
//
// 台账三条验收(逐条对齐,不是平行自证):
// ① ACK 前暂存的帧在 ACK 时**按原序**交付;
// ② 暂存超上限后再来一帧 ⇒ activate 必须抛错且**一帧都不交付** —— 并断
//    stagedCount===0 证明"整批清空"而非"shift 保上限"(shift 保上限正是
//    上游 packages/ui/src/v4/ackActivationBarrier.ts:114-128 点名要防的缺陷);
// ③ activate 抛错前必须已反向退订(断退订调用次数,不看日志文案)。

import { describe, it, expect, vi } from 'vitest'
import {
  FRAME_BARRIER_MAX_STAGED_FRAMES,
  FRAME_BARRIER_MAX_STAGED_BYTES,
  FrameBarrierOverflowError,
  createFrameOwnershipBarrier,
  type BarrierFrame,
} from '../frame-ownership-barrier'

const f = (topic: string, subscriptionId: string, byteSize?: number): BarrierFrame<string> => ({
  topic,
  subscriptionId,
  ...(byteSize !== undefined ? { byteSize } : {}),
  frame: `${topic}#${subscriptionId}`,
})

describe('G-816030 帧归属屏障:上限常量', () => {
  it('默认双上限可导入且为正(条数 512 / 字节 1MiB)', () => {
    expect(FRAME_BARRIER_MAX_STAGED_FRAMES).toBe(512)
    expect(FRAME_BARRIER_MAX_STAGED_BYTES).toBe(1 << 20)
  })
})

describe('G-816030 验收①:ACK 前暂存,ACK 后按原序交付', () => {
  it('ACK 前 3 帧全部暂存;activate 返回同 3 帧且按原序、暂存清空', () => {
    const barrier = createFrameOwnershipBarrier<string>()
    const a1 = f('chat-stream', 'sub-a')
    const a2 = f('chat-stream', 'sub-a')
    const a3 = f('chat-stream', 'sub-a')
    expect(barrier.offer(a1)).toBe('staged')
    expect(barrier.offer(a2)).toBe('staged')
    expect(barrier.offer(a3)).toBe('staged')
    expect(barrier.stagedCount()).toBe(3)

    const flushed = barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] })
    expect(flushed.map((x) => x.frame)).toEqual([a1.frame, a2.frame, a3.frame])
    expect(barrier.stagedCount()).toBe(0)
    // ACK 后所有权确立:后续同订阅同 topic 的帧直接 pass(不暂存)
    expect(barrier.isOwned('chat-stream', 'sub-a')).toBe(true)
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('pass')
  })

  it('多订阅共存:activate 只冲刷归属已激活 topic 的帧,其余订阅的暂存帧保留', () => {
    // topic 是所有权键:同一 topic 只能归属一个订阅,多订阅共存须各占 topic
    const barrier = createFrameOwnershipBarrier<string>()
    expect(barrier.offer(f('notify-stream', 'sub-a'))).toBe('staged')
    expect(barrier.offer(f('chat-stream', 'sub-b'))).toBe('staged')
    expect(barrier.offer(f('agent-log', 'sub-b'))).toBe('staged')

    const flushed = barrier.activate({
      subscriptionId: 'sub-b',
      topics: ['chat-stream', 'agent-log'],
    })
    // sub-b 的两帧按 offer 原序交付;sub-a 的帧不属于本次 ACK,保留等它自己的 ACK
    expect(flushed.map((x) => x.frame)).toEqual(['chat-stream#sub-b', 'agent-log#sub-b'])
    expect(barrier.stagedCount()).toBe(1)
    expect(barrier.isOwned('chat-stream', 'sub-a')).toBe(false)
    expect(barrier.isOwned('chat-stream', 'sub-b')).toBe(true)

    const lateFlush = barrier.activate({ subscriptionId: 'sub-a', topics: ['notify-stream'] })
    expect(lateFlush.map((x) => x.frame)).toEqual(['notify-stream#sub-a'])
    expect(barrier.stagedCount()).toBe(0)
  })
})

describe('G-816030 验收②:超上限 ⇒ activate 抛错且一帧不交付(整批清空,非 shift)', () => {
  it('条数上限:第 4 帧(上限 3)触发整批清空;activate 抛 FrameBarrierOverflowError 且 stagedCount===0', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 3 })
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    // 越界帧:返回 'overflow' 且**整批**(3 暂存 + 本帧 = 4)清空,不是 shift 掉头部保 3 条
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('overflow')
    expect(barrier.stagedCount()).toBe(0)
    expect(barrier.stagedBytes()).toBe(0)
    expect(barrier.overflowOf('sub-a')).toBe(true)

    // activate 必须抛错 —— 一帧都不交付(抛错即无返回值,交付无从发生)
    let delivered: BarrierFrame<string>[] | null = null
    expect(() => {
      delivered = barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] })
    }).toThrow(FrameBarrierOverflowError)
    expect(delivered).toBeNull()
  })

  it('溢出错误携带 reason="frames" 与整批 droppedCount', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 2 })
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a')) // 越界:2 + 1 = 3
    try {
      barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] })
      expect.unreachable('activate must throw on overflow')
    } catch (err) {
      expect(err).toBeInstanceOf(FrameBarrierOverflowError)
      const overflowErr = err as FrameBarrierOverflowError
      expect(overflowErr.reason).toBe('frames')
      expect(overflowErr.droppedCount).toBe(3)
    }
  })

  it('字节上限:byteSize 累计越界 ⇒ reason="bytes",同样整批清空', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedBytes: 100 })
    expect(barrier.offer(f('chat-stream', 'sub-a', 60))).toBe('staged')
    expect(barrier.stagedBytes()).toBe(60)
    // 60 + 50 = 110 > 100 ⇒ 整批清空
    expect(barrier.offer(f('chat-stream', 'sub-a', 50))).toBe('overflow')
    expect(barrier.stagedCount()).toBe(0)
    expect(barrier.stagedBytes()).toBe(0)
    try {
      barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] })
      expect.unreachable('activate must throw on byte overflow')
    } catch (err) {
      expect(err).toBeInstanceOf(FrameBarrierOverflowError)
      const overflowErr = err as FrameBarrierOverflowError
      expect(overflowErr.reason).toBe('bytes')
      expect(overflowErr.droppedCount).toBe(2)
    }
  })

  it('溢出后该订阅 offer 恒拒、activate 恒抛,直到 reset', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 1 })
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a'))
    expect(barrier.overflowOf('sub-a')).toBe(true)
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('overflow')
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('overflow')
    expect(() =>
      barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] }),
    ).toThrow(FrameBarrierOverflowError)
    // 其他订阅不受牵连
    expect(barrier.offer(f('chat-stream', 'sub-b'))).toBe('staged')
    // reset 清全部状态:同订阅可重新暂存/激活
    barrier.reset()
    expect(barrier.overflowOf('sub-a')).toBe(false)
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    expect(barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] })).toHaveLength(1)
  })
})

describe('G-816030 验收③:activate 抛错前必须已反向退订', () => {
  it('抛错前 unsubscribe 恰被调用一次(断调用次数,不看日志文案)', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 1 })
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a')) // 触发溢出
    const unsubscribe = vi.fn()
    expect(() =>
      barrier.activate({
        subscriptionId: 'sub-a',
        topics: ['chat-stream'],
        unsubscribe,
      }),
    ).toThrow(FrameBarrierOverflowError)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('未溢出的 activate 不调用 unsubscribe(反向锁:退订只属于越界路径)', () => {
    const barrier = createFrameOwnershipBarrier<string>()
    barrier.offer(f('chat-stream', 'sub-a'))
    const unsubscribe = vi.fn()
    const flushed = barrier.activate({
      subscriptionId: 'sub-a',
      topics: ['chat-stream'],
      unsubscribe,
    })
    expect(flushed).toHaveLength(1)
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it('unsubscribe 自身抛错不掩盖越界错误(仍抛 FrameBarrierOverflowError)', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 1 })
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a'))
    expect(() =>
      barrier.activate({
        subscriptionId: 'sub-a',
        topics: ['chat-stream'],
        unsubscribe: () => {
          throw new Error('unsubscribe blew up')
        },
      }),
    ).toThrow(FrameBarrierOverflowError)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
