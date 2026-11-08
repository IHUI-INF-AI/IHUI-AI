// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * agent-control bridge 消息来源闸测试(2026-11-08,同型根因 D 类)。
 *
 * 要证明的不是"返回值不同",而是**非白名单 sender 投递时零副作用**:
 * 1) dispatchAgentActionRequest 调用 0 次(不执行任何浏览器/DOM 动作);
 * 2) fetch 的 /result 回执 0 次(不向外回报);
 * 3) requestId 不被吞掉 —— 同一 requestId 再由可信顶层页面投递时必须照常执行,
 *    以此反证伪造消息没有污染去重集合(内部状态零变更)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { dispatchMock, fetchMock, warnSpy } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  fetchMock: vi.fn(),
  warnSpy: vi.fn(),
}))

vi.mock('../lib/token', () => ({ getToken: () => 'tk' }))
vi.mock('../lib/config', () => ({ getBridgeBaseUrl: () => 'http://127.0.0.1:8802' }))
vi.mock('../lib/ext-ui-forwarder', () => ({
  dispatchAgentActionRequest: dispatchMock,
}))

import { initAgentControlBridge } from '../lib/agent-control-bridge'

const CHROME_PROFILE_ID = 'test-profile'
const EXT_ORIGIN = `chrome-extension://${CHROME_PROFILE_ID}/`

let onMessage: (
  msg: unknown,
  sender?: unknown,
  sendResponse?: (response: unknown) => void,
) => void = () => {
  throw new Error('listener 未捕获')
}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: CHROME_PROFILE_ID,
    getManifest: () => ({ version: '9.9.9' }),
    onMessage: {
      addListener: (
        fn: (msg: unknown, sender?: unknown, sendResponse?: (r: unknown) => void) => void,
      ) => {
        onMessage = fn
      },
    },
  },
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
}
vi.stubGlobal('fetch', fetchMock)
fetchMock.mockResolvedValue({ ok: true })
initAgentControlBridge()

function wsNotification(requestId: string) {
  return {
    type: 'ws.notification',
    payload: {
      type: 'notification',
      data: {
        type: 'agent.action',
        request: { requestId, category: 'browser', action: 'screenshot', params: {} },
      },
    },
  }
}

/** 只看 /result 的 POST(init 时已发过一次 /capability) */
function resultPosts() {
  return fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/result'))
}

const TRUSTED_PAGE_SENDER = { id: CHROME_PROFILE_ID, url: `${EXT_ORIGIN}sidepanel.html` }

/** 非白名单三档:外部扩展 / 本扩展 content script / 完全缺失 sender */
const UNTRUSTED_CASES: Array<[string, unknown]> = [
  ['外部扩展', { id: 'other-ext', url: 'chrome-extension://other-ext/popup.html' }],
  [
    '本扩展 content script',
    { id: CHROME_PROFILE_ID, url: 'https://aizhs.top/some-page', tab: { id: 9 } },
  ],
  ['缺失 sender', undefined],
]

beforeEach(() => {
  fetchMock.mockClear()
  fetchMock.mockResolvedValue({ ok: true })
  dispatchMock.mockReset()
  dispatchMock.mockResolvedValue({
    requestId: 'req',
    success: true,
    durationMs: 1,
    executedBy: 'extension',
  })
  warnSpy.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(warnSpy)
})

describe('agent-control bridge 消息来源闸(零副作用)', () => {
  for (const [label, sender] of UNTRUSTED_CASES) {
    it(`${label} 投递 ws.notification:不执行、不回执、不吞 requestId`, async () => {
      const requestId = `req-untrusted-${label}`
      onMessage(wsNotification(requestId), sender)
      await new Promise((r) => setTimeout(r, 30))

      // 零副作用
      expect(dispatchMock).not.toHaveBeenCalled()
      expect(resultPosts()).toHaveLength(0)
      // 不静默:留可诊断日志
      expect(warnSpy.mock.calls.some((c) => String(c.join(' ')).includes(requestId))).toBe(true)

      // 内部状态零变更:同一 requestId 再走可信页面必须照常执行
      dispatchMock.mockResolvedValue({
        requestId,
        success: true,
        durationMs: 1,
        executedBy: 'extension',
      })
      onMessage(wsNotification(requestId), TRUSTED_PAGE_SENDER)
      await vi.waitFor(() => expect(resultPosts()).toHaveLength(1))
      expect(dispatchMock).toHaveBeenCalledTimes(1)
    })
  }

  it('可信顶层页面(本扩展 URL)投递:照常执行并回执', async () => {
    const requestId = 'req-trusted-page'
    onMessage(wsNotification(requestId), TRUSTED_PAGE_SENDER)
    await vi.waitFor(() => expect(resultPosts()).toHaveLength(1))
    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })
})
