// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-401「codebase/vector/checkpoints 缺 workspace 权限校验」回归测试。
 *
 * 缺陷: 该组 9 个端点只有 requireAuth,handler 拿 workspacePath 直取 indexer /
 * checkpointManager,非工作区成员凭 workspacePath 即可读写他人代码索引/向量/检查点。
 * 同文件 fs.* 组早已接 assertWorkspacePermission,这组漏接。
 *
 * 修复: 9 个端点统一挂工作区权限守卫(guardWorkspace → assertWorkspacePermission),
 * 拒绝即 return,业务方法零调用。
 *
 * 本文件钉住:
 *  ① 9 个端点在非成员调用下全部 403,且 checkWorkspace 以 (userId, workspacePath) 被调用;
 *  ② 守卫放行时端点正常返回,不误杀。
 *
 * 隔离: auth 桩只替换 authenticate;checkWorkspace 被 mock 成纯内存判定,业务 indexer
 * 在拒绝路径根本不执行,放行路径的 incrementalIndexer.status 被 spy 成固定返回,
 * 不读真实代码库/向量库/检查点文件,零网络。
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

import { permissionManager, incrementalIndexer } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const PREFIX = '/api/workspace'
const USER = 'user-f401'
const WS = '/srv/ws-victim'

const denied = { allowed: false, configured: true, reason: 'not a workspace member' }

type Endpoint = {
  method: 'GET' | 'POST'
  url: string
  payload?: Record<string, unknown>
}

const endpoints: Endpoint[] = [
  { method: 'POST', url: '/codebase/index', payload: { workspacePath: WS } },
  { method: 'GET', url: `/codebase/search?workspacePath=${encodeURIComponent(WS)}&q=x` },
  { method: 'POST', url: '/codebase/incremental', payload: { workspacePath: WS } },
  { method: 'GET', url: `/codebase/status?workspacePath=${encodeURIComponent(WS)}` },
  { method: 'POST', url: '/vector/index', payload: { workspacePath: WS } },
  { method: 'POST', url: '/vector/search', payload: { workspacePath: WS, query: 'x' } },
  { method: 'GET', url: `/checkpoints?workspacePath=${encodeURIComponent(WS)}` },
  { method: 'POST', url: '/checkpoints/cp-1/rollback', payload: { workspacePath: WS } },
  { method: 'POST', url: '/checkpoints/undo', payload: { workspacePath: WS } },
]

let app: FastifyInstance
let checkSpy: ReturnType<typeof vi.spyOn>

describe('codebase/vector/checkpoints 工作区权限守卫 — F-401', () => {
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
      req.userId = USER
      return req
    })
    checkSpy = vi.spyOn(permissionManager, 'checkWorkspace').mockResolvedValue(denied as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockAuthenticate.mockReset()
  })

  it.each(endpoints)('$method $url 非成员 → 403 且守卫被调用', async (ep) => {
    const res = await app.inject({
      method: ep.method,
      url: `${PREFIX}${ep.url}`,
      headers: { 'x-probe-user': USER },
      ...(ep.payload ? { payload: ep.payload } : {}),
    })

    expect(res.statusCode).toBe(403)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(checkSpy.mock.calls[0]?.[0]).toMatchObject({ userId: USER, workspacePath: WS })
  })

  it('成员放行:守卫 allowed 时 /codebase/status 正常返回,不误杀', async () => {
    checkSpy.mockResolvedValue({ allowed: true } as never)
    const statusSpy = vi.spyOn(incrementalIndexer, 'status').mockReturnValue({} as never)

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/codebase/status?workspacePath=${encodeURIComponent(WS)}`,
      headers: { 'x-probe-user': USER },
    })

    expect(res.statusCode).toBe(200)
    expect(statusSpy).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
