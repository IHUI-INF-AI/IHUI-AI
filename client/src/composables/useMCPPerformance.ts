/**
 * MCP 性能监控 Composable
 */

import { ref, computed } from 'vue'
import type { MCPCallResult } from './useMCP'

interface PerformanceMetric {
  toolName: string
  serverId: string
  callCount: number
  successCount: number
  failureCount: number
  averageResponseTime: number
  totalResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  lastCallTime: number
}

/**
 * MCP 性能监控
 */
export function useMCPPerformance() {
  const metrics = ref<Map<string, PerformanceMetric>>(new Map())
  const callTimings = ref<
    Map<string, Array<{ startTime: number; endTime: number; duration: number }>>
  >(new Map())

  /**
   * 记录工具调用开始
   */
  const recordCallStart = (serverId: string, toolName: string) => {
    const key = `${serverId}-${toolName}`
    const startTime = performance.now()

    if (!callTimings.value.has(key)) {
      callTimings.value.set(key, [])
    }

    callTimings.value.get(key)!.push({
      startTime,
      endTime: 0,
      duration: 0,
    })

    return startTime
  }

  /**
   * 记录工具调用结束
   */
  const recordCallEnd = (
    serverId: string,
    toolName: string,
    result: MCPCallResult,
    startTime?: number
  ) => {
    const key = `${serverId}-${toolName}`
    const endTime = performance.now()
    const duration = startTime ? endTime - startTime : 0

    // 更新最后一次调用的时间
    const timings = callTimings.value.get(key)
    if (timings && timings.length > 0) {
      const lastTiming = timings[timings.length - 1]
      if (lastTiming.endTime === 0) {
        lastTiming.endTime = endTime
        lastTiming.duration = duration
      }
    }

    // 更新指标
    if (!metrics.value.has(key)) {
      metrics.value.set(key, {
        toolName,
        serverId,
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        lastCallTime: Date.now(),
      })
    }

    const metric = metrics.value.get(key)!
    metric.callCount++
    if (result.success) {
      metric.successCount++
    } else {
      metric.failureCount++
    }

    if (duration > 0) {
      metric.totalResponseTime += duration
      metric.averageResponseTime = metric.totalResponseTime / metric.callCount
      metric.minResponseTime = Math.min(metric.minResponseTime, duration)
      metric.maxResponseTime = Math.max(metric.maxResponseTime, duration)
    }

    metric.lastCallTime = Date.now()
  }

  /**
   * 获取工具性能指标
   */
  const getToolMetrics = (serverId: string, toolName: string) => {
    const key = `${serverId}-${toolName}`
    return metrics.value.get(key)
  }

  /**
   * 获取所有工具的性能指标
   */
  const getAllMetrics = computed(() => {
    return Array.from(metrics.value.values())
  })

  /**
   * 获取性能统计
   */
  const getPerformanceStats = computed(() => {
    const allMetrics = Array.from(metrics.value.values()) as PerformanceMetric[]
    const totalCalls = allMetrics.reduce((sum, m) => sum + m.callCount, 0)
    const totalSuccess = allMetrics.reduce((sum, m) => sum + m.successCount, 0)
    const totalFailure = allMetrics.reduce((sum, m) => sum + m.failureCount, 0)
    const avgResponseTime =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length
        : 0

    return {
      totalCalls,
      totalSuccess,
      totalFailure,
      successRate: totalCalls > 0 ? (totalSuccess / totalCalls) * 100 : 0,
      averageResponseTime: avgResponseTime,
      toolCount: allMetrics.length,
    }
  })

  /**
   * 获取最慢的工具
   */
  const getSlowestTools = computed(() => {
    return (Array.from(metrics.value.values()) as PerformanceMetric[])
      .filter(m => m.callCount > 0)
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10)
  })

  /**
   * 获取最常用的工具
   */
  const getMostUsedTools = computed(() => {
    return (Array.from(metrics.value.values()) as PerformanceMetric[])
      .filter(m => m.callCount > 0)
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10)
  })

  /**
   * 获取失败率最高的工具
   */
  const getMostFailedTools = computed(() => {
    return (Array.from(metrics.value.values()) as PerformanceMetric[])
      .filter(m => m.callCount > 0)
      .map(m => ({
        ...m,
        failureRate: (m.failureCount / m.callCount) * 100,
      }))
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 10)
  })

  /**
   * 清除性能数据
   */
  const clearMetrics = () => {
    metrics.value.clear()
    callTimings.value.clear()
  }

  /**
   * 导出性能数据
   */
  const exportMetrics = () => {
    return {
      metrics: (Array.from(metrics.value.entries()) as Array<[string, unknown]>).map(
        ([key, value]) => ({
          key,
          ...(value as Record<string, unknown>),
        })
      ),
      stats: getPerformanceStats.value,
      timestamp: Date.now(),
    }
  }

  return {
    // 状态
    metrics,
    callTimings,

    // 计算属性
    getAllMetrics,
    getPerformanceStats,
    getSlowestTools,
    getMostUsedTools,
    getMostFailedTools,

    // 方法
    recordCallStart,
    recordCallEnd,
    getToolMetrics,
    clearMetrics,
    exportMetrics,
  }
}
