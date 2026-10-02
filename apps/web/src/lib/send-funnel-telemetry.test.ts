// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import {
  SEND_FUNNEL_EVENT_GROUP,
  SEND_SETTLE_REASON_CODES,
  SendFunnelTelemetry,
  type FunnelEvent,
} from './send-funnel-telemetry'

/**
 * 发送漏斗埋点验收测试(2026-09-30 立,吸收批次 74 票 G-977983)。
 * 锁定验收:send_settled 携带端到端与 ACK 两段耗时 / reason_code 只出枚举值 /
 * 空 id 不下发该维度 / reporter 抛错不冒泡 / reporter 缺失时静默。
 */

function collect() {
  const events: FunnelEvent[] = []
  const reporter = (event: FunnelEvent) => {
    events.push(event)
  }
  return { events, reporter }
}

describe('SendFunnelTelemetry 三事件漏斗', () => {
  it('send_settled 的 value = 端到端耗时,且端到端与 ACK 两段分字段', () => {
    const { events, reporter } = collect()
    const funnel = new SendFunnelTelemetry({ reporter })

    funnel.reportSendSettled({
      sessionId: 's-1',
      commandId: 'cmd-1',
      submitSeq: 'seq-1',
      status: 'success',
      totalCostMs: 1234.6,
      ackCostMs: 210.2,
      queueConfirmed: true,
    })

    expect(events).toHaveLength(1)
    const event = events[0]!
    expect(event.group).toBe(SEND_FUNNEL_EVENT_GROUP)
    expect(event.name).toBe('send_settled')
    // value 直接可出分位
    expect(event.value).toBe(1235)
    expect(event.properties.total_cost_ms).toBe(1235)
    expect(event.properties.ack_cost_ms).toBe(210)
    // 相减即"回流 + 渲染"段:1235 - 210
    expect(
      (event.properties.total_cost_ms as number) - (event.properties.ack_cost_ms as number),
    ).toBe(1025)
    expect(event.properties.queue_confirmed).toBe(true)
    expect(event.properties.session_id).toBe('s-1')
    expect(event.properties.command_id).toBe('cmd-1')
    expect(event.properties.status).toBe('success')
  })

  it('失败落定携带 reason_code,且只出 9 种枚举值', () => {
    expect(SEND_SETTLE_REASON_CODES).toHaveLength(9)
    const { events, reporter } = collect()
    const funnel = new SendFunnelTelemetry({ reporter })

    for (const reasonCode of SEND_SETTLE_REASON_CODES) {
      funnel.reportSendSettled({
        sessionId: 's-1',
        submitSeq: 'seq-x',
        status: 'fail',
        reasonCode,
        totalCostMs: 50,
        queueConfirmed: false,
      })
    }
    // 成功落定不携带 reason_code
    funnel.reportSendSettled({
      sessionId: 's-1',
      submitSeq: 'seq-ok',
      status: 'success',
      totalCostMs: 80,
      queueConfirmed: true,
    })

    const settled = events.filter((e) => e.name === 'send_settled')
    expect(settled).toHaveLength(SEND_SETTLE_REASON_CODES.length + 1)
    const reasonValues = settled
      .map((e) => e.properties.reason_code)
      .filter((v): v is string => v !== undefined)
    expect(reasonValues).toHaveLength(SEND_SETTLE_REASON_CODES.length)
    for (const value of reasonValues) {
      expect(SEND_SETTLE_REASON_CODES).toContain(value)
    }
    const success = settled.at(-1)!
    expect(success.properties.reason_code).toBeUndefined()
  })

  it('空 sessionId/commandId 不下发该维度,scope 区分 session|draft', () => {
    const { events, reporter } = collect()
    const funnel = new SendFunnelTelemetry({ reporter })

    funnel.reportSendSettled({
      sessionId: null,
      submitSeq: 'seq-draft',
      status: 'fail',
      reasonCode: 'composer_error',
      totalCostMs: 10,
      queueConfirmed: false,
    })
    funnel.reportSendSubmit({
      sessionId: '   ',
      submitSeq: 'seq-2',
      submitMs: 5,
      trigger: 'shortcut',
    })

    const settled = events.find((e) => e.name === 'send_settled')!
    expect(settled.properties.session_id).toBeUndefined()
    expect(settled.properties.composer_scope).toBe('draft')

    const submit = events.find((e) => e.name === 'send_submit')!
    expect(submit.properties.session_id).toBeUndefined()
    expect(submit.properties.composer_scope).toBe('draft')
    expect(submit.properties.send_trigger).toBe('shortcut')

    funnel.reportSendSubmit({
      sessionId: 's-9',
      submitSeq: 'seq-3',
      submitMs: 5,
      trigger: 'button',
    })
    expect(events.at(-1)!.properties.session_id).toBe('s-9')
    expect(events.at(-1)!.properties.composer_scope).toBe('session')
  })

  it('仅用户真实聚焦才报(程序性聚焦不上报)', () => {
    const { events, reporter } = collect()
    const funnel = new SendFunnelTelemetry({ reporter })

    funnel.reportComposerFocus({ sessionId: 's-1', focusMs: 1200, isTrustedUserFocus: false })
    expect(events).toHaveLength(0)

    funnel.reportComposerFocus({ sessionId: 's-1', focusMs: 1200, isTrustedUserFocus: true })
    expect(events).toHaveLength(1)
    expect(events[0]!.name).toBe('composer_focus')
    expect(events[0]!.properties.focus_ms).toBe(1200)
  })

  it('reporter 抛错(同步/异步)不冒泡进发送主链路', async () => {
    const onWarn = vi.fn()
    const funnel = new SendFunnelTelemetry({
      reporter: () => {
        throw new Error('sync boom')
      },
      onWarn,
    })
    expect(() =>
      funnel.reportSendSubmit({ sessionId: 's', submitSeq: 'x', submitMs: 1, trigger: 'button' }),
    ).not.toThrow()

    const asyncFunnel = new SendFunnelTelemetry({
      reporter: () => Promise.reject(new Error('async boom')),
      onWarn,
    })
    expect(() =>
      asyncFunnel.reportSendSettled({
        sessionId: 's',
        submitSeq: 'x',
        status: 'fail',
        reasonCode: 'transport_error',
        totalCostMs: 1,
        queueConfirmed: false,
      }),
    ).not.toThrow()
    // 等一拍让异步 catch 走完
    await Promise.resolve()
    await Promise.resolve()
    expect(onWarn).toHaveBeenCalledTimes(2)
  })

  it('reporter 缺失时整组静默', () => {
    const silent = new SendFunnelTelemetry()
    expect(() =>
      silent.reportComposerFocus({ sessionId: null, focusMs: 1, isTrustedUserFocus: true }),
    ).not.toThrow()
    expect(() =>
      silent.reportSendSubmit({ sessionId: null, submitSeq: 'x', submitMs: 1, trigger: 'button' }),
    ).not.toThrow()
    expect(() =>
      silent.reportSendSettled({
        sessionId: null,
        submitSeq: 'x',
        status: 'success',
        totalCostMs: 1,
        queueConfirmed: true,
      }),
    ).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
