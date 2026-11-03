// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D141 控制帧补齐票 —— api 代理层三帧的落地证明(2026-10-28 立)
 *
 * 立因:`reload_plugins` / `mcp_clear_auth` / `refresh_memory` 三帧在 D141 正本里被判为
 * **真缺**(宿主要显式调用,且必须拿得到结果)。端到端的真身在 ai-service,本文件盯的
 * 是中间那一格(api 转发),它最容易做错的三件事:
 *
 * ① **转发路径必须踩准**:`/mcp/slash-commands/reload` 与同段的 `/mcp/...` 参数路由
 *    同处一个插件里,`/mcp/external/servers/:name/clear-auth` 更是带着路径参数 ——
 *    转发串到下一段就等于"帧静默串味",用户看到的报错根本指不到真因。所以每条用例
 *    直接断言**转发到的上游路径**。
 * ② **serverName 必须编码**:名字里带 `/`、空格、中文时若不 encodeURIComponent,
 *    路径会被截成另一回事(甚至打到别人的 server 上)。这条专为此立的用例。
 * ③ **未登录不给放行,上游失败不静默成功**:缺 auth ⇒ 401 且**一次都不转发**;
 *    上游非 2xx / 连不上 ⇒ 如实回状态码,aiproxy 层不许把失败包成 200。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAiServiceFetch } = vi.hoisted(() => ({
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

// authenticate 会查用户状态(非活跃 ⇒ 401)。不桩掉的话本用例会在鉴权那一格短路,
// 根本走不到"帧有没有被转发"的判据上。
vi.mock('../../db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

// mcp-extended 插件顶部直接 import 了 db / pathparams 要用到的 drizzle sql ——
// 本文件只判路由转发,不需要真库。
vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
  __esModule: true,
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

import { mcpExtendedRoutes } from '../mcp-extended.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }
const USER_ID = '11111111-1111-4111-8111-111111111111'

function mockAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    roleId: 0,
  } as never)
}

/** ai-service 侧的成功响应(裸 JSON,非 {code,message,data} 信封)。 */
function upstreamJson(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json; charset=utf-8' },
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

type FetchCall = [unknown, string, { method?: string; body?: string }]

describe('D141 三帧 · api 代理层', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(mcpExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    mockAiServiceFetch.mockReset()
  })

  // ==========================================================================
  // reload_plugins
  // ==========================================================================

  describe('reload_plugins: POST /api/mcp/slash-commands/reload', () => {
    it('必须转发到 ai-service 同名路径,且把命令列表原样回灌给调用方', async () => {
      const upstream = {
        reloaded: true,
        commands: [
          { name: 'help', description: '显示帮助' },
          { name: 'skill', description: '调用技能' },
        ],
        commandCount: 2,
        skills: 3,
        skillNames: ['alpha', 'beta', 'gamma'],
        added: ['alpha'],
        removed: [],
        changed: ['beta'],
        lastReload: '2026-10-28T00:00:00',
        forced: true,
      }
      mockAiServiceFetch.mockResolvedValue(upstreamJson(upstream))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/slash-commands/reload',
        headers: AUTH_HEADERS,
        payload: { force: true },
      })

      expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
      expect(res.statusCode).toBe(200)
      const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      // 路径不得串到别段(串段会打到别的语义上,且报错指不到真因)
      expect(pathArg).toBe('/api/mcp/slash-commands/reload')
      expect(initArg.method).toBe('POST')
      // force 必须透传:不传/传 false 会退化成 mtime 增量,把手改 SKILL.md 报成"没变化"
      expect(JSON.parse(initArg.body ?? '{}')).toEqual({ force: true })
      // 差额必须回得来 —— 只回一句"已重载"等于把静默失败包装成成功
      expect(res.json().data).toEqual(upstream)
    })

    it('未登录 ⇒ 401 且一次都不转发', async () => {
      vi.mocked(verifyAccessToken).mockRejectedValue(
        Object.assign(new Error('请先登录'), { statusCode: 401 }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/slash-commands/reload',
        payload: { force: true },
      })

      expect(res.statusCode).toBe(401)
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })

    it('上游不可用 ⇒ 502 明示(不许回 200 带空数据)', async () => {
      mockAiServiceFetch.mockRejectedValue(new Error('connect ECONNREFUSED'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/slash-commands/reload',
        headers: AUTH_HEADERS,
        payload: { force: true },
      })

      expect(res.statusCode).toBe(502)
    })

    it('上游非 2xx ⇒ 502 且不带"成功"字样', async () => {
      mockAiServiceFetch.mockResolvedValue(upstreamJson({ error: 'boom' }, 500))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/slash-commands/reload',
        headers: AUTH_HEADERS,
        payload: { force: true },
      })

      expect(res.statusCode).toBe(502)
      expect(res.json().data).toBeUndefined()
    })
  })

  // ==========================================================================
  // mcp_clear_auth
  // ==========================================================================

  describe('mcp_clear_auth: POST /api/mcp/external/servers/:name/clear-auth', () => {
    it('必须转发到 ai-service 同名路径,并把清除结果原样带回', async () => {
      const upstream = {
        server: 'my-svr',
        ok: true,
        cleared: true,
        hadToken: true,
        persistFileRemoved: true,
        error: null,
      }
      mockAiServiceFetch.mockResolvedValue(upstreamJson(upstream))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/my-svr/clear-auth',
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
      expect(res.statusCode).toBe(200)
      const [, pathArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      expect(pathArg).toBe('/api/mcp/external/servers/my-svr/clear-auth')
      expect(res.json().data).toEqual(upstream)
    })

    it('serverName 必须编码 —— 带空格/斜杠的名字不许把上游路径截成另一回事', async () => {
      mockAiServiceFetch.mockResolvedValue(upstreamJson({ cleared: false, reason: 'no_oauth' }))

      const res = await app.inject({
        method: 'POST',
        url: `/api/mcp/external/servers/${encodeURIComponent('a b/c')}/clear-auth`,
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(res.statusCode).toBe(200)
      const [, pathArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      expect(pathArg).toBe('/api/mcp/external/servers/a%20b%2Fc/clear-auth')
      expect(pathArg).not.toContain(' ')
    })

    it('上游 403(越权)必须原样透出 —— 不许塌成 404 或 502', async () => {
      mockAiServiceFetch.mockResolvedValue(
        upstreamJson({ error: '无权清除该 MCP Server 的凭据: svr1' }, 403),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/svr1/clear-auth',
        headers: AUTH_HEADERS,
        payload: {},
      })

      // 403 与 404 必须可区分:混同会让"看得见但动不了"和"没有这台"变成同一件事
      expect(res.statusCode).toBe(403)
      expect(res.statusCode).not.toBe(404)
    })

    it('上游 404(没有这台)必须原样透出', async () => {
      mockAiServiceFetch.mockResolvedValue(upstreamJson({ error: 'MCP Server 不存在: nope' }, 404))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/nope/clear-auth',
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(res.statusCode).toBe(404)
    })

    it('未登录 ⇒ 401 且一次都不转发(撤回凭据尤其不能裸奔)', async () => {
      vi.mocked(verifyAccessToken).mockRejectedValue(
        Object.assign(new Error('请先登录'), { statusCode: 401 }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/svr1/clear-auth',
        payload: {},
      })

      expect(res.statusCode).toBe(401)
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
