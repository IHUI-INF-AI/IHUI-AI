// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 事件契约单一事实源测试(#25,2026-09-16 立)
 *
 * 覆盖:
 * 1. SSE_EVENTS 事件名集合完整性(26 个:2026-09-19 补录 fallback/usage/steer/budget、
 *    删 repair/resumed 孤儿事件)与无重复
 * 2. SSE_EVENT_NAMES 派生一致性
 * 3. isSSEEventName 类型守卫
 * 4. 判别联合 SSEEventPayload 与事件名映射的全量对齐(编译期穷尽性 + 运行时抽样)
 * 5. #25 补录的 3 个漂移事件(plan_updated/terminal_start/terminal_end)
 * 6. 2026-09-19 补录 3 个:usage(D1 消息级计量)/ steer(中途引导)/ fallback(模型降级)
 */

import { describe, it, expect } from 'vitest'
import {
  SSE_EVENTS,
  SSE_EVENT_NAMES,
  isSSEEventName,
  type SSEEventPayload,
  type SSEEventName,
} from '../contract'

// ============ 1. 事件名集合完整性 ============

describe('SSE_EVENTS 事件名集合', () => {
  it('包含全部 28 个契约事件(V3 #48/#58:26 - token + terminal_delta + start + tool-approval)', () => {
    expect(Object.keys(SSE_EVENTS)).toHaveLength(28)
    expect(SSE_EVENT_NAMES).toHaveLength(28)
  })

  // D34(2026-09-22,G-40/G-44):运行环境交代两帧。
  // 事件名为我方协议自定;实证部分是字段形状(kind 八枚举 / collapsed+全文 /
  // attempt+maxRetries+retryInMs+httpStatus)。第 36 轮收回曾多加的
  // settings_applied(无服务端触发点)与 terminal_output(与 terminal_end 重复)。
  it('包含 D34 补录的 2 个运行环境交代事件', () => {
    expect(SSE_EVENTS.INJECTION_APPLIED).toBe('injection_applied')
    expect(SSE_EVENTS.RETRY_SCHEDULED).toBe('retry_scheduled')
  })

  it('值无重复(事件判别名唯一)', () => {
    const values = Object.values(SSE_EVENTS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('包含 #25 补录的 3 个对话流漂移事件', () => {
    expect(SSE_EVENTS.PLAN_UPDATED).toBe('plan_updated')
    expect(SSE_EVENTS.TERMINAL_START).toBe('terminal_start')
    expect(SSE_EVENTS.TERMINAL_END).toBe('terminal_end')
  })

  it('包含 2026-09-19 新增的 budget(网关预算档位提醒)', () => {
    expect(SSE_EVENTS.BUDGET).toBe('budget')
  })

  it('核心流式事件在位', () => {
    expect(SSE_EVENTS.CHUNK).toBe('chunk')
    expect(SSE_EVENTS.REASONING).toBe('reasoning')
    expect(SSE_EVENTS.TOOL_CALL_START).toBe('tool-call-start')
    expect(SSE_EVENTS.TOOL_RESULT).toBe('tool-result')
    expect(SSE_EVENTS.SUBAGENT_SPAWN).toBe('subagent_spawn')
    expect(SSE_EVENTS.PLAN_STEP).toBe('plan-step')
    expect(SSE_EVENTS.DONE).toBe('done')
    expect(SSE_EVENTS.ERROR).toBe('error')
    expect(SSE_EVENTS.COMPACTION).toBe('compaction')
    expect(SSE_EVENTS.THINKING).toBe('thinking')
  })
})

// ============ 2. 派生一致性 ============

describe('SSE_EVENT_NAMES 派生', () => {
  it('与 SSE_EVENTS 值集合一致', () => {
    expect([...SSE_EVENT_NAMES].sort()).toEqual([...Object.values(SSE_EVENTS)].sort())
  })
})

// ============ 3. 类型守卫 ============

describe('isSSEEventName', () => {
  it('已知事件名返回 true', () => {
    for (const name of SSE_EVENT_NAMES) {
      expect(isSSEEventName(name)).toBe(true)
    }
  })

  it('未知事件名返回 false', () => {
    expect(isSSEEventName('unknown-event')).toBe(false)
    expect(isSSEEventName('')).toBe(false)
    expect(isSSEEventName('CHUNK')).toBe(false)
  })
})

// ============ 4. 判别联合对齐 ============

/**
 * 编译期穷尽性:每个 SSE_EVENTS 键必须在 SSEEventPayload 判别联合中有
 * 对应 type 成员。新增事件漏写 payload 类型时此处 tsc/vitest 编译报错。
 */
const PAYLOAD_TYPE_BY_KEY: Record<keyof typeof SSE_EVENTS, SSEEventName> = {
  CHUNK: 'chunk',
  REASONING: 'reasoning',
  TOOL_CALL_START: 'tool-call-start',
  TOOL_RESULT: 'tool-result',
  TOOL_DELEGATE: 'tool-delegate',
  TOOL_SUMMARY: 'tool-summary',
  CITATIONS: 'citations',
  QUESTION: 'question',
  SUBAGENT_SPAWN: 'subagent_spawn',
  SUBAGENT_PROGRESS: 'subagent_progress',
  SUBAGENT_END: 'subagent_end',
  PLAN_STEP: 'plan-step',
  THINKING: 'thinking',
  PLAN_UPDATED: 'plan_updated',
  TERMINAL_START: 'terminal_start',
  TERMINAL_END: 'terminal_end',
  // V3 #48(2026-09-26)补登:终端逐行增量 / agent 流执行开始
  TERMINAL_DELTA: 'terminal_delta',
  START: 'start',
  // V3 #58(2026-09-26):主聊天流工具审批帧
  TOOL_APPROVAL: 'tool-approval',
  DONE: 'done',
  ERROR: 'error',
  COMPACTION: 'compaction',
  // 2026-09-19 补录 3 个(此前入契约未同步本映射,编译期穷尽性检查已拦截):
  // usage(D1 消息级计量)/ steer(中途引导注入确认)/ fallback(模型降级通知)
  USAGE: 'usage',
  STEER: 'steer',
  FALLBACK: 'fallback',
  // 2026-09-19 立:网关预算档位提醒(流首软提醒,80%~95% warning / 95%~100% critical)
  BUDGET: 'budget',
  INJECTION_APPLIED: 'injection_applied',
  RETRY_SCHEDULED: 'retry_scheduled',
}

describe('SSEEventPayload 判别联合对齐', () => {
  it('键→事件名映射与 SSE_EVENTS 值一致(编译期穷尽 + 运行时校验)', () => {
    for (const [key, name] of Object.entries(PAYLOAD_TYPE_BY_KEY)) {
      expect(SSE_EVENTS[key as keyof typeof SSE_EVENTS]).toBe(name)
    }
  })

  it('判别联合成员的 type 抽样可赋值(payload 类型收紧不回归)', () => {
    const samples: SSEEventPayload[] = [
      { type: 'chunk', content: 'hello' },
      {
        type: 'plan_updated',
        plan: [{ step: 's1', status: 'done', durationMs: 12 }],
        explanation: 'e',
        timestamp: 't',
      },
      {
        type: 'terminal_start',
        terminalId: 't1',
        command: 'ls',
        status: 'running',
        startedAt: 'now',
      },
      {
        type: 'terminal_end',
        terminalId: 't1',
        status: 'completed',
        endedAt: 'now',
        durationMs: 100,
        output: 'ok',
        exitCode: 0,
      },
      { type: 'error', message: 'boom', errorCode: 'E1' },
      // P1 #27(2026-09-16 立):done 事件携带 memoryUpdates(已记住提示条数据源)
      { type: 'done', model: 'm', stub: false, memoryUpdates: ['用户偏好 TypeScript'] },
      // Steer(2026-09-19 立):中途引导注入确认(tool loop 边界注入 messages 后下发)
      { type: 'steer', phase: 'injected', text: '换个思路,先看配置文件' },
      // Fallback(P4-2,2026-09-19 入契约):主模型失败切换备用模型通知
      {
        type: 'fallback',
        primary_model: 'gemini-2.0',
        backup_model: 'step-router-v1',
        reason: 'timeout',
      },
    ]
    expect(samples).toHaveLength(8)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
