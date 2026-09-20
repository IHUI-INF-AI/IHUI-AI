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
    expect(typeof evt!.ts).toBe('number')
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
    expect(typeof evt!.ts).toBe('number')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
