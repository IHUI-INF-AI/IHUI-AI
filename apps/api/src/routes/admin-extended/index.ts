/**
 * admin-extended 组合根(从原 frontend-stub-admin-routes.ts 拆分)。
 *
 * 拆分原则:
 * - 按业务域拆分到同目录下多个子文件,每文件单一业务域。
 * - 所有路由保留原始 method + path(API URL 0 改动)。
 * - requireAdmin preHandler 逐路由保留(原样),不提升到插件级。
 * - 响应格式 { code, message, data } 不变。
 *
 * server.ts 仍通过 frontend-stub-admin-routes.ts 的 barrel re-export 引用本组合根,
 * 注册时带 prefix: '/api',因此各子文件内的路径形如 '/admin/agent-rule/:id' 最终
 * 暴露为 '/api/admin/agent-rule/:id',与拆分前完全一致。
 */
import type { FastifyPluginAsync } from 'fastify'
import { agentRuleRoutes } from './agent-rule-routes.js'
import { agentTaskRoutes } from './agent-task-routes.js'
import { clawdbotRoutes } from './clawdbot-routes.js'
import { productIdentityRoutes } from './product-identity-routes.js'
import { memberLevelRoutes } from './member-level-routes.js'
import { zhsUserRoutes } from './zhs-user-routes.js'
import { themeRoutes } from './theme-routes.js'
import { userRoutes } from './user-routes.js'
import { orderRoutes } from './order-routes.js'
import { eduRoutes } from './edu-routes.js'
import { monitorRoutes } from './monitor-routes.js'
import { systemRoutes } from './system-routes.js'
import { customerServiceRoutes } from './customer-service-routes.js'
import { roleRoutes } from './role-routes.js'
import { deprecatedRoutes } from './deprecated-routes.js'

export const frontendAdminRoutes: FastifyPluginAsync = async (server) => {
  // 不加 prefix:子路由内已含完整路径(/admin/...),保证 URL 0 改动。
  server.register(agentRuleRoutes)
  server.register(agentTaskRoutes)
  server.register(clawdbotRoutes)
  server.register(productIdentityRoutes)
  server.register(memberLevelRoutes)
  server.register(zhsUserRoutes)
  server.register(themeRoutes)
  server.register(userRoutes)
  server.register(orderRoutes)
  server.register(eduRoutes)
  server.register(monitorRoutes)
  server.register(systemRoutes)
  server.register(customerServiceRoutes)
  server.register(roleRoutes)
  server.register(deprecatedRoutes)
}
