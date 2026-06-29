import { t } from '@/utils/i18n'

/**
 * AI 能力自动发现和推荐系统
 * 智能分析用户需求，自动推荐最佳 AI 能力组合
 */

import { AICapabilityType } from './unified-ai-orchestrator'
import { getUnifiedAIOrchestrator } from './unified-ai-orchestrator'

// 能力推荐结果
export interface CapabilityRecommendation {
  capabilityType: AICapabilityType
  capabilityId?: string
  confidence: number
  reason: string
  estimatedLatency?: number
  estimatedCost?: number
  alternatives?: CapabilityRecommendation[]
}

// 使用场景模式
export interface UsagePattern {
  id: string
  name: string
  description: string
  keywords: string[]
  recommendedCapabilities: Array<{
    type: AICapabilityType
    priority: number
  }>
  templateId?: string
}

/** 延迟估算表 */
type LatencyEstimates = Record<AICapabilityType, number>
/** 成本估算表 */
type CostEstimates = Record<AICapabilityType, number>

/**
 * AI 能力发现和推荐系统
 */
export class AICapabilityDiscovery {
  private orchestrator = getUnifiedAIOrchestrator()

  // 使用场景模式库
  private usagePatterns: UsagePattern[] = [
    {
      id: 'data-analysis',
      name: '数据分析',
      description: t('text.ai_capability_discovery.分析数据并生成报'),
      keywords: ['分析', '数据', '报告', '统计', '图表'],
      recommendedCapabilities: [
        { type: AICapabilityType.MCP, priority: 1 },
        { type: AICapabilityType.MODEL, priority: 2 },
      ],
      templateId: 'data-analysis',
    },
    {
      id: 'content-generation',
      name: '内容生成',
      description: t('text.ai_capability_discovery.生成文本文章文案1'),
      keywords: ['生成', '内容', '文章', '文案', '写作'],
      recommendedCapabilities: [
        { type: AICapabilityType.MODEL, priority: 1 },
        { type: AICapabilityType.AGENT, priority: 2 },
      ],
      templateId: 'content-generation',
    },
    {
      id: 'code-generation',
      name: '代码生成',
      description: t('text.ai_capability_discovery.生成优化测试代码2'),
      keywords: ['代码', '编程', '开发', '函数', '类'],
      recommendedCapabilities: [
        { type: AICapabilityType.MODEL, priority: 1 },
        { type: AICapabilityType.MCP, priority: 2 },
      ],
      templateId: 'code-generation',
    },
    {
      id: 'qa-system',
      name: '智能问答',
      description: t('text.ai_capability_discovery.回答问题和提供信3'),
      keywords: ['问题', '回答', '查询', '信息', '帮助'],
      recommendedCapabilities: [
        { type: AICapabilityType.MCP, priority: 1 },
        { type: AICapabilityType.MODEL, priority: 2 },
      ],
      templateId: 'intelligent-qa',
    },
    {
      id: 'document-processing',
      name: '文档处理',
      description: t('text.ai_capability_discovery.处理分析生成文档4'),
      keywords: ['文档', '文件', '处理', '解析', '生成'],
      recommendedCapabilities: [
        { type: AICapabilityType.MCP, priority: 1 },
        { type: AICapabilityType.MODEL, priority: 2 },
        { type: AICapabilityType.AGENT, priority: 3 },
      ],
      templateId: 'document-generation',
    },
  ]

  /**
   * 分析用户需求并推荐能力
   */
  async discoverCapabilities(
    userMessage: string,
    context?: {
      currentPage?: string
      userHistory?: string[]
      preferences?: Record<string, unknown>
    }
  ): Promise<CapabilityRecommendation[]> {
    const recommendations: CapabilityRecommendation[] = []
    const lowerMessage = userMessage.toLowerCase()

    // 1. 匹配使用场景模式
    const matchedPatterns = this.matchUsagePatterns(lowerMessage)
    for (const pattern of matchedPatterns) {
      for (const cap of pattern.recommendedCapabilities) {
        const recommendation = await this.buildRecommendation(
          cap.type,
          userMessage,
          pattern,
          cap.priority
        )
        if (recommendation) {
          recommendations.push(recommendation)
        }
      }
    }

    // 2. 基于关键词推荐
    const keywordRecommendations = this.recommendByKeywords(lowerMessage)
    recommendations.push(...keywordRecommendations)

    // 3. 基于用户历史推荐
    if (context?.userHistory) {
      const historyRecommendations = this.recommendByHistory(context.userHistory, lowerMessage)
      recommendations.push(...historyRecommendations)
    }

    // 4. 去重和排序
    const uniqueRecommendations = this.deduplicateRecommendations(recommendations)
    return uniqueRecommendations.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 匹配使用场景模式
   */
  private matchUsagePatterns(message: string): UsagePattern[] {
    const matched: Array<{ pattern: UsagePattern; score: number }> = []

    for (const pattern of this.usagePatterns) {
      let score = 0
      for (const keyword of pattern.keywords) {
        if (message.includes(keyword)) {
          score += 1
        }
      }
      if (score > 0) {
        matched.push({ pattern, score })
      }
    }

    return matched
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => m.pattern)
  }

  /**
   * 构建推荐
   */
  private async buildRecommendation(
    type: AICapabilityType,
    userMessage: string,
    pattern: UsagePattern,
    priority: number
  ): Promise<CapabilityRecommendation | null> {
    const availableCapabilities = this.orchestrator.getAvailableCapabilities(type)

    if (availableCapabilities.length === 0) {
      return null
    }

    // 选择最佳能力
    const bestCapability = availableCapabilities[0] as {
      type: AICapabilityType
      name: string
      description?: string
      available: boolean
      metadata?: { id?: string; [key: string]: unknown }
    }

    return {
      capabilityType: type,
      capabilityId: bestCapability.metadata?.id,
      confidence: 0.7 - (priority - 1) * 0.1,
      reason: `匹配场景：${pattern.name}`,
      estimatedLatency: this.estimateLatency(type),
      estimatedCost: this.estimateCost(type),
    }
  }

  /**
   * 基于关键词推荐
   */
  private recommendByKeywords(message: string): CapabilityRecommendation[] {
    const recommendations: CapabilityRecommendation[] = []

    // 模型关键词
    if (message.includes('生成') || message.includes('写') || message.includes('创作')) {
      recommendations.push({
        capabilityType: AICapabilityType.MODEL,
        confidence: 0.8,
        reason: '检测到内容生成需求',
      })
    }

    // MCP 工具关键词
    if (message.includes('查询') || message.includes('获取') || message.includes('搜索')) {
      recommendations.push({
        capabilityType: AICapabilityType.MCP,
        confidence: 0.7,
        reason: '检测到数据查询需求',
      })
    }

    // Agent 关键词
    if (message.includes('智能体') || message.includes('助手') || message.includes('代理')) {
      recommendations.push({
        capabilityType: AICapabilityType.AGENT,
        confidence: 0.75,
        reason: '检测到智能体使用需求',
      })
    }

    // Agentic 关键词
    if (message.includes('复杂') || message.includes('多步骤') || message.includes('协作')) {
      recommendations.push({
        capabilityType: AICapabilityType.AGENTIC,
        confidence: 0.7,
        reason: '检测到复杂任务需求',
      })
    }

    return recommendations
  }

  /**
   * 基于用户历史推荐
   */
  private recommendByHistory(
    history: string[],
    _currentMessage: string
  ): CapabilityRecommendation[] {
    const recommendations: CapabilityRecommendation[] = []

    // 分析历史使用模式
    const historyAnalysis = this.analyzeHistory(history)

    // 如果历史中经常使用某种能力，推荐使用
    for (const [type, count] of Object.entries(historyAnalysis)) {
      if (count > 2) {
        recommendations.push({
          capabilityType: type as AICapabilityType,
          confidence: 0.6,
          reason: `基于您的使用历史（使用 ${count} 次）`,
        })
      }
    }

    return recommendations
  }

  /**
   * 分析历史使用模式
   */
  private analyzeHistory(history: string[]): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const item of history) {
      // 简单的关键词匹配（实际应该从历史记录中提取）
      if (item.includes('模型') || item.includes('生成')) {
        counts[AICapabilityType.MODEL] = (counts[AICapabilityType.MODEL] || 0) + 1
      }
      if (item.includes('工具') || item.includes('MCP')) {
        counts[AICapabilityType.MCP] = (counts[AICapabilityType.MCP] || 0) + 1
      }
      if (item.includes('智能体') || item.includes('Agent')) {
        counts[AICapabilityType.AGENT] = (counts[AICapabilityType.AGENT] || 0) + 1
      }
    }

    return counts
  }

  /**
   * 去重推荐
   */
  private deduplicateRecommendations(
    recommendations: CapabilityRecommendation[]
  ): CapabilityRecommendation[] {
    const seen = new Map<string, CapabilityRecommendation>()

    for (const rec of recommendations) {
      const key = `${rec.capabilityType}:${rec.capabilityId || 'auto'}`
      const existing = seen.get(key)

      if (!existing || rec.confidence > existing.confidence) {
        seen.set(key, rec)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * 估算延迟
   */
  private estimateLatency(type: AICapabilityType): number {
    const estimates: LatencyEstimates = {
      [AICapabilityType.MODEL]: 2000,
      [AICapabilityType.AGENT]: 3000,
      [AICapabilityType.AGENTIC]: 5000,
      [AICapabilityType.MCP]: 1000,
      [AICapabilityType.HYBRID]: 4000,
      [AICapabilityType.AUTO]: 2500,
    }
    return estimates[type] ?? 2000
  }

  /**
   * 估算成本
   */
  private estimateCost(type: AICapabilityType): number {
    const estimates: CostEstimates = {
      [AICapabilityType.MODEL]: 0.01,
      [AICapabilityType.AGENT]: 0.02,
      [AICapabilityType.AGENTIC]: 0.05,
      [AICapabilityType.MCP]: 0.001,
      [AICapabilityType.HYBRID]: 0.03,
      [AICapabilityType.AUTO]: 0.02,
    }
    return estimates[type] ?? 0.01
  }

  /**
   * 获取推荐模板
   */
  getRecommendedTemplate(userMessage: string): string | null {
    const patterns = this.matchUsagePatterns(userMessage.toLowerCase())
    if (patterns.length > 0 && patterns[0].templateId) {
      return patterns[0].templateId
    }
    return null
  }

  /**
   * 获取所有使用场景模式
   */
  getAllUsagePatterns(): UsagePattern[] {
    return this.usagePatterns
  }
}

// 单例实例
let discoveryInstance: AICapabilityDiscovery | null = null

/**
 * 获取 AI 能力发现实例
 */
export function getAICapabilityDiscovery(): AICapabilityDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new AICapabilityDiscovery()
  }
  return discoveryInstance
}
