/**
 * 调试脚本: 完整模拟生产环境 expiration-monitor 调度路径,
 * 暴露所有错误信息用于定位 28P01 根因。
 *
 * 关键点: 必须与 scheduler-worker 启动时同样的路径加载 .env
 *
 * 运行: cd apps/api && pnpm tsx --env-file=.env scripts/probe-exp-monitor-full.ts
 */
import { startExpirationMonitor } from '../src/services/expiration-monitor-service.js'
import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'

console.log('[probe] DATABASE_URL =', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))

try {
  const r1 = await db.execute(sql`SELECT current_user, session_user, inet_client_addr()`)
  console.log('[probe] db.execute OK:', JSON.stringify(r1))
} catch (e: any) {
  console.log('[probe] db.execute FAILED:', e?.message, '|', e?.code, '|', e?.severity)
  console.log('[probe] stack:', e?.stack?.split('\n').slice(0, 5).join('\n'))
}

try {
  const result = await startExpirationMonitor()
  console.log('[probe] monitor result:', JSON.stringify(result, null, 2))
} catch (e: any) {
  console.log('[probe] monitor FAILED:', e?.message, '|', e?.code)
  console.log('[probe] stack:', e?.stack?.split('\n').slice(0, 5).join('\n'))
}

process.exit(0)
