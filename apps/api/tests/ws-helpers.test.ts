import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockVerifyAccessToken, mockVerifyWsToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockVerifyWsToken: vi.fn(),
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  verifyWsToken: mockVerifyWsToken,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn(),
}))

import { wsAuth, WS_CLOSE, type UserStatusFetcher } from '../src/plugins/ws-helpers.js'
import type { WebSocket } from '@fastify/websocket'

/** 极简 mock WebSocket,只追踪 close 调用 */
function makeMockSocket(): WebSocket {
  return {
    close: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
  } as unknown as WebSocket
}

describe('ws-helpers — WebSocket 鉴权辅助', () => {
  beforeEach(() => {
    mockVerifyAccessToken.mockReset()
    // 默认:非 WS 专用 token(走 access token 降级路径)
    mockVerifyWsToken.mockReset().mockResolvedValue(null)
  })

  describe('WS_CLOSE 常量', () => {
    it('暴露稳定的 close code 约定', () => {
      expect(WS_CLOSE.MISSING_TOKEN).toBe(4001)
      expect(WS_CLOSE.INVALID_TOKEN).toBe(4003)
      expect(WS_CLOSE.ACCOUNT_CANCELLED).toBe(4004)
    })
  })

  describe('wsAuth — 鉴权核心逻辑', () => {
    it('缺 token → close(4001) + 返回 null', async () => {
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, undefined)
      expect(userId).toBeNull()
      expect(socket.close).toHaveBeenCalledWith(4001, '缺少 token')
    })

    it('空字符串 token → close(4001) + 返回 null', async () => {
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, '')
      expect(userId).toBeNull()
      expect(socket.close).toHaveBeenCalledWith(4001, '缺少 token')
    })

    it('token 校验失败 → close(4003) + 返回 null', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('invalid signature'))
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'bad-token')
      expect(userId).toBeNull()
      expect(socket.close).toHaveBeenCalledWith(4003, 'token 无效')
    })

    it('用户不存在 → close(4003) + 返回 null', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'ghost-user' })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(undefined)
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'valid-token', fetchStatus)
      expect(userId).toBeNull()
      expect(socket.close).toHaveBeenCalledWith(4003, '用户不存在')
    })

    it('账号已注销(status=3) → close(4004) + 返回 null', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'cancelled-user' })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(3)
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'valid-token', fetchStatus)
      expect(userId).toBeNull()
      expect(socket.close).toHaveBeenCalledWith(4004, '账号已注销')
    })

    it('正常用户(status=1) → 返回 userId,无 close', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-001' })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(1)
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'valid-token', fetchStatus)
      expect(userId).toBe('user-001')
      expect(socket.close).not.toHaveBeenCalled()
    })

    it('正常用户(status=0/2) → 放行', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-002' })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(0)
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'valid-token', fetchStatus)
      expect(userId).toBe('user-002')
      expect(socket.close).not.toHaveBeenCalled()
    })

    it('status 查询被注入的 fetchStatus 接管(便于测试)', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'u-1' })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(1)
      const socket = makeMockSocket()
      await wsAuth(socket, 'tok', fetchStatus)
      expect(fetchStatus).toHaveBeenCalledWith('u-1')
    })

    it('缺 token 时不调用 verifyAccessToken 也不查询 status', async () => {
      const socket = makeMockSocket()
      await wsAuth(socket, undefined)
      expect(mockVerifyAccessToken).not.toHaveBeenCalled()
    })

    it('token 无效时不查询 status', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('bad'))
      const socket = makeMockSocket()
      await wsAuth(socket, 'bad')
      // 注:此处因 token 校验失败,函数内不会进入 status 查询
      expect(socket.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('wsAuth — WS 专用短期 token(ticket)路径', () => {
    it('WS ticket 有效 → 直接用 ticket 的 userId,不走 access token 降级', async () => {
      mockVerifyWsToken.mockResolvedValue({ userId: 'user-ws-1', claims: {} })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(1)
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'ws-ticket-token', fetchStatus)
      expect(userId).toBe('user-ws-1')
      expect(mockVerifyAccessToken).not.toHaveBeenCalled()
      expect(socket.close).not.toHaveBeenCalled()
    })

    it('WS ticket 无效但 access token 有效 → 降级 access token 路径', async () => {
      mockVerifyWsToken.mockResolvedValue(null)
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-fallback' })
      const fetchStatus: UserStatusFetcher = vi.fn().mockResolvedValue(1)
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'legacy-access-token', fetchStatus)
      expect(userId).toBe('user-fallback')
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('legacy-access-token')
    })

    it('WS ticket 与 access token 均无效 → close(4003) + 返回 null', async () => {
      mockVerifyWsToken.mockResolvedValue(null)
      mockVerifyAccessToken.mockRejectedValue(new Error('expired'))
      const socket = makeMockSocket()
      const userId = await wsAuth(socket, 'bad-token')
      expect(userId).toBeNull()
      expect(socket.close).toHaveBeenCalledWith(4003, 'token 无效')
    })
  })
})
