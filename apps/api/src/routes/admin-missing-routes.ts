/**
 * admin-missing-routes: 路由 hub,负责注册 admin/ 目录下所有子路由。
 * 原始实现已拆分到 admin/*.ts,本文件只保留注册逻辑。
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
}
