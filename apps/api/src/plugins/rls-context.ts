/**
 * RLS 上下文中间件。
 *
 * 作用:为每个 HTTP 请求设置 PostgreSQL 会话变量 app.current_user_id 和
 * app.current_user_role,供 RLS 策略(current_setting)使用。
 *
 * 关键点:
 * 1. 必须在每个请求开始时设置,PostgreSQL 连接池中连接可能被复用,跨请求
 *    的 session 变量会污染。
 * 2. 用 SET LOCAL(在事务中)更安全,但 Drizzle ORM + postgres-js 走 auto-commit,
 *    故使用 set_config 第三参数 false(session 级,非 transaction 级),
 *    下次请求时会被覆盖。
 * 3. 当前应用以 postgres 超级用户连接,RLS 默认不生效;仅当未来切换到
 *    app_user 非超级用户角色时 RLS 才会真正拦截。
 * 4. 未认证请求(无 userId)不设置变量,RLS 会拒绝所有访问(零信任)。
 *
 * 部署启用 RLS 步骤:
 *   1. CREATE ROLE app_user WITH LOGIN PASSWORD '...';
 *   2. GRANT USAGE ON SCHEMA public TO app_user;
 *   3. GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
 *   4. 切换 DATABASE_URL 到 app_user
 *   5. 启动服务,RLS 自动生效
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

const rlsContextPlugin: FastifyPluginAsync = async (server) => {
  // 每个请求开始时设置会话变量
  server.addHook('onRequest', async (request: FastifyRequest) => {
    if (!request.url.startsWith('/api/')) return

    const userId = request.userId
    const roleId = request.jwtPayload?.roleId ?? 0

    if (!userId) {
      await clearRlsContext()
      return
    }

    await setRlsContext(userId, roleId)
  })
}

async function setRlsContext(userId: string, roleId: number): Promise<void> {
  try {
    await db.execute(
      sql`SELECT set_config('app.current_user_id', ${userId}, false), set_config('app.current_user_role', ${String(roleId)}, false)`,
    )
  } catch (e) {
    console.error('[rls-context] setRlsContext failed:', (e as Error).message)
  }
}

async function clearRlsContext(): Promise<void> {
  try {
    await db.execute(
      sql`SELECT set_config('app.current_user_id', '', false), set_config('app.current_user_role', '', false)`,
    )
  } catch {
    // ignore
  }
}

export default fp(rlsContextPlugin, {
  name: 'rls-context-plugin',
})

/**
 * 单元测试辅助:直接设置 RLS 上下文(供 vitest 使用)
 */
export async function withRlsContext<T>(
  userId: string,
  roleId: number,
  fn: () => Promise<T>,
): Promise<T> {
  await setRlsContext(userId, roleId)
  try {
    return await fn()
  } finally {
    await clearRlsContext()
  }
}
