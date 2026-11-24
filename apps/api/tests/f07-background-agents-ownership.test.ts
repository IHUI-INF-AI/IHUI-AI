// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-07:后台 Agent 的归属隔离(P1 越权读写)。
 *
 * 修前:`BackgroundAgentManager` 的 list/get/cancel 只按 agentId 操作,不接收调用者身份;
 * 路由层也不按用户过滤,且创建时 `userUuid` 取自 body —— 任一登录用户都能列出/查看/
 * 取消所有人的后台 Agent(泄露 prompt、workspacePath、运行事件与结果,并能掐断他人长任务)。
 *
 * 本文件对每一面都给「退回即翻红」的构造:
 *   ① list:B 的响应原文里不得出现 A 的 agentId / prompt(不是只断言"B 列表为空",
 *      否则"过滤写了但没生效"会蒙过去);
 *   ② get:B 用 A 的 agentId ⇒ 404,且响应体不泄漏 prompt;
 *   ③ cancel:B 取消 A 的 agent ⇒ 404,且**取消不得静默成功** —— 随后 A 自己 get 仍为
 *      running,A 仍能正常 cancel(正向对照,证明上一条不是"怎么都 404");
 *   ④ 创建时 body 伪造 `userUuid=B`:归属只认登录身份,伪造值不得把 A 的 agent 记到 B 名下;
 *   ⑤ 正向对照:本人查看/取消自己的 agent 均 200。
 *
 * 隔离:Fastify 内存态、auth 插件桩成按请求头取 userId、`agentLoop.run` 挂起(agent 保持
 * running),零网络零 DB。persist 会写 ~/.ihui/background-agents,afterEach 按 agentId 清理。
 */
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 路由层鉴权:按请求头切换调用者;保留真实导出,避免其它模块缺名导出
vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return {
    ...actual,
    authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
      const raw = request.headers['x-probe-user']
      request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'user-a'
    },
  }
})

import { agentLoop, backgroundAgentManager } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const PROMPT = `owner-only-prompt-${randomUUID()}`
const AGENTS_URL = '/api/workspace/background-agents'

let app: FastifyInstance
let runSpy: ReturnType<typeof vi.spyOn>
const createdIds: string[] = []

function asUser(userId: string): Record<string, string> {
  return { 'x-probe-user': userId }
}

async function createAgent(userId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: AGENTS_URL,
    headers: asUser(userId),
    payload: { prompt: PROMPT, workspacePath: process.cwd(), ...extra },
  })
  expect(res.statusCode).toBe(201)
  const agentId = res.json().data.agentId as string
  createdIds.push(agentId)
  return agentId
}

function getAgent(userId: string, agentId: string) {
  return app.inject({ method: 'GET', url: `${AGENTS_URL}/${agentId}`, headers: asUser(userId) })
}

function cancelAgent(userId: string, agentId: string) {
  return app.inject({
    method: 'POST',
    url: `${AGENTS_URL}/${agentId}/cancel`,
    headers: asUser(userId),
  })
}

beforeEach(async () => {
  const manager = backgroundAgentManager as unknown as {
    agents: Map<string, unknown>
    tasks: Map<string, unknown>
  }
  manager.agents.clear()
  manager.tasks.clear()

  runSpy = vi
    .spyOn(agentLoop, 'run')
    .mockImplementation(() => new Promise<never>(() => {})) as ReturnType<typeof vi.spyOn>

  app = Fastify()
  await app.register(workspaceAiRoutes, { prefix: '/api/workspace' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  runSpy.mockRestore()
  const dir = join(homedir(), '.ihui', 'background-agents')
  for (const agentId of createdIds.splice(0)) {
    const file = join(dir, `${agentId}.summary.json`)
    if (existsSync(file)) rmSync(file, { force: true })
  }
})

describe('F-07 · 后台 Agent 归属隔离', () => {
  it('跨用户 list:B 的响应里不出现 A 的 agentId / prompt', async () => {
    const agentId = await createAgent('user-a')

    const bList = await app.inject({ method: 'GET', url: AGENTS_URL, headers: asUser('user-b') })
    expect(bList.statusCode).toBe(200)
    expect(bList.body).not.toContain(agentId)
    expect(bList.body).not.toContain(PROMPT)
    expect(bList.json().data.agents).toEqual([])

    // 正向对照:A 自己的列表仍然看得到(收紧未误伤)
    const aList = await app.inject({ method: 'GET', url: AGENTS_URL, headers: asUser('user-a') })
    expect(aList.statusCode).toBe(200)
    expect(aList.json().data.agents.map((a: { agentId: string }) => a.agentId)).toEqual([agentId])
  })

  it('跨用户 get:B 用 A 的 agentId ⇒ 404,响应不泄漏 prompt', async () => {
    const agentId = await createAgent('user-a')

    const res = await getAgent('user-b', agentId)
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain(PROMPT)
    expect(res.body).not.toContain(agentId)
  })

  it('跨用户 cancel:B 取消 A 的 agent ⇒ 404,且取消不静默成功(A 仍 running、仍可取消)', async () => {
    const agentId = await createAgent('user-a')

    const res = await cancelAgent('user-b', agentId)
    expect(res.statusCode).toBe(404)
    expect(res.json().data?.canceled).not.toBe(true)

    // 不静默成功:任务未被改写,仍由 A 控制
    const stillRunning = await getAgent('user-a', agentId)
    expect(stillRunning.statusCode).toBe(200)
    expect(stillRunning.json().data.status).toBe('running')

    // 正向对照:本人取消成功(证明 404 来自归属闸,不是 cancel 整体坏了)
    const ownCancel = await cancelAgent('user-a', agentId)
    expect(ownCancel.statusCode).toBe(200)
    expect(ownCancel.json().data.canceled).toBe(true)
  })

  it('创建时 body 伪造 userUuid=B ⇒ 归属只认登录身份,B 拿不到也取消不掉', async () => {
    const agentId = await createAgent('user-a', { userUuid: 'user-b' })

    expect((await getAgent('user-b', agentId)).statusCode).toBe(404)
    expect((await cancelAgent('user-b', agentId)).statusCode).toBe(404)
    // 归属仍是 A:A 可查看且任务仍 running
    const own = await getAgent('user-a', agentId)
    expect(own.statusCode).toBe(200)
    expect(own.json().data.status).toBe('running')
  })

  it('正向对照:本人查看/取消自己的 Agent 均 200', async () => {
    const agentId = await createAgent('user-a')

    const got = await getAgent('user-a', agentId)
    expect(got.statusCode).toBe(200)
    expect(got.json().data.agentId).toBe(agentId)

    const canceled = await cancelAgent('user-a', agentId)
    expect(canceled.statusCode).toBe(200)
    expect(canceled.json().data.canceled).toBe(true)

    const after = await getAgent('user-a', agentId)
    expect(after.statusCode).toBe(200)
    expect(after.json().data.status).toBe('cancelled')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
