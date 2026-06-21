import { t } from '@/utils/i18n'

/**
 * Agentic AI 系统 Composables
 * 与后端 Agentic Orchestrator 深度集成
 * 使用统一的 API 服务
 */

import { ref, computed, onUnmounted } from 'vue'
import { logger } from '../utils/logger'
import { useDesignSystem } from './useDesignSystem'
import { createAgenticSwarm, getSwarmStatus } from '@/api/services/agentic.service'
import { AgentStatus, AgentType } from '@/services/agentic-ai'
// 定义缺失的类型并导出
export interface AgentSwarmConfig {
  swarmId?: string
  task?: string
  agents?: any[]
  coordination?: string
  status?: string
  currentIteration?: number
  [key: string]: any
}

export interface TaskPlan {
  strategic?: any
  tactical?: any
  operational?: any
  [key: string]: any
}

export interface ReflectionResult {
  [key: string]: any
}

// 重新导出 AgentStatus 和 AgentType，避免重复定义
export { AgentStatus, AgentType }

/**
 * 使用 Agentic 系统
 */
export function useAgentic() {
  const { colors } = useDesignSystem()

  const activeSwarms = ref<Map<string, AgentSwarmConfig>>(new Map())
  const currentSwarm = ref<AgentSwarmConfig | null>(null)
  const taskPlan = ref<TaskPlan | null>(null)
  const reflectionResults = ref<ReflectionResult[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 创建并执行 Agent Swarm（带重试机制）
   */
  const createAndExecuteSwarm = async (
    task: string,
    options?: {
      agentSpecs?: Array<Partial<{ type: AgentType; name: string }>>
      coordination?: 'hierarchical' | 'peer-to-peer' | 'market-based'
      maxIterations?: number
    },
    retries = 3
  ): Promise<{ swarmId: string; plan: TaskPlan }> => {
    isLoading.value = true
    error.value = null

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await createAgenticSwarm({
          task,
          options: {
            coordination: options?.coordination || 'hierarchical',
            maxIterations: options?.maxIterations || 10,
            ...options,
          },
        })

        if (response.code !== 200) {
          throw new Error(response.message || '创建 Swarm 失败')
        }

        if (!response.data) {
          throw new Error(t('error.use_agentic.创建Swarm失'))
        }

        const { swarmId, plan } = response.data

        // 更新状态
        taskPlan.value = plan
        currentSwarm.value = {
          swarmId,
          task,
          agents: [],
          coordination: options?.coordination || 'hierarchical',
          status: 'running' as const,
          maxIterations: options?.maxIterations,
        }

        activeSwarms.value.set(swarmId, currentSwarm.value)

        // 开始轮询状态
        startPolling(swarmId)

        return { swarmId, plan }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('未知错误')

        // 如果是最后一次尝试，抛出错误
        if (attempt === retries) {
          error.value = lastError.message
          isLoading.value = false
          throw lastError
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // 理论上不会到达这里，但为了类型安全
    isLoading.value = false
    throw lastError || new Error('创建 Swarm 失败')
  }

  /**
   * 获取 Swarm 状态（带重试机制）
   */
  const getSwarmStatusData = async (swarmId: string, retries = 3): Promise<AgentSwarmConfig> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await getSwarmStatus(swarmId)

        if (response.code !== 200) {
          throw new Error(response.message || '获取状态失败')
        }

        if (!response.data) {
          throw new Error(t('error.use_agentic.获取状态失败返回1'))
        }

        const { swarm, agentStates } = response.data

        // 更新 Swarm 状态
        if (activeSwarms.value.has(swarmId)) {
          const existingSwarm = activeSwarms.value.get(swarmId)!
          existingSwarm.status = swarm.status as string
          existingSwarm.currentIteration = (swarm.currentIteration as number) || 0
          existingSwarm.agents = (Array.isArray(swarm.agents) ? swarm.agents : []).map(
            (agent: Record<string, unknown>) => ({
              ...agent,
              status: ((agentStates as Record<string, unknown>)[agent.agentId as string] ||
                'idle') as AgentStatus,
            })
          )

          if (swarmId === currentSwarm.value?.swarmId) {
            currentSwarm.value = existingSwarm
          }
        }

        return swarm
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('未知错误')

        // 如果是最后一次尝试，抛出错误
        if (attempt === retries) {
          error.value = lastError.message
          throw lastError
        }

        // 等待后重试（指数退避）
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // 理论上不会到达这里，但为了类型安全
    throw lastError || new Error('获取状态失败')
  }

  /**
   * 轮询 Swarm 状态
   */
  let pollingInterval: ReturnType<typeof setInterval> | null = null

  const startPolling = (swarmId: string, interval: number = 2000) => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    pollingInterval = setInterval(async () => {
      try {
        const swarm = await getSwarmStatusData(swarmId)

        if (swarm.status === 'completed' || swarm.status === 'failed') {
          stopPolling()
        }
      } catch (err) {
        logger.error('Polling status failed:', err)
      }
    }, interval)
  }

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  /**
   * 获取 Agent 状态颜色
   */
  const getAgentStatusColor = (status: AgentStatus): string => {
    const statusColors: Record<AgentStatus, string> = {
      [AgentStatus.IDLE]: 'var(--el-text-color-primary)',
      [AgentStatus.THINKING]: 'var(--el-text-color-primary)',
      [AgentStatus.ACTING]: 'var(--color-emerald-500)',
      [AgentStatus.REFLECTING]: 'var(--color-amber-500)',
      [AgentStatus.COMPLETED]: 'var(--color-emerald-500)',
      [AgentStatus.FAILED]: 'var(--color-red-ef4444)',
    }
    return statusColors[status] || colors.value.text.secondary
  }

  /**
   * 获取 Agent 类型图标
   */
  const getAgentTypeIcon = (type: AgentType): string => {
    const icons: Record<AgentType, string> = {
      [AgentType.REASONING]: '🧠',
      [AgentType.ACTING]: '⚡',
      [AgentType.SPECIALIST]: '🎯',
    }
    return icons[type] || '🤖'
  }

  /**
   * 获取 Agent 类型名称
   */
  const getAgentTypeName = (type: AgentType): string => {
    const names: Record<AgentType, string> = {
      [AgentType.REASONING]: '思考层',
      [AgentType.ACTING]: '执行层',
      [AgentType.SPECIALIST]: '专业层',
    }
    return names[type] || '未知'
  }

  onUnmounted(() => {
    stopPolling()
  })

  return {
    // 状态
    activeSwarms: computed(() => Array.from(activeSwarms.value.values())),
    currentSwarm,
    taskPlan,
    reflectionResults,
    isLoading,
    error,

    // 方法
    createAndExecuteSwarm,
    getSwarmStatus: getSwarmStatusData,
    startPolling,
    stopPolling,
    getAgentStatusColor,
    getAgentTypeIcon,
    getAgentTypeName,
  }
}
