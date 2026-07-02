/**
 * cspReport.ts 单元测试
 *
 * 覆盖:
 * - initCspReport 注册 securitypolicyviolation 监听器
 * - reportCspViolation 接受 SecurityPolicyViolationEvent
 * - reportCspViolation 接受 CspViolation 风格对象 (kebab-case 字段)
 * - 空入参安全短路
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 隔离测试环境: sendBeacon 通常不可用, mock 掉
const originalSendBeacon = navigator.sendBeacon
beforeEach(() => {
  ;(navigator as any).sendBeacon = vi.fn(() => true)
})
afterEach(() => {
  ;(navigator as any).sendBeacon = originalSendBeacon
  vi.restoreAllMocks()
})

describe('cspReport', () => {
  it('initCspReport 不会重复注册监听器 (no-op on server)', async () => {
    const { initCspReport } = await import('@/utils/cspReport')
    expect(() => initCspReport()).not.toThrow()
  })

  it('initCspReport 监听 securitypolicyviolation 事件并调用 sendBeacon', async () => {
    const addListener = vi.spyOn(document, 'addEventListener')
    const { initCspReport } = await import('@/utils/cspReport')
    initCspReport()
    expect(addListener).toHaveBeenCalledWith('securitypolicyviolation', expect.any(Function))
  })

  it('reportCspViolation 接受 SecurityPolicyViolationEvent 并双路上报', async () => {
    const { reportCspViolation } = await import('@/utils/cspReport')
    const event = {
      blockedURI: 'inline',
      documentURI: 'https://example.com/',
      effectiveDirective: 'script-src',
      originalPolicy: "script-src 'self'",
      referrer: '',
      violatedDirective: 'script-src',
      sourceFile: 'https://example.com/app.js',
      lineNumber: 42,
      columnNumber: 7,
      statusCode: 200,
      disposition: 'enforce',
    } as unknown as SecurityPolicyViolationEvent

    expect(() => reportCspViolation(event)).not.toThrow()
    expect(navigator.sendBeacon).toHaveBeenCalled()
  })

  it('reportCspViolation 接受 kebab-case 风格的部分对象', async () => {
    const { reportCspViolation } = await import('@/utils/cspReport')
    const partial = {
      'blocked-uri': 'https://evil.example/x.js',
      'violated-directive': 'script-src',
    } as any
    expect(() => reportCspViolation(partial)).not.toThrow()
    expect(navigator.sendBeacon).toHaveBeenCalled()
  })

  it('reportCspViolation 空入参安全短路', async () => {
    const { reportCspViolation } = await import('@/utils/cspReport')
    expect(() => reportCspViolation(null as any)).not.toThrow()
    expect(() => reportCspViolation(undefined as any)).not.toThrow()
  })
})
