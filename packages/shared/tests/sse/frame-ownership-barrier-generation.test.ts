// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { createFrameOwnershipBarrier } from '../../src/sse/frame-ownership-barrier.js'

/**
 * G-276:迟到帧不得回写所有权映射(建连 await 窗口代际重验的收尾格)。
 *
 * 上游锚:上游仓 replaceableConversationTransport.ts:84-99 的单向代际守卫 ——
 * 代际递增后,旧代际的迟到帧只丢弃、不投递、不回写任何代际状态。本仓所有权映射
 * (activeByTopic)的判据源是 packages/shared/src/sse/frame-ownership-barrier.ts:
 * activate(ACK)是唯一回写映射的路径,也是唯一推进当前代际的出口。
 *
 * 落点说明(2026-10-19):本组用例原先躺在
 * `packages/api-client/tests/ws-client-generation.test.ts`,经跨包相对导入直引本包判据源 ——
 * 而它通篇只测屏障,一处也没有触碰 WebSocketClient。那条边同时踩了架构契约的三档红
 * (D1 未声明依赖、D2 反向依赖更上层、D4 由此造出 shared→api-client→shared 的环),
 * 而守门头注点名的唯一合规出路就是"把测判据源的测试放到判据源自己那一层"(不得用
 * arch-exempt 糊)。被测对象在本包,用例就该长在本包:迁过来之后 import 是本包内相对路径,
 * 跨模块边归零,环随之消失,而两条断言逐字未动。
 */
describe('G-276 迟到帧/迟到 ACK 不得回写所有权映射(屏障单向代际守卫)', () => {
  it('⑤ 迟到 ACK(generation 早于当前代际)不回写所有权映射、不冲刷暂存;迟到帧只丢弃不投递', () => {
    const barrier = createFrameOwnershipBarrier<string>()
    // 新代际(gen 2)ACK 先确立所有权
    barrier.activate({ subscriptionId: 'sub-gen2', topics: ['chat-stream'], generation: 2 })
    expect(barrier.isOwned('chat-stream', 'sub-gen2')).toBe(true)
    // 迟到的旧代际(gen 1)帧:只丢弃 —— 不投递('pass' 不可能)、不暂存、不动状态
    expect(
      barrier.offer({
        topic: 'chat-stream',
        subscriptionId: 'sub-gen1',
        generation: 1,
        frame: 'late',
      }),
    ).toBe('stale')
    expect(barrier.stagedCount()).toBe(0)
    // 迟到的旧代际(gen 1)ACK:不回写映射 —— topic 所有权仍是 gen2,gen1 无从取得
    const flushed = barrier.activate({
      subscriptionId: 'sub-gen1',
      topics: ['chat-stream'],
      generation: 1,
    })
    expect(flushed).toEqual([])
    expect(barrier.isOwned('chat-stream', 'sub-gen2')).toBe(true)
    expect(barrier.isOwned('chat-stream', 'sub-gen1')).toBe(false)
    // 换代前已暂存的旧代际帧,不得借新代际 ACK 之手投递(冲刷按代际过滤)
    const fresh = createFrameOwnershipBarrier<string>()
    fresh.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen1', generation: 1, frame: 'old-1' })
    fresh.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen2', generation: 2, frame: 'new-2' })
    const gen2Flush = fresh.activate({
      subscriptionId: 'sub-gen2',
      topics: ['chat-stream'],
      generation: 2,
    })
    expect(gen2Flush.map((x) => x.frame)).toEqual(['new-2'])
    expect(fresh.isOwned('chat-stream', 'sub-gen2')).toBe(true)
  })

  it('⑥ 反向锁:当前代际 ACK 回写保留 —— 映射照写、暂存照冲、同代际帧照投(行为逐字不变)', () => {
    const barrier = createFrameOwnershipBarrier<string>()
    barrier.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen3', generation: 3, frame: 'a' })
    barrier.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen3', generation: 3, frame: 'b' })
    // 当前代际 ACK:回写保留 —— 映射确立、暂存按原序冲刷
    const flushed = barrier.activate({
      subscriptionId: 'sub-gen3',
      topics: ['chat-stream'],
      generation: 3,
    })
    expect(flushed.map((x) => x.frame)).toEqual(['a', 'b'])
    expect(barrier.isOwned('chat-stream', 'sub-gen3')).toBe(true)
    // 同代际后续帧照常直接投递(不暂存、不丢弃)
    expect(
      barrier.offer({
        topic: 'chat-stream',
        subscriptionId: 'sub-gen3',
        generation: 3,
        frame: 'c',
      }),
    ).toBe('pass')
    // 幂等重 ACK(同代际)不丢所有权
    expect(
      barrier.activate({ subscriptionId: 'sub-gen3', topics: ['chat-stream'], generation: 3 }),
    ).toEqual([])
    expect(barrier.isOwned('chat-stream', 'sub-gen3')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
