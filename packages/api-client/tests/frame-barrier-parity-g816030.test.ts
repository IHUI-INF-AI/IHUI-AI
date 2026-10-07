// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816030:帧归属屏障的**双面同形对账**(api-client 零依赖包边界,先例:
// frame-watermark-parity-b76-13 —— 本包不得 import @ihui/shared,判据源
// packages/shared/src/sse/frame-ownership-barrier.ts 与本包移植件靠
// 同一张判例表 + 逐字标记串钉住:任何一侧改规则而另一侧不同步,该侧就红。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import {
  FRAME_BARRIER_MAX_STAGED_FRAMES,
  FRAME_BARRIER_MAX_STAGED_BYTES,
  FrameBarrierOverflowError,
  createFrameOwnershipBarrier,
  type BarrierFrame,
} from '../src/frame-ownership-barrier'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

const f = (topic: string, subscriptionId: string): BarrierFrame<string> => ({
  topic,
  subscriptionId,
  frame: `${topic}#${subscriptionId}`,
})

describe('G-816030 api-client 侧帧归属屏障 = 判据源同形(判例表)', () => {
  it('上限常量与判据源同值(512 条 / 1MiB)', () => {
    expect(FRAME_BARRIER_MAX_STAGED_FRAMES).toBe(512)
    expect(FRAME_BARRIER_MAX_STAGED_BYTES).toBe(1 << 20)
  })

  // 验收①:ACK 前暂存,ACK 后按原序交付
  it('ACK 前 3 帧全部暂存;activate 按原序交付且暂存清空、所有权确立', () => {
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
    expect(barrier.isOwned('chat-stream', 'sub-a')).toBe(true)
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('pass')
  })

  // 验收②:超上限 ⇒ activate 抛错且一帧不交付;stagedCount===0 证明"整批清空"
  // 而非"shift 保上限"(shift 保上限正是判据源点名要防的缺陷)
  it('条数超限:offer 溢出即整批清空;activate 抛 FrameBarrierOverflowError(reason=frames)', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 3 })
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('overflow')
    expect(barrier.stagedCount()).toBe(0)
    expect(barrier.stagedBytes()).toBe(0)
    expect(barrier.overflowOf('sub-a')).toBe(true)
    expect(() =>
      barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'] }),
    ).toThrow(FrameBarrierOverflowError)
  })

  // 验收③:activate 抛错前必须已反向退订(断调用次数,不看日志文案)
  it('activate 抛错前 unsubscribe 恰被调用一次', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 1 })
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a'))
    const unsubscribe = vi.fn()
    expect(() =>
      barrier.activate({ subscriptionId: 'sub-a', topics: ['chat-stream'], unsubscribe }),
    ).toThrow(FrameBarrierOverflowError)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('字节超限:reason="bytes",同样整批清空、activate 必抛', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedBytes: 100 })
    expect(barrier.offer({ ...f('chat-stream', 'sub-a'), byteSize: 60 })).toBe('staged')
    expect(barrier.stagedBytes()).toBe(60)
    expect(barrier.offer({ ...f('chat-stream', 'sub-a'), byteSize: 50 })).toBe('overflow')
    expect(barrier.stagedCount()).toBe(0)
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

  it('溢出订阅 offer 恒拒、其他订阅不受牵连、reset 后恢复', () => {
    const barrier = createFrameOwnershipBarrier<string>({ maxStagedFrames: 1 })
    barrier.offer(f('chat-stream', 'sub-a'))
    barrier.offer(f('chat-stream', 'sub-a'))
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('overflow')
    expect(barrier.offer(f('chat-stream', 'sub-b'))).toBe('staged')
    barrier.reset()
    expect(barrier.overflowOf('sub-a')).toBe(false)
    expect(barrier.offer(f('chat-stream', 'sub-a'))).toBe('staged')
  })

  it('结构同形:判据源与本移植的上限常量/类型/错误构造/越界判定标记逐字同族(漂移即红)', () => {
    const local = readFileSync(
      resolve(REPO, 'packages/api-client/src/frame-ownership-barrier.ts'),
      'utf8',
    )
    const shared = readFileSync(
      resolve(REPO, 'packages/shared/src/sse/frame-ownership-barrier.ts'),
      'utf8',
    )
    for (const marker of [
      'export const FRAME_BARRIER_MAX_STAGED_FRAMES = 512',
      'export const FRAME_BARRIER_MAX_STAGED_BYTES = 1 << 20',
      "export type FrameBarrierDeliveryKind = 'pass' | 'staged' | 'overflow'",
      'export class FrameBarrierOverflowError extends Error',
      "readonly reason: 'frames' | 'bytes'",
      'stagedCount(): number',
      'stagedBytes(): number',
      'overflowOf(subscriptionId: string): boolean',
      'staged.length + 1 > maxFrames || bytes + byteSizeOf(frame) > maxBytes',
      'throw new FrameBarrierOverflowError(overflow.reason, overflow.droppedCount)',
      'unsubscribe?.()',
    ]) {
      expect(local.includes(marker), `local 缺 ${marker}`).toBe(true)
      expect(shared.includes(marker), `shared 缺 ${marker}`).toBe(true)
    }
  })

  it('通路锁:client.ts 的水位闸真接帧归属屏障(暂存/ACK/复位三路都在,读环仍走 processLine)', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/client.ts'), 'utf8')
    expect(src).toContain("from './frame-ownership-barrier.js'")
    expect(src).toContain('frameBarrier.offer(')
    expect(src).toContain('ackFrameBarrier(')
    expect(src).toContain('frameBarrier.activate(')
    expect(src).toContain("verdict === 'overflow'")
    expect(src).toContain('frameBarrier.reset()')
    // D138 通路锁(继承自 frame-watermark-parity):带水位闸的 processLine 必须真接进
    // runResumableSSEStream 的 onLine —— 摘线(读环绕过水位闸)本用例必红。
    expect(src).toMatch(/onLine: \(line\) => processLine\(line\)/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
