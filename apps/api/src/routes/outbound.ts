/**
 * 外呼业务编排路由(迁移自 coze_zhs_py/api/outbound.py)。
 *
 * 内存存储外呼任务,管理创建/列表/启动/停止/统计生命周期。
 *
 * 注册(server.ts):
 *   server.register(outboundRoutes, { prefix: '/api/outbound' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { generateCompactId } from '../utils/crypto-random.js'

interface OutboundCampaign {
  id: string
  name: string
  userId: string
  script: string
  phoneList: string[]
  status: 'created' | 'running' | 'paused' | 'stopped' | 'completed'
  totalCalls: number
  answeredCalls: number
  failedCalls: number
  createdAt: number
  updatedAt: number
  startedAt?: number
}

const campaignStore = new Map<string, OutboundCampaign>()

// 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成外呼活动 ID
// 风险:可预测活动 ID → 攻击者枚举其他用户/团队外呼活动 → 越权访问/数据泄露
function genId(prefix: string): string {
  return generateCompactId(prefix)
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  script: z.string().min(1),
  phoneList: z.array(z.string().min(1)).min(1),
})

const listQuery = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const idParam = z.object({ id: z.string().min(1) })

export const outboundRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // POST /campaign — 创建外呼任务
  server.post('/campaign', async (request, reply) => {
    const body = createSchema.parse(request.body)
    const campaign: OutboundCampaign = {
      id: genId('campaign'),
      name: body.name,
      userId: request.userId!,
      script: body.script,
      phoneList: body.phoneList,
      status: 'created',
      totalCalls: body.phoneList.length,
      answeredCalls: 0,
      failedCalls: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    campaignStore.set(campaign.id, campaign)
    return reply.status(201).send(success(campaign))
  })

  // GET /campaign — 查询任务列表(当前用户,分页)
  server.get('/campaign', async (request, reply) => {
    const query = listQuery.parse(request.query)
    let list = Array.from(campaignStore.values()).filter((c) => c.userId === request.userId)
    if (query.status) list = list.filter((c) => c.status === query.status)
    list.sort((a, b) => b.createdAt - a.createdAt)
    const start = (query.page - 1) * query.pageSize
    const paged = list.slice(start, start + query.pageSize)
    return reply.send(
      success({ list: paged, total: list.length, page: query.page, pageSize: query.pageSize }),
    )
  })

  // POST /campaign/:id/start — 启动外呼
  server.post('/campaign/:id/start', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const campaign = campaignStore.get(id)
    if (!campaign) return reply.status(404).send(error(404, '任务不存在'))
    if (campaign.userId !== request.userId)
      return reply.status(403).send(error(403, '无权操作该任务'))
    if (campaign.status === 'running') {
      return reply.status(400).send(error(400, '任务已在运行中'))
    }
    if (campaign.status === 'completed' || campaign.status === 'stopped') {
      return reply.status(400).send(error(400, `任务已处于终态: ${campaign.status}`))
    }
    campaign.status = 'running'
    campaign.startedAt = Date.now()
    campaign.updatedAt = Date.now()
    return reply.send(success(campaign))
  })

  // POST /campaign/:id/stop — 停止外呼
  server.post('/campaign/:id/stop', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const campaign = campaignStore.get(id)
    if (!campaign) return reply.status(404).send(error(404, '任务不存在'))
    if (campaign.userId !== request.userId)
      return reply.status(403).send(error(403, '无权操作该任务'))
    if (campaign.status !== 'running') {
      return reply.status(400).send(error(400, `任务当前状态: ${campaign.status},无法停止`))
    }
    campaign.status = 'stopped'
    campaign.updatedAt = Date.now()
    return reply.send(success(campaign))
  })

  // GET /campaign/:id/stats — 统计数据
  server.get('/campaign/:id/stats', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const campaign = campaignStore.get(id)
    if (!campaign) return reply.status(404).send(error(404, '任务不存在'))
    if (campaign.userId !== request.userId)
      return reply.status(403).send(error(403, '无权访问该任务'))
    return reply.send(
      success({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalCalls: campaign.totalCalls,
        answeredCalls: campaign.answeredCalls,
        failedCalls: campaign.failedCalls,
        pendingCalls: campaign.totalCalls - campaign.answeredCalls - campaign.failedCalls,
        answerRate: campaign.totalCalls === 0 ? 0 : campaign.answeredCalls / campaign.totalCalls,
        durationMs: campaign.startedAt ? Date.now() - campaign.startedAt : 0,
      }),
    )
  })
}
