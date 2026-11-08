// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-423:配对请求/会话不是"只创建不回收"。
 * - 过期 pending 请求离开 Map(原来只改状态,永远留存);
 * - 终态请求过 TTL 也清理;
 * - sessions 超过上限淘汰最久未活跃会话。
 */
import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.LOG_LEVEL = 'silent'
})

import { PairingService } from '../src/services/clawdbot/pairing.js'

const FIVE_MIN = 1000 * 60 * 5

describe('F-423 PairingService 回收', () => {
  it('过期 pending 请求被删除,confirm 返回 null', () => {
    const svc = new PairingService()
    const req = svc.createRequest({ userId: 'u1' })
    req.expiresAt = Date.now() - 1
    expect(svc.getStats().pendingRequests).toBe(1)

    expect(svc.cleanupExpired()).toBe(1)
    expect(svc.getStats().pendingRequests).toBe(0)
    expect(svc.confirmPairing(req.code, 'u1', 'd1', 'web')).toBeNull()
  })

  it('终态请求过了 TTL 也被清理(不会永久占内存)', () => {
    const svc = new PairingService()
    const req = svc.createRequest({ userId: 'u1' })
    const session = svc.confirmPairing(req.code, 'u1', 'd1', 'web')
    expect(session).not.toBeNull()
    expect(svc.getStats().confirmed).toBe(1)

    req.createdAt = Date.now() - FIVE_MIN - 1000
    expect(svc.cleanupExpired()).toBe(1)
    expect(svc.getStats().confirmed).toBe(0)
  })

  it('sessions 超上限时淘汰最久未活跃会话', () => {
    const svc = new PairingService()
    let lastSessionId = ''
    for (let i = 0; i < 1001; i++) {
      const req = svc.createRequest({ userId: `u${i}` })
      const session = svc.confirmPairing(req.code, `u${i}`, `d${i}`, 'web')
      expect(session).not.toBeNull()
      lastSessionId = session!.id
    }
    expect(svc.getStats().activeSessions).toBeLessThanOrEqual(1000)
    // 最新确认的会话必须还在(淘汰的是最久未活跃的)
    expect(svc.getSession(lastSessionId)).toBeDefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
