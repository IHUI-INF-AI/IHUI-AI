/**
 * Subagent 派单 zustand store(2026-07-22 立)。
 *
 * 职责:
 *  - 维护 dispatches[] + activeDispatchId + topology 状态
 *  - 提供 createDispatch / cancelDispatch / refreshTopology actions
 *  - 通过 fetchApi 调 /api/subagents/* 路由
 *
 * 设计:
 *  - 组件优先用 use-subagent-dispatch.ts 的 react-query hooks(自动重试 + 缓存)
 *  - 本 store 用于跨组件共享状态(如 DispatchSubagentDialog 提交后,
 *    SwarmTopologyView 需要立即看到新节点)
 *  - 所有 actions 返回 { ok: boolean; error?: string } 便于调用方 toast
 */

import { create } from 'zustand'
import { fetchApi } from '@/lib/api'
import type { SubagentDispatch, DispatchInput, SwarmTopologyV2 } from '@ihui/shared/subagents'

interface SubagentDispatchState {
  /** 全部已派发列表(按 createdAt 倒序,最新在前) */
  dispatches: SubagentDispatch[]
  /** 当前选中的 dispatch ID(用于详情查看 / 取消) */
  activeDispatchId: string | null
  /** Swarm 拓扑(节点 + 边) */
  topology: SwarmTopologyV2
  /** 派单提交中(防重复点击) */
  isCreating: boolean
  /** 拓扑刷新中 */
  isRefreshingTopology: boolean

  // Actions
  createDispatch: (input: DispatchInput) => Promise<{ ok: boolean; error?: string }>
  cancelDispatch: (id: string) => Promise<{ ok: boolean; error?: string }>
  refreshActive: () => Promise<void>
  refreshTopology: () => Promise<void>
  setActiveDispatchId: (id: string | null) => void
  reset: () => void
}

const EMPTY_TOPOLOGY: SwarmTopologyV2 = { nodes: [], edges: [] }

export const useSubagentDispatchStore = create<SubagentDispatchState>((set, get) => ({
  dispatches: [],
  activeDispatchId: null,
  topology: EMPTY_TOPOLOGY,
  isCreating: false,
  isRefreshingTopology: false,

  createDispatch: async (input) => {
    if (get().isCreating) return { ok: false, error: '派单提交中,请稍候' }
    set({ isCreating: true })
    try {
      const r = await fetchApi<{ dispatch: SubagentDispatch }>('/api/subagents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.success || !r.data?.dispatch) {
        return { ok: false, error: r.error || '派单失败' }
      }
      const dispatch = r.data.dispatch
      set((s) => ({
        dispatches: [dispatch, ...s.dispatches],
        activeDispatchId: dispatch.id,
      }))
      // 创建后立即刷新拓扑(让 SwarmTopologyView 看到新节点)
      void get().refreshTopology()
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    } finally {
      // 2026-08-21 修复(派单失败后永久卡死):原实现 isCreating: false 只在
      // 成功 set() 与 catch 两条路径复位,fetchApi 正常返回但 r.success === false
      // (服务端校验失败/业务错误)时提前 return,既不走成功 set 也不抛异常,
      // isCreating 永久为 true → 后续所有派单被"派单提交中,请稍候"拒绝,
      // 直到刷新页面。统一收敛到 finally 复位,任何路径都不会锁死。
      set({ isCreating: false })
    }
  },

  cancelDispatch: async (id) => {
    const r = await fetchApi<{ cancelled: boolean }>(
      `/api/subagents/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    )
    if (!r.success || !r.data?.cancelled) {
      return { ok: false, error: r.error || '取消失败' }
    }
    set((s) => ({
      dispatches: s.dispatches.map((d) =>
        d.id === id ? { ...d, status: 'cancelled' as const } : d,
      ),
    }))
    void get().refreshTopology()
    return { ok: true }
  },

  refreshActive: async () => {
    const r = await fetchApi<{ dispatches: SubagentDispatch[] }>('/api/subagents/active')
    if (r.success && r.data?.dispatches) {
      set({ dispatches: r.data.dispatches })
    }
  },

  refreshTopology: async () => {
    if (get().isRefreshingTopology) return
    set({ isRefreshingTopology: true })
    try {
      const r = await fetchApi<{ topology: SwarmTopologyV2 }>('/api/subagents/topology')
      if (r.success && r.data?.topology) {
        set({ topology: r.data.topology })
      }
    } finally {
      set({ isRefreshingTopology: false })
    }
  },

  setActiveDispatchId: (id) => set({ activeDispatchId: id }),

  reset: () =>
    set({
      dispatches: [],
      activeDispatchId: null,
      topology: EMPTY_TOPOLOGY,
      isCreating: false,
      isRefreshingTopology: false,
    }),
}))
