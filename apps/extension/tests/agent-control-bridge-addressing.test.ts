// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展桥定址投递客户端侧测试(2026-09-26,镜像 web 端 use-agent-control 的同款不变量)。
 * 判据链全 mock:token/config/forwarder/fetch 都不触网;chrome 只桩 runtime/alarms。
 * init 只在模块顶层跑一次(桥自带 bridgeInitialized 幂等闸),beforeEach 清 mock 计数。
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

import { shouldExecuteAssignment, initAgentControlBridge } from '../lib/agent-control-bridge'

// 桥内实例 id 恒为 `ext-${chrome.runtime.id}`:桩 runtime.id 不带 ext- 前缀
const CHROME_PROFILE_ID = 'test-profile'
const SELF_INSTANCE_ID = `ext-${CHROME_PROFILE_ID}`

// 捕获桥注册的 runtime.onMessage 监听器(init 幂等,只此一次)
let onMessage: (msg: unknown) => void = () => {
  throw new Error('listener 未捕获')
}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: CHROME_PROFILE_ID,
    onMessage: {
      addListener: (fn: (msg: unknown) => void) => {
        onMessage = fn
      },
    },
  },
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
}
vi.stubGlobal('fetch', fetchMock)
fetchMock.mockResolvedValue({ ok: true })
initAgentControlBridge()

function wsNotification(requestId: string, assignment?: Record<string, unknown>) {
  return {
    type: 'ws.notification',
    payload: {
      type: 'notification',
      data: {
        type: 'agent.action',
        request: { requestId, category: 'browser', action: 'screenshot', params: {} },
        ...(assignment ? { assignment } : {}),
      },
    },
  }
}

/** 只看 /result 的 POST(init 时已发过一次 /capability,计数须先分流) */
function resultPosts() {
  return fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/result'))
}

beforeEach(() => {
  fetchMock.mockClear()
  fetchMock.mockResolvedValue({ ok: true })
  dispatchMock.mockReset()
  warnSpy.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(warnSpy)
})

describe('扩展桥 assignment 定址(客户端自律层)', () => {
  it('shouldExecuteAssignment:缺省放行 / 他实例拒 / 异端种类拒 / 本实例放行', () => {
    expect(shouldExecuteAssignment(undefined)).toBe(true)
    expect(
      shouldExecuteAssignment({
        endpoint: 'extension',
        instanceId: 'ext-other-profile',
        token: 't',
      }),
    ).toBe(false)
    expect(
      shouldExecuteAssignment({ endpoint: 'web', instanceId: SELF_INSTANCE_ID, token: 't' }),
    ).toBe(false)
    expect(
      shouldExecuteAssignment({ endpoint: 'extension', instanceId: SELF_INSTANCE_ID, token: 't' }),
    ).toBe(true)
  })

  it('非指派端收到广播:不执行、不回执,且留可诊断日志(不得静默 return)', async () => {
    onMessage(
      wsNotification('req-other', {
        endpoint: 'extension',
        instanceId: 'ext-x',
        token: 'tk-1',
      }),
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
    expect(warnSpy.mock.calls.some((c) => String(c.join(' ')).includes('req-other'))).toBe(true)
  })

  it('指派端回执回显服务端 token + 自报本实例(只回显,不算第二份期望身份)', async () => {
    const token = 'tk-server-' + Math.random().toString(36).slice(2)
    dispatchMock.mockResolvedValue({
      requestId: 'req-mine',
      success: true,
      durationMs: 1,
      executedBy: 'extension',
    })
    onMessage(
      wsNotification('req-mine', {
        endpoint: 'extension',
        instanceId: SELF_INSTANCE_ID,
        token,
      }),
    )
    await vi.waitFor(() => expect(resultPosts()).toHaveLength(1))
    const body = JSON.parse((resultPosts()[0]?.[1] as { body: string }).body) as {
      requestId: string
      responded?: { instanceId: string; assignmentToken: string }
    }
    expect(body.requestId).toBe('req-mine')
    expect(body.responded).toEqual({ instanceId: SELF_INSTANCE_ID, assignmentToken: token })
  })

  it('旧服务端(无 assignment)形态逐字不变:照常执行且不带 responded', async () => {
    dispatchMock.mockResolvedValue({
      requestId: 'req-legacy',
      success: true,
      durationMs: 1,
      executedBy: 'extension',
    })
    onMessage(wsNotification('req-legacy'))
    await vi.waitFor(() => expect(resultPosts()).toHaveLength(1))
    const body = JSON.parse((resultPosts()[0]?.[1] as { body: string }).body) as {
      responded?: unknown
    }
    expect(body.responded).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
