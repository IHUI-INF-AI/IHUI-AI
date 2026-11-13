// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-99 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/ai/career-advice 绕过 aiServiceFetch 手写 fetch,只带 Content-Type;
 * ai-service /api/llm/complete 默认需 JWT ⇒ 恒 401,而 catch 把静态模板当 200 成功返回,
 * 功能长期静默失效(无计费/审计,200 + 兜底文案掩盖全部故障)。
 *
 * 本文件锁:
 *   ① 成功路径:走 aiServiceFetch 时真实透传调用者 Authorization,并返回上游正文;
 *   ② 上游 401 / 500 / 504:如实返回错误码与错误体(不再是 200 伪成功、不出现兜底模板);
 *   ③ 上游 200 但正文为空:同样是失败(502),不得用模板冒充;
 *   ④ 网络错误:502,不得落回 200;
 *   ⑤ 源锁:career-advice 处理器内不再出现裸 fetch / 手写 AbortController / 兜底模板。
 *
 * 只 mock authenticate / db / 全局 fetch,不触达真实 ai-service、PG、Redis。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = 'f99-user'
  }),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import aiModulesRoutes from '../src/routes/user/ai-modules-routes.js'

const FORM = {
  school: '示例中学',
  classLevel: '高一',
  scoreRange: '中等偏上',
  languageDifficulty: '文言文阅读偏弱',
  scienceCharacteristics: '物理实验兴趣浓',
  learningObstacle: '做题速度慢',
  hobbies: '机器人社团',
  target: '计算机相关专业',
}

const USER_TOKEN = 'Bearer f99-user-token'

describe('F-99 /api/ai/career-advice 必须带凭证并如实报错', () => {
  let app: FastifyInstance
  const fetchMock = vi.fn<typeof fetch>()

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock)
    app = Fastify({ logger: false })
    await app.register(aiModulesRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    fetchMock.mockReset()
  })

  const call = (payload: Record<string, unknown> = FORM) =>
    app.inject({
      method: 'POST',
      url: '/api/ai/career-advice',
      headers: { authorization: USER_TOKEN },
      payload,
    })

  const upstreamJson = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  it('① 成功路径:透传 Authorization 到 ai-service,返回真实正文', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ content: '  个性化生涯建议正文  ' }))

    const res = await call()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { content: '个性化生涯建议正文' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/api/llm/complete')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe(USER_TOKEN)
    expect(headers['Content-Type']).toBe('application/json')

    // 出站体仍是 /llm/complete 的 OpenAI messages 契约
    const body = JSON.parse(String((init as RequestInit).body ?? '{}')) as {
      messages?: Array<{ role: string; content: string }>
    }
    expect(body.messages?.[0]?.role).toBe('user')
    expect(body.messages?.[0]?.content).toContain('示例中学')
  })

  it('② 上游 401:如实返回 502 错误,不再是 200 + 模板兜底', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"detail":"Not authenticated"}', { status: 401 }))

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; message: string; data?: unknown }
    expect(body.code).toBe(502)
    expect(body.data).toBeUndefined()
    expect(body.message).toContain('AI 服务调用失败')
    expect(res.body).not.toContain('兜底建议')
  })

  it('③ 上游 500:如实返回 502 错误,不再伪成功', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream down', { status: 500 }))

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; message: string; data?: unknown }
    expect(body.code).toBe(502)
    expect(body.data).toBeUndefined()
    expect(res.body).not.toContain('兜底建议')
  })

  it('④ 上游 504:如实透传 504,不吞成 200', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }))

    const res = await call()
    expect(res.statusCode).toBe(504)
    expect((res.json() as { code: number }).code).toBe(504)
  })

  it('⑤ 上游 200 但正文为空:502,不得用模板冒充成功', async () => {
    fetchMock.mockResolvedValueOnce(upstreamJson({ content: '   ' }))

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; data?: unknown }
    expect(body.code).toBe(502)
    expect(body.data).toBeUndefined()
  })

  it('⑥ 网络错误:502,不得落回 200', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    const res = await call()
    expect(res.statusCode).toBe(502)
    expect((res.json() as { code: number }).code).toBe(502)
  })

  it('⑦ 源锁:career-advice 处理器不再出现裸 fetch / 手写 AbortController / 兜底模板', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/user/ai-modules-routes.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf("server.post('/ai/career-advice'")
    const end = src.indexOf("server.post('/ai/career-advice/export'")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)

    expect(block).toContain("aiServiceFetch(request, '/api/llm/complete'")
    // 裸 fetch:小写 fetch( 且前一字符不是标识符字符(排除 aiServiceFetch()
    expect(block).not.toMatch(/(?<![A-Za-z0-9_$])fetch\(/)
    expect(block).not.toContain('new AbortController()')
    expect(block).not.toContain('config.AI_SERVICE_URL')
    expect(block).not.toContain('此为兜底建议')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
