// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-306 Workspace agent/run 伪成功回归锁。
 *
 * 缺陷:workspace-ai-service 调 ai-service 写的是 `/llm/chat`,而 ai-service 的 llm 路由只在
 * `/api` 前缀下(`/api/llm/complete`),调用恒 404;404 落伪成功分支,任务被置 completed,
 * 任何登录用户都能拿到 200 + completed + 「Agent 第 N 轮思考」,实际零执行。
 *
 * 本夹具钉住:
 *   ① 路由面:POST /api/workspace/agent/run 不再返回 200 + completed,而是显式 501;
 *   ② 服务面:失败时调用真实端点 `/api/llm/complete`(带 /api 前缀),且 404 一律 failed,
 *      不再伪造「第 N 轮思考」;
 *   ③ 正向对照:真实 200 响应下的内容原样落到 task.result,证明不是一刀切禁用。
 *
 * 改前读数:① 200(completed);② 请求打到 /llm/chat、404 后 completed + 伪思考。
 * 改后读数:① 501;② 打到 /api/llm/complete、404 后 failed;③ 200 成功内容原样。
 */
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAiServiceSystemFetch } = vi.hoisted(() => ({
  mockAiServiceSystemFetch: vi.fn(),
}))

vi.mock('../src/utils/ai-service-fetch.js', async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>('../src/utils/ai-service-fetch.js')
  return {
    ...actual,
    aiServiceSystemFetch: (...args: unknown[]) => mockAiServiceSystemFetch(...args),
  }
})

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return {
    ...actual,
    authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
      const raw = request.headers['x-probe-user']
      request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
    },
  }
})

import { agentLoop } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

describe('F-306 Workspace agent/run 不再伪成功', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockAiServiceSystemFetch.mockReset()
    app = Fastify()
    await app.register(workspaceAiRoutes, { prefix: '/api/workspace' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('路由面:POST /agent/run 显式 501,不再 200 + completed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/agent/run',
      headers: { 'x-probe-user': 'user-a' },
      payload: { goal: '修复登录页', tools: ['read_file'] },
    })

    expect(res.statusCode).toBe(501)
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(501)
    expect(body.message).toContain('未接入')
    expect(res.body).not.toContain('completed')
  })

  it('服务面:失败时打真实端点 /api/llm/complete,404 落 failed 且不伪造思考', async () => {
    mockAiServiceSystemFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const task = await agentLoop.run({ goal: '修复登录页', tools: ['read_file'] })

    expect(mockAiServiceSystemFetch).toHaveBeenCalledWith(
      '/api/llm/complete',
      expect.anything(),
    )
    expect(task.status).toBe('failed')
    expect(task.result).not.toContain('第 1 轮思考')
    const llmStep = task.steps.find((step) => step.type === 'llm')
    expect(llmStep?.content).not.toContain('Agent 第 1 轮思考')
    expect(llmStep?.content).toContain('/api/llm/complete')
  })

  it('正向对照:真实 200 内容原样落到 task.result', async () => {
    mockAiServiceSystemFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: '先复现问题,再定位空指针' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const task = await agentLoop.run({ goal: '修复登录页' })

    expect(task.status).toBe('completed')
    expect(task.result).toBe('先复现问题,再定位空指针')
  })
})
