/**
 * 跨端日志工具(2026-07-27 立,从 apps/miniapp-taro/src/utils/logger.ts 迁移)
 *
 * 设计:
 * - 分级输出(error/warn/info/debug),currentLevel 控制最低输出级别
 * - 默认 error 级别(生产环境只输出 error,避免日志噪音)
 * - 跨端兼容:只用 console.error/warn/info,不依赖任何平台 API
 * - 签名统一:logger.error(module, action, err) / logger.warn(module, action, message) / logger.info(module, action, message)
 *
 * 消费者(2026-07-27 审计):
 * - miniapp-taro:`apps/miniapp-taro/src/utils/logger.ts` re-export 本 logger,
 *   30+ 处调用(三参数结构化,如 `logger.error('agentDialogue', 'ws 连接', e)`)
 *
 * 不消费此 logger 的端(避免误判为死代码):
 * - web:浏览器 SSR + PII 保护需求不同,独立实现 `apps/web/src/lib/logger.ts`
 *   (变参 `...args` + SSR 安全 + 生产只 error/warn + 不打印原始 error 对象)
 *   web 端 22 处调用与 shared 三参数签名不兼容,设计目标根本不同,
 *   两端 logger 各自存在是合理的端差异,非死代码。
 *
 * 用法:
 *   import { logger } from '@ihui/shared/utils/logger'
 *   logger.error('ranking/detail', '获取详情', err)
 *   logger.warn('auth', 'token过期', '请重新登录')
 *   logger.info('app', '启动', 'v1.0.0')
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const currentLevel: LogLevel = 'error'

export const logger = {
  error: (module: string, action: string, err: unknown) => {
    if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.error) {
      console.error(`[${module}] ${action} failed:`, err)
    }
  },
  warn: (module: string, action: string, message: string) => {
    if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.warn) {
      console.warn(`[${module}] ${action}: ${message}`)
    }
  },
  info: (module: string, action: string, message: string) => {
    if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.info) {
      console.info(`[${module}] ${action}: ${message}`)
    }
  },
}
