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
  UNKNOWN_SSE_EVENT_RECENT_LIMIT,
  recordUnknownSseEventName,
  resetUnknownSseEventTelemetry,
  setUnknownSseEventReporter,
  unknownSseEventCounts,
  unknownSseEventRecentNames,
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
    expect(notices[0]?.count).toBe(1)
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
      expect(String(warn.mock.calls[0]?.[0])).toContain('no-host-reporter')
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

  // ---- D133(承 V4 #91):有界点名清单 ------------------------------------

  it('D133 验收:先喂一个假事件名 ⇒ 计数 +1 且点名清单含该名(只判当前为 0 不成立)', () => {
    // 断言顺序就是验收语义:先喂假名(动作),再断言计数 > 0 且名单点名 ——
    // 不先喂就断言,红绿都不说明任何事("看起来全绿"正是本票要禁的形态)。
    expect(unknownSseEventTotal()).toBe(0)
    recordUnknownSseEventName('d133-fake-event')
    expect(unknownSseEventCounts()['d133-fake-event']).toBe(1)
    expect(unknownSseEventTotal()).toBeGreaterThan(0)
    expect(unknownSseEventRecentNames()).toContain('d133-fake-event')
  })

  it('D133 同名多次出现,点名清单每次都记(计数与清单口径不同:清单是出现序,不是每名一次)', () => {
    recordUnknownSseEventName('d133-repeat')
    recordUnknownSseEventName('d133-repeat')
    expect(unknownSseEventCounts()['d133-repeat']).toBe(2)
    expect(unknownSseEventRecentNames()).toEqual(['d133-repeat', 'd133-repeat'])
  })

  it(`D133 有界:超过 ${UNKNOWN_SSE_EVENT_RECENT_LIMIT} 条后挤掉最旧、最新在尾(不设界就是内存泄漏)`, () => {
    for (let i = 0; i < UNKNOWN_SSE_EVENT_RECENT_LIMIT + 5; i++) {
      recordUnknownSseEventName(`d133-flood-${i}`)
    }
    const recent = unknownSseEventRecentNames()
    expect(recent.length).toBe(UNKNOWN_SSE_EVENT_RECENT_LIMIT)
    expect(recent[0]).toBe('d133-flood-5') // 最旧的 0~4 已被挤出
    expect(recent[recent.length - 1]).toBe(`d133-flood-${UNKNOWN_SSE_EVENT_RECENT_LIMIT + 4}`)
    // 计数不受清单有界影响:全部 55 个名字各自都在册
    expect(unknownSseEventCounts()['d133-flood-0']).toBe(1)
    expect(unknownSseEventTotal()).toBe(UNKNOWN_SSE_EVENT_RECENT_LIMIT + 5)
  })

  it('D133 点名清单快照是拷贝:调用方改它不得污染内部状态', () => {
    recordUnknownSseEventName('d133-copy-guard')
    const recent = unknownSseEventRecentNames() as string[]
    recent.length = 0
    expect(unknownSseEventRecentNames()).toEqual(['d133-copy-guard'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
