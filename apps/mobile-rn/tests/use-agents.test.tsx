/**
 * useAgents 跨端共享 hook 集成测试
 *
 * 验证 @ihui/shared/hooks/useAgents 在 mobile-rn 端消费的真实可用性,
 * 覆盖列表加载、选中态、错误处理、本地查找、setAgents 等场景。
 *
 * 覆盖场景(14 个):
 * 1.  挂载后 autoLoad=true 自动拉取,agents 填充,loading 从 true→false
 * 2.  autoLoad=false 时不自动拉取,agents 为空
 * 3.  load() 成功:agents 填充,列表内容正确(对应 total 正确)
 * 4.  load() 失败:error 填充,agents 保持空
 * 5.  refresh() 等价于 load()(同样填充 agents)
 * 6.  selectById 本地有:currentAgent 设置,不调 fetchDetail
 * 7.  selectById 本地无 + 有 fetchDetail:调 fetchDetail,currentAgent 设置
 * 8.  selectById 本地无 + 无 fetchDetail:error 设置
 * 9.  selectById 本地无 + fetchDetail 失败:error 填充
 * 10. clearSelection:currentAgent 清空
 * 11. findById:返回本地 agent 或 undefined
 * 12. setAgents:手动设置 agents(供 createAgent 后本地更新)
 * 13. loading 状态在 load 期间为 true,完成后为 false
 * 14. fetchList 返回空 list:agents 为空数组(不是 null)
 *
 * 测试策略:
 * - 用 vi.fn() mock fetchList / fetchDetail,不依赖真实网络
 * - 用 renderHook + act + waitFor 模拟 React 组件生命周期
 * - 用受控 Promise(deferred)验证 loading 中间态
 * - mock agent 类型用 TestAgent extends Agent { uses?: number; isVipExclusive?: boolean }
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgents } from '@ihui/shared/hooks'
import type { Agent, AgentListResponse } from '@ihui/shared/hooks'

// 测试用 mock agent 类型(扩展 Agent,模拟各端自定义字段)
interface TestAgent extends Agent {
  uses?: number
  isVipExclusive?: boolean
}

// 构造 mock agent 列表工厂
function makeAgents(count: number): TestAgent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a-${i + 1}`,
    name: `Agent ${i + 1}`,
    avatar: `https://example.com/${i + 1}.png`,
    description: `desc ${i + 1}`,
    systemPrompt: `prompt ${i + 1}`,
    uses: i * 10,
    isVipExclusive: i % 2 === 0,
  }))
}

// 构造标准列表响应(对齐后端 GET /api/agents/list)
function makeListResponse(agents: TestAgent[]): AgentListResponse<TestAgent> {
  return {
    list: agents,
    total: agents.length,
    page: 1,
    pageSize: 20,
  }
}

describe('useAgents 跨端共享 hook — 集成测试', () => {
  let fetchList: ReturnType<typeof vi.fn>
  let fetchDetail: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchList = vi.fn()
    fetchDetail = vi.fn()
  })

  // 场景 1:挂载后 autoLoad=true 自动拉取,agents 填充,loading 从 true→false
  it('autoLoad=true 时挂载后自动拉取,agents 填充,loading 最终为 false', async () => {
    const agents = makeAgents(2)
    fetchList.mockResolvedValue(makeListResponse(agents))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail }),
    )

    // autoLoad 默认 true,挂载后应自动拉取
    await waitFor(() => expect(result.current.agents).toHaveLength(2))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchList).toHaveBeenCalledTimes(1)
    expect(result.current.agents).toEqual(agents)
  })

  // 场景 2:autoLoad=false 时不自动拉取,agents 为空
  it('autoLoad=false 时不自动拉取,agents 为空,loading 为 false', async () => {
    fetchList.mockResolvedValue(makeListResponse(makeAgents(3)))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: false }),
    )

    // 让一拍确保 useEffect 已执行(不应触发 load)
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchList).not.toHaveBeenCalled()
    expect(result.current.agents).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.currentAgent).toBeNull()
  })

  // 场景 3:load() 成功:agents 填充,列表内容正确
  it('load() 成功后 agents 填充,内容与 fetchList 返回一致', async () => {
    const agents = makeAgents(3)
    fetchList.mockResolvedValue(makeListResponse(agents))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: false }),
    )

    await act(async () => {
      await result.current.load()
    })

    expect(result.current.agents).toHaveLength(3)
    expect(result.current.agents).toEqual(agents)
    // hook 未暴露 total,通过 agents.length === list.length 间接验证 total 正确
    expect(result.current.agents.length).toBe(3)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  // 场景 4:load() 失败:error 填充,agents 保持空
  it('load() 失败时 error 填充,agents 保持空', async () => {
    fetchList.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: false }),
    )

    await act(async () => {
      await result.current.load()
    })

    expect(result.current.error).toBe('network down')
    expect(result.current.agents).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  // 场景 5:refresh() 等价于 load()
  it('refresh() 等价于 load(),同样填充 agents', async () => {
    const agents = makeAgents(2)
    fetchList.mockResolvedValue(makeListResponse(agents))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: false }),
    )

    await act(async () => {
      await result.current.refresh()
    })

    expect(fetchList).toHaveBeenCalledTimes(1)
    expect(result.current.agents).toEqual(agents)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // 场景 6:selectById 本地有:currentAgent 设置,不调 fetchDetail
  it('selectById 本地命中时设置 currentAgent,不调 fetchDetail', async () => {
    const agents = makeAgents(2)
    fetchList.mockResolvedValue(makeListResponse(agents))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(2))

    await act(async () => {
      await result.current.selectById('a-2')
    })

    expect(result.current.currentAgent).toEqual(agents[1])
    expect(fetchDetail).not.toHaveBeenCalled()
    // 本地命中不触发 loading
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // 场景 7:selectById 本地无 + 有 fetchDetail:调 fetchDetail,currentAgent 设置
  it('selectById 本地无 + 有 fetchDetail 时调 fetchDetail 并设置 currentAgent', async () => {
    const agents = makeAgents(1)
    fetchList.mockResolvedValue(makeListResponse(agents))
    const remoteAgent: TestAgent = {
      id: 'remote-1',
      name: 'Remote Agent',
      uses: 99,
      isVipExclusive: true,
    }
    fetchDetail.mockResolvedValue(remoteAgent)

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.selectById('remote-1')
    })

    expect(fetchDetail).toHaveBeenCalledTimes(1)
    expect(fetchDetail).toHaveBeenCalledWith('remote-1')
    expect(result.current.currentAgent).toEqual(remoteAgent)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // 场景 8:selectById 本地无 + 无 fetchDetail:error 设置
  it('selectById 本地无且未提供 fetchDetail 时设置 error', async () => {
    const agents = makeAgents(1)
    fetchList.mockResolvedValue(makeListResponse(agents))

    // 不传 fetchDetail
    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.selectById('not-exist')
    })

    expect(result.current.error).toContain('not-exist')
    expect(result.current.error).toContain('no fetchDetail provided')
    expect(result.current.currentAgent).toBeNull()
  })

  // 场景 9:selectById 本地无 + fetchDetail 失败:error 填充
  it('selectById 本地无 + fetchDetail 失败时 error 填充,currentAgent 保持空', async () => {
    const agents = makeAgents(1)
    fetchList.mockResolvedValue(makeListResponse(agents))
    fetchDetail.mockRejectedValue(new Error('detail fetch failed'))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.selectById('missing-1')
    })

    expect(fetchDetail).toHaveBeenCalledTimes(1)
    expect(fetchDetail).toHaveBeenCalledWith('missing-1')
    expect(result.current.error).toBe('detail fetch failed')
    expect(result.current.currentAgent).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  // 场景 10:clearSelection:currentAgent 清空
  it('clearSelection 清空 currentAgent', async () => {
    const agents = makeAgents(2)
    fetchList.mockResolvedValue(makeListResponse(agents))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(2))

    // 先选中
    await act(async () => {
      await result.current.selectById('a-1')
    })
    expect(result.current.currentAgent).not.toBeNull()

    // 再清空
    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.currentAgent).toBeNull()
  })

  // 场景 11:findById:返回本地 agent 或 undefined
  it('findById 返回本地 agent 或 undefined', async () => {
    const agents = makeAgents(3)
    fetchList.mockResolvedValue(makeListResponse(agents))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(3))

    expect(result.current.findById('a-2')).toEqual(agents[1])
    expect(result.current.findById('a-3')).toEqual(agents[2])
    expect(result.current.findById('not-exist')).toBeUndefined()
  })

  // 场景 12:setAgents:手动设置 agents(供 createAgent 后本地更新)
  it('setAgents 手动设置 agents(模拟 createAgent 后本地追加)', async () => {
    fetchList.mockResolvedValue(makeListResponse(makeAgents(2)))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.agents).toHaveLength(2))

    const newAgent: TestAgent = {
      id: 'a-new',
      name: 'New Agent',
      uses: 0,
      isVipExclusive: false,
    }

    // 模拟 createAgent 后本地追加(函数式更新)
    act(() => {
      result.current.setAgents((prev) => [...prev, newAgent])
    })

    expect(result.current.agents).toHaveLength(3)
    expect(result.current.agents[2]).toEqual(newAgent)
    // findById 能查到新增的
    expect(result.current.findById('a-new')).toEqual(newAgent)
  })

  // 场景 13:loading 状态在 load 期间为 true,完成后为 false
  it('loading 在 load 期间为 true,完成后为 false', async () => {
    // 用受控 Promise 冻结 load,验证中间态 loading=true
    let resolveLoad: (val: AgentListResponse<TestAgent>) => void = () => {}
    const pending = new Promise<AgentListResponse<TestAgent>>((resolve) => {
      resolveLoad = resolve
    })
    fetchList.mockReturnValue(pending)

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: false }),
    )

    // 触发 load(不 await,保持 pending),同步部分 setLoading(true) 被 act flush
    let loadPromise: Promise<void> = Promise.resolve()
    act(() => {
      loadPromise = result.current.load()
    })

    // load 期间 loading 应为 true
    expect(result.current.loading).toBe(true)
    expect(result.current.agents).toEqual([])

    // resolve 后 loading 变 false,agents 填充
    await act(async () => {
      resolveLoad(makeListResponse(makeAgents(2)))
      await loadPromise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.agents).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  // 场景 14:fetchList 返回空 list:agents 为空数组(不是 null)
  it('fetchList 返回空 list 时 agents 为空数组(不是 null/undefined)', async () => {
    fetchList.mockResolvedValue(makeListResponse([]))

    const { result } = renderHook(() =>
      useAgents<TestAgent>({ fetchList, fetchDetail, autoLoad: true }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(Array.isArray(result.current.agents)).toBe(true)
    expect(result.current.agents).toEqual([])
    expect(result.current.agents.length).toBe(0)
    expect(result.current.error).toBeNull()
  })
})
