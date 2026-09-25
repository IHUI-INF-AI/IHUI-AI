// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Web UI 桥(use-ui-control-bridge.ts)定址投递客户端侧测试(2026-09-26)。
 *
 * 与桌面桥 use-agent-control-addressing.test.ts 同一组不变量,钉的是本端 category='ui':
 *  - 非指派到本标签页:不执行、不回执,且留可诊断日志(不得静默 return);
 *  - 指派端:回执回显服务端 token + 自报本实例;
 *  - **载荷无 assignment(旧服务端)⇒ 与改前逐字同行为**(照常执行、回执不含 responded)。
 * 判据本身住 `@ihui/shared/utils/agent-action-addressing`,此处刻意不 mock 它(装车证明)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchApiMock, executeUiActionMock, warnSpy } = vi.hoisted(() => ({
  fetchApiMock: vi.fn(),
  executeUiActionMock: vi.fn(),
  warnSpy: vi.fn(),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@ihui/api-client', () => ({ createNotificationClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('@/lib/ui-action-registry', () => ({
  configureUiControlBridge: vi.fn(),
  resetUiControlBridge: vi.fn(),
  executeUiAction: executeUiActionMock,
}))
vi.mock('@/stores/navigation', () => ({ useNavigateWithProgress: () => vi.fn() }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign(vi.fn(), { getState: () => ({ token: 'tk' }) }),
}))
vi.mock('@/lib/api-base-url', () => ({ resolveWsApiBaseUrl: () => 'http://127.0.0.1:8802' }))

import { __test__ } from '../use-ui-control-bridge'

const { handleWsMessage, selfIdentity } = __test__

function wsFrame(requestId: string, assignment?: Record<string, unknown>) {
  return {
    type: 'notification',
    data: {
      type: 'agent.action',
      request: { requestId, category: 'ui', action: 'describe', params: {} },
      ...(assignment ? { assignment } : {}),
    },
  } as never
}

function resultPosts(): Array<{ body: Record<string, unknown> }> {
  return fetchApiMock.mock.calls
    .filter((c) => String(c[0]) === '/api/agent-control/result')
    .map((c) => ({ body: JSON.parse((c[1] as { body: string }).body) as Record<string, unknown> }))
}

beforeEach(() => {
  fetchApiMock.mockReset()
  fetchApiMock.mockResolvedValue({ success: true })
  executeUiActionMock.mockReset()
  executeUiActionMock.mockResolvedValue({ ok: true, data: { page: { path: '/x' } } })
  warnSpy.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(warnSpy)
})

describe('web UI 桥 assignment 定址', () => {
  it('自身身份为 endpoint=web + 端内既有实例 id 单点(不新造第二个 id 源)', () => {
    const self = selfIdentity()
    expect(self.endpoint).toBe('web')
    expect(self.instanceId).toMatch(/^web-/)
  })

  it('非指派到本标签页:不执行、不回执,且留可诊断日志(不得静默 return)', async () => {
    handleWsMessage(
      wsFrame('req-not-mine', { endpoint: 'web', instanceId: 'web-other-tab', token: 'tk-1' }),
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(executeUiActionMock).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
    expect(warnSpy.mock.calls.some((c) => String(c.join(' ')).includes('req-not-mine'))).toBe(true)
  })

  it('指派到本页:回执带 responded{本实例 + 原样回显服务端 token}', async () => {
    const token = 'tk-' + Math.random().toString(36).slice(2)
    handleWsMessage(
      wsFrame('req-mine', { endpoint: 'web', instanceId: selfIdentity().instanceId, token }),
    )
    await vi.waitFor(() => expect(resultPosts()).toHaveLength(1))
    const body = resultPosts()[0]?.body as Record<string, unknown>
    expect(body.requestId).toBe('req-mine')
    expect(body.responded).toEqual({
      instanceId: selfIdentity().instanceId,
      assignmentToken: token,
    })
  })

  it('旧服务端(无 assignment)形态逐字不变:照常执行且不带 responded', async () => {
    handleWsMessage(wsFrame('req-legacy'))
    await vi.waitFor(() => expect(resultPosts()).toHaveLength(1))
    expect(executeUiActionMock).toHaveBeenCalledWith('describe', {})
    const body = resultPosts()[0]?.body as Record<string, unknown>
    expect(body.responded).toBeUndefined()
    // data.instanceId 是改前就有的字段(多标签页钉回同页),不得因本次收口而消失
    expect((body.data as Record<string, unknown>).instanceId).toBe(selfIdentity().instanceId)
  })

  it('非 ui category(computer/app_ui)仍按改前语义忽略,不计入定址日志', async () => {
    handleWsMessage({
      type: 'notification',
      data: {
        type: 'agent.action',
        request: {
          requestId: 'req-other-cat',
          category: 'computer',
          action: 'describe',
          params: {},
        },
      },
    } as never)
    await new Promise((r) => setTimeout(r, 20))
    expect(executeUiActionMock).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('req-other-cat')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
