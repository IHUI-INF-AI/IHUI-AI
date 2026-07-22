/**
 * 终端 PTY 进程退出清理插件 — 防止僵尸 PTY。
 *
 * 在 Fastify onClose + process SIGINT/SIGTERM 时 kill 所有 PTY session。
 * 注册为 Fastify 插件,hook onClose。
 *
 * 注意:process.on('SIGINT'/'SIGTERM') 直接调用 killAllSessions(),
 * 因为 process 退出时 Fastify onClose 钩子可能来不及执行。
 */

import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { killAllSessions, getActiveSessionCount } from '../services/terminal-service.js'

const terminalCleanupPlugin: FastifyPluginAsync = async (server) => {
  // Fastify 关闭时清理
  server.addHook('onClose', async () => {
    const count = getActiveSessionCount()
    if (count > 0) {
      server.log.info({ count }, 'terminal cleanup: killing PTY sessions on server close')
      killAllSessions()
    }
  })
}

// 进程信号钩子(防 SIGINT/SIGTERM 时 PTY 僵尸)
// 使用 once 避免重复注册(热重载场景)
let signalHandlersRegistered = false
function registerSignalHandlers(): void {
  if (signalHandlersRegistered) return
  signalHandlersRegistered = true

  const cleanup = (signal: string) => {
    try {
      const count = getActiveSessionCount()
      if (count > 0) {
        // eslint-disable-next-line no-console
        console.log(`[terminal-cleanup] ${signal}: killing ${count} PTY sessions`)
        killAllSessions()
      }
    } catch {
      /* ignore */
    }
    // 允许进程退出(不阻止默认行为)
    process.exit(0)
  }

  process.once('SIGINT', () => cleanup('SIGINT'))
  process.once('SIGTERM', () => cleanup('SIGTERM'))
}

registerSignalHandlers()

export const terminalCleanup = fp(terminalCleanupPlugin, {
  name: 'terminal-cleanup',
  fastify: '5.x',
})

export default terminalCleanup
