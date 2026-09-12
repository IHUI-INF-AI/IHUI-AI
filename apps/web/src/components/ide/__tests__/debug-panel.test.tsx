// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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

// @/lib/api/debug 全部 API mock(含 store 懒加载用的 getScopes/getVariablesByReference)
const debugApi = vi.hoisted(() => ({
  launchDebugSession: vi.fn(),
  setBreakpoints: vi.fn(),
  continueExecution: vi.fn(),
  stepExecution: vi.fn(),
  getStackTrace: vi.fn(),
  getScopes: vi.fn(),
  getVariablesByReference: vi.fn(),
  evaluateExpression: vi.fn(),
  disconnectSession: vi.fn(),
}))
vi.mock('@/lib/api/debug', () => debugApi)

// toast:面板从 @/components/common 导入(Toaster.tsx 事件桥接实现),直接 mock 该模块
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('@/components/common', () => ({ toast: toastMock }))

import { DebugPanel } from '../debug-panel'
import { useDebugStore } from '@/stores/debug'

/** 重置 zustand 单例 store(模块加载时已读 localStorage,测试中须显式重置) */
function resetDebugStore() {
  useDebugStore.setState({
    debugState: 'stopped',
    sessionId: null,
    loading: false,
    stackFrames: [],
    currentFrameId: null,
    scopes: [],
    scopeExpanded: {},
    variablesByRef: {},
    expandedRefs: {},
    loadingRefs: {},
    watches: [],
    watchValues: {},
    consoleLogs: [],
    breakpoints: [],
  })
}

describe('DebugPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    mockStore.state = {
      activeView: 'debug',
      openTabs: [],
      activeTabId: null,
      workspacePath: '/test/ws',
    }
    resetDebugStore()
    Object.values(debugApi).forEach((fn) => fn.mockReset())
    // 默认无 scope;各用例按需覆写
    debugApi.getScopes.mockResolvedValue({ scopes: [] })
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
    // store 为单例,直接注入断点(store 在模块加载时读 localStorage,测试内 setItem 不会生效)
    useDebugStore.setState({
      breakpoints: [{ id: 'bp-1', file: 'src/app.ts', line: 10, enabled: true }],
    })
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

  it('断点 toggle 持久化写入 ide:breakpoints localStorage', async () => {
    useDebugStore.setState({
      breakpoints: [{ id: 'bp-1', file: 'src/app.ts', line: 10, enabled: true }],
    })
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    const { getByRole, getByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(getByText('debug.breakpoints')).not.toBeNull())
    fireEvent.click(getByRole('button', { name: 'debug.toggle' }))
    const saved = JSON.parse(localStorage.getItem('ide:breakpoints') ?? '[]')
    expect(saved).toEqual([{ id: 'bp-1', file: 'src/app.ts', line: 10, enabled: false }])
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
    await waitFor(() => expect(getByText('42')).not.toBeNull())
    // 删除 watch(无断点时仅一个 aria-label=debug.delete 按钮)
    fireEvent.click(getByRole('button', { name: 'debug.delete' }))
    await waitFor(() => expect(queryByText('myVar')).toBeNull())
  })

  it('Watch 去重:重复添加同一表达式弹 toast.error 且不重复渲染', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    debugApi.evaluateExpression.mockResolvedValue({ result: '—' })
    const { getByRole, getByPlaceholderText, getByText, getAllByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() => expect(getByText('debug.watch')).not.toBeNull())
    const input = getByPlaceholderText('debug.watchPlaceholder')
    fireEvent.change(input, { target: { value: 'dup' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(getByText('dup')).not.toBeNull()
    // 再次输入同一表达式
    fireEvent.change(input, { target: { value: 'dup' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('debug.watchDuplicate'))
    // 仍只有一条
    expect(getAllByText('dup')).toHaveLength(1)
  })

  it('暂停后按 Scopes 分组渲染变量:Locals 展开(expensive 组不拉取),子树懒加载', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({
      stopped: { reason: 'breakpoint', threadId: 1 },
    })
    debugApi.getStackTrace.mockResolvedValue({
      stackFrames: [{ id: 7, name: 'main', line: 10, column: 1, source: { name: 'app.ts' } }],
    })
    debugApi.getScopes.mockResolvedValue({
      scopes: [
        { name: 'Locals', variablesReference: 1000, expensive: false },
        { name: 'Globals', variablesReference: 2000, expensive: true },
      ],
    })
    debugApi.getVariablesByReference.mockImplementation(async (_sid: string, ref: number) =>
      ref === 1000
        ? {
            variables: [
              { name: 'x', value: '1', type: 'number', variablesReference: 0 },
              { name: 'obj', value: '{…}', type: 'object', variablesReference: 3000 },
            ],
          }
        : ref === 3000
          ? {
              variables: [{ name: 'y', value: '2', type: 'number', variablesReference: 0 }],
            }
          : { variables: [] },
    )
    const { getByRole, getByText, getByTestId, queryByTestId } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    // paused + 调用栈 + Locals 顶层变量渲染
    await waitFor(() => expect(getByText('debug.statePaused')).not.toBeNull())
    await waitFor(() => expect(getByTestId('debug-scope-Locals')).not.toBeNull())
    await waitFor(() => expect(getByTestId('debug-variable-x')).not.toBeNull())
    expect(getByTestId('debug-variable-obj')).not.toBeNull()
    // expensive 组(Globals)不主动拉取:其变量不应出现
    expect(queryByTestId('debug-variable-g')).toBeNull()
    expect(debugApi.getVariablesByReference).not.toHaveBeenCalledWith('sid-1', 2000)
    // 子树懒加载:展开 obj 前未请求 3000
    expect(debugApi.getVariablesByReference).not.toHaveBeenCalledWith('sid-1', 3000)
    fireEvent.click(
      getByTestId('debug-variable-obj').querySelector('button[aria-label="expand obj"]')!,
    )
    await waitFor(() => expect(getByTestId('debug-variable-y')).not.toBeNull())
    expect(debugApi.getVariablesByReference).toHaveBeenCalledWith('sid-1', 3000)
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
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('debug.launchFailed'))
    // variables/watch/breakpoints/callStack 标题均不出现
    expect(() => getByText('debug.variables')).toThrow()
  })

  it('断点生命周期:会话中删除断点后发送空 lines 清除后端断点(DAP 全量替换)', async () => {
    useDebugStore.setState({
      breakpoints: [{ id: 'bp-1', file: 'src/app.ts', line: 10, enabled: true }],
    })
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    debugApi.setBreakpoints.mockResolvedValue({ breakpoints: [] })
    const { getByRole, getAllByRole } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    // 启动后断点同步到后端
    await waitFor(() =>
      expect(debugApi.setBreakpoints).toHaveBeenCalledWith('sid-1', {
        file: 'src/app.ts',
        lines: [{ line: 10 }],
      }),
    )
    // 会话中删除断点 → 后端收到空 lines(否则 adapter 仍会命中已删除断点)
    const deleteBtn = getAllByRole('button', { name: 'debug.delete' })[0]
    if (!deleteBtn) throw new Error('delete button not found')
    fireEvent.click(deleteBtn)
    await waitFor(() =>
      expect(debugApi.setBreakpoints).toHaveBeenLastCalledWith('sid-1', {
        file: 'src/app.ts',
        lines: [],
      }),
    )
  })

  it('断点生命周期:禁用断点后同步的 lines 不含该断点', async () => {
    useDebugStore.setState({
      breakpoints: [
        { id: 'bp-1', file: 'src/app.ts', line: 10, enabled: true },
        { id: 'bp-2', file: 'src/app.ts', line: 20, enabled: true },
      ],
    })
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({ stopped: null })
    debugApi.setBreakpoints.mockResolvedValue({ breakpoints: [] })
    const { getByRole, getByText, getAllByRole } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    await waitFor(() =>
      expect(debugApi.setBreakpoints).toHaveBeenCalledWith('sid-1', {
        file: 'src/app.ts',
        lines: [{ line: 10 }, { line: 20 }],
      }),
    )
    // 禁用 bp-1 → 重新同步,lines 仅剩 20(两个断点各有一个 toggle 按钮,取第一个)
    const toggleBtn = getAllByRole('button', { name: 'debug.toggle' })[0]
    if (!toggleBtn) throw new Error('toggle button not found')
    fireEvent.click(toggleBtn)
    await waitFor(() =>
      expect(debugApi.setBreakpoints).toHaveBeenLastCalledWith('sid-1', {
        file: 'src/app.ts',
        lines: [{ line: 20 }],
      }),
    )
    expect(getByText('1/2')).not.toBeNull()
  })

  it('stopped reason=timeout:程序仍在运行,状态保持 running 且不拉取调用栈', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({
      stopped: { reason: 'timeout', threadId: 1 },
    })
    const { getByRole, getByText, queryByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    // 超时非暂停:状态应为 running 而非 paused
    await waitFor(() => expect(getByText('debug.stateRunning')).not.toBeNull())
    expect(queryByText('debug.statePaused')).toBeNull()
    expect(debugApi.getStackTrace).not.toHaveBeenCalled()
  })

  it('stopped reason=terminated:会话结束回到 stopped 并清空 sessionId', async () => {
    debugApi.launchDebugSession.mockResolvedValue({ sessionId: 'sid-1' })
    debugApi.continueExecution.mockResolvedValue({
      stopped: { reason: 'terminated', threadId: 1 },
    })
    const { getByRole, getByText } = render(<DebugPanel />)
    fireEvent.click(getByRole('button', { name: 'debug.start' }))
    // 程序结束:回到 stopped 态,sessionId 清空,不拉取调用栈
    await waitFor(() => expect(getByText('debug.stateStopped')).not.toBeNull())
    await waitFor(() => expect(useDebugStore.getState().sessionId).toBeNull())
    expect(debugApi.getStackTrace).not.toHaveBeenCalled()
    // console 记录 terminated
    const logs = useDebugStore.getState().consoleLogs
    expect(logs.some((l) => l.text.includes('terminated'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
