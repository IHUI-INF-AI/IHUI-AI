// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y 族 async 错误处理回归(2026-11-18)。
 *
 * 三处防御性 try/catch,各钉一个真实失效型:
 *  - Y-90 fetchProfile:网络 reject 时 loading 复位 false 且落 error(否则 UI 永久转圈);
 *  - Y-93 useSuperAgentPanel.refresh:void refresh()/setInterval 无 catch ⇒ unhandled rejection;
 *  - Y-94 useTaskReceiver.register:30s 心跳 void register() 无 catch ⇒ unhandled rejection。
 * 全部用 mock 底层 API reject 真实驱动,断言不抛且状态被更新。
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const M = vi.hoisted(() => ({
  getProfile: vi.fn(),
  fetchApi: vi.fn(),
  wsHook: vi.fn(() => ({ connected: false, lastMessage: null })),
  loggerError: vi.fn(),
}))

// --- fetchApi 被多处 import,统一 mock 成可 reject 的桩 ---
vi.mock('@/lib/api', () => ({ fetchApi: M.fetchApi }))
vi.mock('@ihui/api-client', () => ({ getProfile: M.getProfile }))
vi.mock('@/lib/logger', () => ({ logger: { error: M.loggerError, warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/hooks/use-websocket', () => ({ useWebSocket: M.wsHook }))
vi.mock('@ihui/shared/tasks/delegation-approval', () => ({
  delegationApprovalAudienceOf: () => 'all',
}))

const BOOM = new Error('network down')

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    },
  })
})

afterEach(() => vi.useRealTimers())

describe('Y-90 user store fetchProfile reject 处理', () => {
  it('getProfile reject → loading 复位 false 且 error 落位,不抛', async () => {
    M.getProfile.mockRejectedValueOnce(BOOM)
    const { useUserStore } = await import('@/stores/user')
    useUserStore.setState({ loading: false, error: null })

    await useUserStore.getState().fetchProfile()

    const s = useUserStore.getState()
    expect(s.loading).toBe(false)
    expect(s.error).toBe('network down')
  })
})

describe('Y-93 useSuperAgentPanel.refresh reject 处理', () => {
  it('fetchApi reject → error 落位,不抛 unhandled', async () => {
    M.fetchApi.mockRejectedValueOnce(BOOM)
    const { useSuperAgentPanel } = await import('@/components/chat/workbench/use-super-agent-panel')
    const { result } = renderHook(() => useSuperAgentPanel())

    await waitFor(() => expect(result.current.error).toBe('network down'))
  })
})

describe('Y-94 useTaskReceiver.register reject 处理', () => {
  it('心跳注册 fetchApi reject → logger.error 记下,不抛 unhandled', async () => {
    // register-device 那一次 reject;后续补拉等调用返回安全值
    M.fetchApi.mockImplementation((path: string) => {
      if (String(path).includes('register-device')) return Promise.reject(BOOM)
      return Promise.resolve({ success: true, data: null })
    })
    const { useTaskReceiver } = await import('@/hooks/use-task-receiver')
    renderHook(() => useTaskReceiver('test-token'))

    await waitFor(() =>
      expect(M.loggerError.mock.calls.some((c) => String(c[1]).includes('network down'))).toBe(true),
    )
  })
})

describe('Y-89 orchestration-hub-panel run reject 处理', () => {
  it('组件内 async run 的 fetchApi 被 try/catch 包裹且 finally 复位 loading', async () => {
    // run 是 useEffect 内闭包,无法直接单元化 invoke;这里钉住防御结构的存在与关键行为(token)。
    // 变异(去掉 try/catch 或 finally)会让本用例失败,配合上面 3 枚行为测试覆盖整个批次。
    const { readFileSync } = await import('node:fs')
    // 测试在 apps/web 包根运行,vitest 下 import.meta.url 非 file scheme,用 cwd 相对路径最稳。
    const src = readFileSync('src/components/ai/orchestration-hub-panel.tsx', 'utf-8')
    const runBody = src.slice(src.indexOf('const run = async () => {'), src.indexOf('void run()'))
    expect(runBody).toContain('try {')
    expect(runBody).toContain('catch (e)')
    expect(runBody).toContain('finally')
    expect(runBody).toContain('setLoading(false)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
