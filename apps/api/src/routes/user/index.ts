/**
 * user 路由组合根(从 missing-user-routes.ts 拆分)。
 * 统一注册鉴权 preHandler + 23 个业务域子路由,端点路径与行为完全等价于原文件。
 */
import type { FastifyPluginAsync } from 'fastify'
import { userAuthPreHandler } from './_shared.js'
import articlesRoutes from './articles-routes.js'
import knowledgeRoutes from './knowledge-routes.js'
import studyRoutes from './study-routes.js'
import mcpRoutes from './mcp-routes.js'
import openclawRoutes from './openclaw-routes.js'
import proxyRoutes from './proxy-routes.js'
import settingsRoutes from './settings-routes.js'
import aiModelsRoutes from './ai-models-routes.js'
import aigcRoutes from './aigc-routes.js'
import courseRoutes from './course-routes.js'
import developerRoutes from './developer-routes.js'
import commissionRoutes from './commission-routes.js'
import miscRoutes from './misc-routes.js'
import paymentRoutes from './payment-routes.js'
import withdrawalRoutes from './withdrawal-routes.js'
import fundRoutes from './fund-routes.js'
import aiModulesRoutes from './ai-modules-routes.js'
import aiFeedRoutes from './ai-feed-routes.js'
import resourcesRoutes from './resources-routes.js'
import skillsRoutes from './skills-routes.js'
import memberRoutes from './member-routes.js'
import aiUsersRoutes from './ai-users-routes.js'
import aiCapabilitiesRoutes from './ai-capabilities-routes.js'

export const missingUserRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', userAuthPreHandler)
  await server.register(articlesRoutes)
  await server.register(knowledgeRoutes)
  await server.register(studyRoutes)
  await server.register(mcpRoutes)
  await server.register(openclawRoutes)
  await server.register(proxyRoutes)
  await server.register(settingsRoutes)
  await server.register(aiModelsRoutes)
  await server.register(aigcRoutes)
  await server.register(courseRoutes)
  await server.register(developerRoutes)
  await server.register(commissionRoutes)
  await server.register(miscRoutes)
  await server.register(paymentRoutes)
  await server.register(withdrawalRoutes)
  await server.register(fundRoutes)
  await server.register(aiModulesRoutes)
  await server.register(aiFeedRoutes)
  await server.register(resourcesRoutes)
  await server.register(skillsRoutes)
  await server.register(memberRoutes)
  await server.register(aiUsersRoutes)
  await server.register(aiCapabilitiesRoutes)
}
