// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// mock 鉴权插件:默认注入 userId,允许单测覆盖为 reject 模拟 401
vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(),
}))

// mock 终端 service:隔离真实 PTY/SSH,仅测路由层逻辑
vi.mock('../../services/terminal-service.js', () => ({
  createSession: vi.fn(),
  listSessions: vi.fn(),
  resizeSession: vi.fn(),
  closeSession: vi.fn(),
}))

import { terminalRoutes } from '../terminal.js'
import { authenticate } from '../../plugins/auth.js'
import {
  createSession,
  listSessions,
  resizeSession,
  closeSession,
} from '../../services/terminal-service.js'
import type { TerminalSession } from '@ihui/types'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

const MOCK_SESSION: TerminalSession = {
  id: 'session-1',
  cwd: '/home/user',
  userId: 'test-user-id',
  createdAt: 1700000000000,
  lastActivityAt: 1700000000000,
  status: 'active',
  kind: 'local',
  shell: 'bash',
}

/**
 * 默认鉴权通过:注入 userId + jwtPayload.roleId,与真实 authenticate 行为一致。
 *
 * roleId 必须能注入 —— requireAdmin 的判据是 `request.jwtPayload.roleId >= 1`
 * (resolveAdminRoleId,且显式 includeInternalChannel:false)。只设 userId 的话,
 * 任何走 admin 闸的端点在单测里都会恒 403,正向分支根本测不到。
 */
function mockAuth(userId = 'test-user-id', roleId = 0): void {
  vi.mocked(authenticate).mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    Object.assign(request, { jwtPayload: { roleId } })
    return { userId } as never
  })
}

/** 管理员身份(本地终端会话默认只对管理员开放);userId 沿用既有断言值 */
function mockAdminAuth(userId = 'test-user-id'): void {
  mockAuth(userId, 1)
}

describe('Terminal API (/api/terminal/*)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(terminalRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 创建本地会话默认只对管理员开放 ⇒ 原有用例(参数校验/限额/500)以管理员身份跑,
    // 普通用户的拒绝分支在下面的成对用例里单独留证。
    mockAdminAuth()
  })

  describe('鉴权', () => {
    it('未鉴权(无 token)返回 401', async () => {
      vi.mocked(authenticate).mockRejectedValue(
        Object.assign(new Error('Authentication required'), { statusCode: 401 }),
      )
      const res = await app.inject({
        method: 'GET',
        url: '/api/terminal/sessions',
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.code).toBe(401)
    })
  })

  describe('GET /api/terminal/sessions', () => {
    it('返回当前用户的 session 列表', async () => {
      vi.mocked(listSessions).mockReturnValue([MOCK_SESSION])
      const res = await app.inject({
        method: 'GET',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(Array.isArray(body.data.sessions)).toBe(true)
      expect(body.data.sessions).toHaveLength(1)
      expect(body.data.sessions[0].id).toBe('session-1')
      // 校验 userId 透传到 service
      expect(listSessions).toHaveBeenCalledWith('test-user-id')
    })

    it('无 session 时返回空数组', async () => {
      vi.mocked(listSessions).mockReturnValue([])
      const res = await app.inject({
        method: 'GET',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.sessions).toEqual([])
    })
  })

  describe('POST /api/terminal/sessions', () => {
    it('创建成功返回 session 对象', async () => {
      vi.mocked(createSession).mockReturnValue(MOCK_SESSION)
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
        payload: { cwd: '/home/user', cols: 80, rows: 24 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.session.id).toBe('session-1')
      // 校验 userId + body 透传到 service
      expect(createSession).toHaveBeenCalledWith('test-user-id', {
        cwd: '/home/user',
        cols: 80,
        rows: 24,
      })
    })

    it('无 body 时使用默认值创建', async () => {
      vi.mocked(createSession).mockReturnValue(MOCK_SESSION)
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(createSession).toHaveBeenCalledWith('test-user-id', {})
    })

    it('超过 5 个并发返回 403', async () => {
      vi.mocked(createSession).mockImplementation(() => {
        throw new Error('超过最大并发终端数(5)')
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('超过最大并发')
    })

    it('其他创建错误(如 node-pty 未安装)返回 400', async () => {
      vi.mocked(createSession).mockImplementation(() => {
        throw new Error('node-pty 未安装,终端功能不可用')
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('node-pty')
    })

    it('cols 超过 500 返回 400(参数校验)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
        payload: { cols: 501 },
      })
      expect(res.statusCode).toBe(400)
      expect(createSession).not.toHaveBeenCalled()
    })

    it('rows 超过 200 返回 400(参数校验)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
        payload: { rows: 201 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('普通用户(非管理员)创建本地会话 → 403,且 createSession 一次都没被调用', async () => {
      mockAuth('plain-user', 0)
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions',
        headers: AUTH_HEADERS,
        payload: { cwd: 'D:\\' },
      })
      expect(res.statusCode).toBe(403)
      // 断言的是副作用没发生:守卫必须挡在 spawn 之前,而不是先起一枚 PTY 再回 403
      expect(vi.mocked(createSession)).not.toHaveBeenCalled()
    })

    it('IHUI_TERMINAL_LOCAL_ENABLED=1 时退回登录用户可用(自托管档,正向对照)', async () => {
      process.env.IHUI_TERMINAL_LOCAL_ENABLED = '1'
      try {
        mockAuth('plain-user', 0)
        vi.mocked(createSession).mockReturnValue(MOCK_SESSION)
        const res = await app.inject({
          method: 'POST',
          url: '/api/terminal/sessions',
          headers: AUTH_HEADERS,
          payload: {},
        })
        expect(res.statusCode).toBe(200)
        expect(vi.mocked(createSession)).toHaveBeenCalledTimes(1)
      } finally {
        delete process.env.IHUI_TERMINAL_LOCAL_ENABLED
      }
    })
  })

  describe('POST /api/terminal/sessions/:id/resize', () => {
    it('调整成功返回 200', async () => {
      vi.mocked(resizeSession).mockReturnValue(true)
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions/session-1/resize',
        headers: AUTH_HEADERS,
        payload: { cols: 120, rows: 40 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.resized).toBe(true)
      // 校验参数透传:sessionId, userId, cols, rows
      expect(resizeSession).toHaveBeenCalledWith('session-1', 'test-user-id', 120, 40)
    })

    it('session 不存在返回 404', async () => {
      vi.mocked(resizeSession).mockReturnValue(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions/nope/resize',
        headers: AUTH_HEADERS,
        payload: { cols: 80, rows: 24 },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })

    it('cols=0 返回 400(参数校验 min=1)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions/session-1/resize',
        headers: AUTH_HEADERS,
        payload: { cols: 0, rows: 24 },
      })
      expect(res.statusCode).toBe(400)
      expect(resizeSession).not.toHaveBeenCalled()
    })

    it('rows=999 返回 400(参数校验 max=200)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/terminal/sessions/session-1/resize',
        headers: AUTH_HEADERS,
        payload: { cols: 80, rows: 999 },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/terminal/sessions/:id', () => {
    it('关闭成功返回 200', async () => {
      vi.mocked(closeSession).mockReturnValue(true)
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/terminal/sessions/session-1',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.closed).toBe(true)
      expect(closeSession).toHaveBeenCalledWith('session-1', 'test-user-id')
    })

    it('session 不存在返回 404', async () => {
      vi.mocked(closeSession).mockReturnValue(false)
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/terminal/sessions/nope',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
