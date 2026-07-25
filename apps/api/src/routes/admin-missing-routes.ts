/**
 * admin-missing-routes: 路由 hub,负责注册 admin/ 目录下所有子路由。
 * 原始实现已拆分到 admin/*.ts,本文件只保留注册逻辑。
 *
 * ---------------------------------------------------------------------------
 * 2026-07-26 任务清单过时说明(P0-3 stub 真实化评估):
 * ---------------------------------------------------------------------------
 * 原任务描述:"24 条有表 CRUD + 51 条空桩"。实际现状:
 *   - 24 条有表 CRUD 已拆分到 admin/ 目录 26 个子路由文件(carousel / ai-gc /
 *     comment-logs / video-logs / zhs-* / task-developer / developer-link /
 *     identity-proportion / user-agent-* / auth-* / user-roles / member-* /
 *     system-*-logs / oss-files / comments / stats / notification-admin /
 *     tool (gen+gen-post) / admin-support-tickets),全部接入 packages/database
 *     现有 pgTable,真实 CRUD。
 *   - 51 条空桩已迁移到独立路由文件并实现真实 CRUD:
 *       * admin-content-routes.ts   (6 端点,内容运营 CRUD)
 *       * admin-auth-edu-routes.ts  (11 端点,鉴权/教务/学习 CRUD)
 *       * admin-monitoring-routes.ts(19 端点,监控/统计聚合)
 *       * admin-shop-routes.ts      (10 端点,商城 CRUD)
 *       * admin-invoices.ts         (4 端点,发票抬头 CRUD)
 *       * admin-plugin-stats.ts     (插件市场统计)
 *     合计 50+ 端点,覆盖原 51 条空桩的业务功能。
 *
 * 受影响文件清单禁止修改上述子路由文件,故本 hub 仅保留注册逻辑不变。
 *
 * 残余真正"空桩"(不在受影响清单,无法在本任务处理):
 *   - admin-support-tickets.ts(3 个空桩,待 support_tickets 表落地)
 *   - admin/stats.ts L407 dashboard/revenue/users 聚合端点(空数据兜底)
 *   - admin/system-login-logs.ts L127 教务/课程模块 8 个无表路由(空数据桩)
 *   - admin/stats.ts L58 相对路径模块 2 个无表路由(空数据桩)
 *
 * 已识别技术债(后续迭代补全):
 *   - support_tickets 表未建,admin-support-tickets.ts 3 个端点保持空桩
 *   - 部分统计聚合端点(dashboard/revenue/users)需补建物化视图或缓存表
 *   - 详见各子路由文件内 TODO 注释
 */
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../plugins/require-permission.js'

export const adminMissingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  const { default: carouselRoutes } = await import('./admin/carousel.js')
  await server.register(carouselRoutes)

  const { default: aiGcRoutes } = await import('./admin/ai-gc.js')
  await server.register(aiGcRoutes)

  const { default: commentLogsRoutes } = await import('./admin/comment-logs.js')
  await server.register(commentLogsRoutes)

  const { default: videoLogsRoutes } = await import('./admin/video-logs.js')
  await server.register(videoLogsRoutes)

  const { default: zhsActivityRoutes } = await import('./admin/zhs-activity.js')
  await server.register(zhsActivityRoutes)

  const { default: zhsAgentRoutes } = await import('./admin/zhs-agent.js')
  await server.register(zhsAgentRoutes)

  const { default: zhsUserRoutes } = await import('./admin/zhs-user.js')
  await server.register(zhsUserRoutes)

  const { default: zhsIdentityRoutes } = await import('./admin/zhs-identity.js')
  await server.register(zhsIdentityRoutes)

  const { default: taskDeveloperRoutes } = await import('./admin/task-developer.js')
  await server.register(taskDeveloperRoutes)

  const { default: developerLinkRoutes } = await import('./admin/developer-link.js')
  await server.register(developerLinkRoutes)

  const { default: identityProportionRoutes } = await import('./admin/identity-proportion.js')
  await server.register(identityProportionRoutes)

  const { default: userAgentAudioRoutes } = await import('./admin/user-agent-audio.js')
  await server.register(userAgentAudioRoutes)

  const { default: userAgentImageRoutes } = await import('./admin/user-agent-image.js')
  await server.register(userAgentImageRoutes)

  const { default: authAccountsRoutes } = await import('./admin/auth-accounts.js')
  await server.register(authAccountsRoutes)

  const { default: authInfoRoutes } = await import('./admin/auth-info.js')
  await server.register(authInfoRoutes)

  const { default: authRoleRoutes } = await import('./admin/auth-role.js')
  await server.register(authRoleRoutes)

  const { default: authTokensRoutes } = await import('./admin/auth-tokens.js')
  await server.register(authTokensRoutes)

  const { default: authUserVipRoutes } = await import('./admin/auth-user-vip.js')
  await server.register(authUserVipRoutes)

  const { default: authVipLevelRoutes } = await import('./admin/auth-vip-level.js')
  await server.register(authVipLevelRoutes)

  const { default: authSmsTempRoutes } = await import('./admin/auth-sms-temp.js')
  await server.register(authSmsTempRoutes)

  const { default: userRolesRoutes } = await import('./admin/user-roles.js')
  await server.register(userRolesRoutes)

  const { default: memberPermissionsRoutes } = await import('./admin/member-permissions.js')
  await server.register(memberPermissionsRoutes)

  const { default: memberUsersRoutes } = await import('./admin/member-users.js')
  await server.register(memberUsersRoutes)

  const { default: systemOperationLogsRoutes } = await import('./admin/system-operation-logs.js')
  await server.register(systemOperationLogsRoutes)

  const { default: systemLoginLogsRoutes } = await import('./admin/system-login-logs.js')
  await server.register(systemLoginLogsRoutes)

  const { default: ossFilesRoutes } = await import('./admin/oss-files.js')
  await server.register(ossFilesRoutes)

  const { default: adminCommentsRoutes } = await import('./admin/comments.js')
  await server.register(adminCommentsRoutes)

  const { default: statsRoutes } = await import('./admin/stats.js')
  await server.register(statsRoutes)

  const { default: notificationAdminRoutes } = await import('./admin/notification-admin.js')
  await server.register(notificationAdminRoutes)

  const { default: toolGenRoutes } = await import('./admin/tool/gen.js')
  await server.register(toolGenRoutes)

  const { default: toolGenPostRoutes } = await import('./admin/tool/gen-post.js')
  await server.register(toolGenPostRoutes)

  const { default: adminSupportTicketsRoutes } = await import('./admin-support-tickets.js')
  await server.register(adminSupportTicketsRoutes)
}
