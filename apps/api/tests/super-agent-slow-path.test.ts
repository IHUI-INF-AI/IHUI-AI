// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

// 测试隔离铁律:service 静态 import 链上的 db/派单出口一律 mock
vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: vi.fn() },
}))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super_agent' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(async () => undefined),
}))

import { createSlowJudgeCall } from '../src/services/super-agent-pump-service.js'
import type { SlowJudgeInput } from '@ihui/shared/super-agent'

const inputs: SlowJudgeInput[] = [
  { id: 'e1', text: '登录页 500 了谁管一下', observedAt: 1730000000000, requesters: ['u-1'] },
  { id: 'e2', text: '周报已发布', observedAt: 1730000000001, requesters: ['u-1'] },
]

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('超工慢路径 api 适配器', () => {
  it('请求体形态：snake_case 下传 id/text/observed_at/requesters', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ code: 0, data: { verdicts: { e1: { verdict: 'act', reason: '报障' } } } }),
    )
    const call = createSlowJudgeCall(fetcher as never)
    const out = await call(inputs)
    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/super-agent/slow-path/judge')
    const body = JSON.parse(String(init.body)) as { items: Record<string, unknown>[] }
    expect(body.items[0]).toEqual({
      id: 'e1',
      text: '登录页 500 了谁管一下',
      observed_at: 1730000000000,
      requesters: ['u-1'],
    })
    expect(out.e1!.verdict).toBe('act')
    // 少一条响应 ⇒ 该条不回落猜测（缺=未判定）
    expect(out.e2).toBeUndefined()
  })

  it('非 ok / envelope 坏 / 单条非法 verdict ⇒ 整批抛错判未判定', async () => {
    await expect(
      createSlowJudgeCall(vi.fn(async () => jsonResponse({}, false, 502)) as never)(inputs),
    ).rejects.toThrow(/502/)
    await expect(
      createSlowJudgeCall(vi.fn(async () => jsonResponse({ code: 1, message: 'no' })) as never)(
        inputs,
      ),
    ).rejects.toThrow(/envelope/)
    await expect(
      createSlowJudgeCall(
        vi.fn(async () =>
          jsonResponse({ code: 0, data: { verdicts: { e1: { verdict: 'maybe', reason: '' } } } }),
        ) as never,
      )(inputs),
    ).rejects.toThrow(/bad verdict/)
  })

  it('适配器抛错 × 引擎侧未判定语义：积压原地、计数如实（端到端接线）', async () => {
    vi.stubEnv('IHUI_SUPER_AGENT_STATE_ACCOUNT', '')
    const { superAgentHost } = await import('../src/services/super-agent-pump-service.js')
    superAgentHost.receive(
      {
        id: 'xv-1',
        sourceId: 'src-x',
        threadId: 'thread-x',
        actorId: 'user-x',
        addressed: false,
        fromBot: false,
        text: '推断消息',
      },
      'user-x',
    )
    const broken = createSlowJudgeCall(
      vi.fn(async () =>
        jsonResponse({ code: 0, data: { verdicts: { 'xv-1': { verdict: 'nope' } } } }),
      ) as never,
    )
    const res = await superAgentHost.judgeRecorded('user-x', broken)
    expect(res.judged).toBe(0)
    expect(res.unjudged).toBe(1)
    expect(res.error).toContain('bad verdict')
    expect(superAgentHost.panel('user-x').pendingRecords).toHaveLength(1)
    vi.unstubAllEnvs()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
