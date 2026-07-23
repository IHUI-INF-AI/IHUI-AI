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
  imageGenRoutes,
  knowledgeBaseRoutes,
  llmStreamRoutes,
  memberRoutes,
  messageRoutes,
  notesRoutes,
  notificationRoutes,
  ossResourceRoutes,
  pdfRoutes,
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
      return reply
        .status(statusCode)
        .send({ code: statusCode, message: (e as Error).message || 'Authentication required' })
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
  await server.register(imageGenRoutes)
  await server.register(knowledgeBaseRoutes)
  await server.register(llmStreamRoutes)
  await server.register(memberRoutes)
  await server.register(messageRoutes)
  await server.register(notesRoutes)
  await server.register(notificationRoutes)
  await server.register(ossResourceRoutes)
  await server.register(pdfRoutes)
  await server.register(serviceAppointmentRoutes)
  await server.register(shareRoutes)
  await server.register(studentProfileRoutes)
  await server.register(studyPlanRoutes)
  await server.register(tourRoutes)
  await server.register(v1ContentRoutes)
  await server.register(v1CustomerServiceRoutes)
  await server.register(v1ToolsRoutes)
}
