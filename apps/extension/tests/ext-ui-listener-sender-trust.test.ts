// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ext_ui sidepanel 接收端消息来源闸测试(2026-11-08,同型根因 D 类)。
 *
 * sidepanel 里的 ext_ui 执行器能点/填/滚动宿主页面,属高权限入口。消息只应由
 * background 转发而来(sender.tab === undefined 的顶层上下文)。本用例断言
 * 非白名单 sender 投递时**零副作用**:执行器 0 次、sendResponse 0 次。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('../lib/ui-action-registry', () => ({ executeExtUiAction: executeMock }))
vi.mock('../lib/ext-ui-forwarder', () => ({
  EXT_UI_FORWARD_MESSAGE_TYPE: 'agent.action.ext_ui',
}))

import { initExtUiListener } from '../entrypoints/sidepanel/ext-ui-listener'

const CHROME_PROFILE_ID = 'test-profile'
const EXT_ORIGIN = `chrome-extension://${CHROME_PROFILE_ID}/`

let onMessage: (
  msg: unknown,
  sender?: unknown,
  sendResponse?: (response: unknown) => void,
) => unknown = () => {
  throw new Error('listener 未捕获')
}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: CHROME_PROFILE_ID,
    onMessage: {
      addListener: (
        fn: (msg: unknown, sender?: unknown, sendResponse?: (r: unknown) => void) => unknown,
      ) => {
        onMessage = fn
      },
    },
  },
}
initExtUiListener()

function extUiMessage() {
  return {
    type: 'agent.action.ext_ui',
    payload: { requestId: 'req-ext-ui', category: 'ext_ui', action: 'click', params: {} },
  }
}

const TRUSTED_BG_SENDER = { id: CHROME_PROFILE_ID, url: `${EXT_ORIGIN}background.js` }

const UNTRUSTED_CASES: Array<[string, unknown]> = [
  ['外部扩展', { id: 'other-ext', url: 'chrome-extension://other-ext/popup.html' }],
  [
    '本扩展 content script',
    { id: CHROME_PROFILE_ID, url: 'https://aizhs.top/some-page', tab: { id: 9 } },
  ],
  ['缺失 sender', undefined],
]

beforeEach(() => {
  executeMock.mockReset()
  executeMock.mockResolvedValue({ success: true })
})

describe('ext_ui 接收端消息来源闸(零副作用)', () => {
  for (const [label, sender] of UNTRUSTED_CASES) {
    it(`${label} 投递 agent.action.ext_ui:执行器 0 次、无回执`, () => {
      const sendResponse = vi.fn()
      onMessage(extUiMessage(), sender, sendResponse)
      expect(executeMock).not.toHaveBeenCalled()
      expect(sendResponse).not.toHaveBeenCalled()
    })
  }

  it('background 投递:照常执行并回执', async () => {
    const sendResponse = vi.fn()
    onMessage(extUiMessage(), TRUSTED_BG_SENDER, sendResponse)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(sendResponse).toHaveBeenCalledWith({ success: true })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
