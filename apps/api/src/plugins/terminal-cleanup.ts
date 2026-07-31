/**
 * 终端 PTY 进程退出清理插件 — 防止僵尸 PTY。
 *
 * 仅通过 Fastify onClose 钩子清理 PTY session。
 *
 * 历史教训(2026-07-31 P0 资源泄露根因):
 * 早期版本在此处 `process.once('SIGINT'/'SIGTERM', () => { ...; process.exit(0) })`,
 * 由于插件在 buildServer() 期间加载,信号监听器**先于** apps/api/src/index.ts
 * 的 `process.on('SIGTERM', () => shutdown(...))` 注册。Node 按注册顺序调用监听器,
 * 这里的 `process.exit(0)` 会立即终止进程,导致 index.ts 的 shutdown() 根本不执行,
 * 所有 Fastify onClose 钩子(Redis/Queue/tenant-db/Worker/ws-*)全部跳过 →
 * tsx watch 频繁重启时连接句柄持续累积,出现 3791 chokidar 句柄泄露事故。
 *
 * 正确做法:进程信号统一由 index.ts / worker-entry.ts 的 shutdown() 接管,
 * shutdown() 会 `await server.close()`,触发本插件的 onClose 钩子调用 killAllSessions()。
 * 任何插件都不得自行调用 `process.exit()`,以免中断 shutdown 链路。
 */

import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { killAllSessions, getActiveSessionCount } from '../services/terminal-service.js'

const terminalCleanupPlugin: FastifyPluginAsync = async (server) => {
  // Fastify 关闭时清理 PTY session
  // shutdown() 调用 `await server.close()` 时触发,确保连接清理链路完整
  server.addHook('onClose', async () => {
    const count = getActiveSessionCount()
    if (count > 0) {
      server.log.info({ count }, 'terminal cleanup: killing PTY sessions on server close')
      killAllSessions()
    }
  })
}

export const terminalCleanup = fp(terminalCleanupPlugin, {
  name: 'terminal-cleanup',
  fastify: '5.x',
})

export default terminalCleanup
