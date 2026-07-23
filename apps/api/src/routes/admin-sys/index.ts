import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { operlogAuditOnResponse } from './_audit-hook.js'
import { menuRoutes } from './menu-routes.js'
import { roleRoutes } from './role-routes.js'
import { logininforRoutes } from './logininfor-routes.js'
import { noticeRoutes } from './notice-routes.js'
import { jobRoutes } from './job-routes.js'
import { jobLogRoutes } from './job-log-routes.js'
import { onlineRoutes } from './online-routes.js'
import { deptRoutes } from './dept-routes.js'
import { postRoutes } from './post-routes.js'
import { configRoutes } from './config-routes.js'
import { dictTypeRoutes } from './dict-type-routes.js'
import { dictDataRoutes } from './dict-data-routes.js'
import { operlogRoutes } from './operlog-routes.js'
import { aliasRoutes } from './alias-routes.js'
import { userRoutes } from './user-routes.js'

// 主插件:系统管理后端(迁移自原 admin-sys.ts)
// - preHandler: requireAdmin(所有子路由继承)
// - onResponse: operlog 审计埋点(异步记录写操作)
// - 子路由按业务域拆分,前缀与原 admin-sys.ts 完全一致
export const adminSysRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.addHook('onResponse', operlogAuditOnResponse)

  server.register(menuRoutes, { prefix: '/sys-menu' })
  server.register(roleRoutes, { prefix: '/role' })
  server.register(logininforRoutes, { prefix: '/logininfor' })
  server.register(noticeRoutes, { prefix: '/notice' })
  server.register(jobRoutes, { prefix: '/job' })
  server.register(jobLogRoutes, { prefix: '/job/log' })
  server.register(onlineRoutes, { prefix: '/online' })
  server.register(deptRoutes, { prefix: '/dept' })
  server.register(postRoutes, { prefix: '/post' })
  server.register(configRoutes, { prefix: '/config' })
  server.register(dictTypeRoutes, { prefix: '/dict/type' })
  server.register(dictDataRoutes, { prefix: '/dict/data' })
  server.register(operlogRoutes, { prefix: '/operlog' })
  server.register(aliasRoutes)
  server.register(userRoutes, { prefix: '/users' })
}

export { menuRoutersRoutes } from './menu-routers-routes.js'
