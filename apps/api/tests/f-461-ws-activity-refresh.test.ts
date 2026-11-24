// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-461 回归锁(2026-11-13)。
 *
 * 病灶:ws-auto-recovery 的 `lastActivityAt` 只在建连与清僵尸时赋值,消息收发从不刷新,
 * 连接持续活跃满 `maxInactiveMs`(默认 15 分钟)后仍被判「服务不活跃」并触发恢复;
 * 每 30s 一次,2.5 分钟耗尽 `maxRecoveryAttempts=5`,此后真实故障无法恢复。
 *
 * 本文件锁:
 *   ① 持续收/发消息的连接超过阈值后不触发恢复;
 *   ② 真正静默超过阈值才恢复(恰好等于阈值不算),且全僵尸连接不算「有连接」;
 *   ③ 活动时间戳随消息推进(内存状态可断言);
 *   ④ 恢复次数上限语义不变(达上限后不再执行恢复动作);
 *   ⑤ 源锁:ws-ai / ws-chat / ws-broadcast 的收发路径确实调用了刷新入口。
 *
 * 时钟用 vitest 假定时器;连接用假 WebSocket,不连库、不监听端口。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebSocket } from '@fastify/websocket'
import { WsAutoRecoveryManager, type WsConnectionMap } from '../src/plugins/ws-auto-recovery.js'

const T0 = 1_700_000_000_000
const MAX_INACTIVE_MS = 60_000

let manager: WsAutoRecoveryManager | null = null

function openSocket(): WebSocket {
  return { readyState: 1, send: vi.fn(), close: vi.fn() } as unknown as WebSocket
}

function createManager(conns: WsConnectionMap, maxRecoveryAttempts = 5) {
  const m = new WsAutoRecoveryManager({
    maxInactiveMs: MAX_INACTIVE_MS,
    serviceCheckIntervalMs: 10_000,
    healthCheckIntervalMs: 3_600_000,
    connectionCheckIntervalMs: 3_600_000,
    memoryCheckIntervalMs: 3_600_000,
    taskCheckIntervalMs: 3_600_000,
    maxRecoveryAttempts,
  })
  const cleanup = vi.fn(async () => {})
  const removeConnection = vi.fn(async () => {})
  m.registerPlugin('ws-chat', { getConnections: () => conns, removeConnection, cleanup })
  manager = m
  return { m, cleanup, removeConnection }
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0 })
})

afterEach(async () => {
  await manager?.stopMonitoring()
  manager = null
  vi.useRealTimers()
})

describe('F-461 活动时间刷新与僵尸判定', () => {
  it('① 持续收发消息的连接超过阈值后不被恢复', async () => {
    const conns: WsConnectionMap = new Map([['u1', openSocket()]])
    const { m, cleanup } = createManager(conns)
    const recovery = vi.spyOn(m, 'triggerRecovery')

    // 每 5s 一次活动(等价于一次消息收发),累计 100s > 60s 阈值
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(5_000)
      m.recordActivity()
    }

    expect(recovery).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()
    expect(m.getStatusReport().recoveryAttempts).toBe(0)
  })

  it('② 真正静默超过阈值才恢复,且只恢复一次', async () => {
    const conns: WsConnectionMap = new Map([['u1', openSocket()]])
    const { m, cleanup, removeConnection } = createManager(conns)

    // 恰好等于阈值:判据是「距最近活动 > 阈值」,不恢复
    await vi.advanceTimersByTimeAsync(MAX_INACTIVE_MS)
    expect(m.getStatusReport().recoveryAttempts).toBe(0)
    expect(cleanup).not.toHaveBeenCalled()

    // 超过阈值:恢复恰好一次
    await vi.advanceTimersByTimeAsync(10_000)
    expect(m.getStatusReport().recoveryAttempts).toBe(1)
    expect(m.getStatusReport().lastRecoveryReason).toBe('service inactive too long')
    expect(cleanup).toHaveBeenCalledTimes(1)
    // 存活连接不该被当作僵尸摘除(恢复动作原语义)
    expect(removeConnection).not.toHaveBeenCalled()

    // 恢复后重置活动时间:紧接着的下一轮检查不再重复触发
    await vi.advanceTimersByTimeAsync(10_000)
    expect(m.getStatusReport().recoveryAttempts).toBe(1)
  })

  it('②-补 全为僵尸连接时不算有连接,不触发恢复', async () => {
    const zombie = { readyState: 3, send: vi.fn() } as unknown as WebSocket
    const { m } = createManager(new Map([['u1', zombie]]))

    await vi.advanceTimersByTimeAsync(MAX_INACTIVE_MS * 2)

    expect(m.getStatusReport().recoveryAttempts).toBe(0)
  })

  it('③ 活动时间戳随消息推进(内存状态可断言)', async () => {
    const { m } = createManager(new Map([['u1', openSocket()]]))

    expect(m.getStatusReport().lastActivityAt).toBe(T0)

    await vi.advanceTimersByTimeAsync(5_000)
    m.recordActivity()
    expect(m.getStatusReport().lastActivityAt).toBe(T0 + 5_000)

    await vi.advanceTimersByTimeAsync(5_000)
    m.recordActivity()
    expect(m.getStatusReport().lastActivityAt).toBe(T0 + 10_000)
    // 推进方向单调,且不再停留在建连时刻
    expect(m.getStatusReport().lastActivityAt).toBeGreaterThan(T0)
  })

  it('④ 恢复次数上限语义不变(达上限后不再执行)', async () => {
    const { m, cleanup } = createManager(new Map([['u1', openSocket()]]), 2)

    for (let i = 0; i < 5; i++) await m.triggerRecovery('manual')

    expect(m.getStatusReport().recoveryAttempts).toBe(2)
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('⑤ 源锁:三个 ws 插件的收发路径都刷新活动时间', () => {
    const dir = fileURLToPath(new URL('../src/plugins/', import.meta.url))
    const ai = readFileSync(`${dir}ws-ai.ts`, 'utf8')
    const chat = readFileSync(`${dir}ws-chat.ts`, 'utf8')
    const broadcast = readFileSync(`${dir}ws-broadcast.ts`, 'utf8')

    // ws-ai:8 处 socket.on('message') 入站入口 + send 出口
    const aiInbound = ai.match(/socket\.on\('message'[\s\S]{0,120}?touchActivity\(\)/g) ?? []
    expect(aiInbound.length).toBe(8)
    expect(ai).toMatch(/const send = [\s\S]{0,80}touchActivity\(\)/)

    // ws-chat:入站入口 + send 出口
    expect(chat).toMatch(/socket\.on\('message'[\s\S]{0,120}?touchActivity\(\)/)
    expect(chat).toMatch(/const send = [\s\S]{0,80}touchActivity\(\)/)

    // ws-broadcast:入站入口 + 本机直投出口
    expect(broadcast).toMatch(/socket\.on\('message'[\s\S]{0,160}?recordActivity\?\.\(\)/)
    expect(broadcast).toMatch(/deliverLocal[\s\S]{0,400}?recordActivity\?\.\(\)/)
  })
})
