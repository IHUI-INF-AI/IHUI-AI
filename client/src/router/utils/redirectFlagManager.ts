/**
 * 重定向标志管理器
 * 
 * 用于管理路由重定向标志，防止路由循环
 * 提供更可靠的标志管理机制，替代直接使用 sessionStorage
 */

import { logger } from '@/utils/logger'

/**
 * 标志项接口
 */
interface FlagItem {
  key: string
  expiry: number
  value: string
}

/**
 * 重定向标志管理器
 */
export class RedirectFlagManager {
  private flags = new Map<string, FlagItem>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly CLEANUP_INTERVAL = 5000 // 5秒清理一次过期标志
  private readonly DEFAULT_TTL = 10000 // 默认10秒过期

  constructor() {
    this.startCleanup()
  }

  /**
   * Setting flag
   * @param key 标志键
   * @param value 标志值（可选，默认为 'true'）
   * @param ttl 存活时间（毫秒），默认10秒
   */
  setFlag(key: string, value = 'true', ttl = this.DEFAULT_TTL): void {
    const expiry = Date.now() + ttl
    this.flags.set(key, { key, expiry, value })
    logger.debug(`[RedirectFlagManager] Setting flag: ${key}, TTL: ${ttl}ms`)
  }

  /**
   * 检查标志是否存在且未过期
   * @param key 标志键
   * @returns 标志是否存在
   */
  hasFlag(key: string): boolean {
    const flag = this.flags.get(key)
    if (!flag) {
      return false
    }

    if (Date.now() > flag.expiry) {
      this.flags.delete(key)
      return false
    }

    return true
  }

  /**
   * 获取标志值
   * @param key 标志键
   * @returns 标志值，如果不存在或已过期返回 null
   */
  getFlag(key: string): string | null {
    const flag = this.flags.get(key)
    if (!flag) {
      return null
    }

    if (Date.now() > flag.expiry) {
      this.flags.delete(key)
      return null
    }

    return flag.value
  }

  /**
   * Clearing flag
   * @param key 标志键
   */
  clearFlag(key: string): void {
    this.flags.delete(key)
    logger.debug(`[RedirectFlagManager] Clearing flag: ${key}`)
  }

  /**
   * Clearing all flags
   */
  clearAllFlags(): void {
    const count = this.flags.size
    this.flags.clear()
    logger.debug(`[RedirectFlagManager] Clearing all flags: ${count} items`)
  }

  /**
   * Clearing expired flags
   */
  clearExpiredFlags(): void {
    const now = Date.now()
    let clearedCount = 0

    for (const [key, flag] of this.flags.entries()) {
      if (now > flag.expiry) {
        this.flags.delete(key)
        clearedCount++
      }
    }

    if (clearedCount > 0) {
      logger.debug(`[RedirectFlagManager] Clearing expired flags: ${clearedCount} items`)
    }
  }

  /**
   * 获取所有有效标志
   * @returns 有效标志列表
   */
  getValidFlags(): FlagItem[] {
    const now = Date.now()
    const validFlags: FlagItem[] = []

    for (const flag of this.flags.values()) {
      if (now <= flag.expiry) {
        validFlags.push(flag)
      }
    }

    return validFlags
  }

  /**
   * 检查是否有任何重定向标志
   * @param prefix 标志前缀（可选）
   * @returns 是否存在重定向标志
   */
  hasAnyRedirectFlag(prefix = '__redirecting_'): boolean {
    const now = Date.now()
    for (const [key, flag] of this.flags.entries()) {
      if (key.startsWith(prefix) && now <= flag.expiry) {
        return true
      }
    }
    return false
  }

  /**
   * 获取所有重定向标志
   * @param prefix 标志前缀（可选）
   * @returns 重定向标志列表
   */
  getRedirectFlags(prefix = '__redirecting_'): FlagItem[] {
    const now = Date.now()
    const redirectFlags: FlagItem[] = []

    for (const flag of this.flags.values()) {
      if (flag.key.startsWith(prefix) && now <= flag.expiry) {
        redirectFlags.push(flag)
      }
    }

    return redirectFlags
  }

  /**
   * 清除所有重定向标志
   * @param prefix 标志前缀（可选）
   */
  clearRedirectFlags(prefix = '__redirecting_'): void {
    const now = Date.now()
    let clearedCount = 0

    for (const [key, flag] of this.flags.entries()) {
      if (key.startsWith(prefix)) {
        // 清除过期或所有标志
        if (now > flag.expiry) {
          this.flags.delete(key)
          clearedCount++
        }
      }
    }

    if (clearedCount > 0) {
      logger.debug(`[RedirectFlagManager] Clearing redirect flags: ${clearedCount} items`)
    }
  }

  /**
   * Starting periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return
    }

    this.cleanupInterval = setInterval(() => {
      this.clearExpiredFlags()
    }, this.CLEANUP_INTERVAL)

    logger.debug('[RedirectFlagManager] Starting periodic cleanup')
  }

  /**
   * Stopping periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logger.debug('[RedirectFlagManager] Stopping periodic cleanup')
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopCleanup()
    this.clearAllFlags()
    logger.debug('[RedirectFlagManager] Destroyed')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalFlags: number
    validFlags: number
    expiredFlags: number
    redirectFlags: number
  } {
    const now = Date.now()
    let validCount = 0
    let expiredCount = 0
    let redirectCount = 0

    for (const flag of this.flags.values()) {
      if (now > flag.expiry) {
        expiredCount++
      } else {
        validCount++
      }

      if (flag.key.startsWith('__redirecting_')) {
        redirectCount++
      }
    }

    return {
      totalFlags: this.flags.size,
      validFlags: validCount,
      expiredFlags: expiredCount,
      redirectFlags: redirectCount,
    }
  }
}

/**
 * 创建全局重定向标志管理器实例
 */
export const redirectFlagManager = new RedirectFlagManager()

/**
 * 便捷函数：设置重定向标志
 */
export function setRedirectFlag(key: string, value = 'true', ttl = 10000): void {
  redirectFlagManager.setFlag(key, value, ttl)
}

/**
 * 便捷函数：检查重定向标志
 */
export function hasRedirectFlag(key: string): boolean {
  return redirectFlagManager.hasFlag(key)
}

/**
 * 便捷函数：获取重定向标志
 */
export function getRedirectFlag(key: string): string | null {
  return redirectFlagManager.getFlag(key)
}

/**
 * 便捷函数：Clearing redirect flags
 */
export function clearRedirectFlag(key: string): void {
  redirectFlagManager.clearFlag(key)
}

/**
 * 便捷函数：检查是否有任何重定向标志
 */
export function hasAnyRedirectFlag(prefix = '__redirecting_'): boolean {
  return redirectFlagManager.hasAnyRedirectFlag(prefix)
}

/**
 * 便捷函数：清除所有重定向标志
 */
export function clearAllRedirectFlags(prefix = '__redirecting_'): void {
  redirectFlagManager.clearRedirectFlags(prefix)
}
