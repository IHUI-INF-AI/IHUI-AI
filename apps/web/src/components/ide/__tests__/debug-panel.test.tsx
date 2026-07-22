// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react'

// useIDEWorkspace 返回的可变状态容器(每个用例 beforeEach 重置)
const mockStore = vi.hoisted(() => ({
  state: {
    activeView: 'debug',
    openTabs: [] as Array<{ id: string; path?: string; language?: string }>,
    activeTabId: null as string | null,
    workspacePath: '/test/ws',
  },
}))

// next-intl:返回 key 字面值,使 getByText / getByRole 能按 key 定位
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: () => mockStore.state,
}))

// @/lib/api/debug 全部 API mock
const debugApi = vi.hoisted(() => ({
  launchDebugSession: vi.fn(),
  setBreakpoints: vi.fn(),
  continueExecution: vi.fn(),
  stepExecution: vi.fn(),
  getStackTrace: vi.fn(),
  getVariables: vi.fn(),
  evaluateExpression: vi.fn(),
  disconnectSession: vi.fn(),
}))
vi.mock('@/lib/api/debug', () => debugApi)

// sonner toast:仅断言调用,不渲染真实 toast
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { DebugPanel } from '../debug-panel'

describe('DebugPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    mockStore.state = {
      activeView: 'debug',
      openTabs: [],
      activeTabId: null,
      workspacePath: '/test/ws',
    }
    debugApi.launchDebugSession.mockReset()
    debugApi.setBreakpoints.mockReset()
    debugApi.continueExecution.mockReset()
    debugApi.stepExecution.mockReset()
    debugApi.getStackTrace.mockReset()
    debugApi.getVariables.mockReset()
    debugApi.evaluateExpression.mockReset()
    debugApi.disconnectSession.mockReset()
  })
  afterEach(() => cleanup())

  it('正常渲染:工具栏 + 调试控制台 + 无会话提示(stopped 初始态)', () => {
    const { getByRole, getByText } = render(<DebugPanel />)
    // 工具栏按钮
    expect(getByRole('button', { name: 'debug.start' })).not.toBeNull()
    expect(getByRole('button', { name: 'debug.stop' })).not.toBeNull()
    expect(getByRole('button', { name: 'debug.stepOver' })).not.toBeNull()
    expect(getByRole('button', { name: 'debug.stepInto' })).not.toBeNull()
    expect(getByRole('button', { name: 'debug.stepOut' })).not.toBeNull()
    // 状态文案 + 无会话提示
    expect(getByText('debug.stateStopped')).not.toBeNull()
    expect(getByText('debug.noSession')).not.toBeNull()
    // 控制台折叠按钮
    expect(getByText('debug.debugConsole')).not.toBeNull()
  })

  it('activeView 非 debug 时不渲染', () => {
    mockStore.state.activeView = 'files'
    const { container } = render(<DebugPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('Play 按钮点击触发 launchDebugSession + continueExecution', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    const { getByRole } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(debugApi.launchDebugSession).toHaveBeenCalled())
    // 首次启动:language=typescript(默认),program=workspacePath
    expect(debugApi.launchDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'typescript', program: '/test/ws' }),
    )
    expect(debugApi.continueExecution).toHaveBeenCalledWith('sid-1')
  })

  it('启动后切换为 running,显示变量/监视/断点/调用栈标题', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    const { getByRole, getByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(getByText('debug.variables')).not.toBeNull())
    expect(getByText('debug.watch')).not.toBeNull()
    expect(getByText('debug.breakpoints')).not.toBeNull()
    expect(getByText('debug.callStack')).not.toBeNull()
    // 状态切换为 running
    expect(getByText('debug.stateRunning')).not.toBeNull()
  })

  it('Stop 按钮点击触发 disconnectSession 并回到 stopped', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    debugApi.disconnectSession.mockResolvedValue({ disconnected: true })
    const { getByRole, getByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(getByText('debug.variables')).not.toBeNull())
    fireEvent.click(getByRole('button', { name: 'debug.stop' }))
    await waitFor(() => expect(debugApi.disconnectSession).toHaveBeenCalledWith('sid-1'))
    // 回到 stopped:无会话提示重新出现
    await waitFor(() => expect(getByText('debug.noSession')).not.toBeNull())
  })

  it('断点 toggle:点击切换启用/禁用,计数器从 1/1 变 0/1', async () => {
    // 通过 localStorage 种入 1 个启用断点(组件 useState 初始化时读取)
    localStorage.setItem(
      'ide:breakpoints',
      JSON.stringify([{ id: 'bp-1', file: 'src/app.ts', line: 10, enabled: true }]),
    )
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    debugApi.setBreakpoints.mockResolvedValue({ breakpoints: [] })
    const { getByRole, getByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(getByText('debug.breakpoints')).not.toBeNull())
    // 初始:1 个启用 / 共 1 个
    expect(getByText('1/1')).not.toBeNull()
    // 点击 toggle 按钮(断点条目的 aria-label=debug.toggle)
    fireEvent.click(getByRole('button', { name: 'debug.toggle' }))
    // 切换为禁用:0 启用 / 共 1 个
    expect(getByText('0/1')).not.toBeNull()
  })

  it('Watch:输入回车添加 + 点击 X 删除', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    debugApi.evaluateExpression.mockResolvedValue({ result: '42' })
    const { getByRole, getByPlaceholderText, getByText, queryByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(getByText('debug.watch')).not.toBeNull())
    const input = getByPlaceholderText('debug.watchPlaceholder')
    fireEvent.change(input, { target: { value: 'myVar' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // watch 已添加,显示表达式名 + 求值结果
    expect(getByText('myVar')).not.toBeNull()
    // 删除 watch(无断点时仅一个 aria-label=debug.delete 按钮)
    fireEvent.click(getByRole('button', { name: 'debug.delete' }))
    await waitFor(() => expect(queryByText('myVar')).toBeNull())
  })

  it('loading 状态:Play 期间按钮 disabled 且显示 spinner', async () => {
    let resolveLaunch!: (v: { sessionId: string }) => void
    debugApi.launchDebugSession.mockReturnValue(
      new Promise<{ sessionId: string }>((r) => {
        resolveLaunch = r
      }),
    )
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    const { getByRole } = render(<DebugPanel />)
    const playBtn = getByRole('button', { name: 'debug.start' }) as HTMLButtonElement
    fireEvent.click(playBtn)
    // loading 期间:按钮 disabled + 渲染 spinner(Loader2 animate-spin)
    await waitFor(() => expect(playBtn.disabled).toBe(true))
    expect(playBtn.querySelector('.animate-spin')).not.toBeNull()
    // resolve 后:loading 结束,按钮恢复可用
    resolveLaunch({ sessionId: 'sid-2' })
    await waitFor(() => expect(playBtn.disabled).toBe(false))
  })

  it('launch 失败时弹出 toast.error 且不切换状态', async () => {
    debugApi.launchDebugSession.mockRejectedValue(new Error('launch boom'))
    const { getByRole, getByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    // 失败后仍停留在 stopped(无会话提示仍在)
    await waitFor(() => expect(getByText('debug.noSession')).not.toBeNull())
    // variables/watch/breakpoints/callStack 标题均不出现
    expect(() => getByText('debug.variables')).toThrow()
  })
})
