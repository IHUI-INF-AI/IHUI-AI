// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-432 夹具:Workspace ACP 会话必须真实落库并校验归属。
 *
 * 改前(红):
 * - create 只 randomUUID 就回 201,不落库;
 * - begin/end 的 :id 只做 z.string(),任意随机/他人 id 都回
 *   prompt_started / prompt_completed(假成功、零归属校验)。
 *
 * 改后(绿):
 * - create 先写 agent_runtime_sessions,写失败 500,不假 201;
 * - begin/end 先按 (id,user_id) 查询;不存在或他人 → 404,响应体不含 prompt 事件。
 *
 * 零真实 DB:mock db 的 select/insert。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({
  selectResults: [] as Array<Array<{ id: string }>>,
  insertCalls: [] as Array<Record<string, unknown>>,
  insertError: null as unknown,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'user-owner'
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(h.selectResults.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        h.insertCalls.push(values)
        if (h.insertError) throw h.insertError
        return undefined
      },
    }),
  },
  dbRead: {},
}))

import { workspaceRoutes } from '../src/routes/workspace.js'

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(workspaceRoutes, { prefix: '/api' })
  return server
}

beforeEach(() => {
  h.selectResults = []
  h.insertCalls = []
  h.insertError = null
})

describe('F-432 Workspace ACP 会话真落库 + 归属校验', () => {
  it('create:先落 agent_runtime_sessions 再回 201,行内带 userId 与 workspaceRoot', async () => {
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspace/acp/sessions',
      payload: { workspaceRoot: '/srv/ws/demo' },
    })
    await server.close()

    expect(res.statusCode).toBe(201)
    expect(res.json().data.type).toBe('session_created')
    expect(h.insertCalls).toHaveLength(1)
    expect(h.insertCalls[0]).toMatchObject({
      botId: 'workspace-acp',
      userId: 'user-owner',
      status: 'active',
      metadata: { source: 'workspace-acp', workspaceRoot: '/srv/ws/demo' },
    })
    expect(h.insertCalls[0]?.id).toBe(res.json().data.data.sessionId)
  })

  it('create:落库失败 → 500,绝不假 201', async () => {
    h.insertError = new Error('db down')
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspace/acp/sessions',
      payload: { workspaceRoot: '/srv/ws/demo' },
    })
    await server.close()

    expect(res.statusCode).toBe(500)
    expect(res.json().data).toBeUndefined()
  })

  it('begin-prompt:随机/他人 id → 404,不返回 prompt_started', async () => {
    h.selectResults = [[]] // 归属查询无行
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspace/acp/sessions/not-a-real-session/begin-prompt',
      payload: { prompt: 'hello' },
    })
    await server.close()

    expect(res.statusCode).toBe(404)
    expect(res.json().data).toBeUndefined()
  })

  it('begin-prompt:本人会话 → 200 prompt_started', async () => {
    h.selectResults = [[{ id: 'sess-mine' }]]
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspace/acp/sessions/sess-mine/begin-prompt',
      payload: { prompt: 'hello' },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.json().data.type).toBe('prompt_started')
  })

  it('end-prompt:他人 id → 404,不返回 prompt_completed', async () => {
    h.selectResults = [[]]
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspace/acp/sessions/sess-other/end-prompt',
      payload: {},
    })
    await server.close()

    expect(res.statusCode).toBe(404)
    expect(res.json().data).toBeUndefined()
  })

  it('end-prompt:本人会话 → 200 prompt_completed', async () => {
    h.selectResults = [[{ id: 'sess-mine' }]]
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/api/workspace/acp/sessions/sess-mine/end-prompt',
      payload: {},
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.json().data.type).toBe('prompt_completed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
