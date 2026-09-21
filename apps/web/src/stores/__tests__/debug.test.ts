// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const debugApi = vi.hoisted(() => ({
  getScopes: vi.fn(),
  getVariablesByReference: vi.fn(),
}))
vi.mock('@/lib/api/debug', () => debugApi)

import { useDebugStore, type Breakpoint } from '@/stores/debug'

const LOCALS = { name: 'Locals', variablesReference: 1000, expensive: false }
const GLOBALS = { name: 'Globals', variablesReference: 2000, expensive: true }

function resetStore() {
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

describe('debug store(1-7b:Scopes 分组 + 懒加载 + 持久化)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
    debugApi.getScopes.mockReset()
    debugApi.getVariablesByReference.mockReset()
  })

  describe('loadScopes', () => {
    it('设置 scopes,仅拉取非 expensive 组并缓存变量', async () => {
      debugApi.getScopes.mockResolvedValue({ scopes: [LOCALS, GLOBALS] })
      debugApi.getVariablesByReference.mockResolvedValue({
        variables: [{ name: 'x', value: '1', type: 'number', variablesReference: 0 }],
      })
      await useDebugStore.getState().loadScopes('sid-1', 7)
      const s = useDebugStore.getState()
      expect(s.scopes).toEqual([LOCALS, GLOBALS])
      // 仅 Locals(非 expensive)被拉取
      expect(debugApi.getVariablesByReference).toHaveBeenCalledTimes(1)
      expect(debugApi.getVariablesByReference).toHaveBeenCalledWith('sid-1', 1000)
      expect(s.variablesByRef[1000]).toEqual([
        { name: 'x', value: '1', type: 'number', variablesReference: 0 },
      ])
      expect(s.scopeExpanded).toEqual({ Locals: true })
      // expensive 组未展开、未缓存
      expect(s.scopeExpanded.Globals).toBeUndefined()
      expect(s.variablesByRef[2000]).toBeUndefined()
    })

    it('重复调用时重置旧 scope 状态(切帧场景)', async () => {
      debugApi.getScopes.mockResolvedValue({ scopes: [LOCALS] })
      debugApi.getVariablesByReference.mockResolvedValue({ variables: [] })
      await useDebugStore.getState().loadScopes('sid-1', 7)
      expect(useDebugStore.getState().variablesByRef[1000]).toEqual([])
      // 切到另一帧:scopes 返回空,旧缓存被清空
      debugApi.getScopes.mockResolvedValue({ scopes: [] })
      await useDebugStore.getState().loadScopes('sid-1', 8)
      const s = useDebugStore.getState()
      expect(s.scopes).toEqual([])
      expect(s.variablesByRef).toEqual({})
      expect(s.scopeExpanded).toEqual({})
    })
  })

  describe('toggleVariable(子树懒加载)', () => {
    it('首次展开拉取子变量并缓存;收起再展开不重复请求', async () => {
      debugApi.getVariablesByReference.mockResolvedValue({
        variables: [{ name: 'y', value: '2', type: 'number', variablesReference: 0 }],
      })
      const store = useDebugStore.getState()
      await store.toggleVariable('sid-1', 3000)
      expect(debugApi.getVariablesByReference).toHaveBeenCalledTimes(1)
      expect(useDebugStore.getState().expandedRefs[3000]).toBe(true)
      expect(useDebugStore.getState().variablesByRef[3000]![0]!.name).toBe('y')
      // 收起
      await useDebugStore.getState().toggleVariable('sid-1', 3000)
      expect(useDebugStore.getState().expandedRefs[3000]).toBe(false)
      // 再次展开:命中缓存,无新请求
      await useDebugStore.getState().toggleVariable('sid-1', 3000)
      expect(debugApi.getVariablesByReference).toHaveBeenCalledTimes(1)
      expect(useDebugStore.getState().expandedRefs[3000]).toBe(true)
    })

    it('ref<=0 直接返回不请求', async () => {
      await useDebugStore.getState().toggleVariable('sid-1', 0)
      expect(debugApi.getVariablesByReference).not.toHaveBeenCalled()
    })

    it('拉取失败时回滚展开状态并记录错误日志', async () => {
      debugApi.getVariablesByReference.mockRejectedValue(new Error('boom'))
      await useDebugStore.getState().toggleVariable('sid-1', 3000)
      const s = useDebugStore.getState()
      expect(s.expandedRefs[3000]).toBe(false)
      expect(s.loadingRefs[3000]).toBe(false)
      expect(s.consoleLogs.some((l) => l.level === 'error' && l.text.includes('boom'))).toBe(true)
    })
  })

  describe('toggleScope(expensive 组手动展开)', () => {
    it('首次展开拉取变量;再次收起;已缓存时不重复请求', async () => {
      debugApi.getVariablesByReference.mockResolvedValue({
        variables: [{ name: 'g', value: '9', type: 'number' }],
      })
      await useDebugStore.getState().toggleScope('sid-1', GLOBALS)
      expect(debugApi.getVariablesByReference).toHaveBeenCalledWith('sid-1', 2000)
      expect(useDebugStore.getState().scopeExpanded.Globals).toBe(true)
      // 收起
      await useDebugStore.getState().toggleScope('sid-1', GLOBALS)
      expect(useDebugStore.getState().scopeExpanded.Globals).toBe(false)
      // 再展开:已缓存,无新请求
      await useDebugStore.getState().toggleScope('sid-1', GLOBALS)
      expect(debugApi.getVariablesByReference).toHaveBeenCalledTimes(1)
    })

    it('variablesReference<=0 的组只切换展开不请求', async () => {
      await useDebugStore.getState().toggleScope('sid-1', { name: 'Empty', variablesReference: 0 })
      expect(useDebugStore.getState().scopeExpanded.Empty).toBe(true)
      expect(debugApi.getVariablesByReference).not.toHaveBeenCalled()
    })
  })

  describe('断点/监视持久化', () => {
    it('toggleBreakpoint 切换启用并写入 localStorage', () => {
      const bp: Breakpoint = { id: 'bp-1', file: 'a.ts', line: 3, enabled: true }
      useDebugStore.setState({ breakpoints: [bp] })
      useDebugStore.getState().toggleBreakpoint('bp-1')
      expect(useDebugStore.getState().breakpoints[0]!.enabled).toBe(false)
      expect(JSON.parse(localStorage.getItem('ide:breakpoints') ?? '[]')).toEqual([
        { ...bp, enabled: false },
      ])
    })

    it('removeBreakpoint 删除并持久化', () => {
      useDebugStore.setState({
        breakpoints: [{ id: 'bp-1', file: 'a.ts', line: 3, enabled: true }],
      })
      useDebugStore.getState().removeBreakpoint('bp-1')
      expect(useDebugStore.getState().breakpoints).toEqual([])
      expect(JSON.parse(localStorage.getItem('ide:breakpoints') ?? '[]')).toEqual([])
    })

    it('toggleBreakpointAt 新增断点(id 为 file:line)并持久化', () => {
      useDebugStore.getState().toggleBreakpointAt('src/a.ts', 5)
      expect(useDebugStore.getState().breakpoints).toEqual([
        { id: 'src/a.ts:5', file: 'src/a.ts', line: 5, enabled: true },
      ])
      expect(JSON.parse(localStorage.getItem('ide:breakpoints') ?? '[]')).toEqual([
        { id: 'src/a.ts:5', file: 'src/a.ts', line: 5, enabled: true },
      ])
    })

    it('toggleBreakpointAt 同 file+line 再点一次移除,跨文件断点不受影响', () => {
      useDebugStore.setState({
        breakpoints: [
          { id: 'src/a.ts:5', file: 'src/a.ts', line: 5, enabled: true },
          { id: 'src/b.ts:9', file: 'src/b.ts', line: 9, enabled: true },
        ],
      })
      useDebugStore.getState().toggleBreakpointAt('src/a.ts', 5)
      expect(useDebugStore.getState().breakpoints).toEqual([
        { id: 'src/b.ts:9', file: 'src/b.ts', line: 9, enabled: true },
      ])
      expect(JSON.parse(localStorage.getItem('ide:breakpoints') ?? '[]')).toEqual([
        { id: 'src/b.ts:9', file: 'src/b.ts', line: 9, enabled: true },
      ])
    })

    it('addWatch 去重:重复表达式返回 false 且不写入', () => {
      const store = useDebugStore.getState()
      expect(store.addWatch('myVar')).toBe(true)
      expect(store.addWatch('myVar')).toBe(false)
      expect(useDebugStore.getState().watches).toEqual(['myVar'])
      expect(JSON.parse(localStorage.getItem('ide:watches') ?? '[]')).toEqual(['myVar'])
    })

    it('addWatch 空白表达式返回 false', () => {
      expect(useDebugStore.getState().addWatch('   ')).toBe(false)
      expect(useDebugStore.getState().watches).toEqual([])
    })

    it('removeWatch 删除对应下标并重排 watchValues', () => {
      useDebugStore.setState({
        watches: ['a', 'b', 'c'],
        watchValues: { 0: '1', 1: '2', 2: '3' },
      })
      useDebugStore.getState().removeWatch(1)
      expect(useDebugStore.getState().watches).toEqual(['a', 'c'])
      expect(JSON.parse(localStorage.getItem('ide:watches') ?? '[]')).toEqual(['a', 'c'])
    })
  })

  describe('运行时状态', () => {
    it('setStackFrames 默认选中第一帧', () => {
      useDebugStore.getState().setStackFrames([
        { id: 3, name: 'inner', line: 5, column: 1 },
        { id: 1, name: 'main', line: 10, column: 1 },
      ])
      expect(useDebugStore.getState().currentFrameId).toBe(3)
    })

    it('clearRuntime 清空调用栈/scope/变量/watch 值', () => {
      useDebugStore.setState({
        stackFrames: [{ id: 3, name: 'f', line: 1, column: 1 }],
        currentFrameId: 3,
        scopes: [LOCALS],
        scopeExpanded: { Locals: true },
        variablesByRef: { 1000: [] },
        expandedRefs: { 1000: true },
        watchValues: { 0: '1' },
      })
      useDebugStore.getState().clearRuntime()
      const s = useDebugStore.getState()
      expect(s.stackFrames).toEqual([])
      expect(s.currentFrameId).toBeNull()
      expect(s.scopes).toEqual([])
      expect(s.variablesByRef).toEqual({})
      expect(s.watchValues).toEqual({})
    })

    it('appendLog 上限 200 条(保留最新)', () => {
      for (let i = 0; i < 205; i++) {
        useDebugStore.getState().appendLog({ level: 'log', text: `l${i}` })
      }
      const logs = useDebugStore.getState().consoleLogs
      expect(logs).toHaveLength(200)
      expect(logs[0]!.text).toBe('l5')
      expect(logs[199]!.text).toBe('l204')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
