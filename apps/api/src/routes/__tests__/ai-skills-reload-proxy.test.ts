// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ai-skills 代理的 `reload_skills` 路由 —— 控制帧在 api 层的落地证明(2026-10-28 立)
 *
 * 立因:`reload_skills` 是 D141 正本判定的**真缺**帧(2026-10-01 三轮否证:skill 面
 * 只有调度与统计,无运行时重载口)。本帧要补的是"宿主可显式调用、且必须回报结果"。
 * api 层是中间那一格 —— web 端(MobileLoginGate 之外)与移动端都经它转发。
 *
 * 本文件盯两件容易做错的事:
 * ① **静态口不被参数口吞掉**:`/reload` 与 `/:id` 同段,若注册顺序写反,POST
 *    `/api/ai-skills/reload` 会被当成"对 id='reload' 的技能做 POST",转发到
 *    `/api/ai-skills/reload/invoke` —— 帧就静默串味了(而且用户看到的是"技能不存在",
 *    根本猜不到是路由顺序问题)。所以用例直接断言**转发到的上游路径**。
 * ② **未登录不给放行**:整条路由有 preHandler 鉴权,缺 auth 必须 401 而不是转发。
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

// authenticate 会查用户状态(非活跃 ⇒ 401 / 查询失败 ⇒ 502)。不桩掉的话,
// 本用例会在鉴权那一格就短路,根本走不到"帧有没有被转发"的判据上。
vi.mock('../../db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

import { aiSkillsProxyRoutes } from '../ai-skills-proxy.js'
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

/** ai-service 侧的成功信封(与 _ok() 的形状一致)。 */
function upstreamOk(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (k: string) => (k === 'content-type' ? 'application/json; charset=utf-8' : null),
    },
    text: async () => JSON.stringify({ code: 0, message: 'ok', data }),
  } as unknown as Response
}

describe('ai-skills 代理 · reload_skills 控制帧', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiSkillsProxyRoutes, { prefix: '/api/ai-skills' })
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

  it('POST /reload 必须转发到 ai-service 的 /api/ai-skills/reload(不被 /:id 吞掉)', async () => {
    const diff = {
      total: 5,
      auto: 4,
      added: ['skill-alpha'],
      removed: ['skill-beta'],
      changed: ['skill-gamma'],
      unchanged: 1,
      lastReload: 1730000000,
      forced: true,
      sourceDirs: ['/tmp/skills'],
    }
    mockAiServiceFetch.mockResolvedValue(upstreamOk(diff))

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai-skills/reload',
      headers: AUTH_HEADERS,
      payload: { force: true },
    })

    expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
    const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as [
      unknown,
      string,
      { method?: string; body?: string },
    ]
    // 路径必须是重载口本身 —— 若被 /:id 吞掉,这里会变成 /api/ai-skills/reload/invoke
    expect(pathArg).toBe('/api/ai-skills/reload')
    expect(initArg.method).toBe('POST')
    // force 要透传给上游(force=false 走 mtime 增量)
    expect(JSON.parse(initArg.body ?? '{}')).toEqual({ force: true })
    // 差额必须原样回传给调用方(前端要显示新增/移除/更新名单)
    expect(res.json().data).toEqual(diff)
  })

  it('未登录时 401,不转发到 ai-service', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('请先登录'), { statusCode: 401 }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai-skills/reload',
      payload: { force: true },
    })

    expect(res.statusCode).toBe(401)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })

  it('上游不可用时给 502 而不是静默 200(静默成功态会把失败包装成成功)', async () => {
    mockAiServiceFetch.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai-skills/reload',
      headers: AUTH_HEADERS,
      payload: { force: true },
    })

    expect(res.statusCode).toBe(502)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
