// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BOUNDARY_STACK_MAX_LENGTH,
  DEFAULT_BOUNDARY_SCOPE,
  ERROR_BOUNDARY_EVENT_GROUP,
  ERROR_BOUNDARY_EVENT_NAME,
  installErrorBoundaryReporter,
  isBoundaryReporterReady,
  redactTelemetryText,
  reportBoundaryError,
  type BoundaryErrorPayload,
} from './error-boundary-telemetry'

/**
 * React 错误边界上报干道验收测试(2026-09-30 立,吸收批次 74 票 G-977982)。
 * 锁定验收:reporter 未注入安全 no-op / reporter 抛错不冒泡 /
 * 上报副本脱敏且原值仍可取(副本/原值分离) / componentStack 4000 截断保头部 /
 * scope 维度透传 / 注入就绪语义(先于 createRoot 纪律的可断言形态)。
 */

afterEach(() => {
  // 模块级单例:每例复位,防止 reporter 串扰到后续用例。
  installErrorBoundaryReporter(null)
})

function collectEvents() {
  const events: BoundaryErrorPayload[] = []
  const reporter = (payload: BoundaryErrorPayload) => {
    events.push(payload)
  }
  return { events, reporter }
}

describe('reporter 注入时机语义', () => {
  it('未注入时未就绪;注入后就绪;卸载(null)复位', () => {
    expect(isBoundaryReporterReady()).toBe(false)
    installErrorBoundaryReporter(collectEvents().reporter)
    expect(isBoundaryReporterReady()).toBe(true)
    installErrorBoundaryReporter(null)
    expect(isBoundaryReporterReady()).toBe(false)
  })

  it('重复注入以后一次为准', () => {
    const first = collectEvents()
    const second = collectEvents()
    installErrorBoundaryReporter(first.reporter)
    installErrorBoundaryReporter(second.reporter)

    reportBoundaryError(new Error('boom'))
    expect(first.events).toHaveLength(0)
    expect(second.events).toHaveLength(1)
  })
})

describe('reportBoundaryError 干道转发', () => {
  it('reporter 未注入时安全 no-op(不抛错、无副作用)', () => {
    expect(() => reportBoundaryError(new Error('x'))).not.toThrow()
    expect(() =>
      reportBoundaryError(new Error('x'), { scope: 'chat', componentStack: 'in Chat' }),
    ).not.toThrow()
  })

  it('事件结构与默认 scope:根级边界缺省记 app', () => {
    const { events, reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    reportBoundaryError(new Error('boom'), { componentStack: 'in Inner' })

    expect(events).toHaveLength(1)
    const payload = events[0]!
    expect(payload.name).toBe(ERROR_BOUNDARY_EVENT_NAME)
    expect(payload.group).toBe(ERROR_BOUNDARY_EVENT_GROUP)
    expect(payload.value).toBe(1)
    expect(payload.properties.error_name).toBe('Error')
    expect(payload.properties.error_message).toBe('boom')
    expect(payload.properties.error_stack).toContain('boom')
    expect(payload.properties.component_stack).toBe('in Inner')
    expect(payload.properties.boundary_scope).toBe(DEFAULT_BOUNDARY_SCOPE)
  })

  it('scope 维度透传(chat/settings 等子树切分)', () => {
    const { events, reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    reportBoundaryError(new Error('x'), { scope: 'chat' })
    reportBoundaryError(new Error('x'), { scope: 'settings' })
    reportBoundaryError(new Error('x'), { scope: '   ' })

    expect(events.map((event) => event.properties.boundary_scope)).toEqual([
      'chat',
      'settings',
      DEFAULT_BOUNDARY_SCOPE,
    ])
  })

  it('非 Error 抛出物(string/对象/其他)防御性提取后仍可上报', () => {
    const { events, reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    reportBoundaryError('plain string failure')
    reportBoundaryError({ message: 'object failure', name: 'Weird' })
    reportBoundaryError(42)

    expect(events[0]!.properties.error_message).toBe('plain string failure')
    expect(events[1]!.properties.error_name).toBe('Weird')
    expect(events[1]!.properties.error_message).toBe('object failure')
    expect(events[2]!.properties.error_message).toBe('42')
  })
})

describe('上报副本脱敏与原值分离', () => {
  it('stack/message/componentStack 副本已脱敏;原值仍可取(本地日志与 fallback 用原值)', () => {
    const { events, reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    const error = new Error('boom at /Users/zhangsan/proj/app.tsx')
    error.stack = [
      'Error: boom',
      '    at render (file:///Users/zhangsan/proj/src/app.tsx:12:3)',
      '    at step (C:\\Users\\wang\\app\\x.ts:1:1)',
    ].join('\n')

    reportBoundaryError(error, {
      scope: 'chat',
      componentStack: 'in Inner (file:///Users/zhangsan/app/inner.tsx:9:1)',
    })

    const payload = events[0]!
    expect(payload.properties.error_stack).toContain('<user>')
    expect(payload.properties.error_stack).not.toContain('zhangsan')
    expect(payload.properties.error_stack).not.toContain('wang')
    expect(payload.properties.error_message).toContain('<user>')
    expect(payload.properties.error_message).not.toContain('zhangsan')
    expect(payload.properties.component_stack).not.toContain('zhangsan')

    // 原 error 对象一个字段都不改:本地日志与 fallback 恢复继续用原值。
    expect(error.stack).toContain('zhangsan')
    expect(error.stack).toContain('wang')
    expect(error.message).toContain('zhangsan')
  })

  it('redactTelemetryText 覆盖 Unix/Windows/file URL 三种家目录形态', () => {
    expect(redactTelemetryText('at f (file:///Users/zhangsan/app/x.ts:1:2)')).toBe(
      'at f (file:///Users/<user>/app/x.ts:1:2)',
    )
    expect(redactTelemetryText('at f (file:///C:/Users/wang/app/x.ts:1:2)')).toBe(
      'at f (file:///C:/Users/<user>/app/x.ts:1:2)',
    )
    expect(redactTelemetryText('at f (C:\\Users\\wang\\app\\x.ts:1:2)')).toBe(
      'at f (C:\\Users\\<user>\\app\\x.ts:1:2)',
    )
    expect(redactTelemetryText('at f (/home/li/app/x.ts:1:2)')).toBe(
      'at f (/home/<user>/app/x.ts:1:2)',
    )
    expect(redactTelemetryText('no user path here')).toBe('no user path here')
  })
})

describe('上报副本截断', () => {
  it('componentStack 超限截断到 4000 且保头部(最近抛错组件在上)', () => {
    const { events, reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    const head = 'in InnermostErrorComponent\n'
    const componentStack =
      head +
      Array.from(
        { length: 300 },
        (_, index) => `    at Layer${index} (file:///u/f.tsx:${index}:1)\n`,
      ).join('')

    reportBoundaryError(new Error('x'), { componentStack })

    const reported = events[0]!.properties.component_stack!
    expect(reported).toHaveLength(BOUNDARY_STACK_MAX_LENGTH)
    expect(reported.startsWith(head)).toBe(true)
    // 尾部低优先层被截掉,头部最近抛错组件完整保留。
    expect(reported).not.toContain('Layer299')
  })

  it('未超限的副本原样上报', () => {
    const { events, reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    reportBoundaryError(new Error('x'), { componentStack: 'in Small' })
    expect(events[0]!.properties.component_stack).toBe('in Small')
  })
})

describe('上报失败不冒泡(不中断 fallback 恢复)', () => {
  it('reporter 同步抛错/异步 reject 均不冒泡,只 warn', async () => {
    const onWarn = vi.fn()
    installErrorBoundaryReporter(() => {
      throw new Error('sync boom')
    })
    expect(() => reportBoundaryError(new Error('x'), { onWarn })).not.toThrow()

    installErrorBoundaryReporter(() => Promise.reject(new Error('async boom')))
    expect(() => reportBoundaryError(new Error('x'), { onWarn })).not.toThrow()

    // 等几拍让异步 catch 走完。
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(onWarn).toHaveBeenCalledTimes(2)
  })

  it('reporter 正常返回时无 warn', async () => {
    const onWarn = vi.fn()
    const { reporter } = collectEvents()
    installErrorBoundaryReporter(reporter)

    reportBoundaryError(new Error('x'), { onWarn })
    await Promise.resolve()
    await Promise.resolve()
    expect(onWarn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
