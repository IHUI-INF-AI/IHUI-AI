// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-200 回归: Crew 全部 LLM 步骤失败不得记 completed / 返回 success。
 *
 * 三种终态口径:
 *   ① 全部步骤失败 ⇒ session failed + success:false(路由 400),任务级全 failed;
 *   ② 部分步骤失败 ⇒ 保留 completed,但响应/流式终态事件带 stepStats 失败统计;
 *   ③ 全部成功 ⇒ 成功路径响应形状不变(不出现 stepStats)。
 *
 * 只 mock db(空操作)/ callRealLlm / 角色表 / 工具 / RAG / 鉴权,不连真实 PG、上游与 Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const SESSION_ID = 'sess-f200'
const ALL_ROLES = ['planner', 'researcher', 'executor', 'reviewer', 'reporter']

vi.mock('../src/db/index.js', () => {
  const sessionRow = {
    id: 'sess-f200',
    userId: 'f200-user',
    title: '市场调研',
    status: 'pending',
    inputMessage: '做一份市场调研报告',
    outputMessage: null,
    config: { maxRetries: 0 },
    createdAt: new Date(),
    completedAt: null,
  }
  return {
    db: {
      select: () => {
        const q = {
          where: () => q,
          orderBy: () => q,
          limit: async () => [sessionRow],
        }
        return { from: () => q }
      },
      insert: () => ({ values: async () => [] }),
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ id: 'sess-f200' }] }) }),
      }),
      delete: () => ({ where: async () => [] }),
    },
  }
})

const llmMock = vi.hoisted(() => vi.fn())

vi.mock('../src/services/crew-llm-adapter.js', () => ({ callRealLlm: llmMock }))

vi.mock('../src/services/crew-agent-registry.js', () => ({
  agentRegistry: {
    listRoles: () => [],
    getRole: (name: string) => ({
      role: name,
      goal: 'g',
      backstory: 'b',
      llmModelId: '',
      tools: [],
      allowDelegation: false,
      verbose: false,
    }),
  },
}))

vi.mock('../src/services/crew-tools.js', () => ({
  getCrewToolDefinitions: () => [],
  executeCrewTool: vi.fn(async () => ({ success: true, output: '' })),
}))

vi.mock('../src/services/knowledge-rag-service.js', () => ({
  knowledgeRagService: { getRagContext: async () => '' },
}))

vi.mock('../src/services/clawdbot/index.js', () => ({
  getModelManager: () => ({ listPublic: () => [] }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }) => {
    request.userId = 'f200-user'
  },
  isSystemAdmin: () => false,
}))

import { crewOrchestrator, type CrewStreamEvent } from '../src/services/crew-orchestrator.js'
import { crewRoutes } from '../src/routes/crew.js'

type LlmCallArgs = { messages: Array<{ role: string; content: string }> }

/** 从提示词 `你是<role>` 还原当前步骤角色(executor 工具循环首条是 system 提示) */
function roleOfPrompt(args: LlmCallArgs): string {
  for (const msg of args.messages) {
    const m = /你是\s*([a-z]+)/.exec(msg.content ?? '')
    if (m) return m[1] ?? ''
  }
  return ''
}

/** 按角色注入成败:failingRoles 内的角色抛错(模拟上游 5xx/超时) */
function llmFailsFor(failingRoles: string[]): void {
  llmMock.mockReset()
  llmMock.mockImplementation(async (args: LlmCallArgs) => {
    const role = roleOfPrompt(args)
    if (failingRoles.includes(role)) throw new Error('fixture: upstream 503')
    return {
      content: `${role} 的真实产出`,
      toolCalls: [],
      modelUsed: 'fixture-model',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }
  })
}

const orch = crewOrchestrator as unknown as {
  updateSessionStatus: (id: string, status: string, result?: string) => Promise<void>
  updateTaskStatus: (
    taskId: string,
    status: string,
    output?: string,
    error?: string,
  ) => Promise<void>
}

describe('F-200 Crew 全步骤失败不得谎报成功', () => {
  let app: FastifyInstance
  let sessionSpy: ReturnType<typeof vi.spyOn>
  let taskSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(crewRoutes, { prefix: '/api/crew' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    llmMock.mockReset()
    sessionSpy = vi.spyOn(orch, 'updateSessionStatus').mockResolvedValue(undefined)
    taskSpy = vi.spyOn(orch, 'updateTaskStatus').mockResolvedValue(undefined)
  })

  const runRoute = () =>
    app.inject({ method: 'POST', url: `/api/crew/sessions/${SESSION_ID}/runs` })

  const sessionStates = () => sessionSpy.mock.calls.map((c) => c[1])
  const taskStates = () => taskSpy.mock.calls.map((c) => c[1])

  it('① 全部失败:orchestrator 返回 success:false + stepStats 全失败', async () => {
    llmFailsFor(ALL_ROLES)

    const out = await crewOrchestrator.executeSession(SESSION_ID)

    expect(out.success).toBe(false)
    expect(out.error).toBe('所有执行步骤均失败')
    expect(out.stepStats).toEqual({
      total: 5,
      completed: 0,
      failed: 5,
      failedRoles: ALL_ROLES,
    })
    expect(sessionStates().at(-1)).toBe('failed')
    expect(sessionStates()).not.toContain('completed')
  })

  it('① 全部失败:路由返回 400 错误,不返回 success 包装', async () => {
    llmFailsFor(ALL_ROLES)

    const res = await runRoute()

    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: number }).code).toBe(400)
    expect((res.json() as { message: string }).message).toBe('所有执行步骤均失败')
    expect(sessionStates().at(-1)).toBe('failed')
    expect(sessionStates()).not.toContain('completed')
    // 任务级不得出现 completed 终态(起始 running 允许)
    expect(taskStates()).not.toContain('completed')
    expect(taskStates().filter((s) => s === 'failed')).toHaveLength(5)
  })

  it('② 部分失败:保留 completed,响应带失败步骤统计', async () => {
    llmFailsFor(['planner', 'researcher'])

    const res = await runRoute()

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data: {
        runId: string
        result: string
        stepStats?: {
          total: number
          completed: number
          failed: number
          failedRoles: string[]
        }
      }
    }
    expect(body.code).toBe(0)
    expect(body.data.runId).toBe(SESSION_ID)
    expect(body.data.result).toBe('reporter 的真实产出')
    expect(body.data.stepStats).toEqual({
      total: 5,
      completed: 3,
      failed: 2,
      failedRoles: ['planner', 'researcher'],
    })
    expect(sessionStates().at(-1)).toBe('completed')
    expect(taskStates().filter((s) => s === 'failed')).toHaveLength(2)
  })

  it('③ 全部成功:成功路径响应形状不变,不出现 stepStats', async () => {
    llmFailsFor([])

    const res = await runRoute()

    expect(res.statusCode).toBe(200)
    const data = (res.json() as { data: Record<string, unknown> }).data
    expect(Object.keys(data).sort()).toEqual(['result', 'runId', 'usage'])
    expect(data['result']).toBe('reporter 的真实产出')
    expect(data['stepStats']).toBeUndefined()
    expect(sessionStates().at(-1)).toBe('completed')
    expect(sessionStates()).not.toContain('failed')
  })

  it('④ 流式全部失败:终态事件为 error(带统计),不得发 complete', async () => {
    llmFailsFor(ALL_ROLES)

    const events: CrewStreamEvent[] = []
    for await (const evt of crewOrchestrator.executeSessionStreaming(SESSION_ID)) events.push(evt)

    expect(events.some((e) => e.type === 'complete')).toBe(false)
    const last = events.at(-1)!
    expect(last.type).toBe('error')
    expect(last.content).toBe('所有执行步骤均失败')
    expect(last.stepStats).toEqual({
      total: 5,
      completed: 0,
      failed: 5,
      failedRoles: ALL_ROLES,
    })
    expect(sessionStates()).toEqual(['failed'])
  })

  it('④ 流式部分失败:complete 事件带失败步骤统计', async () => {
    llmFailsFor(['executor'])

    const events: CrewStreamEvent[] = []
    for await (const evt of crewOrchestrator.executeSessionStreaming(SESSION_ID)) events.push(evt)

    const complete = events.find((e) => e.type === 'complete')
    expect(complete).toBeDefined()
    expect(complete!.content).toBe('reporter 的真实产出')
    expect(complete!.stepStats).toEqual({
      total: 5,
      completed: 4,
      failed: 1,
      failedRoles: ['executor'],
    })
    expect(sessionStates().at(-1)).toBe('completed')
  })

  it('④ 流式全部成功:complete 事件不带 stepStats', async () => {
    llmFailsFor([])

    const events: CrewStreamEvent[] = []
    for await (const evt of crewOrchestrator.executeSessionStreaming(SESSION_ID)) events.push(evt)

    const complete = events.find((e) => e.type === 'complete')
    expect(complete).toBeDefined()
    expect(complete!.stepStats).toBeUndefined()
    expect(events.some((e) => e.type === 'error')).toBe(false)
    expect(sessionStates()).toEqual(['completed'])
  })
})
