// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-69: 执行抛错必须回执,不能只 console.warn。
 * 桥的 dispatch 一旦 reject,服务端要立刻拿到 success:false,而不是干等超时。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { dispatchMock, fetchMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('../lib/token', () => ({ getToken: () => 'tk' }))
vi.mock('../lib/config', () => ({ getBridgeBaseUrl: () => 'http://127.0.0.1:8802' }))
vi.mock('../lib/ext-ui-forwarder', () => ({
  dispatchAgentActionRequest: dispatchMock,
}))

import { initAgentControlBridge } from '../lib/agent-control-bridge'

const CHROME_PROFILE_ID = 'test-profile'
const EXT_ORIGIN = `chrome-extension://${CHROME_PROFILE_ID}/`

let onMessage: (msg: unknown, sender?: unknown) => void = () => {
  throw new Error('listener 未捕获')
}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: CHROME_PROFILE_ID,
    getManifest: () => ({ version: '9.9.9' }),
    onMessage: {
      addListener: (fn: (msg: unknown, sender?: unknown) => void) => {
        onMessage = fn
      },
    },
  },
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
}
vi.stubGlobal('fetch', fetchMock)
fetchMock.mockResolvedValue({ ok: true })
initAgentControlBridge()

function resultPosts(): Array<[unknown, { body?: string } | undefined]> {
  return fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/result')) as Array<
    [unknown, { body?: string } | undefined]
  >
}

beforeEach(() => {
  fetchMock.mockClear()
  fetchMock.mockResolvedValue({ ok: true })
  dispatchMock.mockReset()
})

describe('agent-control 执行失败回执 (DBG-69)', () => {
  it('dispatch reject 时 POST /result 且 success 为 false', async () => {
    dispatchMock.mockRejectedValue(new Error('capture failed'))
    onMessage(
      {
        type: 'ws.notification',
        payload: {
          type: 'notification',
          data: {
            type: 'agent.action',
            request: {
              requestId: 'req-fail',
              category: 'browser',
              action: 'screenshot',
              params: {},
            },
          },
        },
      },
      { id: CHROME_PROFILE_ID, url: `${EXT_ORIGIN}sidepanel.html` },
    )
    await vi.waitFor(() => {
      expect(resultPosts()).toHaveLength(1)
    })
    const body = JSON.parse(resultPosts()[0]?.[1]?.body ?? '{}') as {
      success?: boolean
      error?: string
      errorCode?: string
      requestId?: string
    }
    expect(body.success).toBe(false)
    expect(body.error).toBe('capture failed')
    expect(body.errorCode).toBe('EXECUTION_FAILED')
    expect(body.requestId).toBe('req-fail')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
