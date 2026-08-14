import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success } from '../utils/response.js'

/**
 * 元学习闭环路由 (F3 真实缺口补齐)。
 *
 * 注:meta-learner 为全新业务域,后端此前未落地(GET /status、/history 由通用
 * admin 参数路由兜底,但 /lessons、/agent-failures、/trigger 无任何实现)。
 * 其具体语义(从哪些技能/课程抽取 lessons、失败分类法 taxonomy、触发调度策略)
 * 需产品规格定义,故此处实现"结构正确、返回统一信封"的最小路由,绝不 404。
 * 待产品规格明确后,再接入 agent_meta_lessons 等表做真实写入/计算。
 */
const metaLearnerRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/admin/meta-learner/lessons
  server.get('/lessons', async (_req, reply) => {
    return reply.send(success({ lessons: [] }))
  })

  // POST /api/admin/meta-learner/agent-failures
  server.post('/agent-failures', async (request, reply) => {
    const parsed = z
      .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
      .safeParse(request.query)
    const limit = parsed.success ? (parsed.data.limit ?? 50) : 50
    return reply.send(
      success({
        agentErrors: { total: 0, byType: {} },
        toolFailures: { total: 0, byType: {} },
        failedCheckpoints: 0,
        recent: [],
        limit,
        note: '需产品规格深化:失败分类法与数据来源待定义',
      }),
    )
  })

  // POST /api/admin/meta-learner/trigger
  server.post('/trigger', async (_req, reply) => {
    return reply.send(
      success({
        status: 'pending_product_spec',
        message: '元学习闭环触发逻辑待产品规格定义',
      }),
    )
  })
}

export default metaLearnerRoutes
