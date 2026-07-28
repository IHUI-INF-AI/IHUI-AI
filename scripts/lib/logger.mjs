/**
 * logger.mjs — 守门脚本共享的 logger 工具
 *
 * 背景(2026-07-27 立,批次 8-P2 工程治理技术债):
 *   原 check-parent-pollution.mjs / check-workspace-hygiene.mjs / check-api-key-leak.mjs 等
 *   各自直接 console.log / console.error,且 check-parent-pollution.mjs 自己实现了
 *   --quiet 静默模式(if (!isQuiet) console.log(...)),逻辑分散重复。
 *
 * 设计:
 *   - 导出 createLogger(opts):返回 { info, warn, error, debug, isQuiet, isDebug }
 *     - info: 普通信息(✅ 成功 / 进度),--quiet 时静默
 *     - warn: 警告(⚠️ 提醒),--quiet 时静默
 *     - error: 错误/主报告(❌ 阻塞报告),始终输出(--quiet 不影响)
 *     - debug: 调试信息,需要 --debug 或 DEBUG 环境变量,且 --quiet 时静默
 *   - 自动检测 --quiet / --debug 命令行参数(可通过 opts 覆盖)
 *   - 导出 COLORS:ANSI 颜色常量(供脚本拼接彩色消息使用)
 *   - 零依赖,只用 Node.js 内置 console
 *
 * --quiet 语义:
 *   - 抑制 info / warn / debug 输出
 *   - 保留 error 输出(脚本主报告/阻塞信息始终可见,便于 CI/agent 读取)
 *
 * 用法:
 *   import { createLogger, COLORS } from './lib/logger.mjs'
 *   const log = createLogger()
 *   log.info('✅ 扫描完成')
 *   log.error('❌ 发现违规')
 *   const C = COLORS
 *   console.log(`${C.green}...${C.reset}`)
 */

const COLORS = Object.freeze({
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
})

/**
 * 创建 logger 实例。
 * @param {object} [opts]
 * @param {boolean} [opts.quiet] 显式指定 quiet 模式(默认从 --quiet 参数推导)
 * @param {boolean} [opts.debug] 显式指定 debug 模式(默认从 --debug 或 DEBUG 环境变量推导)
 * @returns {{info: Function, warn: Function, error: Function, debug: Function, isQuiet: Function, isDebug: Function}}
 */
function createLogger(opts = {}) {
  const argv = process.argv.slice(2)
  const quiet = opts.quiet ?? argv.includes('--quiet')
  const debugOn = opts.debug ?? (argv.includes('--debug') || !!process.env.DEBUG)

  return {
    info: (...a) => {
      if (!quiet) console.log(...a)
    },
    warn: (...a) => {
      if (!quiet) console.warn(...a)
    },
    error: (...a) => {
      console.error(...a)
    },
    debug: (...a) => {
      if (debugOn && !quiet) console.log(...a)
    },
    isQuiet: () => quiet,
    isDebug: () => debugOn && !quiet,
  }
}

export { createLogger, COLORS }
