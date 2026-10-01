// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-05 票1 验收②:解析面字段级判据(field-loss)。
 *
 * 立因:此前字段面全靠逐解析器手搓 typeof 守卫 —— "任一字段 typeof 不符 ⇒ 整个
 * 事件丢弃(return null)",后端新加键被静默吞掉与"流断了"在消费端同形。本文件钉
 * 三件事:
 *   (a) 未知新键**不丢事件**(边界宽松候选:payload 带、字段表没声明的键照常解析),
 *   (b) 未知键进 unknownSseFieldCounts 计数并报名(防"静默吞掉"),
 *   (c) 声明字段被拒 ⇒ 严格工厂返回带 `fault.sse.fieldRejected` 码的 typed fault
 *       对象而不是 null —— 防止"闸门本身是可跳过的 console.warn"。
 * 主解析器返回契约(事件对象或 null)不变:消费端 use-agent-runtime 按
 * `if (!evt) return` 接线,fault 从主通道返回会伪装成事件污染下游状态。
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  SSE_FIELD_FAULT_CODE,
  isSseFieldFault,
  parseAgentTaskEvent,
  parseAgentTaskEventStrict,
  parsePlanStepEvent,
  resetSseFieldTelemetry,
  setUnknownSseFieldReporter,
  sseFieldFaultCounts,
  unknownSseFieldCounts,
  type UnknownSseFieldNotice,
} from '../src/sse/agent-events'

afterEach(() => {
  resetSseFieldTelemetry()
})

describe('未知 payload 键(字段面 (a)+(b))', () => {
  it('携带字段表没有的 brand_new_field 时,解析结果不为 null(不丢事件)', () => {
    const evt = parsePlanStepEvent(
      JSON.stringify({
        type: 'plan-step',
        payload: { step_index: 0, tool_name: 'x', status: 'started', brand_new_field: 42 },
      }),
    )
    expect(evt).not.toBeNull()
    expect(evt!.stepIndex).toBe(0)
  })

  it('unknownSseFieldCounts() 对该事件计数 =1,报名包含 brand_new_field', () => {
    const notices: UnknownSseFieldNotice[] = []
    setUnknownSseFieldReporter((n) => notices.push(n))
    parsePlanStepEvent(
      JSON.stringify({
        payload: { step_index: 1, tool_name: 'x', status: 'completed', brand_new_field: 42 },
      }),
    )
    expect(unknownSseFieldCounts()['plan-step']?.brand_new_field).toBe(1)
    // 报名一次性:同一字段第二次出现只累加计数,不再刷屏(与 G-816042 名称面同构)。
    parsePlanStepEvent(
      JSON.stringify({
        payload: { step_index: 2, tool_name: 'y', status: 'completed', brand_new_field: 43 },
      }),
    )
    expect(unknownSseFieldCounts()['plan-step']?.brand_new_field).toBe(2)
    const fieldNotices = notices.filter((n) => n.field === 'brand_new_field')
    expect(fieldNotices).toHaveLength(1)
    expect(fieldNotices[0]!.eventName).toBe('plan-step')
    expect(fieldNotices[0]!.kind).toBe('unknown-field')
  })

  it('已声明键不进未知计数(阳性对照,防审计器把白名单也当未知)', () => {
    parsePlanStepEvent(
      JSON.stringify({
        payload: { step_index: 0, tool_name: 'x', status: 'started', run_id: 'r1' },
      }),
    )
    expect(unknownSseFieldCounts()['plan-step']).toBeUndefined()
  })
})

describe('声明字段被拒(typed fault (c))', () => {
  it('payload.step_index 为字符串 ⇒ 严格工厂返回带 code 的 fault 对象,不是 null', () => {
    const result = parseAgentTaskEventStrict(
      'plan-step',
      JSON.stringify({ payload: { step_index: 'not-a-number', tool_name: 'x', status: 'started' } }),
    )
    expect(result).not.toBeNull()
    expect(isSseFieldFault(result)).toBe(true)
    if (isSseFieldFault(result)) {
      expect(result.code).toBe(SSE_FIELD_FAULT_CODE)
      expect(result.eventName).toBe('plan-step')
      expect(result.field).toBe('step_index')
      expect(result.expected).toBe('number')
      expect(result.got).toBe('string')
    }
  })

  it('fault 同步落账:sseFieldFaultCounts() 计数 =1(账面上可见,不是 console.warn 一闪)', () => {
    parseAgentTaskEventStrict(
      'plan-step',
      JSON.stringify({ payload: { step_index: 'x', tool_name: 'x', status: 'started' } }),
    )
    expect(sseFieldFaultCounts()['plan-step']?.step_index).toBe(1)
  })

  it('主工厂对同一输入保持 wire 兼容契约:返回 null(不是 fault 对象)', () => {
    // 消费端 `if (!evt) return` 依赖这个形状;fault 若走主通道会伪装成事件对象。
    const result = parseAgentTaskEvent(
      'plan-step',
      JSON.stringify({ payload: { step_index: 'x', tool_name: 'x', status: 'started' } }),
    )
    expect(result).toBeNull()
  })

  it('严格工厂对合法 payload 返回事件对象(fault 谓词为 false 的阳性对照)', () => {
    const result = parseAgentTaskEventStrict(
      'plan-step',
      JSON.stringify({ payload: { step_index: 0, tool_name: 'x', status: 'started' } }),
    )
    expect(result).not.toBeNull()
    expect(isSseFieldFault(result)).toBe(false)
    if (!isSseFieldFault(result) && result !== null) {
      expect(result.name).toBe('plan-step')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
