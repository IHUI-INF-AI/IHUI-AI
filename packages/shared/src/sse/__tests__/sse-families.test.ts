// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D133(承 V4 #91):SSE 事件族登记表的判据测试。
//
// 四条判据:① 两族清单与各自单源逐名等值(import 派生 ⇒ 应恒真,断言写在是防
// "绕开本文件另抄一份"的回潮);② 交叉映射键穷尽(键数 = 对话流名数,mapped type
// 在 tsc 层强制,这里在运行时再钉一遍);③ 关键交叉与刻意"无"的对照(同义不同码的
// 三条 + 同名三条 + 近似项不得充数);④ 启动期对账 throw 面注入篡改表逐格验红。

import { describe, expect, it } from 'vitest'

import { AGENT_TASK_EVENT_NAMES, AGENT_TASK_EVENTS } from '../agent-events'
import { SSE_EVENTS, SSE_EVENT_NAMES } from '../contract'
import {
  SSE_EVENT_FAMILIES,
  SSE_EVENT_FAMILY_AGENT_TASK,
  SSE_EVENT_FAMILY_CHAT,
  SSE_FAMILY_CROSS_REFERENCES,
  agentTaskToChatCrossReference,
  assertSseFamiliesConsistent,
  chatToAgentTaskCrossReference,
} from '../families'

describe('SSE 事件族登记表(families.ts, D133)', () => {
  it('① 对话流族清单 === contract.ts SSE_EVENTS 值集(不手抄第二份)', () => {
    expect(SSE_EVENT_FAMILY_CHAT.source).toContain('contract.ts')
    expect([...SSE_EVENT_FAMILY_CHAT.names]).toEqual([...SSE_EVENT_NAMES])
    expect(SSE_EVENT_FAMILY_CHAT.names.length).toBe(Object.values(SSE_EVENTS).length)
  })

  it('①b agent 任务流族清单 === agent-events.ts AGENT_TASK_EVENTS 值集', () => {
    expect(SSE_EVENT_FAMILY_AGENT_TASK.source).toContain('agent-events.ts')
    expect([...SSE_EVENT_FAMILY_AGENT_TASK.names]).toEqual([...AGENT_TASK_EVENT_NAMES])
  })

  it('①c 两族都无重复名(对账判据的机器可判前提)', () => {
    for (const family of SSE_EVENT_FAMILIES) {
      expect(new Set(family.names).size).toBe(family.names.length)
    }
  })

  it('② 交叉映射键穷尽:键数 = 对话流事件数(mapped type 的运行时复核)', () => {
    expect(Object.keys(SSE_FAMILY_CROSS_REFERENCES).length).toBe(SSE_EVENT_NAMES.length)
    for (const name of SSE_EVENT_NAMES) {
      expect(SSE_FAMILY_CROSS_REFERENCES).toHaveProperty(name)
    }
  })

  it('③ 同义不同码的三条交叉(kebab/snake 混排正是本表存在的理由)', () => {
    expect(SSE_FAMILY_CROSS_REFERENCES['tool-call-start']).toBe(AGENT_TASK_EVENTS.TOOL_CALL)
    expect(SSE_FAMILY_CROSS_REFERENCES['tool-result']).toBe(AGENT_TASK_EVENTS.TOOL_RESULT)
    expect(SSE_FAMILY_CROSS_REFERENCES.terminal_delta).toBe(AGENT_TASK_EVENTS.TERMINAL_DELTA)
  })

  it('③b 同名的三条交叉(逐字符相等)', () => {
    expect(SSE_FAMILY_CROSS_REFERENCES.thinking).toBe(AGENT_TASK_EVENTS.THINKING)
    expect(SSE_FAMILY_CROSS_REFERENCES['plan-step']).toBe(AGENT_TASK_EVENTS.PLAN_STEP)
    expect(SSE_FAMILY_CROSS_REFERENCES.compaction).toBe(AGENT_TASK_EVENTS.COMPACTION)
    expect(SSE_FAMILY_CROSS_REFERENCES.error).toBe(AGENT_TASK_EVENTS.ERROR)
    expect(SSE_FAMILY_CROSS_REFERENCES['tool-approval']).toBe(AGENT_TASK_EVENTS.TOOL_APPROVAL)
  })

  it('③c 近似项如实标 null,不许"看起来对应"充数', () => {
    // start(任务执行开始,带 resume_from)≠ session(会话建立),生命周期不同位
    expect(SSE_FAMILY_CROSS_REFERENCES.start).toBeNull()
    // plan_updated(对话流整表更新)≠ plan-step(agent 流时间线增量)
    expect(SSE_FAMILY_CROSS_REFERENCES.plan_updated).toBeNull()
    // 对话流 chunk ≠ agent 流 message(承载面不同构)
    expect(SSE_FAMILY_CROSS_REFERENCES.chunk).toBeNull()
  })

  it('③d 反向查表与正向一致(派生表,非手写第二份)', () => {
    expect(agentTaskToChatCrossReference(AGENT_TASK_EVENTS.TOOL_RESULT)).toBe('tool-result')
    expect(agentTaskToChatCrossReference(AGENT_TASK_EVENTS.TERMINAL_DELTA)).toBe('terminal_delta')
    expect(agentTaskToChatCrossReference(AGENT_TASK_EVENTS.SESSION)).toBeUndefined()
    // 每条非 null 正向都有反向,且 chatToAgentTaskCrossReference 与直查映射同值
    for (const chatName of SSE_EVENT_NAMES) {
      const agentName = chatToAgentTaskCrossReference(chatName)
      if (agentName !== null) {
        expect(agentTaskToChatCrossReference(agentName)).toBe(chatName)
      }
    }
  })

  it('④ 启动期对账:真实登记表不 throw(模块加载即已跑过一遍)', () => {
    expect(() => assertSseFamiliesConsistent()).not.toThrow()
  })

  it('④b 交叉表键不在对话流族里 ⇒ throw 且点名(offender 不得静默)', () => {
    expect(() =>
      assertSseFamiliesConsistent({ cross: { 'not-a-chat-event': 'thinking' } }),
    ).toThrow(/not-a-chat-event/)
  })

  it('④c 交叉值不在 agent 任务流族里 ⇒ throw 且点名', () => {
    expect(() =>
      assertSseFamiliesConsistent({ cross: { chunk: 'no-such-agent-event' } }),
    ).toThrow(/no-such-agent-event/)
  })

  it('④d 族清单有重复名 ⇒ throw(对账判据要求可判集合)', () => {
    expect(() =>
      assertSseFamiliesConsistent({ chatNames: ['chunk', 'chunk'], agentTaskNames: AGENT_TASK_EVENT_NAMES }),
    ).toThrow(/duplicate/)
    expect(() =>
      assertSseFamiliesConsistent({
        chatNames: SSE_EVENT_NAMES,
        agentTaskNames: ['session', 'session'],
      }),
    ).toThrow(/duplicate/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
