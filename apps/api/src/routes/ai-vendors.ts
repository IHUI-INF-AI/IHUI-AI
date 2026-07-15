/**
 * R4 AI 厂商专属多模态后端路由(HUB)。
 *
 * 拆分说明(R4 重构):原 2567 行单体文件按职责拆为 4 个 ≤800 行子路由 + 共享模块:
 *   - ai-vendors/_shared.ts        共享 schema / VENDORS / 工具函数(422 行)
 *   - ai-vendors/proxy-llm.ts      LLM:Dashscope + Doubao + Gemini + V2 样板(473 行)
 *   - ai-vendors/proxy-media.ts    多媒体:Suno + Sora2(134 行)
 *   - ai-vendors/proxy-tools.ts    工具:Coze + Bailian + JiMeng4 + N8N + Coze workflow + Kling(753 行)
 *   - ai-vendors/proxy-extended.ts 扩展:Tencent + Volcengine + 通用端点 + Admin(728 行)
 *
 * 注册(server.ts):
 *   server.register(aiVendorRoutes, { prefix: '/api/ai' })
 *   server.register(adminAiVendorRoutes, { prefix: '/api/admin/ai' })
 *   server.register(aiVendorV2Routes, { prefix: '/api/ai' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from './ai-vendors/_shared.js'
import { llmVendorRoutes, llmVendorV2Routes } from './ai-vendors/proxy-llm.js'
import { mediaVendorRoutes } from './ai-vendors/proxy-media.js'
import { toolsVendorRoutes } from './ai-vendors/proxy-tools.js'
import { extendedVendorRoutes, adminAiVendorRoutes } from './ai-vendors/proxy-extended.js'

export const aiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })
  await server.register(llmVendorRoutes)
  await server.register(mediaVendorRoutes)
  await server.register(toolsVendorRoutes)
  await server.register(extendedVendorRoutes)
}

export { adminAiVendorRoutes }

export const aiVendorV2Routes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })
  await server.register(llmVendorV2Routes)
}

export { cloneTimbre } from './ai-vendors/_shared.js'
