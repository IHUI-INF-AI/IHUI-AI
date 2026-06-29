import { t } from '@/utils/i18n'

/**
 * 统一 AI 能力 Composable
 * 提供统一的 AI 能力调用接口
 */

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getI18nGlobal } from '@/locales'
import {
  getUnifiedAIOrchestrator,
  type AICapabilityRequest,
  type AICapabilityResponse,
  type CapabilityComposition,
  AICapabilityType,
} from '@/services/unified-ai-orchestrator'

// 重新导出类型供外部使用
export { AICapabilityType }
import { useAICapabilityCache } from './useAICapabilityCache'

/**
 * 统一 AI 能力 Composable
 */
export function useUnifiedAI() {
  const orchestrator = getUnifiedAIOrchestrator()
  const cache = useAICapabilityCache({
    ttl: 5 * 60 * 1000, // 5 分钟缓存
    maxSize: 100,
    enableCache: true,
  })

  // 状态
  const loading = ref(false)
  const lastResponse = ref<AICapabilityResponse | null>(null)

  /**
   * 智能调用 AI 能力（自动选择最佳能力）
   */
  const smartInvoke = async (
    userMessage: string,
    options?: {
      preferredType?: AICapabilityType
      context?: AICapabilityRequest['context']
      useCache?: boolean
    }
  ): Promise<AICapabilityResponse | null> => {
    loading.value = true
    try {
      const request: AICapabilityRequest = {
        type: options?.preferredType || AICapabilityType.HYBRID,
        input: userMessage,
        context: {
          userMessage,
          ...options?.context,
        },
        options: {
          retry: true,
        },
      }

      // 检查缓存
      if (options?.useCache !== false) {
        const cached = cache.getCache(request)
        if (cached) {
          lastResponse.value = cached
          return cached
        }
      }

      const response = await orchestrator.invokeCapability(request)

      // 设置缓存
      if (options?.useCache !== false && response.success) {
        cache.setCache(request, response)
      }

      lastResponse.value = response

      if (response.success) {
        ElMessage.success(t('msg.use_unified_a_i.AI能力调用成功'))
      } else {
        ElMessage.error(response.error || 'AI 能力调用失败')
      }

      return response
    } catch (error: unknown) {
      const err = error as { message?: string }
      ElMessage.error(err?.message || t('common.errors.aiCapabilityInvokeFailed'))
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 调用指定能力
   */
  const invokeCapability = async (request: AICapabilityRequest): Promise<AICapabilityResponse> => {
    loading.value = true
    try {
      const response = await orchestrator.invokeCapability(request)
      lastResponse.value = response
      return response
    } catch (e) { console.error(e); throw e } finally {
      loading.value = false
    }
  }

  /**
   * 执行能力组合
   */
  const executeComposition = async (
    composition: CapabilityComposition
  ): Promise<AICapabilityResponse[]> => {
    loading.value = true
    try {
      return await orchestrator.executeComposition(composition)
    } catch (e) { console.error(e); throw e } finally {
      loading.value = false
    }
  }

  /**
   * 获取可用能力
   */
  const getAvailableCapabilities = (type?: AICapabilityType) => {
    return orchestrator.getAvailableCapabilities(type)
  }

  /**
   * 获取调用历史
   */
  const getCallHistory = () => {
    return orchestrator.getCallHistory()
  }

  /**
   * 获取性能统计
   */
  const getPerformanceStats = () => {
    return orchestrator.getPerformanceStats()
  }

  /**
   * 获取缓存统计
   */
  const getCacheStats = () => {
    return cache.getCacheStats()
  }

  /**
   * 清除缓存
   */
  const clearCache = () => {
    cache.clearCache()
    ElMessage.success(String(getI18nGlobal().t('messages.cacheCleared')))
  }

  // 计算属性
  const availableModels = computed(() => getAvailableCapabilities(AICapabilityType.MODEL))
  const availableAgents = computed(() => getAvailableCapabilities(AICapabilityType.AGENT))
  const availableMCPTools = computed(() => getAvailableCapabilities(AICapabilityType.MCP))
  const allCapabilities = computed(() => getAvailableCapabilities())

  return {
    // 状态
    loading,
    lastResponse,

    // 计算属性
    availableModels,
    availableAgents,
    availableMCPTools,
    allCapabilities,

    // 方法
    smartInvoke,
    invokeCapability,
    executeComposition,
    getAvailableCapabilities,
    getCallHistory,
    getPerformanceStats,
    getCacheStats,
    clearCache,
  }
}
