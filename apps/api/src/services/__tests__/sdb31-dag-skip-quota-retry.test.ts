// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-37:DAG 条件边把下游标 `cancelled` 后,层执行不消费该标记 ⇒ 下游照跑并进结果。
 * SDB-38:DAG 执行器签名丢弃 retry/quotas ⇒ token 配额与重试在 DAG 会话里不生效。
 *
 * 夹具:mock ai-service HTTP,不连 DB/Redis(服务实例传 null)。
 * - 条件边用例:节点 a 输出不含 'YES',b(及 b→c)必须一次都不调用。
 * - 配额用例:单节点返回超大 token_usage,dispatch 必须收口为 quota_exceeded。
 * - 重试用例:首次 failed、第二次成功,retry.maxAttempts=2 时必须调用两次并完成。
 */

import { describe, it, expect, vi } from 'vitest'

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

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: async (_path: string, opts: { body: string }) => {
    const body = JSON.parse(opts.body) as { items?: Array<{ input?: string }> }
    const input = body.items?.[0]?.input ?? ''
    const task = /请处理当前节点任务: (\S+)/.exec(input)?.[1] ?? input
    aiState.calls.push(task)
    return aiState.handler(task, aiState.calls.length)
  },
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  },
  dbRead: {},
}))

import { SubagentDispatchService } from '../subagent-dispatch-service.js'

type RtView = {
  dispatch: { status: string; result?: string }
  dagNodeStatus: Map<string, string>
  completedAt?: number
}

function rtOf(svc: SubagentDispatchService, id: string): RtView {
  const map = (svc as unknown as { runtimes: Map<string, RtView> }).runtimes
  const rt = map.get(id)
  if (!rt) throw new Error(`runtime ${id} 不存在`)
  return rt
}

async function waitDone(svc: SubagentDispatchService, id: string): Promise<RtView> {
  for (let i = 0; i < 200; i++) {
    const rt = rtOf(svc, id)
    if (rt.completedAt !== undefined) return rt
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('dispatch 未在预期时间内结束')
}

const baseInput = {
  goal: 'g',
  affectedFiles: ['a.ts'],
  forbidden: [],
  verifyCommands: [],
  constraints: '',
  deliverables: '',
}

describe('SDB-37 DAG 条件边的 cancelled 必须被层执行消费', () => {
  it('条件不满足时下游(含其下游)一次都不调用,结果不含被跳过节点', async () => {
    aiState.calls = []
    aiState.handler = (task) =>
      task === 'TASK_A'
        ? {
            status: 200,
            ok: true,
            statusText: 'OK',
            json: async () => ({ code: 0, data: { final_output: 'NO' } }),
          }
        : {
            status: 200,
            ok: true,
            statusText: 'OK',
            json: async () => ({ code: 0, data: { final_output: 'SHOULD_NOT_RUN' } }),
          }

    const svc = new SubagentDispatchService(null)
    const res = await svc.dispatch({
      ...baseInput,
      dag: {
        nodes: [
          { id: 'a', agentRole: 'coder', task: 'TASK_A' },
          { id: 'b', agentRole: 'coder', task: 'TASK_B' },
          { id: 'c', agentRole: 'coder', task: 'TASK_C' },
        ],
        edges: [
          { from: 'a', to: 'b', condition: "result.includes('YES')" },
          { from: 'b', to: 'c' },
        ],
      },
    })
    if (!res.dispatch) throw new Error('dispatch 未创建')
    const rt = await waitDone(svc, res.dispatch.id)

    expect(aiState.calls).toEqual(['TASK_A'])
    expect(rt.dagNodeStatus.get('b')).toBe('cancelled')
    expect(rt.dagNodeStatus.get('c')).toBe('cancelled')
    expect(rt.dispatch.status).toBe('completed')
    expect(rt.dispatch.result ?? '').not.toContain('SHOULD_NOT_RUN')
  })
})

describe('SDB-38 DAG 必须消费 tokenQuota 与 retry', () => {
  it('节点 token 超限 ⇒ dispatch 收口为 quota_exceeded', async () => {
    aiState.calls = []
    aiState.handler = () => ({
      status: 200,
      ok: true,
      statusText: 'OK',
      json: async () => ({
        code: 0,
        data: {
          final_output: 'Q',
          token_usage: { prompt: 1000, completion: 4000, total: 5000 },
        },
      }),
    })

    const svc = new SubagentDispatchService(null)
    const res = await svc.dispatch({
      ...baseInput,
      quotas: { timeoutMs: 5000, tokenQuota: 1000, maxRetries: 0 },
      dag: { nodes: [{ id: 'a', agentRole: 'coder', task: 'TASK_QUOTA' }], edges: [] },
    })
    if (!res.dispatch) throw new Error('dispatch 未创建')
    const rt = await waitDone(svc, res.dispatch.id)

    expect(rt.dispatch.status).toBe('quota_exceeded')
    expect(rt.dispatch.result ?? '').toContain('token 超限')
    expect(aiState.calls).toEqual(['TASK_QUOTA'])
  })

  it('retry.maxAttempts=2 时候失败一次再成功,最终 completed', async () => {
    aiState.calls = []
    aiState.handler = (_task, callNo) =>
      callNo === 1
        ? { status: 500, ok: false, statusText: 'ERR', json: async () => ({}) }
        : {
            status: 200,
            ok: true,
            statusText: 'OK',
            json: async () => ({ code: 0, data: { final_output: 'RETRIED_OK' } }),
          }

    const svc = new SubagentDispatchService(null)
    const res = await svc.dispatch({
      ...baseInput,
      retry: { maxAttempts: 2, delayMs: 0 },
      dag: { nodes: [{ id: 'a', agentRole: 'coder', task: 'TASK_RETRY' }], edges: [] },
    })
    if (!res.dispatch) throw new Error('dispatch 未创建')
    const rt = await waitDone(svc, res.dispatch.id)

    expect(aiState.calls).toEqual(['TASK_RETRY', 'TASK_RETRY'])
    expect(rt.dispatch.status).toBe('completed')
    expect(rt.dispatch.result ?? '').toContain('RETRIED_OK')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
