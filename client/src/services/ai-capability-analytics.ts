import { t } from '@/utils/i18n'

/**
 * AI 能力使用分析和优化系统
 * 分析 AI 能力的使用模式，提供优化建议
 */

import { ref } from 'vue'
import type { AICapabilityType, AICapabilityResponse } from './unified-ai-orchestrator'
import { getUnifiedAIOrchestrator } from './unified-ai-orchestrator'

// 使用分析数据
export interface CapabilityUsageAnalytics {
  capabilityId: string
  capabilityType: AICapabilityType
  totalCalls: number
  successCalls: number
  failureCalls: number
  averageLatency: number
  totalCost: number
  averageCost: number
  successRate: number
  usageFrequency: {
    hourly: Record<string, number>
    daily: Record<string, number>
    weekly: Record<string, number>
  }
  errorPatterns: Array<{
    error: string
    count: number
    lastOccurred: number
  }>
  performanceTrend: Array<{
    timestamp: number
    latency: number
    success: boolean
  }>
}

// 优化建议
export interface OptimizationRecommendation {
  type: 'performance' | 'cost' | 'reliability' | 'usage'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action: string
  expectedImpact: string
}

// 使用模式分析
export interface UsagePattern {
  pattern: string
  frequency: number
  averageLatency: number
  successRate: number
  recommendedOptimization?: string
}

/**
 * AI 能力分析系统
 */
export class AICapabilityAnalytics {
  private orchestrator = getUnifiedAIOrchestrator()
  private analyticsData = ref<Map<string, CapabilityUsageAnalytics>>(new Map())

  /**
   * 记录能力调用
   */
  recordCall(response: AICapabilityResponse): void {
    const key = `${response.capabilityType}:${response.capabilityId}`
    const now = Date.now()
    const hour = new Date(now).toISOString().slice(0, 13)
    const day = new Date(now).toISOString().slice(0, 10)
    const week = this.getWeekKey(now)

    if (!this.analyticsData.value.has(key)) {
      this.analyticsData.value.set(key, {
        capabilityId: response.capabilityId,
        capabilityType: response.capabilityType,
        totalCalls: 0,
        successCalls: 0,
        failureCalls: 0,
        averageLatency: 0,
        totalCost: 0,
        averageCost: 0,
        successRate: 0,
        usageFrequency: {
          hourly: {},
          daily: {},
          weekly: {},
        },
        errorPatterns: [],
        performanceTrend: [],
      })
    }

    const analytics = this.analyticsData.value.get(key)!

    // 更新基本统计
    analytics.totalCalls++
    if (response.success) {
      analytics.successCalls++
    } else {
      analytics.failureCalls++
    }

    // 更新延迟
    const latency = response.metadata?.latency || 0
    if (analytics.totalCalls > 0) {
      analytics.averageLatency =
        (analytics.averageLatency * (analytics.totalCalls - 1) + latency) / analytics.totalCalls
    } else {
      analytics.averageLatency = latency
    }

    // 更新成本
    const cost = response.metadata?.cost || 0
    analytics.totalCost += cost
    if (analytics.totalCalls > 0) {
      analytics.averageCost = analytics.totalCost / analytics.totalCalls
    } else {
      analytics.averageCost = cost
    }

    // 更新成功率
    if (analytics.totalCalls > 0) {
      analytics.successRate = analytics.successCalls / analytics.totalCalls
    } else {
      analytics.successRate = 0
    }

    // 更新使用频率
    analytics.usageFrequency.hourly[hour] = (analytics.usageFrequency.hourly[hour] || 0) + 1
    analytics.usageFrequency.daily[day] = (analytics.usageFrequency.daily[day] || 0) + 1
    analytics.usageFrequency.weekly[week] = (analytics.usageFrequency.weekly[week] || 0) + 1

    // 更新错误模式
    if (!response.success && response.error) {
      const errorPattern = analytics.errorPatterns.find(e => e.error === response.error)
      if (errorPattern) {
        errorPattern.count++
        errorPattern.lastOccurred = now
      } else {
        analytics.errorPatterns.push({
          error: response.error,
          count: 1,
          lastOccurred: now,
        })
      }
    }

    // 更新性能趋势（保留最近100条）
    analytics.performanceTrend.push({
      timestamp: now,
      latency,
      success: response.success,
    })
    if (analytics.performanceTrend.length > 100) {
      analytics.performanceTrend.shift()
    }

    this.analyticsData.value.set(key, { ...analytics })
  }

  /**
   * 获取能力分析数据
   */
  getAnalytics(capabilityId?: string): CapabilityUsageAnalytics[] {
    if (capabilityId) {
      const analytics = this.analyticsData.value.get(capabilityId)
      return analytics ? [analytics] : []
    }
    return Array.from(this.analyticsData.value.values())
  }

  /**
   * 生成优化建议
   */
  generateRecommendations(capabilityId?: string): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = []
    const analyticsList = this.getAnalytics(capabilityId)

    for (const analytics of analyticsList) {
      // 性能优化建议
      if (analytics.averageLatency > 5000) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          title: t('text.ai_capability_analytics.延迟过高'),
          description: `${analytics.capabilityId} 的平均延迟为 ${analytics.averageLatency.toFixed(2)}ms，建议优化`,
          action: '考虑使用更快的模型或优化请求参数',
          expectedImpact: '预计可降低延迟 30-50%',
        })
      }

      // 成本优化建议
      if (analytics.averageCost > 0.1) {
        recommendations.push({
          type: 'cost',
          priority: 'medium',
          title: t('text.ai_capability_analytics.成本较高1'),
          description: `${analytics.capabilityId} 的平均成本为 $${analytics.averageCost.toFixed(4)}，建议优化`,
          action: '考虑使用更经济的模型或减少不必要的调用',
          expectedImpact: '预计可降低成本 20-40%',
        })
      }

      // 可靠性优化建议
      if (analytics.successRate < 0.9) {
        recommendations.push({
          type: 'reliability',
          priority: 'high',
          title: t('text.ai_capability_analytics.成功率较低2'),
          description: `${analytics.capabilityId} 的成功率为 ${(analytics.successRate * 100).toFixed(2)}%，建议优化`,
          action: '检查错误模式并实施重试机制',
          expectedImpact: '预计可提高成功率至 95%+',
        })
      }

      // 使用模式优化建议
      const peakHours = this.getPeakHours(analytics.usageFrequency.hourly)
      if (peakHours.length > 0) {
        recommendations.push({
          type: 'usage',
          priority: 'low',
          title: t('text.ai_capability_analytics.使用模式分析3'),
          description: `检测到使用高峰时段：${peakHours.join(', ')}`,
          action: '考虑在非高峰时段进行批量处理',
          expectedImpact: '预计可降低延迟和成本',
        })
      }

      // 错误模式优化建议
      const topErrors = analytics.errorPatterns.sort((a, b) => b.count - a.count).slice(0, 3)
      if (topErrors.length > 0) {
        recommendations.push({
          type: 'reliability',
          priority: 'medium',
          title: t('text.ai_capability_analytics.常见错误4'),
          description: `检测到常见错误：${topErrors.map(e => e.error).join(', ')}`,
          action: '实施针对性的错误处理和重试策略',
          expectedImpact: '预计可减少错误率 50%+',
        })
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * 分析使用模式
   */
  analyzeUsagePatterns(capabilityId?: string): UsagePattern[] {
    const patterns: UsagePattern[] = []
    const analyticsList = this.getAnalytics(capabilityId)

    for (const analytics of analyticsList) {
      // 分析时间模式
      const hourlyPatterns = this.analyzeHourlyPattern(analytics.usageFrequency.hourly)
      patterns.push(...hourlyPatterns)

      // 分析性能模式
      const performancePatterns = this.analyzePerformancePattern(analytics.performanceTrend)
      patterns.push(...performancePatterns)
    }

    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * 获取峰值时段
   */
  private getPeakHours(hourlyFrequency: Record<string, number>): string[] {
    const entries = Object.entries(hourlyFrequency)
    if (entries.length === 0) return []

    const maxCount = Math.max(...entries.map(([, count]) => count))
    const threshold = maxCount * 0.8 // 80% 以上认为是高峰

    return entries.filter(([, count]) => count >= threshold).map(([hour]) => hour)
  }

  /**
   * 分析小时模式
   */
  private analyzeHourlyPattern(hourlyFrequency: Record<string, number>): UsagePattern[] {
    const patterns: UsagePattern[] = []
    const entries = Object.entries(hourlyFrequency)

    if (entries.length === 0) return patterns

    const totalCalls = entries.reduce((sum, [, count]) => sum + count, 0)
    const avgCalls = totalCalls / entries.length

    // 识别高峰时段
    const peakHours = entries.filter(([, count]) => count > avgCalls * 1.5).map(([hour]) => hour)

    if (peakHours.length > 0) {
      patterns.push({
        pattern: `高峰时段：${peakHours.join(', ')}`,
        frequency: peakHours.length,
        averageLatency: 0, // 需要从性能趋势中计算
        successRate: 0, // 需要从性能趋势中计算
        recommendedOptimization: '考虑在非高峰时段进行批量处理',
      })
    }

    return patterns
  }

  /**
   * 分析性能模式
   */
  private analyzePerformancePattern(
    performanceTrend: Array<{ timestamp: number; latency: number; success: boolean }>
  ): UsagePattern[] {
    const patterns: UsagePattern[] = []

    if (performanceTrend.length === 0) return patterns

    const successful = performanceTrend.filter(p => p.success)
    const failed = performanceTrend.filter(p => !p.success)

    if (successful.length > 0) {
      const avgLatency = successful.reduce((sum, p) => sum + p.latency, 0) / successful.length

      patterns.push({
        pattern: '成功调用性能',
        frequency: successful.length,
        averageLatency: avgLatency,
        successRate: 1.0,
        recommendedOptimization: avgLatency > 3000 ? '考虑优化请求参数或使用更快的模型' : undefined,
      })
    }

    if (failed.length > 0) {
      patterns.push({
        pattern: '失败调用模式',
        frequency: failed.length,
        averageLatency: 0,
        successRate: 0,
        recommendedOptimization: '检查错误原因并实施重试机制',
      })
    }

    return patterns
  }

  /**
   * 获取周键
   */
  private getWeekKey(timestamp: number): string {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const week = this.getWeekNumber(date)
    return `${year}-W${week}`
  }

  /**
   * 获取周数
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  /**
   * 获取能力使用摘要
   */
  getUsageSummary(capabilityId?: string): {
    totalCalls: number
    totalCost: number
    averageLatency: number
    successRate: number
    topCapabilities: Array<{
      id: string
      calls: number
      cost: number
    }>
  } {
    const analyticsList = this.getAnalytics(capabilityId)

    const totalCalls = analyticsList.reduce((sum, a) => sum + a.totalCalls, 0)
    const totalCost = analyticsList.reduce((sum, a) => sum + a.totalCost, 0)
    const avgLatency =
      analyticsList.reduce((sum, a) => sum + a.averageLatency * a.totalCalls, 0) / totalCalls || 0
    const successRate =
      analyticsList.reduce((sum, a) => sum + a.successRate * a.totalCalls, 0) / totalCalls || 0

    const topCapabilities = analyticsList
      .map(a => ({
        id: a.capabilityId,
        calls: a.totalCalls,
        cost: a.totalCost,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10)

    return {
      totalCalls,
      totalCost,
      averageLatency: avgLatency,
      successRate,
      topCapabilities,
    }
  }
}

// 单例实例
let analyticsInstance: AICapabilityAnalytics | null = null

/**
 * 获取 AI 能力分析实例
 */
export function getAICapabilityAnalytics(): AICapabilityAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new AICapabilityAnalytics()
  }
  return analyticsInstance
}
