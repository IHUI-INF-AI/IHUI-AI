// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816042:分发工厂的"未识别事件名"必须计数并报名,而不是静默 return null。
//
// 三条判据各有成对反向锁(本仓最高频失效型是"把没判写成判过了",而报名做成无条件刷屏
// 同样是失败):① 契约外名字 ⇒ 计数 +1 且首次报名;② 已知事件名 ⇒ 计数恒为 0;
// ③ 默认出口不得静默(没有宿主注册时也要喊一次)。

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AGENT_TASK_EVENTS, AGENT_TASK_EVENT_NAMES, parseAgentTaskEvent } from '../agent-events'
import {
  recordUnknownSseEventName,
  resetUnknownSseEventTelemetry,
  setUnknownSseEventReporter,
  unknownSseEventCounts,
  unknownSseEventTotal,
  type UnknownSseEventNotice,
} from '../unknown-event-telemetry'

describe('未识别 SSE 事件名的计数与一次性报名', () => {
  let notices: UnknownSseEventNotice[] = []

  beforeEach(() => {
    resetUnknownSseEventTelemetry()
    notices = []
    setUnknownSseEventReporter((notice) => notices.push(notice))
  })

  it('① 分发工厂遇到契约外的名字:返回 null 且计数 +1、报名一次(静默丢弃的实现必红)', () => {
    const raw = JSON.stringify({ payload: {} })
    expect(parseAgentTaskEvent('totally-new-event', raw)).toBeNull()
    expect(unknownSseEventCounts()['totally-new-event']).toBe(1)
    expect(unknownSseEventTotal()).toBe(1)
    expect(notices).toHaveLength(1)
    expect(notices[0]).toEqual({ name: 'totally-new-event', count: 1 })
  })

  it('①b 同一个名字第二次:计数累加但不得再报名(防刷屏)', () => {
    const raw = JSON.stringify({ payload: {} })
    parseAgentTaskEvent('dup-event', raw)
    parseAgentTaskEvent('dup-event', raw)
    expect(unknownSseEventCounts()['dup-event']).toBe(2)
    expect(notices).toHaveLength(1)
    expect(notices[0].count).toBe(1)
  })

  it('② 已知事件名(9 个被本工厂路由的)不得产生任何计数或报名(反向锁)', () => {
    const routed = [
      [AGENT_TASK_EVENTS.SELF_HEAL, { phase: 'started' }],
      [AGENT_TASK_EVENTS.THINKING, { content: 'x' }],
      [AGENT_TASK_EVENTS.PLAN_STEP, { step_index: 0, tool_name: 't', status: 'started' }],
      [AGENT_TASK_EVENTS.SESSION_END, { success: true }],
      [AGENT_TASK_EVENTS.PERMISSION_MODE, { mode: 'default' }],
      [AGENT_TASK_EVENTS.TERMINAL_DELTA, { stream: 'stdout', text: 'x' }],
      [AGENT_TASK_EVENTS.AGENT_STATUS, { status: 'resuming' }],
      [AGENT_TASK_EVENTS.MESSAGE_SEND, { iteration: 1 }],
      [AGENT_TASK_EVENTS.TOOL_APPROVAL, { approval_id: 'a' }],
    ] as const
    for (const [name, payload] of routed) {
      parseAgentTaskEvent(name, JSON.stringify({ type: name, payload }))
    }
    expect(unknownSseEventTotal()).toBe(0)
    expect(notices).toHaveLength(0)
  })

  it('②b 契约内而本工厂不路由的名字(session/tool_call/…)是职责边界,不是异常', () => {
    // 这条把"每帧刷屏"的写法钉红:把那 6 个名字也报出来,notices 就会非空。
    for (const name of AGENT_TASK_EVENT_NAMES) {
      parseAgentTaskEvent(name, JSON.stringify({ payload: {} }))
    }
    expect(notices).toHaveLength(0)
    expect(unknownSseEventTotal()).toBe(0)
  })

  it('③ 宿主没注册出口时,默认出口必须喊一次(不得静默)', () => {
    setUnknownSseEventReporter(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      recordUnknownSseEventName('no-host-reporter')
      recordUnknownSseEventName('no-host-reporter')
      // 只报第一次:两次调用对应一条控制台报名。
      // 断言必须写在 finally 之前 —— mockRestore() 会连带清空 calls 历史,
      // 放在还原之后断言就是"测自己的收尾",红绿都不说明任何事。
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toContain('no-host-reporter')
      expect(unknownSseEventCounts()['no-host-reporter']).toBe(2)
    } finally {
      warn.mockRestore()
    }
  })

  it('非字符串名字归成可点名的键并仍报名(不得因类型意外而静默)', () => {
    recordUnknownSseEventName(undefined)
    recordUnknownSseEventName(null)
    expect(unknownSseEventCounts()['<non-string:undefined>']).toBe(1)
    expect(unknownSseEventCounts()['<non-string:object>']).toBe(1)
    expect(notices).toHaveLength(2)
  })

  it('空串也归未命名一类(不得把 "" 当合法事件名塞进计数表)', () => {
    recordUnknownSseEventName('')
    expect(unknownSseEventCounts()['<non-string:string>']).toBe(1)
    expect(unknownSseEventCounts()['']).toBeUndefined()
  })

  it('counts() 返回拷贝:调用方改它不得污染内部状态', () => {
    recordUnknownSseEventName('copy-guard')
    const snapshot = unknownSseEventCounts()
    snapshot['copy-guard'] = 9999
    delete snapshot['copy-guard']
    expect(unknownSseEventCounts()['copy-guard']).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
