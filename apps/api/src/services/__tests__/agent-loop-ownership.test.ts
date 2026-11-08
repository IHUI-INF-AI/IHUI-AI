// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AgentLoopRuntime 任务归属 + 上游失败诚实状态(F-39 / F-306,2026-08-11 立)。
 * 行为断言:
 * - F-39:A 建任务,B 的 list/status/cancel/inject 全部不可见/不可操作;终态任务超 TTL 被回收。
 * - F-306:上游 503 或网络抛错 → task.status='failed',不再写"伪成功文案"后记 completed。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { systemFetch } = vi.hoisted(() => ({ systemFetch: vi.fn() }))
vi.mock('../../utils/ai-service-fetch.js', () => ({ aiServiceSystemFetch: systemFetch }))

import { agentLoop } from '../workspace-ai-service'
import type { AgentTask } from '../workspace-ai-service'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const created: string[] = []

type WhiteBox = {
  tasks: Map<string, AgentTask>
  injections: Map<string, string[]>
}

function cleanup(): void {
  const box = agentLoop as unknown as WhiteBox
  for (const taskId of created) {
    box.tasks.delete(taskId)
    box.injections.delete(taskId)
  }
  created.length = 0
}

function okResponse(content = 'ok'): Response {
  return new Response(JSON.stringify({ content }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  systemFetch.mockReset()
})

afterEach(cleanup)

describe('F-39 AgentLoopRuntime 任务按发起人归属', () => {
  it('A 建任务:run 写入发起人,A 可见;B 列表不可见', async () => {
    systemFetch.mockResolvedValue(okResponse())
    const task = await agentLoop.run({ goal: 'g', userId: USER_A })
    created.push(task.taskId)

    expect(task.userId).toBe(USER_A)
    expect(agentLoop.listRunning(USER_B)).toEqual({})
    expect(agentLoop.status(task.taskId, USER_B)).toBeNull()
    expect(agentLoop.status(task.taskId, USER_A)?.taskId).toBe(task.taskId)
    expect(agentLoop.listRunning(USER_A)[task.taskId]?.taskId).toBe(task.taskId)
  })

  it('B 对 A 的运行中任务:status/cancel/inject 全部拒绝且零副作用', () => {
    const box = agentLoop as unknown as WhiteBox
    const running: AgentTask = {
      taskId: 'owned-running',
      userId: USER_A,
      sessionId: 's',
      goal: 'g',
      status: 'running',
      startedAt: new Date().toISOString(),
      injections: [],
      iterations: 0,
      steps: [],
      result: '',
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    box.tasks.set('owned-running', running)

    expect(agentLoop.listRunning(USER_B)).toEqual({})
    expect(agentLoop.status('owned-running', USER_B)).toBeNull()
    expect(agentLoop.cancel('owned-running', USER_B)).toBe(false)
    expect(agentLoop.injectMessage('owned-running', USER_B, '越权插话')).toBe(false)
    // 零副作用:任务仍是 running,队列里没有 B 的内容
    expect(running.status).toBe('running')
    expect(running.injections).toEqual([])
    expect(box.injections.get('owned-running')).toBeUndefined()

    // 同一操作由 A 本人发起则正常
    expect(agentLoop.injectMessage('owned-running', USER_A, '本人插话')).toBe(true)
    expect(agentLoop.cancel('owned-running', USER_A)).toBe(true)
    box.tasks.delete('owned-running')
    box.injections.delete('owned-running')
  })

  it('终态任务超过 1h 被回收,插话队列一并清空', () => {
    const box = agentLoop as unknown as WhiteBox
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const stale: AgentTask = {
      taskId: 'stale-task',
      userId: USER_A,
      sessionId: 's',
      goal: 'g',
      status: 'completed',
      startedAt: twoHoursAgo,
      injections: [],
      iterations: 1,
      steps: [],
      result: 'x',
      error: null,
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    }
    box.tasks.set('stale-task', stale)
    box.injections.set('stale-task', ['left-over'])

    expect(agentLoop.listRunning(USER_A)['stale-task']).toBeUndefined()
    expect(box.tasks.get('stale-task')).toBeUndefined()
    expect(box.injections.get('stale-task')).toBeUndefined()
  })
})

describe('F-306 上游失败必须落 failed', () => {
  it('LLM 返回 503 → failed + error,不产生伪成功文案', async () => {
    systemFetch.mockResolvedValue(new Response('upstream down', { status: 503 }))
    const task = await agentLoop.run({ goal: '写周报', userId: USER_A })
    created.push(task.taskId)

    expect(task.status).toBe('failed')
    expect(task.error).toContain('503')
    expect(task.result).toBe('')
    expect(task.steps.some((s) => s.content.includes('Agent 第 1 轮思考'))).toBe(false)
    expect(task.steps.some((s) => s.type === 'llm')).toBe(false)
  })

  it('网络异常 → failed + error,不记 completed', async () => {
    systemFetch.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8830'))
    const task = await agentLoop.run({ goal: 'g', userId: USER_A })
    created.push(task.taskId)

    expect(task.status).toBe('failed')
    expect(task.error).toContain('ECONNREFUSED')
  })
})
