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
  {
    id: 'e1',
    text: '登录页 500 了谁管一下',
    observedAt: 1730000000000,
    requesters: ['u-1'],
    enabledRules: ['bug-fix', 'feature-request'],
    companions: [{ id: 'c1', text: '顺带把注册也修了' }],
    relatedTickets: [
      { id: 'tk-1', title: '登录页修复', scope: '登录页 500', strength: 'record', stage: 'worker' },
    ],
    threadWindow: [
      { actorId: 'u-1', fromBot: false, addressed: true, text: '登录页 500 了谁管一下' },
    ],
  },
  {
    id: 'e2',
    text: '周报已发布',
    observedAt: 1730000000001,
    requesters: ['u-1'],
    enabledRules: ['bug-fix', 'feature-request'],
    companions: [],
    relatedTickets: [],
    threadWindow: [],
  },
]

/** 完整 Assessment 的合法样例；按需覆写单字段造坏形状。 */
function assessment(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    decision: 'accept',
    confidence: 0.92,
    rule_assessments: [
      { rule_id: 'bug-fix', matched: true, reason: '线上报障，属缺陷修复' },
      { rule_id: 'feature-request', matched: false, reason: '不是新增功能' },
    ],
    direction: {
      implementation_requested: true,
      target_basis: 'specified',
      requires_design_decision: false,
      evidence: '明确要求修登录页 500',
    },
    intent_evidence: '谁管一下 = 请求接单处理',
    title: '修复登录页 500',
    scope: '登录页 500 错误',
    worktree_name: 'fix-login-500',
    reason: '报障且方向已定',
    ...over,
  }
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function envelope(verdicts: Record<string, unknown>, model = 'gpt-4o-mini'): unknown {
  return { code: 0, data: { model, verdicts } }
}

describe('超工慢路径 api 适配器', () => {
  it('请求体形态：snake_case 下传启用规则/同伴/相关工单/线程窗口', async () => {
    const fetcher = vi.fn(async () => jsonResponse(envelope({ e1: assessment() })))
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
      enabled_rules: ['bug-fix', 'feature-request'],
      companions: [{ id: 'c1', text: '顺带把注册也修了' }],
      related_tickets: [
        {
          id: 'tk-1',
          title: '登录页修复',
          scope: '登录页 500',
          strength: 'record',
          stage: 'worker',
        },
      ],
      thread_window: [
        { actor_id: 'u-1', from_bot: false, addressed: true, text: '登录页 500 了谁管一下' },
      ],
    })
    // 响应完整映射为 Assessment 模型（含 direction / ruleAssessments / 身份）。
    expect(out.e1).toMatchObject({
      decision: 'accept',
      confidence: 0.92,
      ruleAssessments: [
        { ruleId: 'bug-fix', matched: true },
        { ruleId: 'feature-request', matched: false },
      ],
      direction: {
        implementationRequested: true,
        targetBasis: 'specified',
        requiresDesignDecision: false,
      },
      intentEvidence: '谁管一下 = 请求接单处理',
      title: '修复登录页 500',
      scope: '登录页 500 错误',
      worktreeName: 'fix-login-500',
      judge: 'ai-service:gpt-4o-mini',
    })
    // 少一条响应 ⇒ 该条不回落猜测（缺=未判定）
    expect(out.e2).toBeUndefined()
  })

  it('非 ok / envelope 坏 / 身份缺失 ⇒ 整批抛错判未判定', async () => {
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
        vi.fn(async () => jsonResponse({ code: 0, data: { verdicts: {} } })) as never,
      )(inputs),
    ).rejects.toThrow(/identity/)
  })

  it('单条 Assessment 形状非法 ⇒ 整批抛错（半可信=不判）', async () => {
    const cases: [string, Record<string, unknown>, RegExp][] = [
      ['bad decision', assessment({ decision: 'maybe' }), /bad decision/],
      ['bad confidence', assessment({ confidence: 1.4 }), /bad confidence/],
      ['bool confidence', assessment({ confidence: true }), /bad confidence/],
      ['rule_assessments 非数组', assessment({ rule_assessments: 'nope' }), /bad rule_assessments/],
      [
        'rule_id 缺失',
        assessment({ rule_assessments: [{ matched: true, reason: 'x' }] }),
        /bad rule_id/,
      ],
      [
        'matched 非布尔',
        assessment({ rule_assessments: [{ rule_id: 'bug-fix', matched: 'yes', reason: 'x' }] }),
        /bad matched/,
      ],
      ['direction 缺失', assessment({ direction: undefined }), /bad direction/],
      [
        'target_basis 非法',
        assessment({
          direction: {
            implementation_requested: true,
            target_basis: 'guess',
            requires_design_decision: false,
            evidence: 'x',
          },
        }),
        /bad target_basis/,
      ],
      ['title 缺失', assessment({ title: 123 }), /bad title/],
      ['intent_evidence 缺失', assessment({ intent_evidence: undefined }), /bad intent_evidence/],
    ]
    for (const [label, row, pattern] of cases) {
      await expect(
        createSlowJudgeCall(vi.fn(async () => jsonResponse(envelope({ e1: row }))) as never)(
          inputs,
        ),
        label,
      ).rejects.toThrow(pattern)
    }
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
        jsonResponse(
          envelope({
            'xv-1': assessment({ direction: { target_basis: 'specified', evidence: 'x' } }),
          }),
        ),
      ) as never,
    )
    const res = await superAgentHost.judgeRecorded('user-x', broken)
    expect(res.judged).toBe(0)
    expect(res.unjudged).toBe(1)
    expect(res.error).toContain('bad implementation_requested')
    expect(superAgentHost.panel('user-x').pendingRecords).toHaveLength(1)
    vi.unstubAllEnvs()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
