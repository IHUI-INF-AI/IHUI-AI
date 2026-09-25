/**
 * 桌面桥(use-agent-control.ts)定址投递票客户端侧测试(2026-09-26)。
 *
 * 钉两条端侧不变量(服务端侧不变量见 apps/api/tests/agent-control-addressed-delivery.test.ts):
 *  - 非指派端收到广播后**不得执行、不得回执**,且留可诊断日志(不得静默 return);
 *  - 指派端回执必须回显服务端派发的 assignment.token + 自报本实例(客户端只回显,不算身份)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchApiMock, clipboardGetMock, warnSpy } = vi.hoisted(() => ({
  fetchApiMock: vi.fn(),
  clipboardGetMock: vi.fn(),
  warnSpy: vi.fn(),
}))

vi.mock('react', () => ({ default: { useRef: () => ({ current: undefined }) } }))
vi.mock('@ihui/api-client', () => ({ createNotificationClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: vi.fn(() => false),
  clipboardGet: clipboardGetMock,
  clipboardSet: vi.fn(),
  getActiveWindow: vi.fn(),
  keyboardHotkey: vi.fn(),
  keyboardPress: vi.fn(),
  keyboardType: vi.fn(),
  mouseClick: vi.fn(),
  mouseMove: vi.fn(),
  mouseScroll: vi.fn(),
  screenshotScreen: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign(vi.fn(), { getState: () => ({ token: 'tk' }) }),
}))
vi.mock('@/lib/api-base-url', () => ({ resolveWsApiBaseUrl: () => 'http://127.0.0.1:8802' }))

import { __test__ } from '../use-agent-control'

const { handleWsMessage, isAssignedToThisInstance, getInstanceId } = __test__

function wsFrame(requestId: string, assignment?: Record<string, unknown>) {
  return {
    type: 'notification',
    data: {
      type: 'agent.action',
      request: {
        requestId,
        category: 'computer',
        action: 'clipboard_get',
        params: {},
      },
      ...(assignment ? { assignment } : {}),
    },
  } as never
}

beforeEach(() => {
  fetchApiMock.mockReset()
  fetchApiMock.mockResolvedValue({ success: true })
  clipboardGetMock.mockReset()
  clipboardGetMock.mockResolvedValue({ clipboard: 'hello' })
  warnSpy.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(warnSpy)
})

describe('桌面桥 assignment 定址判据', () => {
  it('缺 assignment(旧服务端)按原语义放行(向后兼容)', () => {
    expect(isAssignedToThisInstance(undefined)).toBe(true)
  })

  it('指派给他实例 → 不执行', () => {
    expect(
      isAssignedToThisInstance({
        endpoint: 'desktop',
        instanceId: 'desktop-not-me',
        token: 't',
      }),
    ).toBe(false)
  })

  it('指派端种类都不是 desktop(串投)→ 不执行,哪怕实例名巧合', () => {
    expect(
      isAssignedToThisInstance({ endpoint: 'web', instanceId: getInstanceId(), token: 't' }),
    ).toBe(false)
  })

  it('非指派消息:不 POST /result,且留下可诊断日志(不静默)', async () => {
    handleWsMessage(
      wsFrame('req-not-mine', { endpoint: 'desktop', instanceId: 'desktop-other', token: 'tk-1' }),
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(warnSpy.mock.calls.some((c) => String(c.join(' ')).includes('req-not-mine'))).toBe(true)
  })

  it('指派消息回执带 responded{本实例 + 回显 token}', async () => {
    const token = 'tk-' + Math.random().toString(36).slice(2)
    handleWsMessage(
      wsFrame('req-mine', { endpoint: 'desktop', instanceId: getInstanceId(), token }),
    )
    await vi.waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    const opts = fetchApiMock.mock.calls[0]?.[1] as { body: string }
    const body = JSON.parse(opts.body) as {
      requestId: string
      responded?: { instanceId: string; assignmentToken: string }
    }
    expect(body.requestId).toBe('req-mine')
    expect(body.responded).toEqual({ instanceId: getInstanceId(), assignmentToken: token })
  })

  it('无 assignment 的旧形态:照常执行且不带 responded(存量语义逐字不变)', async () => {
    handleWsMessage(wsFrame('req-legacy'))
    await vi.waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    const opts = fetchApiMock.mock.calls[0]?.[1] as { body: string }
    const body = JSON.parse(opts.body) as { responded?: unknown }
    expect(body.responded).toBeUndefined()
  })
})
