import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { PairingService, getPairingService } from '../src/services/clawdbot/pairing.js'

describe('clawdbot PairingService 配对服务', () => {
  let svc: PairingService

  beforeEach(() => {
    svc = new PairingService()
  })

  describe('createRequest 创建请求', () => {
    it('生成 6 位大写 code 与 expiresAt', () => {
      const r = svc.createRequest({ userId: 'u1', deviceId: 'd1', channelType: 'web' })
      // 2026-07-21 安全加固:id 改用 CSPRNG hex 格式(pr_<hex>),不再用 timestamp
      expect(r.id).toMatch(/^pr_[a-z0-9]+$/)
      expect(r.code).toMatch(/^[A-Z0-9]{6}$/)
      expect(r.status).toBe('pending')
      expect(r.expiresAt).toBeGreaterThan(Date.now())
    })

    it('可选参数允许省略', () => {
      const r = svc.createRequest({})
      expect(r.userId).toBeUndefined()
      expect(r.deviceId).toBeUndefined()
    })

    it('触发 requestCreated 事件', () => {
      const handler = vi.fn()
      svc.on('requestCreated', handler)
      svc.createRequest({})
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('confirmPairing 确认配对', () => {
    it('有效 code + pending 状态确认成功', () => {
      const r = svc.createRequest({ userId: 'u1', deviceId: 'd1', channelType: 'web' })
      const session = svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      expect(session).not.toBeNull()
      expect(session!.userId).toBe('u1')
      expect(session!.deviceId).toBe('d1')
      expect(session!.channelType).toBe('web')
      expect(session!.pairedAt).toBeGreaterThan(0)
    })

    it('无效 code 返回 null', () => {
      expect(svc.confirmPairing('XXXXXX', 'u1', 'd1', 'web')).toBeNull()
    })

    it('已过期 code 标记为 expired 并返回 null', () => {
      const r = svc.createRequest({})
      const internal = svc as unknown as {
        requests: Map<string, { expiresAt: number; status: string }>
      }
      internal.requests.get(r.id)!.expiresAt = Date.now() - 1000
      expect(svc.confirmPairing(r.code, 'u1', 'd1', 'web')).toBeNull()
      expect(internal.requests.get(r.id)!.status).toBe('expired')
    })

    it('确认后 code 从 codeToRequestId 移除', () => {
      const r = svc.createRequest({})
      svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      // 二次确认应失败
      expect(svc.confirmPairing(r.code, 'u1', 'd1', 'web')).toBeNull()
    })

    it('触发 paired 事件', () => {
      const handler = vi.fn()
      svc.on('paired', handler)
      const r = svc.createRequest({})
      svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSession / getSessionByUser', () => {
    it('getSession 返回指定会话', () => {
      const r = svc.createRequest({})
      const s = svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      expect(svc.getSession(s!.id)?.userId).toBe('u1')
    })

    it('getSessionByUser 返回用户首个会话', () => {
      const r = svc.createRequest({})
      svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      expect(svc.getSessionByUser('u1')?.deviceId).toBe('d1')
    })

    it('不存在返回 undefined', () => {
      expect(svc.getSession('not_exist')).toBeUndefined()
      expect(svc.getSessionByUser('not_exist')).toBeUndefined()
    })
  })

  describe('updateActivity 更新活跃', () => {
    it('更新 lastActiveAt', async () => {
      const r = svc.createRequest({})
      const s = svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      const before = s!.lastActiveAt
      await new Promise((r) => setTimeout(r, 5))
      svc.updateActivity(s!.id)
      expect(svc.getSession(s!.id)!.lastActiveAt).toBeGreaterThanOrEqual(before)
    })

    it('不存在会话不抛错', () => {
      expect(() => svc.updateActivity('not_exist')).not.toThrow()
    })
  })

  describe('unpair 解绑', () => {
    it('解绑存在会话返回 true', () => {
      const r = svc.createRequest({})
      const s = svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      expect(svc.unpair(s!.id)).toBe(true)
      expect(svc.getSession(s!.id)).toBeUndefined()
    })

    it('解绑不存在返回 false', () => {
      expect(svc.unpair('not_exist')).toBe(false)
    })

    it('触发 unpaired 事件', () => {
      const handler = vi.fn()
      svc.on('unpaired', handler)
      const r = svc.createRequest({})
      const s = svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      svc.unpair(s!.id)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancelRequest 取消请求', () => {
    it('取消存在请求返回 true', () => {
      const r = svc.createRequest({})
      expect(svc.cancelRequest(r.id)).toBe(true)
      const internal = svc as unknown as { requests: Map<string, { status: string }> }
      expect(internal.requests.get(r.id)!.status).toBe('cancelled')
    })

    it('取消不存在返回 false', () => {
      expect(svc.cancelRequest('not_exist')).toBe(false)
    })

    it('取消后 code 从 codeToRequestId 移除', () => {
      const r = svc.createRequest({})
      svc.cancelRequest(r.id)
      expect(svc.confirmPairing(r.code, 'u1', 'd1', 'web')).toBeNull()
    })

    it('触发 cancelled 事件', () => {
      const handler = vi.fn()
      svc.on('cancelled', handler)
      const r = svc.createRequest({})
      svc.cancelRequest(r.id)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanupExpired 清理过期', () => {
    it('清理过期 pending 请求', () => {
      const r1 = svc.createRequest({})
      const r2 = svc.createRequest({})
      const internal = svc as unknown as {
        requests: Map<string, { expiresAt: number; status: string; code: string }>
        codeToRequestId: Map<string, string>
      }
      internal.requests.get(r1.id)!.expiresAt = Date.now() - 1000
      internal.requests.get(r2.id)!.expiresAt = Date.now() - 1000
      const n = svc.cleanupExpired()
      expect(n).toBe(2)
      expect(internal.requests.get(r1.id)!.status).toBe('expired')
      expect(internal.codeToRequestId.has(r1.code)).toBe(false)
    })

    it('未过期请求不清理', () => {
      svc.createRequest({})
      expect(svc.cleanupExpired()).toBe(0)
    })
  })

  describe('getStats 统计', () => {
    it('返回 pendingRequests/activeSessions/confirmed', () => {
      svc.createRequest({})
      const r = svc.createRequest({})
      svc.confirmPairing(r.code, 'u1', 'd1', 'web')
      const s = svc.getStats()
      expect(s.pendingRequests).toBe(1)
      expect(s.activeSessions).toBe(1)
      expect(s.confirmed).toBe(1)
    })
  })

  describe('单例', () => {
    it('getPairingService 返回同一实例', () => {
      expect(getPairingService()).toBe(getPairingService())
    })
  })
})
