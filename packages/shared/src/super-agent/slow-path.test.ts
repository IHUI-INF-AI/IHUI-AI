// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from './engine'
import {
  DEFAULT_MIN_CONFIDENCE,
  SLOW_PATH_RULE_ID,
  classifyDecisions,
  isSlowDecision,
  isSlowDecisionKind,
  isTargetBasis,
  pickDecisions,
} from './slow-path'
import type { RuleAssessment, SlowDecision, SlowJudgeInput } from './slow-path'
import type { IncomingTrigger } from './engine'

function fakeClock(start = 1000) {
  let now = start
  let n = 0
  return {
    tick: (ms: number) => {
      now += ms
    },
    clock: {
      now: () => now,
      id: (prefix: string) => `${prefix}_${(n += 1).toString(36)}`,
    },
  }
}

function inferred(id: string, text = `消息 ${id}`): IncomingTrigger {
  return {
    id,
    sourceId: 'src-1',
    threadId: 'thread-1',
    actorId: 'user-1',
    addressed: false,
    fromBot: false,
    text,
  }
}

const policy = (mode: 'record' | 'auto') => ({
  ...DEFAULT_SUPER_AGENT_POLICY,
  acceptMode: mode as 'record' | 'auto',
})

/** 形状合法的判定底座；各用例只覆写关心的字段。 */
function rules(ids: readonly string[] = [SLOW_PATH_RULE_ID], matched = true): RuleAssessment[] {
  return ids.map((ruleId) => ({ ruleId, matched, reason: matched ? '命中' : '不命中' }))
}

function judged(over: Partial<SlowDecision> = {}): SlowDecision {
  return {
    decision: 'ignore',
    ruleAssessments: rules(),
    direction: {
      implementationRequested: false,
      targetBasis: 'undetermined',
      requiresDesignDecision: true,
      evidence: '',
    },
    confidence: 0.9,
    title: '',
    scope: '',
    intentEvidence: '',
    reason: '无需动手',
    judge: 'ai-service:fake-judge',
    at: 1,
    ...over,
  }
}

function acceptance(over: Partial<SlowDecision> = {}): SlowDecision {
  return judged({
    decision: 'accept',
    direction: {
      implementationRequested: true,
      targetBasis: 'specified',
      requiresDesignDecision: false,
      evidence: '原文明说谁管一下',
    },
    title: '修复登录 500',
    scope: '登录页',
    intentEvidence: '谁管一下',
    reason: '像求助',
    ...over,
  })
}

describe('超工慢路径判定环', () => {
  it('词表与拆解纯判据：坏形状整条丢，不回落猜测', () => {
    expect(isSlowDecisionKind('accept')).toBe(true)
    expect(isSlowDecisionKind('act')).toBe(false)
    expect(isTargetBasis('existing-standard')).toBe(true)
    const d = judged()
    const rows = pickDecisions(
      {
        a: d,
        b: { decision: 'nope', reason: '', at: 1 } as unknown as SlowDecision,
        c: undefined,
      },
      ['a', 'b', 'c'],
    )
    expect(rows).toEqual([{ id: 'a', decision: { ...d, gate: 'pass' } }])
    // 缺置信度/身份/方向/规则字段一律算坏形状（不得默认补全成可信判定）。
    expect(isSlowDecision({ decision: 'accept', reason: '', at: 1 })).toBe(false)
    expect(isSlowDecision({ ...d, confidence: undefined })).toBe(false)
    expect(isSlowDecision({ ...d, confidence: 1.2 })).toBe(false)
    expect(isSlowDecision({ ...d, judge: '  ' })).toBe(false)
    expect(isSlowDecision({ ...d, direction: { ...d.direction, targetBasis: 'bad' } })).toBe(false)
    const classified = classifyDecisions(
      {
        a: d,
        b: { decision: 'accept', reason: '', at: 1 } as unknown as SlowDecision,
        c: undefined,
      },
      ['a', 'b', 'c'],
    )
    expect(classified.unjudged).toEqual([
      { id: 'b', reason: 'invalid_shape' },
      { id: 'c', reason: 'not_returned' },
    ])
    // 阈值边界：恰好等于阈值算达标，低于才拒。
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.7)
    expect(
      classifyDecisions({ a: acceptance({ confidence: DEFAULT_MIN_CONFIDENCE }) }, ['a']).unjudged,
    ).toEqual([])
  })

  it('record 档：判定只注记进面板，绝不开工；输入带上下文；同条重新 receive 仍 duplicate', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('record'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const seen: SlowJudgeInput[] = []
    const res = await host.judgeRecorded('user-1', async (inputs) => {
      seen.push(...inputs)
      return { t1: acceptance({ at: 2000 }) }
    })
    expect(res.judged).toBe(1)
    expect(res.unjudgedReasons).toEqual({})
    expect(res.autoAccepted).toEqual([])
    const panel = host.panel('user-1')
    expect(panel.pendingRecords[0]!.decision).toMatchObject({
      decision: 'accept',
      reason: '像求助',
      at: 2000,
      confidence: 0.9,
      title: '修复登录 500',
      scope: '登录页',
      intentEvidence: '谁管一下',
      judge: 'ai-service:fake-judge',
      gate: 'pass',
    })
    expect(seen[0]!.requesters).toEqual(['user-1'])
    expect(seen[0]!.enabledRules).toEqual([SLOW_PATH_RULE_ID])
    // 上下文三件套：无相关工单/同伴时有界为空；线程窗口至少含本条原文。
    expect(seen[0]!.companions).toEqual([])
    expect(seen[0]!.relatedTickets).toEqual([])
    expect(seen[0]!.threadWindow.map((m) => m.text)).toContain('消息 t1')
    // 判定后原触发再收:仍在簿 ⇒ duplicate 不重开
    expect(host.receive(inferred('t1'), 'user-1').disposition).toBe('duplicate')
  })

  it('auto 档 ∧ act：走与人工同一条 acceptRecorded 语义通道开工（inferred 强度）', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({ reason: '缺陷报告', at: 1500, confidence: 0.95 }),
    }))
    expect(res.autoAccepted).toHaveLength(1)
    const ticket = host.getTicket(res.autoAccepted[0]!.ticketId!, 'user-1')!
    expect(ticket.strength).toBe('inferred')
    // 范围=原始请求原文：判定提案里的 title/scope 不得渗入授权范围
    expect(ticket.scope).toBe('消息 t1')
    expect(host.panel('user-1').pendingRecords).toEqual([])
  })

  it('auto 档 ∧ ignore：只注记不开工；ignore 不重判', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const r1 = await host.judgeRecorded('user-1', async () => ({
      t1: judged({ reason: '寒暄' }),
    }))
    expect(r1.autoAccepted).toEqual([])
    expect(r1.judged).toBe(1)
    let calls = 0
    await host.judgeRecorded('user-1', async () => {
      calls += 1
      return {}
    })
    expect(calls).toBe(0)
  })

  it('decision=unavailable ⇒ 未判定但终局落账，不再重判烧 token', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const r1 = await host.judgeRecorded('user-1', async () => ({
      t1: judged({ decision: 'unavailable', reason: '上下文不足' }),
    }))
    expect(r1.autoAccepted).toEqual([])
    expect(r1.unjudged).toBe(1)
    expect(r1.unjudgedReasons).toEqual({ unavailable: 1 })
    expect(host.panel('user-1').pendingRecords[0]!.decision?.gate).toBe('unavailable')
    let calls = 0
    await host.judgeRecorded('user-1', async () => {
      calls += 1
      return {}
    })
    expect(calls).toBe(0)
  })

  it('机器人条目：判定可注记，但慢路径通道永不自动开工（auto 档也不行）', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive({ ...inferred('bot1'), fromBot: true }, 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      bot1: acceptance({ reason: '机器人播报但像活' }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(host.panel('user-1').pendingRecords[0]!.decision?.decision).toBe('accept')
  })

  it('判定通道抛错 ⇒ 未判定：积压原地保留、点名 channel_error、下一轮可重试', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const bad = await host.judgeRecorded('user-1', async () => {
      throw new Error('ai down')
    })
    expect(bad).toMatchObject({
      judged: 0,
      unjudged: 1,
      unjudgedReasons: { channel_error: 1 },
      error: 'ai down',
    })
    expect(host.panel('user-1').pendingRecords).toHaveLength(1)
    expect(host.panel('user-1').pendingRecords[0]!.judgeAttempts).toBe(1)
    const good = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({ reason: 'ok', at: 9 }),
    }))
    expect(good.autoAccepted).toHaveLength(1)
  })

  it('置信度不足 ⇒ fail-closed：只注记 wouldAccept 提案、绝不开单', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({ reason: '像求助但拿不准', confidence: 0.3 }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(res.judged).toBe(0)
    expect(res.unjudged).toBe(1)
    expect(res.unjudgedReasons).toEqual({ low_confidence: 1 })
    const row = host.panel('user-1').pendingRecords[0]!
    expect(row.decision?.gate).toBe('low_confidence')
    expect(row.decision?.wouldAccept).toBe(true)
    expect(row.decision?.confidence).toBe(0.3)
    expect(row.decision?.judge).toBe('ai-service:fake-judge')
    // 低置信度提案不自动重判（避免每轮重复烧 token），但人工仍可接手。
    const manual = host.acceptRecorded('user-1', 't1', 'human-rule')
    expect(manual.disposition).toBe('accepted')
  })

  it('direction 未定 ⇒ 提案档 direction_undetermined，不开单', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({
        direction: {
          implementationRequested: true,
          targetBasis: 'undetermined',
          requiresDesignDecision: false,
          evidence: '目标不明确',
        },
      }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(res.unjudgedReasons).toEqual({ direction_undetermined: 1 })
    expect(host.panel('user-1').pendingRecords[0]!.decision).toMatchObject({
      gate: 'direction_undetermined',
      wouldAccept: true,
    })
  })

  it('无规则命中 ⇒ 提案档 rule_unmatched，不开单', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({ ruleAssessments: rules([SLOW_PATH_RULE_ID], false) }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(res.unjudgedReasons).toEqual({ rule_unmatched: 1 })
    expect(host.panel('user-1').pendingRecords[0]!.decision?.wouldAccept).toBe(true)
  })

  it('intentEvidence 为空 ⇒ 提案档 no_intent_evidence，不开单', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({ intentEvidence: '   ' }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(res.unjudgedReasons).toEqual({ no_intent_evidence: 1 })
  })

  it('返回形状非法 ⇒ invalid_shape，且不落任何判定注记', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      // accept 但提案标题为空 ⇒ 结构上不可落地，整条作废
      t1: acceptance({ title: '' }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(res.unjudgedReasons).toEqual({ invalid_shape: 1 })
    expect(host.panel('user-1').pendingRecords[0]!.decision).toBeUndefined()
  })

  it('规则条目必须与启用规则一一对应：缺条/多条都算 invalid_shape', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance({
        ruleAssessments: [...rules(), { ruleId: 'extra-rule', matched: true, reason: '越界' }],
      }),
    }))
    expect(res.autoAccepted).toEqual([])
    expect(res.unjudgedReasons).toEqual({ invalid_shape: 1 })
  })

  it('模型漏回某条 ⇒ not_returned，不拿别条结果顶替', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    host.receive(inferred('t2', '消息 t2'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: acceptance(),
    }))
    expect(res.judged).toBe(1)
    expect(res.unjudgedReasons).toEqual({ not_returned: 1 })
    expect(host.panel('user-1').pendingRecords.find((r) => r.id === 't2')!.decision).toBeUndefined()
  })

  it('多启用规则：按命中的那条规则开工；规则集合不一致按 invalid_shape', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const enabledRules = ['bug-fix', 'feature-request'] as const
    const seen: SlowJudgeInput[] = []
    const ok = await host.judgeRecorded(
      'user-1',
      async (inputs) => {
        seen.push(...inputs)
        return {
          t1: acceptance({
            ruleAssessments: [
              { ruleId: 'bug-fix', matched: true, reason: '是缺陷' },
              { ruleId: 'feature-request', matched: false, reason: '不是新功能' },
            ],
          }),
        }
      },
      { rules: enabledRules },
    )
    expect(seen[0]!.enabledRules).toEqual([...enabledRules])
    expect(ok.autoAccepted).toHaveLength(1)
    expect(host.panel('user-1').pendingRecords).toEqual([])
  })

  it('确定性过滤已挡掉的触发不会进慢路径：判定器零调用', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    // actor 与主体不符 ⇒ receive 阶段直接 filtered，不落 recordedTriggers。
    const filtered = host.receive(inferred('t1'), 'user-2')
    expect(filtered.disposition).toBe('filtered')
    let calls = 0
    const res = await host.judgeRecorded('user-1', async () => {
      calls += 1
      return {}
    })
    expect(calls).toBe(0)
    expect(res).toEqual({ judged: 0, unjudged: 0, unjudgedReasons: {}, autoAccepted: [] })
    expect(host.panel('user-1').pendingRecords).toEqual([])
  })

  it('暂停时顺延：不调模型、不消耗 attempt，恢复后照常判', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    // 先入积压（暂停期间新到的触发本就不入账），再暂停，验证积压顺延。
    host.receive(inferred('t1'), 'user-1')
    host.applyPolicy('user-1', { ...policy('auto'), paused: true })
    let calls = 0
    const res = await host.judgeRecorded('user-1', async () => {
      calls += 1
      return {}
    })
    expect(calls).toBe(0)
    expect(res).toEqual({ judged: 0, unjudged: 0, unjudgedReasons: {}, autoAccepted: [] })
    expect(host.panel('user-1').pendingRecords[0]!.judgeAttempts).toBe(0)
    host.applyPolicy('user-1', { ...policy('auto'), paused: false })
    const ok = await host.judgeRecorded('user-1', async () => ({ t1: acceptance() }))
    expect(ok.autoAccepted).toHaveLength(1)
  })

  it('重排 2 次后记 unavailable 并停发：第 3 次失败后不再调模型', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    let calls = 0
    for (let i = 0; i < 3; i += 1) {
      const r = await host.judgeRecorded('user-1', async () => {
        calls += 1
        return {}
      })
      // 前两次记 not_returned；第 3 次（重排用尽）转 unavailable。
      expect(r.unjudgedReasons).toEqual({ [i < 2 ? 'not_returned' : 'unavailable']: 1 })
    }
    expect(calls).toBe(3)
    expect(host.panel('user-1').pendingRecords[0]!.judgeAttempts).toBe(3)
    const exhausted = await host.judgeRecorded('user-1', async () => {
      calls += 1
      return {}
    })
    expect(calls).toBe(3)
    expect(exhausted.unjudgedReasons).toEqual({ unavailable: 1 })
    expect(exhausted.unjudged).toBe(1)
  })

  it('人工点名仍在判定建议之上（人点名优先既有语义）：ignore 注记不拦人工 ruleId', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    await host.judgeRecorded('user-1', async () => ({
      t1: judged({ reason: '判员认为无需' }),
    }))
    const manual = host.acceptRecorded('user-1', 't1', 'human-rule')
    expect(manual.disposition).toBe('accepted')
  })

  it('批量限流：一轮最多 limit 条，剩下轮再判；他人主体不误判', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('record'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    host.receive(inferred('t2', '消息 t2'), 'user-1')
    const other = host.receive({ ...inferred('t9'), actorId: 'user-2' }, 'user-2')
    void other
    const res = await host.judgeRecorded(
      'user-1',
      async (inputs) => {
        expect(inputs.map((i) => i.id)).toEqual(['t1'])
        return { t1: judged({ reason: 'x' }) }
      },
      { limit: 1 },
    )
    expect(res.judged).toBe(1)
    expect(host.panel('user-2').pendingRecords[0]!.decision).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
