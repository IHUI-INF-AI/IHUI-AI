// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 崩溃上报「收成一句人话」这一格(2026-10-23 立)。
 *
 * 立项现场:小程序「微信一键登录」点了没反应,库里两条 `crash_reports` 写的是
 * `unhandled rejection: [object Object]` 且 stack 为空 —— 上报等于没记,
 * 只能回到开发者工具控制台重看一遍才拿到真文案(`showToast:fail parameter error:
 * parameter.title should be String instead of Undefined`)。
 *
 * 每条臂都配一个"已知应命中"的正例,免得"没上报"和"上报了但没内容"同色。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const captured: {
  onError?: (e: unknown) => void
  onRejection?: (res: { reason?: unknown }) => void
  requests: Array<{ url: string; method: string; data: Record<string, unknown> }>
} = { requests: [] }

vi.mock('@tarojs/taro', () => ({
  default: {
    onError: (cb: (e: unknown) => void) => {
      captured.onError = cb
    },
    onUnhandledRejection: (cb: (res: { reason?: unknown }) => void) => {
      captured.onRejection = cb
    },
    getCurrentPages: () => [{ route: 'pages/user/index' }],
    request: (opts: { url: string; method: string; data: Record<string, unknown> }) => {
      captured.requests.push(opts)
      return { catch: () => {} }
    },
  },
  onError: (cb: (e: unknown) => void) => {
    captured.onError = cb
  },
  onUnhandledRejection: (cb: (res: { reason?: unknown }) => void) => {
    captured.onRejection = cb
  },
  getCurrentPages: () => [{ route: 'pages/user/index' }],
  request: (opts: { url: string; method: string; data: Record<string, unknown> }) => {
    captured.requests.push(opts)
    return { catch: () => {} }
  },
}))

import { describeReason, initCrashReport } from '../src/utils/crash-report'

/** 取"那一条上报";一条都没有就点名,不让它塌成 `Cannot read properties of undefined` */
function onlyRequest(): { url: string; method: string; data: Record<string, unknown> } {
  const r = captured.requests[0]
  if (!r) throw new Error('没有发出任何崩溃上报请求')
  return r
}

beforeEach(() => {
  captured.requests.length = 0
  initCrashReport()
})

describe('describeReason 三形各有出口', () => {
  it('D1 Error 形:message 与 stack 各归各位', () => {
    const e = new Error('boom')
    const d = describeReason(e)
    expect(d.message).toBe('boom')
    expect(d.stack).toContain('Error: boom')
  })

  it('D2 裸对象形(微信那一例):不得坍成 [object Object],必须带出 errno 与 errMsg', () => {
    const d = describeReason({
      errno: 1001,
      errMsg:
        'showToast:fail parameter error: parameter.title should be String instead of Undefined;',
    })
    expect(d.message).not.toContain('[object Object]')
    expect(d.message).toContain('errno=1001')
    expect(d.message).toContain('showToast:fail parameter error')
  })

  it('D3 标量形:字符串与数字原样收成', () => {
    expect(describeReason('网络断了').message).toBe('网络断了')
    expect(describeReason(42).message).toBe('42')
  })

  it('D4 自引用对象不得抛(判据必须比 String() 更耐操)', () => {
    const cyc: Record<string, unknown> = { name: 'loop' }
    cyc.self = cyc
    expect(() => describeReason(cyc)).not.toThrow()
    expect(describeReason(cyc).message).toContain('name="loop"')
  })

  it('D5 空对象也有话可说,不上报一条空消息', () => {
    expect(describeReason({}).message).toBe('object(无可枚举自有键)')
    expect(describeReason(undefined).message).toBe('undefined')
  })
})

describe('发射面:真上报带内容、带 route、且先脱敏', () => {
  it('D6 未处理的裸对象拒绝 ⇒ 落库文本含真文案与当前页 route', () => {
    captured.onRejection?.({ reason: { errno: 1001, errMsg: 'showToast:fail parameter error' } })
    expect(captured.requests).toHaveLength(1)
    const body = onlyRequest().data
    expect(body.platform).toBe('wechat-miniapp')
    expect(body.route).toBe('pages/user/index')
    expect(String(body.errorMessage)).toContain('unhandled rejection:')
    expect(String(body.errorMessage)).toContain('showToast:fail parameter error')
  })

  it('D7 凭据不得原文出设备:Bearer 串在发射前已被共享层出口抹掉', () => {
    const secret = 'Bearer abcdefghijklmnopqrstuvwxyz012345'
    captured.onError?.({ message: `请求头 ${secret} 被拒` })
    expect(captured.requests).toHaveLength(1)
    const sent = String(onlyRequest().data.errorMessage)
    expect(sent).not.toContain('abcdefghijklmnopqrstuvwxyz012345')
    // 抹掉之后仍要留得下"这里有过一个 Bearer"这件事,不能整条消息一起丢
    expect(sent).toContain('请求头')
  })

  it('D8 Error 的 stack 走 stack 这一列,不挤进 4000 字的消息列', () => {
    const e = new Error('炸了')
    captured.onError?.(e)
    const body = onlyRequest().data
    expect(String(body.errorMessage)).toContain('炸了')
    expect(String(body.stack)).toContain('Error: 炸了')
  })
})
