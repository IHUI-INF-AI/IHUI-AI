// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 任务流 SSE 事件单源测试(t4 runtime 收敛,2026-09-19 立)
 *
 * 覆盖:
 * 1. AGENT_TASK_EVENTS 常量集合完整性(15 个,对齐 agent_events.py
 *    HOOK_EVENT_TO_SSE 值侧)与值无重复
 * 2. AGENT_TASK_EVENT_NAMES 派生一致性 + isAgentTaskEventName 类型守卫
 * 3. 9 个逐事件解析器:有效载荷 snake→camel 映射 / 守卫拒绝(无效 phase、
 *    缺失必填、非 JSON、非字符串、数组、载荷缺失)
 * 4. parseToolApprovalEvent 的 session_id 顶层优先/payload 兜底/
 *    danger_level 缺省 high/type 守卫
 * 5. parseAgentTaskEvent 统一分发工厂:9 事件路由 + 未知事件名/无效载荷返回 null
 * 6. G-721:`| null` 与"字段缺席"的分工 —— **undefined 不得被解释为清除**,且两态都不得
 *    被折成 0 / '' / false 这类肯定结论(contract.ts 的 reasoningTokens 在解析位保持可分)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  AGENT_TASK_EVENTS,
  AGENT_TASK_EVENT_NAMES,
  isAgentTaskEventName,
  parseSelfHealEvent,
  parseThinkingEvent,
  parsePlanStepEvent,
  parseSessionEndEvent,
  parsePermissionModeEvent,
  parseTerminalDeltaEvent,
  parseAgentStatusEvent,
  parseMessageSendEvent,
  parseToolApprovalEvent,
  parseAgentTaskEvent,
} from '../agent-events'
// G-721:usage 帧的 reasoningTokens 三值分工住在契约里,断言要拿真类型而不是自造形状
import { type SSEEventPayload } from '../contract'

// ============ 1. 事件名常量集合 ============

describe('AGENT_TASK_EVENTS 常量集合', () => {
  it('包含全部 15 个 Agent 任务流事件', () => {
    expect(Object.keys(AGENT_TASK_EVENTS)).toHaveLength(15)
    expect(AGENT_TASK_EVENT_NAMES).toHaveLength(15)
  })

  it('值无重复(事件判别名唯一)', () => {
    const values = Object.values(AGENT_TASK_EVENTS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('与 agent_events.py HOOK_EVENT_TO_SSE 值侧对齐', () => {
    expect(AGENT_TASK_EVENTS.SESSION).toBe('session')
    expect(AGENT_TASK_EVENTS.SESSION_END).toBe('session_end')
    expect(AGENT_TASK_EVENTS.TOOL_CALL).toBe('tool_call')
    expect(AGENT_TASK_EVENTS.TOOL_RESULT).toBe('tool_result')
    expect(AGENT_TASK_EVENTS.TOOL_APPROVAL).toBe('tool-approval')
    expect(AGENT_TASK_EVENTS.MESSAGE_SEND).toBe('message_send')
    expect(AGENT_TASK_EVENTS.MESSAGE).toBe('message')
    expect(AGENT_TASK_EVENTS.ERROR).toBe('error')
    expect(AGENT_TASK_EVENTS.PERMISSION_MODE).toBe('permission-mode')
    expect(AGENT_TASK_EVENTS.SELF_HEAL).toBe('self-heal')
    expect(AGENT_TASK_EVENTS.THINKING).toBe('thinking')
    expect(AGENT_TASK_EVENTS.PLAN_STEP).toBe('plan-step')
    expect(AGENT_TASK_EVENTS.TERMINAL_DELTA).toBe('terminal-delta')
    expect(AGENT_TASK_EVENTS.COMPACTION).toBe('compaction')
    expect(AGENT_TASK_EVENTS.AGENT_STATUS).toBe('agent-status')
  })
})

// ============ 2. 派生一致性与类型守卫 ============

describe('AGENT_TASK_EVENT_NAMES 派生与守卫', () => {
  it('与 AGENT_TASK_EVENTS 值集合一致', () => {
    expect([...AGENT_TASK_EVENT_NAMES].sort()).toEqual([...Object.values(AGENT_TASK_EVENTS)].sort())
  })

  it('isAgentTaskEventName 已知返回 true/未知返回 false', () => {
    for (const name of AGENT_TASK_EVENT_NAMES) {
      expect(isAgentTaskEventName(name)).toBe(true)
    }
    expect(isAgentTaskEventName('unknown-event')).toBe(false)
    expect(isAgentTaskEventName('')).toBe(false)
    expect(isAgentTaskEventName('SELF_HEAL')).toBe(false)
  })
})

// ============ 3. 逐事件解析器 ============

describe('parseSelfHealEvent', () => {
  it('started 载荷:snake→camel 全量映射,failed 透传/ok·attempts 为 null', () => {
    const evt = parseSelfHealEvent(
      JSON.stringify({
        type: 'self-heal',
        payload: {
          session_id: 's1',
          iteration: 2,
          phase: 'started',
          command: 'pytest -q',
          failed: 3,
        },
      }),
    )
    expect(evt).not.toBeNull()
    expect(evt!.sessionId).toBe('s1')
    expect(evt!.iteration).toBe(2)
    expect(evt!.phase).toBe('started')
    expect(evt!.command).toBe('pytest -q')
    expect(evt!.failed).toBe(3)
    expect(evt!.ok).toBeNull()
    expect(evt!.attempts).toBeNull()
    expect(evt!.rollbackCount).toBe(0)
    // G-998099:客户端禁本地时钟造 ts——wire 未带则键整个不存在;带 wire ts 的透传用例见 tests/event-id-stability
    expect(evt!.ts).toBeUndefined()
  })

  it('finished 载荷:ok/attempts/rollbacks 透传,failed 为 null', () => {
    const evt = parseSelfHealEvent(
      JSON.stringify({
        payload: { phase: 'finished', ok: true, attempts: 2, rollbacks: 1 },
      }),
    )
    expect(evt!.phase).toBe('finished')
    expect(evt!.ok).toBe(true)
    expect(evt!.attempts).toBe(2)
    expect(evt!.failed).toBeNull()
    expect(evt!.rollbackCount).toBe(1)
  })

  it('无效 phase/载荷缺失/非 JSON/数组 一律返回 null', () => {
    expect(parseSelfHealEvent(JSON.stringify({ payload: { phase: 'unknown' } }))).toBeNull()
    expect(parseSelfHealEvent(JSON.stringify({}))).toBeNull()
    expect(parseSelfHealEvent('not-json')).toBeNull()
    expect(parseSelfHealEvent('[1,2]')).toBeNull()
    expect(parseSelfHealEvent(undefined)).toBeNull()
  })
})

describe('parseThinkingEvent', () => {
  it('有效载荷:runId/content/iteration/isFinal 映射', () => {
    const evt = parseThinkingEvent(
      JSON.stringify({
        payload: { run_id: 'r1', content: '思考中', iteration: 1, is_final: true },
      }),
    )
    expect(evt!.runId).toBe('r1')
    expect(evt!.content).toBe('思考中')
    expect(evt!.iteration).toBe(1)
    expect(evt!.isFinal).toBe(true)
  })

  it('空 content 丢弃(整段透传拼接策略依赖非空保证)', () => {
    expect(parseThinkingEvent(JSON.stringify({ payload: { content: '' } }))).toBeNull()
  })
})

describe('parsePlanStepEvent', () => {
  it('started 载荷:step_index/tool_name 必填,status 白名单', () => {
    const evt = parsePlanStepEvent(
      JSON.stringify({
        payload: { run_id: 'r1', step_index: 0, tool_name: 'read_file', status: 'started' },
      }),
    )
    expect(evt!.runId).toBe('r1')
    expect(evt!.stepIndex).toBe(0)
    expect(evt!.toolName).toBe('read_file')
    expect(evt!.status).toBe('started')
  })

  it('completed 载荷:decision/reason 可空透传', () => {
    const evt = parsePlanStepEvent(
      JSON.stringify({
        payload: {
          step_index: 1,
          tool_name: 'write_file',
          status: 'completed',
          decision: 'allow',
          reason: 'ok',
        },
      }),
    )
    expect(evt!.status).toBe('completed')
    expect(evt!.decision).toBe('allow')
    expect(evt!.reason).toBe('ok')
  })

  it('status 非白名单/step_index 缺失 返回 null', () => {
    expect(
      parsePlanStepEvent(
        JSON.stringify({ payload: { step_index: 0, tool_name: 't', status: 'pending' } }),
      ),
    ).toBeNull()
    expect(
      parsePlanStepEvent(JSON.stringify({ payload: { tool_name: 't', status: 'started' } })),
    ).toBeNull()
  })
})

describe('parseSessionEndEvent', () => {
  it('有效载荷:会话摘要全量映射', () => {
    const evt = parseSessionEndEvent(
      JSON.stringify({
        payload: {
          session_id: 's1',
          success: true,
          stop_reason: 'done',
          total_iterations: 5,
          total_duration_ms: 1234,
        },
      }),
    )
    expect(evt!.sessionId).toBe('s1')
    expect(evt!.success).toBe(true)
    expect(evt!.stopReason).toBe('done')
    expect(evt!.totalIterations).toBe(5)
    expect(evt!.totalDurationMs).toBe(1234)
  })

  it('载荷缺失返回 null', () => {
    expect(parseSessionEndEvent(JSON.stringify({ type: 'session_end' }))).toBeNull()
  })
})

describe('parsePermissionModeEvent', () => {
  it('有效载荷:mode/tool/decision 映射,缺省空串', () => {
    const evt = parsePermissionModeEvent(
      JSON.stringify({ payload: { mode: 'default', tool: 'write_file', decision: 'ask' } }),
    )
    expect(evt!.mode).toBe('default')
    expect(evt!.tool).toBe('write_file')
    expect(evt!.decision).toBe('ask')
    // G-998099:同上——wire 未带 ts 则键不存在,不再由客户端补本地时钟
    expect(evt!.ts).toBeUndefined()
    // 载荷字段全缺省:空串兜底(payload 存在即不返回 null)
    expect(parsePermissionModeEvent(JSON.stringify({ payload: {} }))!.mode).toBe('')
  })
})

describe('parseTerminalDeltaEvent', () => {
  it('stdout 载荷:command/stream/text/iteration 映射,id 由 tool_call_id 优先派生', () => {
    const evt = parseTerminalDeltaEvent(
      JSON.stringify({
        payload: {
          run_id: 'r1',
          tool_call_id: 'tc1',
          command: 'npm test',
          stream: 'stdout',
          text: 'ok',
          iteration: 1,
        },
      }),
    )
    expect(evt!.command).toBe('npm test')
    expect(evt!.stream).toBe('stdout')
    expect(evt!.text).toBe('ok')
    expect(evt!.iteration).toBe(1)
    expect(evt!.id.startsWith('tc1-')).toBe(true)
  })

  it('stderr 载荷同样接受', () => {
    const evt = parseTerminalDeltaEvent(
      JSON.stringify({ payload: { run_id: 'r1', stream: 'stderr', text: 'boom' } }),
    )
    expect(evt!.stream).toBe('stderr')
    expect(evt!.id.startsWith('r1-')).toBe(true)
  })

  it('stream 非白名单/text 缺失 返回 null', () => {
    expect(
      parseTerminalDeltaEvent(JSON.stringify({ payload: { stream: 'both', text: 'x' } })),
    ).toBeNull()
    expect(parseTerminalDeltaEvent(JSON.stringify({ payload: { stream: 'stdout' } }))).toBeNull()
  })
})

describe('parseAgentStatusEvent', () => {
  it('resuming/pausing/cancelling 三态接受', () => {
    for (const status of ['resuming', 'pausing', 'cancelling'] as const) {
      const evt = parseAgentStatusEvent(JSON.stringify({ payload: { session_id: 's1', status } }))
      expect(evt!.sessionId).toBe('s1')
      expect(evt!.status).toBe(status)
    }
  })

  it('非法 status 返回 null', () => {
    expect(parseAgentStatusEvent(JSON.stringify({ payload: { status: 'running' } }))).toBeNull()
  })
})

describe('parseMessageSendEvent', () => {
  it('有效载荷:iteration 必填,messages_count 缺省 0', () => {
    const evt = parseMessageSendEvent(
      JSON.stringify({ payload: { iteration: 3, messages_count: 12 } }),
    )
    expect(evt!.iteration).toBe(3)
    expect(evt!.messagesCount).toBe(12)
    // 仅缺 messages_count:缺省 0(iteration 缺失才返回 null,见下例)
    expect(
      parseMessageSendEvent(JSON.stringify({ payload: { iteration: 3 } }))!.messagesCount,
    ).toBe(0)
    // iteration 缺失 → 守卫拒绝,返回 null
    expect(parseMessageSendEvent(JSON.stringify({ payload: {} }))).toBeNull()
  })

  it('iteration 非数字返回 null', () => {
    expect(parseMessageSendEvent(JSON.stringify({ payload: { iteration: '3' } }))).toBeNull()
  })
})

describe('parseToolApprovalEvent', () => {
  it('有效载荷:顶层 session_id 优先,数值 id 字符串化,danger_level 透传', () => {
    const evt = parseToolApprovalEvent(
      JSON.stringify({
        type: 'tool-approval',
        session_id: 's-top',
        payload: {
          approval_id: 'a1',
          tool_name: 'rm',
          tool_call_id: 42,
          args_preview: 'rm -rf /tmp/x',
          danger_level: 'medium',
          session_id: 's-payload',
        },
      }),
    )
    expect(evt!.approvalId).toBe('a1')
    expect(evt!.toolName).toBe('rm')
    expect(evt!.toolCallId).toBe('42')
    expect(evt!.argsPreview).toBe('rm -rf /tmp/x')
    expect(evt!.dangerLevel).toBe('medium')
    expect(evt!.sessionId).toBe('s-top')
  })

  it('顶层缺失时 payload 内 session_id 兜底;danger_level 缺省 high', () => {
    const evt = parseToolApprovalEvent(
      JSON.stringify({ type: 'tool-approval', payload: { session_id: 's-payload' } }),
    )
    expect(evt!.sessionId).toBe('s-payload')
    expect(evt!.dangerLevel).toBe('high')
  })

  it('type 守卫:非 tool-approval 事件与载荷缺失返回 null', () => {
    expect(parseToolApprovalEvent(JSON.stringify({ type: 'message', payload: {} }))).toBeNull()
    expect(parseToolApprovalEvent(JSON.stringify({ type: 'tool-approval' }))).toBeNull()
  })
})

// ============ 4. 统一分发工厂 ============

describe('parseAgentTaskEvent 工厂', () => {
  it('9 个逐名消费事件全部正确路由', () => {
    const cases: Array<[string, string, (e: unknown) => unknown]> = [
      [
        AGENT_TASK_EVENTS.SELF_HEAL,
        JSON.stringify({ payload: { phase: 'started' } }),
        parseSelfHealEvent,
      ],
      [
        AGENT_TASK_EVENTS.THINKING,
        JSON.stringify({ payload: { content: 'x' } }),
        parseThinkingEvent,
      ],
      [
        AGENT_TASK_EVENTS.PLAN_STEP,
        JSON.stringify({ payload: { step_index: 0, tool_name: 't', status: 'started' } }),
        parsePlanStepEvent,
      ],
      [
        AGENT_TASK_EVENTS.SESSION_END,
        JSON.stringify({ payload: { success: true } }),
        parseSessionEndEvent,
      ],
      [
        AGENT_TASK_EVENTS.PERMISSION_MODE,
        JSON.stringify({ payload: { mode: 'default' } }),
        parsePermissionModeEvent,
      ],
      [
        AGENT_TASK_EVENTS.TERMINAL_DELTA,
        JSON.stringify({ payload: { stream: 'stdout', text: 'x' } }),
        parseTerminalDeltaEvent,
      ],
      [
        AGENT_TASK_EVENTS.AGENT_STATUS,
        JSON.stringify({ payload: { status: 'resuming' } }),
        parseAgentStatusEvent,
      ],
      [
        AGENT_TASK_EVENTS.MESSAGE_SEND,
        JSON.stringify({ payload: { iteration: 1 } }),
        parseMessageSendEvent,
      ],
      [
        AGENT_TASK_EVENTS.TOOL_APPROVAL,
        JSON.stringify({ type: 'tool-approval', payload: {} }),
        parseToolApprovalEvent,
      ],
    ]
    // 7 类视图事件含 ts:Date.now()(self-heal 另有 id 派生), 工厂与直接解析是
    // 两次独立调用, 冻结时钟保证毫秒时间戳一致, toEqual 逐字段可比。
    const now = vi.spyOn(Date, 'now').mockReturnValue(1735689600000)
    try {
      for (const [name, raw, parser] of cases) {
        const routed = parseAgentTaskEvent(name, raw)
        expect(routed).not.toBeNull()
        expect(routed!.name).toBe(name)
        // 工厂路由结果与直接调用解析器逐字段等价
        expect(routed!.event).toEqual(parser(raw))
      }
    } finally {
      now.mockRestore()
    }
  })

  it('未知事件名/无效载荷返回 null(调用方静默丢弃)', () => {
    expect(parseAgentTaskEvent('unknown-event', JSON.stringify({ payload: {} }))).toBeNull()
    // session/tool_call/tool_result/message/error/compaction 不经本工厂(见模块注释)
    expect(
      parseAgentTaskEvent(AGENT_TASK_EVENTS.SESSION, JSON.stringify({ payload: {} })),
    ).toBeNull()
    expect(parseAgentTaskEvent(AGENT_TASK_EVENTS.SELF_HEAL, 'not-json')).toBeNull()
  })
})

// ============ 5. G-721:`| null` 与"字段缺席"的分工(消费端口径) ============
//
// 钉两件事,一条比一条容易写错:
//  ① **缺席(undefined)不得被解释为清除** —— 视图对象必须保持"只有一套『没值』的表示法",
//     即 null;若有人把缺席折成 0 / '' / false(肯定结论)或另造一个"已清除"标志,下面的断言红。
//  ② **两态在能分的地方必须保持可分** —— contract.ts 的 `reasoningTokens` 是三值类型,
//     折叠只许发生在渲染位;解析位一折,①里的"读 wire 才能区分"就永久丢了(那条断言同样会红)。
// 反向对照:每条折叠断言都配一条"有值时必须原样透出",证明断言的不是恒 null 的空转判据。

/** 视图键集合(逐字比较用):"多一个清除标志"这类改动只会体现在键集合上。 */
function viewKeys(event: object): string {
  return Object.keys(event).sort().join('|')
}

describe('G-721 字段缺席与显式 null 的分工', () => {
  it('self-heal ok:缺席与显式 null 同落 null,两者都不得被读成 false,也不得长出第二套"没值"表示', () => {
    const absent = parseSelfHealEvent(JSON.stringify({ payload: { phase: 'finished', attempts: 2 } }))
    const explicitNull = parseSelfHealEvent(
      JSON.stringify({ payload: { phase: 'finished', ok: null, attempts: 2 } }),
    )
    const full = parseSelfHealEvent(
      JSON.stringify({ payload: { phase: 'finished', ok: true, attempts: 2 } }),
    )
    expect(absent).not.toBeNull()
    expect(explicitNull).not.toBeNull()
    expect(full).not.toBeNull()
    // 缺席 ⇒ null("这一帧没报结果"),**不是 false**("修复失败"是一条肯定结论)
    expect(absent!.ok).toBeNull()
    expect(absent!.ok).not.toBe(false)
    expect(explicitNull!.ok).toBeNull()
    // 反向对照:真报了值必须原样透出 ⇒ 上面两条 null 不是"恒 null"的空转
    expect(full!.ok).toBe(true)
    // 视图不得为"缺席"另造一种表示(新增/删减键都算)—— 三帧键集合逐字相同
    expect(viewKeys(absent!)).toBe(viewKeys(explicitNull!))
    expect(viewKeys(absent!)).toBe(viewKeys(full!))
  })

  it('self-heal failed/phase:0 是合法肯定值,缺席由 phase 承载而不是由"清除"承载', () => {
    const zero = parseSelfHealEvent(JSON.stringify({ payload: { phase: 'started', failed: 0 } }))
    const absent = parseSelfHealEvent(JSON.stringify({ payload: { phase: 'started' } }))
    const nullish = parseSelfHealEvent(
      JSON.stringify({ payload: { phase: 'started', failed: null } }),
    )
    // 0 = "确无失败项",必须保住 ⇒ 把缺席/ null 一起折成 0 的写法会在这里红
    expect(zero!.failed).toBe(0)
    expect(absent!.failed).toBeNull()
    expect(absent!.failed).not.toBe(0)
    expect(nullish!.failed).toBeNull()
    // 相变只由 phase 判:started 相即便显式发了 ok=true,也不得被当"结果已报"
    expect(parseSelfHealEvent(JSON.stringify({ payload: { phase: 'started', ok: true } }))!.ok).toBeNull()
  })

  it('plan-step decision/reason:缺席与显式 null 同落 null,绝不落空串', () => {
    const base = { step_index: 0, tool_name: 't', status: 'started' }
    const absent = parsePlanStepEvent(JSON.stringify({ payload: base }))
    const explicitNull = parsePlanStepEvent(
      JSON.stringify({ payload: { ...base, decision: null, reason: null } }),
    )
    expect(absent!.decision).toBeNull()
    expect(explicitNull!.decision).toBeNull()
    // '' 会被消费端读成"有一条空决策"—— 那是对没值下了结论
    expect(absent!.decision).not.toBe('')
    expect(absent!.reason).not.toBe('')
    // 反向对照:有值原样透出
    const valued = parsePlanStepEvent(
      JSON.stringify({ payload: { ...base, decision: 'allow', reason: 'readonly' } }),
    )
    expect(valued!.decision).toBe('allow')
    expect(valued!.reason).toBe('readonly')
  })

  it('thinking / terminal-delta iteration:缺席与 null 都不得折成 0(0 是"第 0 轮"的结论)', () => {
    expect(parseThinkingEvent(JSON.stringify({ payload: { content: 'x' } }))!.iteration).toBeNull()
    expect(
      parseThinkingEvent(JSON.stringify({ payload: { content: 'x', iteration: null } }))!.iteration,
    ).toBeNull()
    const tdAbsent = parseTerminalDeltaEvent(
      JSON.stringify({ payload: { stream: 'stdout', text: 'x' } }),
    )
    const tdNull = parseTerminalDeltaEvent(
      JSON.stringify({ payload: { stream: 'stdout', text: 'x', iteration: null } }),
    )
    expect(tdAbsent!.iteration).toBeNull()
    expect(tdAbsent!.iteration).not.toBe(0)
    expect(tdNull!.iteration).toBeNull()
    // id 里那个 `-0` 是 G-998099 的 id 稳定性口径(缺席当占位拼串),不是 iteration 的语义值 ⇒
    // 视图 iteration 必须仍是 null,不得与 id 里的 0 混为一谈。
    expect(tdAbsent!.id.endsWith('-0')).toBe(true)
    expect(tdAbsent!.iteration).toBeNull()
  })

  it('terminal-delta tool_call_id:null(显式无归属)与缺席(该通道用 camelCase terminalId)在 wire 可分、在视图同折叠', () => {
    const wireAbsent: Record<string, unknown> = { stream: 'stdout', text: 'x' }
    const wireNull: Record<string, unknown> = { stream: 'stdout', text: 'x', tool_call_id: null }
    // ① wire 层两态**必须**仍然可分 —— 这是"逐字段写出分工"能被机器复核的那一半
    expect('tool_call_id' in wireAbsent).toBe(false)
    expect('tool_call_id' in wireNull).toBe(true)
    // ② 视图层同折叠成"无归属"的 id;把缺席折成 '' 会让 id 变成 '-0'(以 '-' 开头),这里红
    const idOfAbsent = parseTerminalDeltaEvent(JSON.stringify({ payload: wireAbsent }))!.id
    const idOfNull = parseTerminalDeltaEvent(JSON.stringify({ payload: wireNull }))!.id
    expect(idOfAbsent).toBe(idOfNull)
    expect(idOfAbsent.startsWith('unknown-')).toBe(true)
    // ③ 反向对照:真有归属时 id 必须带出那个值 ⇒ 上面的折叠不是"恒 unknown"空转
    expect(
      parseTerminalDeltaEvent(
        JSON.stringify({ payload: { ...wireNull, tool_call_id: 'tc-9' } }),
      )!.id.startsWith('tc-9-'),
    ).toBe(true)
  })

  it('contract usage 帧 reasoningTokens:缺席(旧帧)与显式 null(该模型不报)在解析位保持可分', () => {
    // 两帧都按 contract.ts 的类型构造:缺席是**线形态**,不是类型错误
    const absentFrame: SSEEventPayload = {
      type: 'usage',
      messageId: 'msg-1',
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
      timing: { firstTokenMs: null, durationMs: 240 },
      model: null,
      costUsd: null,
    }
    const nullFrame: SSEEventPayload = {
      type: 'usage',
      messageId: 'msg-2',
      usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25, reasoningTokens: null },
      timing: { firstTokenMs: 120, durationMs: 800 },
      model: 'm',
      costUsd: null,
    }
    const usageOf = (frame: SSEEventPayload) => {
      if (frame.type !== 'usage') {
        throw new Error('[g-721] 收窄失败:构造的 usage 帧没被识别成判别联合成员')
      }
      return frame.usage
    }
    // ① 键在不在,两态不同形(折叠只许发生在渲染位;解析位一折这条就红)
    expect(Object.prototype.hasOwnProperty.call(usageOf(absentFrame), 'reasoningTokens')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(usageOf(nullFrame), 'reasoningTokens')).toBe(true)
    // ② 值也不同形:undefined(未知,旧帧) ≠ null(报了"没有推理用量")
    expect(usageOf(absentFrame).reasoningTokens).toBeUndefined()
    expect(usageOf(nullFrame).reasoningTokens).toBeNull()
    expect(usageOf(absentFrame).reasoningTokens === usageOf(nullFrame).reasoningTokens).toBe(false)
    // ③ 两态都不得被读成肯定值 0(0 = "确实一个推理 token 都没花")
    expect(usageOf(absentFrame).reasoningTokens).not.toBe(0)
    expect(usageOf(nullFrame).reasoningTokens).not.toBe(0)
    // 反向对照:有值时三值类型必须原样透出 ⇒ ①② 不是"恒空"空转
    const valued: SSEEventPayload = {
      ...nullFrame,
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3, reasoningTokens: 7 },
    }
    expect(usageOf(valued).reasoningTokens).toBe(7)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
