// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * other 路由组合根(从 frontend-stub-other-routes.ts 拆分)。
 *
 * 注册 authenticate preHandler 一次,所有子路由继承鉴权。
 * 子路由路径与原 frontend-stub-other-routes.ts 完全一致,API URL 0 改动。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/auth.js'
import {
  activityRoutes,
  addressRoutes,
  aiWorldRoutes,
  aiCapabilityRoutes,
  auditRoutes,
  businessCardRoutes,
  developerRoutes,
  dramaRoutes,
  historyRoutes,
  imageGenRoutes,
  knowledgeBaseRoutes,
  llmStreamRoutes,
  memberRoutes,
  messageRoutes,
  notesRoutes,
  notificationRoutes,
  ossResourceRoutes,
  pdfRoutes,
  recruitmentRoutes,
  serviceAppointmentRoutes,
  shareRoutes,
  studentProfileRoutes,
  studyPlanRoutes,
  tourRoutes,
  v1ContentRoutes,
  v1CustomerServiceRoutes,
  v1ToolsRoutes,
} from './_exports.js'

export const otherRoutes: FastifyPluginAsync = async (server) => {
  // preHandler 统一鉴权:authenticate 失败返回 401。
  // 原 frontend-stub-other-routes.ts 行为:所有子路由默认需登录,公开路由由各子路由在 handler 内 try/catch 自处理。
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send({ code: statusCode, message: '操作失败,请稍后重试' })
    }
  })

  await server.register(activityRoutes)
  await server.register(addressRoutes)
  await server.register(aiWorldRoutes)
  await server.register(aiCapabilityRoutes)
  await server.register(auditRoutes)
  await server.register(businessCardRoutes)
  await server.register(developerRoutes)
  await server.register(dramaRoutes)
  // historyRoutes 自 1b1b030493 写下就没进过这张表 —— 三个端点在线上恒 404(整条 -S 历史零命中,
  // 不是被谁摘掉的)。tests/browse-history-endpoints.test.ts 注册的正是本 barrel,所以它一直红。
  await server.register(historyRoutes)
  await server.register(imageGenRoutes)
  await server.register(knowledgeBaseRoutes)
  await server.register(llmStreamRoutes)
  await server.register(memberRoutes)
  await server.register(messageRoutes)
  await server.register(notesRoutes)
  await server.register(notificationRoutes)
  await server.register(ossResourceRoutes)
  await server.register(pdfRoutes)
  await server.register(recruitmentRoutes)
  await server.register(serviceAppointmentRoutes)
  await server.register(shareRoutes)
  await server.register(studentProfileRoutes)
  await server.register(studyPlanRoutes)
  await server.register(tourRoutes)
  await server.register(v1ContentRoutes)
  await server.register(v1CustomerServiceRoutes)
  await server.register(v1ToolsRoutes)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
