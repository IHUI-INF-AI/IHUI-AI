// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D155(2026-09-29 立)下行告警三档契约测试。
 *
 * 覆盖(与 shared/src/sse/__tests__/contract.test.ts 互补,那个文件钉 SSE_EVENTS 主注册表):
 * 1. SSE_ALERT_EVENTS 三档名与值(kebab-case,与 budget 帧同族命名)
 * 2. 三档名**不在** SSE_EVENTS / isSSEEventName 为 false —— 契约声明的"暂不入主注册表"
 *    是刻意设计(对账 0 要求 sse_contract.py 逐名同步,生产判定点在 ai-service 现场释放),
 *    不是漏登 —— 本测试把它钉住,防止"顺手补登"造成跨语言 parity 假红
 * 3. SSEAlertEventPayload 判别联合:逐帧按 type 收窄 + 可选字段缺席合法 + meta 透传
 * 4. normalizeSSEAlertSeverity:表上三值放行 / 表外(缺省/未知串/非串)回退 warning
 */

import { describe, it, expect } from 'vitest'
import {
  SSE_ALERT_EVENTS,
  SSE_ALERT_EVENT_NAMES,
  SSE_ALERT_SEVERITIES,
  SSE_EVENTS,
  isSSEAlertEventName,
  isSSEEventName,
  normalizeSSEAlertSeverity,
  type SSEAlertEventPayload,
  type SSEAlertSeverity,
} from '../contract'

describe('SSE_ALERT_EVENTS 事件名(D155)', () => {
  it('三档名与值逐一点名在位', () => {
    expect(SSE_ALERT_EVENTS.CONFIG_WARNING).toBe('config-warning')
    expect(SSE_ALERT_EVENTS.DEPRECATION_NOTICE).toBe('deprecation-notice')
    expect(SSE_ALERT_EVENTS.GUARDIAN_WARNING).toBe('guardian-warning')
    expect(SSE_ALERT_EVENT_NAMES).toHaveLength(3)
  })

  it('与主注册表 SSE_EVENTS 无名字冲突(将来并册时不产生第二语义)', () => {
    const main = new Set(Object.values(SSE_EVENTS))
    for (const name of SSE_ALERT_EVENT_NAMES) {
      expect(main.has(name)).toBe(false)
    }
  })

  it('刻意暂不入主注册表:isSSEEventName 为 false、isSSEAlertEventName 为 true', () => {
    // 这不是漏登:主注册表两侧(sse_contract.py)逐名等值由 parity 门强制,而三档的
    // 生产判定点在 ai-service 现场释放;单侧加名即假红。并册时本用例要同步反转。
    for (const name of SSE_ALERT_EVENT_NAMES) {
      expect(isSSEEventName(name)).toBe(false)
      expect(isSSEAlertEventName(name)).toBe(true)
    }
    expect(isSSEEventName('budget')).toBe(true)
    expect(isSSEAlertEventName('budget')).toBe(false)
    expect(isSSEAlertEventName('unknown-alert')).toBe(false)
  })
})

describe('normalizeSSEAlertSeverity(D155 强度域归一)', () => {
  it('表上三值原样放行', () => {
    expect(normalizeSSEAlertSeverity('info')).toBe('info')
    expect(normalizeSSEAlertSeverity('warning')).toBe('warning')
    expect(normalizeSSEAlertSeverity('critical')).toBe('critical')
  })

  it('表外值(缺省/未知串/非串)一律回退 warning,不抛不崩', () => {
    expect(normalizeSSEAlertSeverity(undefined)).toBe('warning')
    expect(normalizeSSEAlertSeverity(null)).toBe('warning')
    expect(normalizeSSEAlertSeverity('')).toBe('warning')
    expect(normalizeSSEAlertSeverity('fatal')).toBe('warning')
    expect(normalizeSSEAlertSeverity('WARNING')).toBe('warning')
    expect(normalizeSSEAlertSeverity(3)).toBe('warning')
    expect(normalizeSSEAlertSeverity({})).toBe('warning')
  })

  it('强度域是封闭三值表', () => {
    expect([...SSE_ALERT_SEVERITIES]).toEqual(['info', 'warning', 'critical'])
  })
})

describe('SSEAlertEventPayload 判别联合(D155 三档帧形)', () => {
  /** 运行时判别收窄:按 type 分流后各档可选字段可读(编译期穷尽由 switch + never 钉住) */
  function severityOf(frame: SSEAlertEventPayload): SSEAlertSeverity {
    switch (frame.type) {
      case 'config-warning':
        return frame.severity
      case 'deprecation-notice':
        return frame.severity
      case 'guardian-warning':
        return frame.severity
      default: {
        const exhaustive: never = frame
        throw new Error(`未知告警帧:${JSON.stringify(exhaustive)}`)
      }
    }
  }

  it('config-warning 帧:必填在位、可选缺席合法、meta 透传', () => {
    const frame: SSEAlertEventPayload = {
      type: 'config-warning',
      severity: 'warning',
      message: 'base URL 已被覆盖到非官方端点',
      field: 'baseUrl',
      provider: 'deepseek',
      effectiveValue: 'https://relay.example.internal/v1',
      traceId: 'a'.repeat(32),
    }
    expect(severityOf(frame)).toBe('warning')
    if (frame.type === 'config-warning') {
      expect(frame.message).toContain('base URL')
      expect(frame.effectiveValue).toBe('https://relay.example.internal/v1')
    }
  })

  it('deprecation-notice 帧:可选字段整字段缺席合法(端上不渲染缺席位)', () => {
    const frame: SSEAlertEventPayload = {
      type: 'deprecation-notice',
      severity: 'info',
      message: '旧版补全端点将于下月停用',
    }
    expect(severityOf(frame)).toBe('info')
    if (frame.type === 'deprecation-notice') {
      expect(frame.capability).toBeUndefined()
      expect(frame.alternative).toBeUndefined()
      expect(frame.sunsetAt).toBeUndefined()
    }
  })

  it('guardian-warning 帧:风险类别与审查器 id 透传(category 值域生产端定义,端上不枚举校验)', () => {
    const frame: SSEAlertEventPayload = {
      type: 'guardian-warning',
      severity: 'critical',
      message: '自动审查发现命令包含递归删除',
      category: 'destructive-command',
      reviewId: 'gr-77',
    }
    expect(severityOf(frame)).toBe('critical')
    if (frame.type === 'guardian-warning') {
      expect(frame.category).toBe('destructive-command')
      expect(frame.reviewId).toBe('gr-77')
    }
  })

  it('未知档位的帧进不了判别联合(编译期)+ 三档枚举可穷尽判别(运行时)', () => {
    const frames: SSEAlertEventPayload[] = [
      {
        type: 'config-warning',
        severity: 'warning',
        message: 'm1',
      },
      {
        type: 'deprecation-notice',
        severity: 'warning',
        message: 'm2',
      },
      {
        type: 'guardian-warning',
        severity: 'warning',
        message: 'm3',
      },
    ]
    expect(frames.map(severityOf)).toEqual(['warning', 'warning', 'warning'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
