import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ─────────────────────────────────────────────────────────────
// Mock:用户偏好查询层(Map 存储,模拟 user_preferences 表)
// + 鉴权层(通过 mockIsAuthenticated 控制是否登录)
// 用 vi.hoisted 保证 vi.mock 工厂能引用到 store / mockIsAuthenticated
// ─────────────────────────────────────────────────────────────
const { store, mockUserId, getAuthState, setAuthState } = vi.hoisted(() => {
  const store = new Map<string, string>() // key: `${userId}:${group}:${pluginId}` → value(JSON)
  const mockUserId = 'user-test-001'
  let mockIsAuthenticated = true
  return {
    store,
    mockUserId,
    getAuthState: () => mockIsAuthenticated,
    setAuthState: (v: boolean) => {
      mockIsAuthenticated = v
    },
  }
})

vi.mock('../../db/user-preferences-queries.js', () => ({
  findUserPreferences: vi.fn(async (userId: string, group?: string) => {
    const list: Array<{
      id: string
      group: string
      key: string
      value: string | null
      updatedAt: Date
    }> = []
    for (const [k, v] of store.entries()) {
      // 用正则切分,避免 noUncheckedIndexedAccess 导致 string | undefined
      const m = /^([^:]+):([^:]+):(.+)$/.exec(k)
      if (!m) continue
      const uid = m[1] as string
      const grp = m[2] as string
      const key = m[3] as string
      if (uid !== userId) continue
      if (group && grp !== group) continue
      list.push({
        id: k,
        group: grp,
        key,
        value: v,
        updatedAt: new Date(),
      })
    }
    return { list, total: list.length }
  }),
  upsertUserPreference: vi.fn(
    async (userId: string, group: string, key: string, value: string | null) => {
      const k = `${userId}:${group}:${key}`
      store.set(k, value ?? '')
      return {
        id: k,
        userId,
        group,
        key,
        value,
        updatedAt: new Date(),
      }
    },
  ),
  deleteUserPreference: vi.fn(async (userId: string, group: string, key: string) => {
    const k = `${userId}:${group}:${key}`
    const existed = store.has(k)
    store.delete(k)
    return existed
  }),
}))

// ─────────────────────────────────────────────────────────────
// Mock:插件事件埋点(append-only,失败不阻塞主流程)
// ─────────────────────────────────────────────────────────────
const pluginEventsStore: Array<{
  pluginId: string
  eventType: string
  userId: string | null
  ip: string | null
}> = []

vi.mock('../../db/plugin-events-queries.js', () => ({
  recordPluginEvent: vi.fn(
    async (input: {
      pluginId: string
      eventType: string
      userId?: string | null
      ip?: string | null
    }) => {
      pluginEventsStore.push({
        pluginId: input.pluginId,
        eventType: input.eventType,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
      })
      return undefined
    },
  ),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    if (!getAuthState()) {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode?: number }).statusCode = 401
      throw err
    }
    request.userId = mockUserId
    return { userId: mockUserId, roleId: 0 }
  }),
}))

import { pluginsRoutes } from '../plugins.js'
import { upsertUserPreference, deleteUserPreference } from '../../db/user-preferences-queries.js'
import { recordPluginEvent } from '../../db/plugin-events-queries.js'

describe('Plugin Marketplace API (4 端点完整覆盖)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(pluginsRoutes, { prefix: '/api/plugins' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.clear()
    pluginEventsStore.length = 0
    setAuthState(true)
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────
  // GET /installed
  // ─────────────────────────────────────────────────────────
  describe('GET /api/plugins/installed', () => {
    it('未登录 → 200 + authenticated=false + 空 states(不抛 401,前端隐藏操作按钮)', async () => {
      setAuthState(false)
      const res = await app.inject({ method: 'GET', url: '/api/plugins/installed' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ states: {}, authenticated: false })
    })

    it('已登录 + 无数据 → 200 + authenticated=true + 空 states', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/plugins/installed' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.authenticated).toBe(true)
      expect(body.data.states).toEqual({})
    })

    it('已登录 + 有 2 条数据 → 200 + states 包含 2 个插件', async () => {
      store.set(
        `${mockUserId}:plugins:playwright-mcp`,
        JSON.stringify({ installedAt: '2026-07-22T10:00:00.000Z', pinned: true }),
      )
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T11:00:00.000Z', pinned: false }),
      )
      const res = await app.inject({ method: 'GET', url: '/api/plugins/installed' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.authenticated).toBe(true)
      expect(Object.keys(body.data.states)).toHaveLength(2)
      expect(body.data.states['playwright-mcp']).toEqual({
        installedAt: '2026-07-22T10:00:00.000Z',
        pinned: true,
      })
      expect(body.data.states['remotion'].pinned).toBe(false)
    })

    it('数据含损坏 JSON → 跳过该条,不影响其他有效数据', async () => {
      store.set(`${mockUserId}:plugins:good`, JSON.stringify({ installedAt: '2026-07-22T10:00:00.000Z', pinned: false }))
      store.set(`${mockUserId}:plugins:broken`, '{not-json')
      store.set(`${mockUserId}:plugins:missing-field`, JSON.stringify({ installedAt: '2026-07-22T10:00:00.000Z' /* 缺 pinned */ }))
      const res = await app.inject({ method: 'GET', url: '/api/plugins/installed' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Object.keys(body.data.states)).toEqual(['good'])
    })
  })

  // ─────────────────────────────────────────────────────────
  // POST /:id/install
  // ─────────────────────────────────────────────────────────
  describe('POST /api/plugins/:id/install', () => {
    it('未登录 → 401', async () => {
      setAuthState(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/playwright-mcp/install',
        payload: {},
      })
      expect(res.statusCode).toBe(401)
    })

    it('无效 id(含特殊字符) → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/evil%2Fpath/install',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toMatch(/Invalid plugin id/)
    })

    it('有效 id + 默认 pinned=false → 200 + state.pinned=false', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/playwright-mcp/install',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.pluginId).toBe('playwright-mcp')
      expect(body.data.state.pinned).toBe(false)
      expect(typeof body.data.state.installedAt).toBe('string')
      // 写入 DB
      expect(upsertUserPreference).toHaveBeenCalledWith(
        mockUserId,
        'plugins',
        'playwright-mcp',
        expect.stringContaining('"pinned":false'),
      )
    })

    it('pinned=true → 200 + state.pinned=true', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/remotion/install',
        payload: { pinned: true },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.state.pinned).toBe(true)
    })

    it('已安装插件 → 保留原 installedAt,仅更新 pinned', async () => {
      const originalTime = '2026-01-01T00:00:00.000Z'
      store.set(
        `${mockUserId}:plugins:playwright-mcp`,
        JSON.stringify({ installedAt: originalTime, pinned: false }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/playwright-mcp/install',
        payload: { pinned: true },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.state.installedAt).toBe(originalTime) // 保留
      expect(body.data.state.pinned).toBe(true) // 更新
    })

    it('无效 body(pinned 非 boolean) → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/x/install',
        payload: { pinned: 'yes' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ─────────────────────────────────────────────────────────
  // DELETE /:id/install
  // ─────────────────────────────────────────────────────────
  describe('DELETE /api/plugins/:id/install', () => {
    it('未登录 → 401', async () => {
      setAuthState(false)
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/plugins/playwright-mcp/install',
      })
      expect(res.statusCode).toBe(401)
    })

    it('无效 id → 400', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/plugins/has%20space/install',
      })
      expect(res.statusCode).toBe(400)
    })

    it('有效 id → 200 + removed=true,调用 deleteUserPreference', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/plugins/playwright-mcp/install',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ pluginId: 'playwright-mcp', removed: true })
      expect(deleteUserPreference).toHaveBeenCalledWith(mockUserId, 'plugins', 'playwright-mcp')
    })

    it('未安装的插件删除 → 仍 200 + removed=true(幂等)', async () => {
      // store 为空,deleteUserPreference 返回 false,但路由仍返回 removed: true
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/plugins/never-installed/install',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.removed).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────
  // PATCH /:id/preferences
  // ─────────────────────────────────────────────────────────
  describe('PATCH /api/plugins/:id/preferences', () => {
    it('未登录 → 401', async () => {
      setAuthState(false)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/playwright-mcp/preferences',
        payload: { pinned: true },
      })
      expect(res.statusCode).toBe(401)
    })

    it('无效 id → 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/%20/preferences',
        payload: { pinned: true },
      })
      expect(res.statusCode).toBe(400)
    })

    it('未安装的插件 → 404 Plugin not installed', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/not-installed/preferences',
        payload: { pinned: true },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toMatch(/not installed/i)
    })

    it('已安装 + pinned=true → 200 + state.pinned=true,保留 installedAt', async () => {
      const originalTime = '2026-07-22T08:00:00.000Z'
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: originalTime, pinned: false }),
      )
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/remotion/preferences',
        payload: { pinned: true },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.state.pinned).toBe(true)
      expect(body.data.state.installedAt).toBe(originalTime)
    })

    it('已安装 + 不传 pinned → 保留原 pinned', async () => {
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T08:00:00.000Z', pinned: true }),
      )
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/remotion/preferences',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.state.pinned).toBe(true)
    })

    it('无效 body(pinned 非 boolean) → 400', async () => {
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T08:00:00.000Z', pinned: false }),
      )
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/remotion/preferences',
        payload: { pinned: 123 },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ─────────────────────────────────────────────────────────
  // 跨端点工作流:install → toggle pinned → uninstall
  // ─────────────────────────────────────────────────────────
  describe('E2E 工作流:install → toggle pinned → uninstall', () => {
    it('完整生命周期', async () => {
      // 1. 安装
      const installRes = await app.inject({
        method: 'POST',
        url: '/api/plugins/playwright-mcp/install',
        payload: { pinned: false },
      })
      expect(installRes.statusCode).toBe(200)
      const installedAt = installRes.json().data.state.installedAt
      expect(installRes.json().data.state.pinned).toBe(false)

      // 2. 验证已写入 DB
      expect(store.has(`${mockUserId}:plugins:playwright-mcp`)).toBe(true)

      // 3. 切换 pinned
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/playwright-mcp/preferences',
        payload: { pinned: true },
      })
      expect(patchRes.statusCode).toBe(200)
      expect(patchRes.json().data.state.pinned).toBe(true)
      expect(patchRes.json().data.state.installedAt).toBe(installedAt) // 保留

      // 4. GET 验证状态
      const getRes = await app.inject({ method: 'GET', url: '/api/plugins/installed' })
      expect(getRes.json().data.states['playwright-mcp'].pinned).toBe(true)

      // 5. 卸载
      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/plugins/playwright-mcp/install',
      })
      expect(delRes.statusCode).toBe(200)
      expect(delRes.json().data.removed).toBe(true)

      // 6. 验证已从 DB 删除
      expect(store.has(`${mockUserId}:plugins:playwright-mcp`)).toBe(false)

      // 7. 再 PATCH 应 404(未安装)
      const patchAfterDel = await app.inject({
        method: 'PATCH',
        url: '/api/plugins/playwright-mcp/preferences',
        payload: { pinned: false },
      })
      expect(patchAfterDel.statusCode).toBe(404)
    })
  })

  // ─────────────────────────────────────────────────────────
  // 安全:pluginId 注入防护
  // ─────────────────────────────────────────────────────────
  describe('安全:pluginId 注入防护', () => {
    const maliciousIds = [
      '../../../etc/passwd',
      "'; DROP TABLE users; --",
      '<script>alert(1)</script>',
      'a b c',
      'plugin|rm',
    ]

    for (const id of maliciousIds) {
      it(`POST 拒绝恶意 id: ${id}`, async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/plugins/${encodeURIComponent(id)}/install`,
          payload: {},
        })
        expect(res.statusCode).toBe(400)
      })
    }

    it('合法 id 含 - 和 _ → 通过(如 playwright-mcp / openai_codex)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/openai_codex/install',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.pluginId).toBe('openai_codex')
    })
  })

  // ─────────────────────────────────────────────────────────
  // 埋点验证:install / uninstall / pin / unpin 事件
  // ─────────────────────────────────────────────────────────
  describe('埋点:事件流记录', () => {
    it('首次 install → 记录 install 事件', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/plugins/playwright-mcp/install',
        payload: { pinned: false },
      })
      expect(recordPluginEvent).toHaveBeenCalledWith({
        pluginId: 'playwright-mcp',
        eventType: 'install',
        userId: mockUserId,
      })
      expect(pluginEventsStore).toHaveLength(1)
      expect(pluginEventsStore[0]).toEqual({
        pluginId: 'playwright-mcp',
        eventType: 'install',
        userId: mockUserId,
        ip: null,
      })
    })

    it('已安装 + 切换 pinned=false→true → 记录 pin 事件(非 install)', async () => {
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T00:00:00.000Z', pinned: false }),
      )
      await app.inject({
        method: 'POST',
        url: '/api/plugins/remotion/install',
        payload: { pinned: true },
      })
      expect(recordPluginEvent).toHaveBeenCalledWith({
        pluginId: 'remotion',
        eventType: 'pin',
        userId: mockUserId,
      })
      expect(pluginEventsStore[0]?.eventType).toBe('pin')
    })

    it('已安装 pinned=true + 切换 pinned=false → 记录 unpin 事件', async () => {
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T00:00:00.000Z', pinned: true }),
      )
      await app.inject({
        method: 'POST',
        url: '/api/plugins/remotion/install',
        payload: { pinned: false },
      })
      expect(pluginEventsStore[0]?.eventType).toBe('unpin')
    })

    it('PATCH pinned true→false → 记录 unpin 事件', async () => {
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T00:00:00.000Z', pinned: true }),
      )
      await app.inject({
        method: 'PATCH',
        url: '/api/plugins/remotion/preferences',
        payload: { pinned: false },
      })
      expect(recordPluginEvent).toHaveBeenCalledWith({
        pluginId: 'remotion',
        eventType: 'unpin',
        userId: mockUserId,
      })
    })

    it('PATCH pinned 未变化 → 不记录事件', async () => {
      store.set(
        `${mockUserId}:plugins:remotion`,
        JSON.stringify({ installedAt: '2026-07-22T00:00:00.000Z', pinned: true }),
      )
      await app.inject({
        method: 'PATCH',
        url: '/api/plugins/remotion/preferences',
        payload: { pinned: true },
      })
      expect(recordPluginEvent).not.toHaveBeenCalled()
    })

    it('uninstall → 记录 uninstall 事件', async () => {
      await app.inject({
        method: 'DELETE',
        url: '/api/plugins/playwright-mcp/install',
      })
      expect(recordPluginEvent).toHaveBeenCalledWith({
        pluginId: 'playwright-mcp',
        eventType: 'uninstall',
        userId: mockUserId,
      })
    })
  })

  // ─────────────────────────────────────────────────────────
  // POST /:id/click - 埋点:点击市场卡片外链
  // ─────────────────────────────────────────────────────────
  describe('POST /api/plugins/:id/click', () => {
    it('游客(未登录)→ 200 + recorded=true,userId=null', async () => {
      setAuthState(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/playwright-mcp/click',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ pluginId: 'playwright-mcp', recorded: true })
      expect(recordPluginEvent).toHaveBeenCalledWith({
        pluginId: 'playwright-mcp',
        eventType: 'click',
        userId: null,
        ip: expect.any(String),
      })
    })

    it('已登录用户 → 200 + recorded=true,userId=用户 id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/remotion/click',
      })
      expect(res.statusCode).toBe(200)
      expect(recordPluginEvent).toHaveBeenCalledWith({
        pluginId: 'remotion',
        eventType: 'click',
        userId: mockUserId,
        ip: expect.any(String),
      })
    })

    it('无效 id → 400,不记录事件', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plugins/has%20space/click',
      })
      expect(res.statusCode).toBe(400)
      expect(recordPluginEvent).not.toHaveBeenCalled()
    })
  })
})
