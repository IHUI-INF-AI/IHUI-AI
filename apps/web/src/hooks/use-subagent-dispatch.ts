/**
 * Subagent 派单 react-query hooks(2026-07-22 立)。
 *
 * 职责:
 *  - useActiveDispatches:轮询活跃派单列表(5s 间隔,自动停止当无活跃)
 *  - useSwarmTopology:轮询拓扑(5s 间隔)
 *  - useCreateDispatch:创建派单 mutation
 *  - useCancelDispatch:取消派单 mutation
 *
 * 设计:
 *  - 与 useSubagentDispatchStore 互补:hooks 负责数据获取 + 缓存,
 *    store 负责跨组件同步状态(Dialog 提交 → TopologyView 立即看到新节点)
 *  - 轮询间隔 5s(平衡实时性 + 服务器压力)
 *  - 拓扑/活跃列表失败时静默降级(不弹 toast,避免 501 噪音)
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { useSubagentDispatchStore } from '@/stores/subagent-dispatch'
import type {
  SubagentDispatch,
  DispatchInput,
  SwarmTopology,
} from '@ihui/types/subagent-dispatch'

const POLL_INTERVAL_MS = 5_000

/** 活跃派单列表 query key */
export const activeDispatchesKey = ['subagent-dispatch', 'active'] as const
/** Swarm 拓扑 query key */
export const swarmTopologyKey = ['subagent-dispatch', 'topology'] as const

/** 拉取活跃派单列表 */
async function fetchActiveDispatches(): Promise<SubagentDispatch[]> {
  const r = await fetchApi<{ dispatches: SubagentDispatch[] }>(
    '/api/subagents/active',
  )
  if (!r.success) return []
  return r.data?.dispatches ?? []
}

/** 拉取 Swarm 拓扑 */
async function fetchSwarmTopology(): Promise<SwarmTopology> {
  const r = await fetchApi<{ topology: SwarmTopology }>(
    '/api/subagents/topology',
  )
  if (!r.success) return { nodes: [], edges: [] }
  return r.data?.topology ?? { nodes: [], edges: [] }
}

/** 活跃派单列表(5s 轮询,失败静默降级) */
export function useActiveDispatches() {
  return useQuery({
    queryKey: activeDispatchesKey,
    queryFn: fetchActiveDispatches,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

/** Swarm 拓扑(5s 轮询,失败静默降级) */
export function useSwarmTopology() {
  return useQuery({
    queryKey: swarmTopologyKey,
    queryFn: fetchSwarmTopology,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

/** 创建派单 mutation(同时更新 store) */
export function useCreateDispatch() {
  const queryClient = useQueryClient()
  const createInStore = useSubagentDispatchStore((s) => s.createDispatch)

  return useMutation({
    mutationFn: async (input: DispatchInput) => createInStore(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activeDispatchesKey })
      void queryClient.invalidateQueries({ queryKey: swarmTopologyKey })
    },
  })
}

/** 取消派单 mutation */
export function useCancelDispatch() {
  const queryClient = useQueryClient()
  const cancelInStore = useSubagentDispatchStore((s) => s.cancelDispatch)

  return useMutation({
    mutationFn: async (id: string) => cancelInStore(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activeDispatchesKey })
      void queryClient.invalidateQueries({ queryKey: swarmTopologyKey })
    },
  })
}
