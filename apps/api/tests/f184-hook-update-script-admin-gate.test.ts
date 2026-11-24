// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Hook PATCH 更新链路的 script 管理员闸(F-184,P1)。
 *
 * 缺陷:创建链路 POST /hooks 在 ai-service 侧已有「script 动作仅管理员可创建」闸,但
 * 更新链路 PATCH /hooks/:id 在 API 转发层此前只做白名单校验、缺 _is_admin 判断,任意登录
 * 用户可把自有 hook 的 action 改成 script,触发时以服务账号执行任意命令。且底层 callAiHooks
 * 会把 ai-service 的 403 吞成 null → 端点误返 404,闸门语义无法从 API 层表达。
 *
 * 本文件钉住三件事:
 *  ① 普通登录用户 PATCH 把 action 改成 script → 403,且转发服务 updateHook 一次都不被调用;
 *  ② 管理员 PATCH script → 200,且 updateHook 恰好调用一次;
 *  ③ script 之外的合法更新(如 log 动作)非管理员仍放行 —— 闸门只针对 script 动作,不误伤。
 *
 * 隔离:auth 桩按请求头给 userId/roleId;hooks-service 用纯内存桩替换(绝不真调 ai-service);
 * 不连 PG/Redis、零网络。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockUpdateHook } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: unknown) => request),
  mockUpdateHook: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return { ...actual, authenticate: mockAuthenticate }
})

vi.mock('../src/services/hooks-service.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/services/hooks-service.js')
  return { ...actual, updateHook: mockUpdateHook }
})

import { hooksRoutes } from '../src/routes/hooks.js'

const PREFIX = '/api'
const REGULAR_USER = 'user-regular'
const ADMIN_USER = 'user-admin'
const HOOK_ID = 'hook-001'

const SCRIPT_PATCH = { action: { type: 'script', config: { command: 'echo hi' } } }
const LOG_PATCH = { action: { type: 'log', config: {} } }

function actorHeaders(userId: string, roleId: number): Record<string, string> {
  return { 'x-probe-user': userId, 'x-probe-role': String(roleId) }
}

let app: FastifyInstance

async function patchHook(headers: Record<string, string>, payload: unknown) {
  return app.inject({
    method: 'PATCH',
    url: `${PREFIX}/hooks/${HOOK_ID}`,
    headers,
    payload,
  })
}

describe('Hook PATCH 更新链路 script 管理员闸(F-184)', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(hooksRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    mockUpdateHook.mockReset()
    mockAuthenticate.mockImplementation(async (request: unknown) => {
      const req = request as {
        headers: Record<string, unknown>
        userId?: string
        jwtPayload?: { userId?: string; roleId?: number }
      }
      const raw = req.headers['x-probe-user']
      const roleId = Number(req.headers['x-probe-role'] ?? 0)
      req.userId = typeof raw === 'string' ? raw : ''
      req.jwtPayload = { userId: req.userId, roleId }
      return req
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockAuthenticate.mockReset()
  })

  it('普通登录用户 PATCH 把 action 改成 script → 403,且 updateHook 零调用', async () => {
    const res = await patchHook(actorHeaders(REGULAR_USER, 0), SCRIPT_PATCH)

    expect(res.statusCode).toBe(403)
    expect(mockUpdateHook).toHaveBeenCalledTimes(0)
  })

  it('管理员 PATCH script → 200,且 updateHook 恰好调用一次', async () => {
    mockUpdateHook.mockResolvedValue({ id: HOOK_ID })
    const res = await patchHook(actorHeaders(ADMIN_USER, 1), SCRIPT_PATCH)

    expect(res.statusCode).toBe(200)
    expect(mockUpdateHook).toHaveBeenCalledTimes(1)
    expect(mockUpdateHook).toHaveBeenCalledWith(expect.anything(), HOOK_ID, expect.anything())
  })

  it('非管理员 PATCH 合法 log 动作仍放行(闸门只针对 script,不误伤)', async () => {
    mockUpdateHook.mockResolvedValue({ id: HOOK_ID })
    const res = await patchHook(actorHeaders(REGULAR_USER, 0), LOG_PATCH)

    expect(res.statusCode).toBe(200)
    expect(mockUpdateHook).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
