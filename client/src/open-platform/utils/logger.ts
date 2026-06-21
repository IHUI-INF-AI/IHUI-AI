/**
 * 开放平台日志工具
 * 使用主项目的统一日志系统
 */

import { logger as baseLogger } from '../../utils/logger'

/**
 * 开放平台专用日志包装器
 * 添加 [open-platform] 前缀以便区分
 */
export const logger = {
  debug: (message: string, ...args: any[]): void => {
    baseLogger.debug(`[open-platform] ${message}`, args.length > 0 ? { args } : undefined)
  },
  info: (message: string, ...args: any[]): void => {
    baseLogger.info(`[open-platform] ${message}`, args.length > 0 ? { args } : undefined)
  },
  warn: (message: string, ...args: any[]): void => {
    baseLogger.warn(`[open-platform] ${message}`, args.length > 0 ? { args } : undefined)
  },
  error: (message: string, error?: Error | unknown, ...args: any[]): void => {
    baseLogger.error(`[open-platform] ${message}`, error, args.length > 0 ? { args } : undefined)
  },
}
