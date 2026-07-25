/**
 * useAgents — 跨端 Agent 列表管理业务 Hook
 *
 * 设计原则(参照 usePagination):
 * 1. 纯逻辑层:只管 agents 列表状态 + 选中态 + loading,不绑定具体 transport
 * 2. 依赖注入:fetchers 由各端注入(web 用 fetchApi / miniapp-taro 用 get<T> / mobile-rn + extension 用 @ihui/api-client)
 * 3. 零新依赖:纯 useState + useEffect + useCallback,不引入 react-query / swr / zustand
 * 4. 非破坏性:与各端现有 useAgent / useAgents 平行存在,可通过 re-export 桥接
 *
 * 各端接入示例:
 * ```ts
 * // mobile-rn
 * import { useAgents } from '@ihui/shared/hooks'
 * import { fetchAgentList, fetchAgentDetail } from '../api/agents'
 *
 * const { agents, currentAgent, loading, error, load, selectById, refresh } = useAgents({
 *   fetchList: fetchAgentList,
 *   fetchDetail: fetchAgentDetail,
 * })
 *
 * // web (桥接版,内部仍用 react-query,对外接口与本 hook 一致)
 * // miniapp-taro (用 Taro.request 封装的 get<T>)
 * ```
 *
 * 与 web 端现有 `apps/web/src/hooks/use-agent.ts` 的差异:
 * - web 版:createAgent 改造逻辑耦合,fetchApi 硬编码
 * - 本 hook:仅列表 + 选中态管理,createAgent 留给各端自实现(避免跨端 API 路径差异)
 */
import * as React from 'react'

/**
 * Agent 基础类型(各端可扩展自己的 Agent 接口)
 *
 * 字段对齐 web/miniapp-taro/mobile-rn 三端共有子集:
 * - id: string(各端统一为 string,miniapp-taro 原 number 由 adapter 转换)
 * - name / avatar / description: 三端共有
 * - systemPrompt: web/mobile-rn 有,miniapp-taro 用 prompt 字段(adapter 转换)
 */
export interface Agent {
  id: string
  name: string
  avatar?: string
  description?: string
  systemPrompt?: string
}

/**
 * 列表响应结构(对齐后端 GET /api/agents/list 返回)
 */
export interface AgentListResponse<T extends Agent = Agent> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * useAgents 配置项
 *
 * @template TAgent - Agent 扩展类型(各端可注入自己的 Agent 接口)
 */
export interface UseAgentsOptions<TAgent extends Agent = Agent> {
  /** 拉取列表(各端注入自己的 transport) */
  fetchList: () => Promise<AgentListResponse<TAgent>>
  /** 拉取单个详情(可选,用于 selectById) */
  fetchDetail?: (id: string) => Promise<TAgent>
  /** 是否挂载时自动拉取(默认 true) */
  autoLoad?: boolean
}

/**
 * useAgents 返回值
 */
export interface UseAgentsReturn<TAgent extends Agent = Agent> {
  /** Agent 列表 */
  agents: TAgent[]
  /** 当前选中的 Agent(selectById 设置) */
  currentAgent: TAgent | null
  /** 加载态(初次 load + refresh + selectById 都会触发) */
  loading: boolean
  /** 错误信息(load/refresh/selectById 失败时设置) */
  error: string | null
  /** 拉取列表(覆盖现有 agents) */
  load: () => Promise<void>
  /** 刷新(等价于 load,语义化命名) */
  refresh: () => Promise<void>
  /** 按 id 选中(先从本地 agents 查,无则调 fetchDetail) */
  selectById: (id: string) => Promise<void>
  /** 清空选中 */
  clearSelection: () => void
  /** 按 id 查找本地 agents(不触发网络) */
  findById: (id: string) => TAgent | undefined
  /** 手动设置 agents(供各端 createAgent/deleteAgent 后本地更新) */
  setAgents: React.Dispatch<React.SetStateAction<TAgent[]>>
}

/**
 * useAgents — Agent 列表管理业务 Hook
 *
 * @example
 * ```ts
 * const { agents, currentAgent, loading, selectById } = useAgents({
 *   fetchList: () => fetchApi('/api/agents/list'),
 *   fetchDetail: (id) => fetchApi(`/api/agents/${id}`),
 * })
 * ```
 */
export function useAgents<TAgent extends Agent = Agent>(
  options: UseAgentsOptions<TAgent>,
): UseAgentsReturn<TAgent> {
  const { fetchList, fetchDetail, autoLoad = true } = options

  const [agents, setAgents] = React.useState<TAgent[]>([])
  const [currentAgent, setCurrentAgent] = React.useState<TAgent | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchList()
      setAgents(res.list ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [fetchList])

  const refresh = React.useCallback(async () => {
    return load()
  }, [load])

  const findById = React.useCallback(
    (id: string) => agents.find((a) => a.id === id),
    [agents],
  )

  const selectById = React.useCallback(
    async (id: string) => {
      // 先从本地查
      const local = agents.find((a) => a.id === id)
      if (local) {
        setCurrentAgent(local)
        return
      }
      // 本地无则拉详情
      if (!fetchDetail) {
        setError(`Agent ${id} not found in local list and no fetchDetail provided`)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const detail = await fetchDetail(id)
        setCurrentAgent(detail)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [agents, fetchDetail],
  )

  const clearSelection = React.useCallback(() => {
    setCurrentAgent(null)
  }, [])

  React.useEffect(() => {
    if (autoLoad) {
      void load()
    }
  }, [autoLoad, load])

  return {
    agents,
    currentAgent,
    loading,
    error,
    load,
    refresh,
    selectById,
    clearSelection,
    findById,
    setAgents,
  }
}
