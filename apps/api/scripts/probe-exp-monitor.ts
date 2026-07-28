/**
 * 调试脚本: 直接调用 expiration-monitor 服务,
 * 暴露 PostgresError 完整堆栈,定位 28P01 根因。
 *
 * 运行: cd apps/api && node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node-loader.mjs", pathToFileURL("./"))' scripts/probe-exp-monitor.mjs
 * 或: pnpm tsx --env-file=.env scripts/probe-exp-monitor.ts
 */
process.loadEnvFile?.()
import { startExpirationMonitor } from '../src/services/expiration-monitor-service.js'

try {
  const result = await startExpirationMonitor()
  console.log('[probe] result:', JSON.stringify(result, null, 2))
} catch (e: unknown) {
  const err = e as { message?: string; code?: string; cause?: { message?: string }; stack?: string }
  console.log('[probe] fatal:', err?.message, '|', err?.code, '|', err?.cause?.message)
  console.log('[probe] stack:', err?.stack)
}
process.exit(0)
