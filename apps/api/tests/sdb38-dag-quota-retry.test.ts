// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-38 DAG 执行器必须真正消费 retry / quotas(tokenQuota)。
 *
 * 背景:dispatch 接收并保存 quotas.tokenQuota,orchestration='dag' 时传给 runDispatchDag,
 * 但执行器既不累计 token 也不按既有判据重试 ⇒ 配额在 DAG 会话中完全失效。
 *
 * 本文件覆盖:
 *  ① 跨节点累计:单个节点都不超限,累计超限后后续节点不再调用模型;
 *  ② 可重试失败(5xx)按既有指数退避重试,第二次成功后 dispatch completed;
 *  ③ 不可重试失败(4xx 永久拒绝)不重试,直接 failed。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
})

type AiHandler = (task: string, callNo: number) => unknown

const aiState = vi.hoisted(() => ({
  calls: [] as string[],
  handler: ((task: string): unknown => {
    void task
    return {
      status: 200,
      ok: true,
      statusText: 'OK',
      json: async () => ({ code: 0, data: { final_output: 'OK' } }),
    }
  }) as AiHandler,
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: async (_path: string, opts: { body: string }) => {
    const body = JSON.parse(opts.body) as { items?: Array<{ input?: string }> }
    const input = body.items?.[0]?.input ?? ''
    const task = /请处理当前节点任务: (\S+)/.exec(input)?.[1] ?? input
    aiState.calls.push(task)
    return aiState.handler(task, aiState.calls.length)
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  },
  dbRead: {},
}))

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service.js'

type RtView = {
  dispatch: { status: string; result?: string }
  dagNodeStatus: Map<string, string>
  steps: Array<{ status: string; error?: string; tokenUsage: { total: number } }>
  completedAt?: number
}

function rtOf(svc: SubagentDispatchService, id: string): RtView {
  const map = (svc as unknown as { runtimes: Map<string, RtView> }).runtimes
  const rt = map.get(id)
  if (!rt) throw new Error(`runtime ${id} 不存在`)
  return rt
}

async function waitDone(svc: SubagentDispatchService, id: string): Promise<RtView> {
  for (let i = 0; i < 300; i++) {
    const rt = rtOf(svc, id)
    if (rt.completedAt !== undefined) return rt
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('dispatch 未在预期时间内结束')
}

const okResponse = (output: string, totalTokens = 0) => ({
  status: 200,
  ok: true,
  statusText: 'OK',
  json: async () => ({
    code: 0,
    data: {
      final_output: output,
      steps: [],
      token_usage: { prompt: 200, completion: Math.max(0, totalTokens - 200), total: totalTokens },
    },
  }),
})

const errorResponse = (status: number) => ({
  status,
  ok: false,
  statusText: status === 400 ? 'Bad Request' : 'Service Unavailable',
  json: async () => ({}),
})

const baseInput = {
  goal: 'g',
  affectedFiles: ['a.ts'],
  forbidden: [],
  verifyCommands: [],
  constraints: '',
  deliverables: '',
}

beforeEach(() => {
  aiState.calls = []
  aiState.handler = () => okResponse('OK')
})

describe('SDB-38 ① DAG 会话累计 token 配额', () => {
  it('单节点均未超限、累计超限后,c 不再调用模型且标记为 cancelled', async () => {
    aiState.handler = (task) => okResponse(`OUT_${task}`, 600)

    const svc = new SubagentDispatchService(null)
    const res = await svc.dispatch({
      ...baseInput,
      quotas: { timeoutMs: 5000, tokenQuota: 1000, maxRetries: 0 },
      dag: {
        nodes: [
          { id: 'a', agentRole: 'coder', task: 'TASK_A' },
          { id: 'b', agentRole: 'coder', task: 'TASK_B' },
          { id: 'c', agentRole: 'coder', task: 'TASK_C' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
    })
    if (!res.dispatch) throw new Error('dispatch 未创建')
    const rt = await waitDone(svc, res.dispatch.id)

    // a(600) + b(600) = 1200 > 1000 ⇒ b 收到超限收口,c 一次都不调
    expect(aiState.calls).toEqual(['TASK_A', 'TASK_B'])
    expect(rt.dagNodeStatus.get('b')).toBe('quota_exceeded')
    expect(rt.dagNodeStatus.get('c')).toBe('cancelled')
    expect(rt.dispatch.status).toBe('quota_exceeded')
    expect(rt.dispatch.result ?? '').toContain('token 超限(1200 > 1000)')
    // 累计值来源于两次真实调用,而不是某一次单节点用量
    expect(rt.steps.filter((s) => s.status === 'ok').length).toBe(1)
  })
})

describe('SDB-38 ② 可重试失败(5xx)重试后成功', () => {
  it('首次 503、第二次 200 ⇒ 调用两次并 completed', async () => {
    aiState.handler = (_task, callNo) =>
      callNo === 1 ? errorResponse(503) : okResponse('RETRIED_OK')

    const svc = new SubagentDispatchService(null)
    const res = await svc.dispatch({
      ...baseInput,
      retry: { maxAttempts: 2, delayMs: 0 },
      dag: { nodes: [{ id: 'a', agentRole: 'coder', task: 'TASK_RETRY' }], edges: [] },
    })
    if (!res.dispatch) throw new Error('dispatch 未创建')
    const rt = await waitDone(svc, res.dispatch.id)

    expect(aiState.calls).toEqual(['TASK_RETRY', 'TASK_RETRY'])
    expect(rt.dagNodeStatus.get('a')).toBe('completed')
    expect(rt.dispatch.status).toBe('completed')
    expect(rt.dispatch.result ?? '').toContain('RETRIED_OK')
  })
})

describe('SDB-38 ③ 不可重试失败(4xx)不重试', () => {
  it('始终 400 ⇒ 只调用一次,节点 failed,dispatch failed', async () => {
    aiState.handler = () => errorResponse(400)

    const svc = new SubagentDispatchService(null)
    const res = await svc.dispatch({
      ...baseInput,
      retry: { maxAttempts: 3, delayMs: 0 },
      dag: { nodes: [{ id: 'a', agentRole: 'coder', task: 'TASK_NO_RETRY' }], edges: [] },
    })
    if (!res.dispatch) throw new Error('dispatch 未创建')
    const rt = await waitDone(svc, res.dispatch.id)

    expect(aiState.calls).toEqual(['TASK_NO_RETRY'])
    expect(rt.dagNodeStatus.get('a')).toBe('failed')
    expect(rt.dispatch.status).toBe('failed')
    expect(rt.steps.at(-1)?.error ?? '').toContain('400')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
