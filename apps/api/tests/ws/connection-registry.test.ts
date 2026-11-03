// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 连接注册表迟到回调竞态的回归测试(2026-09-26 根治票)。
// 判据核心:旧连接迟到的 close/error 回调**不得按 key 删** —— 同 key 的替代品
// (重连后的新连接/新成员)必须存活;清理(摘 key / 清窗口)只在"确实轮到我"时发生。
import { describe, it, expect, vi } from 'vitest'
import type { WebSocket } from '@fastify/websocket'
import {
  removeIfSame,
  removeIfDead,
  releaseUserConnectionSlots,
} from '../../src/utils/connection-registry.js'
import { WsRateLimiter, WsUserConnectionLimiter } from '../../src/plugins/ws-helpers.js'

// ws-helpers 的默认 status 查询会牵进 db 层;本测试只用两个限流类,mock 掉取源面。
vi.mock('../../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn(async () => undefined),
}))

type RoomTable = Map<string, Set<string>>

/** 故障形态的在体对照:旧实现"close 回调按 key 整删"(removeConnection 钩子旧语义)。
 *  它必须能把替代品拆掉 —— 否则下面的 ① 是恒真式,阳性对照不成立。 */
function legacyDeleteByKey(table: RoomTable, key: string): void {
  table.delete(key)
}

describe('removeIfSame:按对象身份删,空集才摘 key', () => {
  it('① 同 key 先 A 后 B,A 的迟到 close 走 removeIfSame ⇒ B 必须仍在表里(阳性对照:旧按 key 整删会把 B 拆掉)', () => {
    const table: RoomTable = new Map([['room1', new Set(['A', 'B'])]])

    // 阳性对照:旧形态按 key 删 ⇒ 活着的替代品 B 被一次遗留 close 抹掉(故障型本身)
    const legacyTable: RoomTable = new Map(table)
    legacyDeleteByKey(legacyTable, 'room1')
    expect(legacyTable.has('room1')).toBe(false) // 证明对照确实会丢 B,判据不是摆设

    // 新出口:只摘 A,B 与 key 都必须在
    expect(removeIfSame(table, 'room1', 'A')).toBe(true)
    expect(table.get('room1')?.has('B')).toBe(true)
    expect(table.has('room1')).toBe(true)
  })

  it('①b 房间已被清空又由 B 重建:对旧成员 A 的重放删除必须是 no-op,不得碰新集合', () => {
    const table: RoomTable = new Map()
    // A 单连接 → 正常 close:成员清空,key 一并摘除
    table.set('room1', new Set(['A']))
    expect(removeIfSame(table, 'room1', 'A')).toBe(true)
    expect(table.has('room1')).toBe(false)
    // B 重连(集合重建)后,A 的迟到回调再跑一次
    table.set('room1', new Set(['B']))
    expect(removeIfSame(table, 'room1', 'A')).toBe(false)
    expect(table.get('room1')?.has('B')).toBe(true)
    expect(table.has('room1')).toBe(true)
  })

  it('② B 自己 close ⇒ 表里为空(key 已摘),且只在真正移除时各生效一次', () => {
    const table: RoomTable = new Map([['room1', new Set(['B'])]])
    expect(removeIfSame(table, 'room1', 'B')).toBe(true)
    expect(table.has('room1')).toBe(false)
    // 重放(双 close 事件形态)不再产生第二次移除,也不误删后来重建的同名 key
    expect(removeIfSame(table, 'room1', 'B')).toBe(false)
  })
})

describe('removeIfDead:兜底清理只摘确认死亡的成员', () => {
  const socketWith = (readyState: number): WebSocket =>
    ({ readyState }) as unknown as WebSocket

  it('③ 混合房间(僵尸 + 活连接):活成员与 key 必须整体幸存;全僵尸才摘 key', () => {
    type Member = { socket: WebSocket; name: string }
    const dead: Member = { socket: socketWith(3), name: 'A' }
    const live: Member = { socket: socketWith(1), name: 'B' }
    const table = new Map<string, Set<Member>>([['r', new Set([dead, live])]])

    const removed = removeIfDead(table, 'r', (m) => m.socket.readyState === 3)
    expect(removed).toBe(1)
    expect(table.get('r')?.has(live)).toBe(true)
    expect(table.has('r')).toBe(true)

    // 之后 B 也死掉 ⇒ 集合清空,key 才摘
    ;(live.socket as unknown as { readyState: number }).readyState = 2
    expect(removeIfDead(table, 'r', (m) => m.socket.readyState >= 2)).toBe(1)
    expect(table.has('r')).toBe(false)
  })

  it('③b 判据中途抛错不得升级成按 key 整删:已摘成员不回滚,活成员与 key 不受影响', () => {
    type Member = { socket: WebSocket; name: string }
    const a: Member = { socket: socketWith(3), name: 'A' }
    const b: Member = { socket: socketWith(1), name: 'B' }
    const table = new Map<string, Set<Member>>([['r', new Set([a, b])]])
    expect(() =>
      removeIfDead(table, 'r', (m) => {
        if (m === b) throw new Error('readyState 探测失败')
        return m.socket.readyState === 3
      }),
    ).toThrow()
    expect(table.get('r')?.has(b)).toBe(true)
    expect(table.has('r')).toBe(true)
  })

  it('key 不存在时返回 0,不凭空建集合', () => {
    const table = new Map<string, Set<number>>()
    expect(removeIfDead(table, 'ghost', () => true)).toBe(0)
    expect(table.has('ghost')).toBe(false)
  })
})

describe('releaseUserConnectionSlots:迟到 close 不得按 userId 抹掉共享防洪窗口', () => {
  it('① 用户先连 A 再连 B(重连),A 的迟到 close 后:B 正在累积的窗口必须还在', () => {
    const limiter = new WsUserConnectionLimiter(8)
    // max=1 让"桶是否被清空"变成一次可观测的 allow() 结果差异
    const rate = new WsRateLimiter(1, 60_000)
    limiter.acquire('u1') // A
    limiter.acquire('u1') // B(重连)
    expect(rate.allow('u1')).toBe(true) // B 用掉了唯一额度
    expect(rate.allow('u1')).toBe(false) // 已限流

    // 旧形态(阳性对照):close 无条件 reset ⇒ 下一次 allow 又变 true,防洪被重连绕过
    const legacyBucketProbe = new WsRateLimiter(1, 60_000)
    expect(legacyBucketProbe.allow('u1')).toBe(true)
    legacyBucketProbe.reset('u1') // ← 旧 close 回调的按 key 整删
    expect(legacyBucketProbe.allow('u1')).toBe(true) // 额度被凭空归还(故障型)

    // 新出口:A 的迟到 close 不得归还 B 的额度
    const cleaned = releaseUserConnectionSlots({ limiter, rateLimiter: rate, userId: 'u1' })
    expect(cleaned).toBe(false)
    expect(rate.allow('u1')).toBe(false)
  })

  it('② 最后一条连接(B)自己 close ⇒ 窗口恰好清一次(内存不累积)', () => {
    const limiter = new WsUserConnectionLimiter(8)
    const rate = new WsRateLimiter(1, 60_000)
    limiter.acquire('u2')
    limiter.acquire('u2')
    expect(rate.allow('u2')).toBe(true)

    // A 迟到 close:不清(窗口仍是满的,后续消息继续被限流)
    expect(releaseUserConnectionSlots({ limiter, rateLimiter: rate, userId: 'u2' })).toBe(false)
    expect(rate.allow('u2')).toBe(false)
    // B close(最后一条):真实对象上窗口恰好被清 —— 下一次 allow 恢复放行
    expect(releaseUserConnectionSlots({ limiter, rateLimiter: rate, userId: 'u2' })).toBe(true)
    expect(rate.allow('u2')).toBe(true)
    // 只清一次的语义用计数桩复核(reset 恰好一次,且带的是这个 userId)
    const resetSpy = vi.fn()
    const countingLimiter = {
      release: vi.fn(),
      currentCount: vi.fn(() => 0),
    }
    expect(
      releaseUserConnectionSlots({
        limiter: countingLimiter,
        rateLimiter: { reset: resetSpy },
        userId: 'u2',
      }),
    ).toBe(true)
    expect(resetSpy).toHaveBeenCalledTimes(1)
    expect(resetSpy).toHaveBeenCalledWith('u2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
