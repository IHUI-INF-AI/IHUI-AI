import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eduPointChannels, eduPoints } from '@ihui/database'
import { increasePoints } from '../db/point-queries.js'

interface PointRule {
  channelCode: string
  pointCode: string
  amount: number
  remark: string
}

const POINT_RULES: { match: (method: string, url: string) => PointRule | null } = {
  match(method: string, url: string): PointRule | null {
    const m = method.toUpperCase()
    const path = url.split('?')[0] ?? ''

    if (m === 'POST' && /^\/api\/follows\/[a-f0-9-]{36}$/i.test(path)) {
      return { channelCode: 'social', pointCode: 'follow', amount: 5, remark: '关注奖励' }
    }
    if (m === 'POST' && path === '/api/checkin') {
      return { channelCode: 'sign', pointCode: 'signin', amount: 10, remark: '签到奖励' }
    }
    if (m === 'POST' && path === '/api/exam/submit-answers') {
      return { channelCode: 'exam', pointCode: 'exam_complete', amount: 50, remark: '完成考试奖励' }
    }
    return null
  },
}

async function resolveRule(rule: PointRule): Promise<{
  channelId: string
  pointId: string
} | null> {
  const [channel, point] = await Promise.all([
    db
      .select({ id: eduPointChannels.id })
      .from(eduPointChannels)
      .where(eq(eduPointChannels.code, rule.channelCode))
      .limit(1),
    db
      .select({ id: eduPoints.id })
      .from(eduPoints)
      .where(eq(eduPoints.code, rule.pointCode))
      .limit(1),
  ])
  if (!channel[0] || !point[0]) return null
  return { channelId: channel[0].id, pointId: point[0].id }
}

/**
 * 行为触发积分奖励(等价 Java PointAspect)。
 *
 * onResponse 钩子:拦截 POST /api/follows/:userId(+5)、/api/checkin(+10)、
 * /api/exam/submit-answers(+50),响应成功(200/201)时调用 increasePoints。
 * 积分规则通过 channel.code + point.code 查表解析,失败不阻塞主请求。
 */
const pointAspectPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase()
    const url = request.url.split('?')[0] ?? ''
    const rule = POINT_RULES.match(method, url)
    if (!rule) return

    if (reply.statusCode !== 200 && reply.statusCode !== 201) return

    const userId = request.userId ?? request.jwtPayload?.userId
    if (!userId) return

    setImmediate(() => {
      ;(async () => {
        try {
          const resolved = await resolveRule(rule)
          if (!resolved) {
            server.log.warn(
              { channelCode: rule.channelCode, pointCode: rule.pointCode },
              'point-aspect: rule channel/point not found, skip',
            )
            return
          }
          await increasePoints({
            memberId: userId,
            channelId: resolved.channelId,
            pointId: resolved.pointId,
            amount: rule.amount,
            remark: rule.remark,
          })
        } catch (e) {
          server.log.warn({ err: e }, 'point-aspect: increasePoints failed')
        }
      })().catch(() => {
        /* swallowed, never block */
      })
    })
  })
}

export default fp(pointAspectPlugin, {
  name: 'point-aspect',
  fastify: '5.x',
})
