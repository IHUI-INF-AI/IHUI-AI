// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-304「POST /workspace-ai/permissions/:requestId/resolve 缺属主校验」回归测试。
 *
 * 缺陷: resolve 只认 requestId,任意登录用户拿他人 requestId 即可代批工具执行;
 * 而 listPending(userId) 是有属主过滤的,判据不一致。PermissionRequest 自带 userId。
 *
 * 修复: resolve 前用 permissionManager.getRequest(requestId) 取请求,以登录身份
 * 比对 userId;不存在与非属主统一 403,不泄露 requestId 是否存在。
 *
 * 本文件钉住:
 *  ① 非属主代批 → 403 且 resolve 零调用;
 *  ② 不存在的 requestId → 403 且 resolve 零调用;
 *  ③ 属主本人 → 200 且 resolve 以该 requestId 调用一次。
 *
 * 隔离: auth 桩只替换 authenticate(按请求头给 userId);getRequest/resolve 被 spy
 * 成纯内存返回,不连 PG/Redis、不触达 WebSocket 推送。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: unknown) => request),
}))

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return { ...actual, authenticate: mockAuthenticate }
})

import { permissionManager } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const PREFIX = '/api/workspace'
const OWNER = 'user-owner'
const ATTACKER = 'user-attacker'
const REQ_ID = 'req-f304-0001'

function actorHeaders(userId: string): Record<string, string> {
  return { 'x-probe-user': userId }
}

function pendingReq(userId: string) {
  return {
    requestId: REQ_ID,
    userId,
    tool: 'fs.write',
    args: {},
    status: 'pending',
    createdAt: 0,
    resolvedAt: null,
  }
}

function injectResolve(userId: string) {
  return app.inject({
    method: 'POST',
    url: `${PREFIX}/permissions/${REQ_ID}/resolve`,
    headers: actorHeaders(userId),
    payload: { approved: true },
  })
}

let app: FastifyInstance

describe('permissions/:requestId/resolve 属主校验 — F-304', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(workspaceAiRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    mockAuthenticate.mockImplementation(async (request: unknown) => {
      const req = request as { headers: Record<string, unknown>; userId?: string }
      const raw = req.headers['x-probe-user']
      if (typeof raw !== 'string' || raw.length === 0) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      req.userId = raw
      return req
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockAuthenticate.mockReset()
  })

  it('① 非属主代批他人 requestId → 403,resolve 零调用', async () => {
    vi.spyOn(permissionManager, 'getRequest').mockReturnValue(pendingReq(OWNER) as never)
    const resolveSpy = vi.spyOn(permissionManager, 'resolve').mockReturnValue(true)

    const res = await injectResolve(ATTACKER)

    expect(res.statusCode).toBe(403)
    expect(resolveSpy).not.toHaveBeenCalled()
  })

  it('② 不存在的 requestId → 403(不泄露存在性),resolve 零调用', async () => {
    vi.spyOn(permissionManager, 'getRequest').mockReturnValue(null)
    const resolveSpy = vi.spyOn(permissionManager, 'resolve').mockReturnValue(true)

    const res = await injectResolve(ATTACKER)

    expect(res.statusCode).toBe(403)
    expect(resolveSpy).not.toHaveBeenCalled()
  })

  it('③ 属主本人 → 200,resolve 以该 requestId 调用一次', async () => {
    vi.spyOn(permissionManager, 'getRequest').mockReturnValue(pendingReq(OWNER) as never)
    const resolveSpy = vi.spyOn(permissionManager, 'resolve').mockReturnValue(true)

    const res = await injectResolve(OWNER)

    expect(res.statusCode).toBe(200)
    expect(resolveSpy).toHaveBeenCalledTimes(1)
    expect(resolveSpy.mock.calls[0]?.[0]).toBe(REQ_ID)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
