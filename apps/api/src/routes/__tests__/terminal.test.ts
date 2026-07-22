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

/** 默认鉴权通过:注入 userId,与真实 authenticate 行为一致 */
function mockAuth(userId = 'test-user-id'): void {
  vi.mocked(authenticate).mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    return { userId } as never
  })
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
    mockAuth()
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
