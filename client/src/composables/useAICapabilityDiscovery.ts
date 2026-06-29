/**
 * AI 能力发现 Composable
 * 提供能力推荐和自动发现功能
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@/utils/i18n'
import {
  getAICapabilityDiscovery,
  type CapabilityRecommendation,
  type UsagePattern,
} from '@/services/ai-capability-discovery'
import { useUnifiedAI } from './useUnifiedAI'

/**
 * AI 能力发现 Composable
 */
export function useAICapabilityDiscovery() {
  const discovery = getAICapabilityDiscovery()
  const { smartInvoke } = useUnifiedAI()

  // 状态
  const recommendations = ref<CapabilityRecommendation[]>([])
  const loading = ref(false)
  const lastDiscovery = ref<string>('')

  /**
   * 发现并推荐能力
   */
  const discoverCapabilities = async (
    userMessage: string,
    context?: {
      currentPage?: string
      userHistory?: string[]
      preferences?: Record<string, unknown>
    }
  ): Promise<CapabilityRecommendation[]> => {
    loading.value = true
    lastDiscovery.value = userMessage

    try {
      const recs = await discovery.discoverCapabilities(userMessage, context)
      recommendations.value = recs
      return recs
    } catch (error: unknown) {
      const err = error as { message?: string }
      ElMessage.error(err?.message || t('common.errors.capabilityDiscoveryFailed'))
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 使用推荐的能力
   */
  const useRecommendedCapability = async (
    recommendation: CapabilityRecommendation,
    userMessage: string
  ): Promise<unknown> => {
    return await smartInvoke(userMessage, {
      preferredType: recommendation.capabilityType,
    })
  }

  /**
   * 获取推荐模板
   */
  const getRecommendedTemplate = (userMessage: string): string | null => {
    return discovery.getRecommendedTemplate(userMessage)
  }

  /**
   * 获取所有使用场景模式
   */
  const getAllUsagePatterns = (): UsagePattern[] => {
    return discovery.getAllUsagePatterns()
  }

  // 计算属性
  const bestRecommendation = computed(() => {
    return recommendations.value.length > 0 ? recommendations.value[0] : null
  })

  const topRecommendations = computed(() => {
    return recommendations.value.slice(0, 3)
  })

  return {
    // 状态
    recommendations,
    loading,
    lastDiscovery,

    // 计算属性
    bestRecommendation,
    topRecommendations,

    // 方法
    discoverCapabilities,
    useRecommendedCapability,
    getRecommendedTemplate,
    getAllUsagePatterns,
  }
}
