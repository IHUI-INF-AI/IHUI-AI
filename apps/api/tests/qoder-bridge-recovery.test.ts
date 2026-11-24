// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桥接恢复策略的行为锁(2026-11-18 立)。
 *
 * B1 缺件即停:runner/SDK/CLI 路径缺失 ⇒ stop(重试不会让文件出现)。
 * B2 端口占用即停:继续重试只会反复失败。
 * B3 登录态失效即摘:401/unauthorized ⇒ drop-session,不做无意义冷却。
 * B4 阈值:连续 3 次进冷却、连续 5 次停(不许无限重试)。
 * B5 退避:指数增长且 60s 封顶,单调不减。
 * B6 判不出就停:非自愈范围内不擅自重试。
 */
import { describe, it, expect } from 'vitest'
import { planBridgeRecovery, bridgeBackoffMs } from '../src/services/upstream-adapters/qoder-bridge-recovery.js'

describe('qoder-bridge-recovery', () => {
  it('B1 缺件 ⇒ stop', () => {
    const d = planBridgeRecovery({ statusCode: 0, consecutiveFailures: 1, missingArtifact: true })
    expect(d.action).toBe('stop')
    expect(d.reason).toContain('路径缺失')
  })

  it('B2 端口占用 ⇒ stop', () => {
    expect(planBridgeRecovery({ statusCode: 0, consecutiveFailures: 1, portConflict: true }).action).toBe('stop')
    expect(planBridgeRecovery({ statusCode: 0, consecutiveFailures: 1, failureText: 'listen EADDRINUSE' }).action).toBe('stop')
  })

  it('B3 登录态失效 ⇒ drop-session', () => {
    expect(planBridgeRecovery({ statusCode: 401, consecutiveFailures: 1 }).action).toBe('drop-session')
    expect(planBridgeRecovery({ statusCode: 0, consecutiveFailures: 1, failureText: 'not logged in' }).action).toBe('drop-session')
  })

  it('B4 连续 3 次冷却、连续 5 次停', () => {
    expect(planBridgeRecovery({ statusCode: 0, consecutiveFailures: 3 }).action).toBe('cooldown')
    const stop = planBridgeRecovery({ statusCode: 0, consecutiveFailures: 5 })
    expect(stop.action).toBe('stop')
    expect(stop.reason).toContain('人工')
  })

  it('B5 退避指数增长且 60s 封顶', () => {
    const seq = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => bridgeBackoffMs(i))
    for (let i = 1; i < seq.length; i += 1) expect(seq[i]!).toBeGreaterThanOrEqual(seq[i - 1]!)
    expect(seq[0]).toBe(1000)
    expect(seq[7]).toBe(60000)
  })

  it('B6 首次进程类失败 ⇒ retry 并给退避', () => {
    const d = planBridgeRecovery({ statusCode: 0, consecutiveFailures: 1 })
    expect(d.action).toBe('retry')
    expect(d.delayMs).toBe(1000)
  })

  it('B6b 上游非鉴权码 ⇒ 冷却交调度,不擅自重试', () => {
    const d = planBridgeRecovery({ statusCode: 500, consecutiveFailures: 1 })
    expect(d.action).toBe('cooldown')
    expect(d.reason).toContain('500')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
