/**
 * 路由诊断工具
 * 
 * 用于记录和分析路由跳转、状态变化等信息
 * 便于排查路由循环等问题
 */

import type { RouteLocationNormalized } from 'vue-router'
import { logger } from '@/utils/logger'

// 兼容类型定义
type _RouteLocation = RouteLocationNormalized
type _Router = ReturnType<typeof import('vue-router').createRouter>

export type RouteLogType = 'guard' | 'redirect' | 'state_change' | 'error' | 'warning'

/**
 * 路由日志项
 */
export interface RouteLog {
  timestamp: number
  type: RouteLogType
  data: Record<string, unknown>
  url: string
  route: {
    path: string
    name: string | symbol | null | undefined
    query: Record<string, unknown>
    params: Record<string, unknown>
  }
  duration?: number
}

/**
 * 路由诊断工具
 */
export class RouteDiagnostics {
  private logs: RouteLog[] = []
  private maxLogs = 100
  private startTime = Date.now()
  private router: _Router | null = null
  private guardTimings = new Map<string, number>()

  /**
   * 设置路由实例
   */
  setRouter(router: _Router): void {
    this.router = router
  }

  /**
   * 记录日志
   */
  log(type: RouteLogType, data: Record<string, unknown>, duration?: number): void {
    const route = this.router?.currentRoute.value
    const log: RouteLog = {
      timestamp: Date.now(),
      type,
      data,
      url: window.location.href,
      route: {
        path: route?.path || '',
        name: route?.name,
        query: route?.query || {},
        params: route?.params || {},
      },
      duration,
    }

    this.logs.push(log)

    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 已禁用控制台日志输出，避免控制台噪音
  }

  /**
   * 记录路由守卫开始
   */
  logGuardStart(to: RouteLocationNormalized, from: RouteLocationNormalized): void {
    const key = `guard_${Date.now()}`
    this.guardTimings.set(key, Date.now())
    this.log('guard', {
      action: 'start',
      to: { path: to.path, name: to.name },
      from: { path: from.path, name: from.name },
      query: to.query,
    })
  }

  /**
   * 记录路由守卫结束
   */
  logGuardEnd(to: RouteLocationNormalized, from: RouteLocationNormalized, action: 'next' | 'redirect' | 'abort', target?: string): void {
    const key = Array.from(this.guardTimings.keys()).pop()
    if (key) {
      const startTime = this.guardTimings.get(key)
      const duration = startTime ? Date.now() - startTime : undefined
      this.guardTimings.delete(key)

      this.log('guard', {
        action: 'end',
        result: action,
        to: { path: to.path, name: to.name },
        from: { path: from.path, name: from.name },
        target,
      }, duration)
    }
  }

  /**
   * 记录重定向
   */
  logRedirect(from: string, to: string, reason: string): void {
    this.log('redirect', {
      from,
      to,
      reason,
    })
  }

  /**
   * 记录状态变化
   */
  logStateChange(key: string, oldValue: any, newValue: any): void {
    this.log('state_change', {
      key,
      oldValue,
      newValue,
    })
  }

  /**
   * 记录错误
   */
  logError(error: Error | string, context?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    this.log('error', {
      error: errorMessage,
      stack: errorStack,
      ...context,
    })
  }

  /**
   * 记录警告
   */
  logWarning(message: string, context?: Record<string, unknown>): void {
    this.log('warning', {
      message,
      ...context,
    })
  }

  /**
   * 获取所有日志
   */
  getLogs(): RouteLog[] {
    return [...this.logs]
  }

  /**
   * 按类型获取日志
   */
  getLogsByType(type: RouteLogType): RouteLog[] {
    return this.logs.filter(log => log.type === type)
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(count = 10): RouteLog[] {
    return this.logs.slice(-count)
  }

  /**
   * 获取指定时间范围内的日志
   */
  getLogsByTimeRange(startTime: number, endTime: number): RouteLog[] {
    return this.logs.filter(log => log.timestamp >= startTime && log.timestamp <= endTime)
  }

  /**
   * 导出日志为 JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      logs: this.logs,
      stats: this.getStats(),
    }, null, 2)
  }

  /**
   * 导出日志为 CSV
   */
  exportLogsAsCsv(): string {
    const headers = ['Timestamp', 'Type', 'Path', 'Name', 'Query', 'Data', 'Duration']
    const rows = this.logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.type,
      log.route.path,
      String(log.route.name || ''),
      JSON.stringify(log.route.query),
      JSON.stringify(log.data),
      String(log.duration || ''),
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }

  /**
   * 清除所有日志
   */
  clearLogs(): void {
    this.logs = []
    this.startTime = Date.now()
    this.guardTimings.clear()
    logger.debug('[RouteDiagnostics] Cleared all logs')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalLogs: number
    logsByType: Record<RouteLogType, number>
    averageGuardDuration: number
    maxGuardDuration: number
    recentErrors: RouteLog[]
    recentWarnings: RouteLog[]
  } {
    const logsByType: Record<RouteLogType, number> = {
      guard: 0,
      redirect: 0,
      state_change: 0,
      error: 0,
      warning: 0,
    }

    const guardDurations: number[] = []
    const recentErrors: RouteLog[] = []
    const recentWarnings: RouteLog[] = []

    for (const log of this.logs) {
      logsByType[log.type]++

      if (log.type === 'guard' && log.duration) {
        guardDurations.push(log.duration)
      }

      if (log.type === 'error') {
        recentErrors.push(log)
      }

      if (log.type === 'warning') {
        recentWarnings.push(log)
      }
    }

    const averageGuardDuration = guardDurations.length > 0
      ? guardDurations.reduce((sum, d) => sum + d, 0) / guardDurations.length
      : 0

    const maxGuardDuration = guardDurations.length > 0
      ? Math.max(...guardDurations)
      : 0

    return {
      totalLogs: this.logs.length,
      logsByType,
      averageGuardDuration,
      maxGuardDuration,
      recentErrors: recentErrors.slice(-5),
      recentWarnings: recentWarnings.slice(-5),
    }
  }

  /**
   * 检测循环重定向
   */
  detectRedirectLoop(maxCount = 3, timeWindow = 5000): boolean {
    const now = Date.now()
    const recentRedirects = this.logs
      .filter(log => log.type === 'redirect' && now - log.timestamp <= timeWindow)
      .map(log => log.data as { from: string; to: string })

    if (recentRedirects.length < maxCount) {
      return false
    }

    const redirectCounts = new Map<string, number>()
    for (const redirect of recentRedirects) {
      const key = `${redirect.from} -> ${redirect.to}`
      redirectCounts.set(key, (redirectCounts.get(key) || 0) + 1)
    }

    for (const count of redirectCounts.values()) {
      if (count >= maxCount) {
        return true
      }
    }

    return false
  }

  /**
   * 获取循环重定向详情
   */
  getRedirectLoopDetails(): Array<{ path: string; count: number; lastSeen: number }> | null {
    const redirectCounts = new Map<string, { count: number; lastSeen: number }>()
    const timeWindow = 10000 // 10秒内
    const now = Date.now()

    for (const log of this.logs) {
      if (log.type === 'redirect' && now - log.timestamp <= timeWindow) {
        const to = (log.data as { to: string }).to
        const existing = redirectCounts.get(to) || { count: 0, lastSeen: 0 }
        redirectCounts.set(to, {
          count: existing.count + 1,
          lastSeen: log.timestamp,
        })
      }
    }

    const loops = Array.from(redirectCounts.entries())
      .filter(([_, data]) => data.count >= 3)
      .map(([path, data]) => ({
        path,
        count: data.count,
        lastSeen: data.lastSeen,
      }))

    return loops.length > 0 ? loops : null
  }

  /**
   * 打印Summary
   */
  printSummary(): void {
    const stats = this.getStats()
    const loopDetails = this.getRedirectLoopDetails()

    // Using logger instead of console, unified log management
    logger.info('[RouteDiagnostics] Summary', {
      totalLogs: stats.totalLogs,
      logsByType: stats.logsByType,
      averageGuardDuration: `${stats.averageGuardDuration.toFixed(2)}ms`,
      maxGuardDuration: `${stats.maxGuardDuration}ms`,
    })

    if (stats.recentErrors.length > 0) {
      logger.warn(`[RouteDiagnostics] Recent errors: ${stats.recentErrors.length} items`, {
        errors: stats.recentErrors.map(error => error.data),
      })
    }

    if (stats.recentWarnings.length > 0) {
      logger.warn(`[RouteDiagnostics] Recent warnings: ${stats.recentWarnings.length} items`, {
        warnings: stats.recentWarnings.map(warning => warning.data),
      })
    }

    if (loopDetails) {
      logger.error('[RouteDiagnostics] Detected redirect loop:', loopDetails)
    }
  }

  /**
   * 获取表情符号
   */
  private getEmoji(type: RouteLogType): string {
    const emojis: Record<RouteLogType, string> = {
      guard: '🛡️',
      redirect: '↪️',
      state_change: '🔄',
      error: '❌',
      warning: '⚠️',
    }
    return emojis[type] || '📝'
  }
}

/**
 * 创建全局路由诊断工具实例
 */
export const routeDiagnostics = new RouteDiagnostics()

/**
 * 便捷函数：记录路由守卫开始
 */
export function logGuardStart(to: RouteLocationNormalized, from: RouteLocationNormalized): void {
  routeDiagnostics.logGuardStart(to, from)
}

/**
 * 便捷函数：记录路由守卫结束
 */
export function logGuardEnd(to: RouteLocationNormalized, from: RouteLocationNormalized, action: 'next' | 'redirect' | 'abort', target?: string): void {
  routeDiagnostics.logGuardEnd(to, from, action, target)
}

/**
 * 便捷函数：记录重定向
 */
export function logRedirect(from: string, to: string, reason: string): void {
  routeDiagnostics.logRedirect(from, to, reason)
}

/**
 * 便捷函数：记录状态变化
 */
export function logStateChange(key: string, oldValue: any, newValue: any): void {
  routeDiagnostics.logStateChange(key, oldValue, newValue)
}

/**
 * 便捷函数：记录错误
 */
export function logRouteError(error: Error | string, context?: Record<string, unknown>): void {
  routeDiagnostics.logError(error, context)
}

/**
 * 便捷函数：记录警告
 */
export function logRouteWarning(message: string, context?: Record<string, unknown>): void {
  routeDiagnostics.logWarning(message, context)
}

/**
 * 便捷函数：检测循环重定向
 */
export function detectRedirectLoop(maxCount = 3, timeWindow = 5000): boolean {
  return routeDiagnostics.detectRedirectLoop(maxCount, timeWindow)
}

/**
 * 便捷函数：打印诊断Summary
 */
export function printRouteDiagnostics(): void {
  routeDiagnostics.printSummary()
}

/**
 * 便捷函数：导出诊断日志
 */
export function exportRouteDiagnostics(): string {
  return routeDiagnostics.exportLogs()
}
