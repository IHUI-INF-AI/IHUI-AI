import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { checkAuth } from '../plugins/auth.js'
import {
  findAllActiveChannels,
  findPoints,
  findUserPointsBalance,
  hasClaimedFirstShare,
  awardFirstSharePoints,
} from '../db/point-queries.js'
import { success } from '../utils/response.js'

const DEFAULT_FIRST_SHARE_REWARD = 5

async function resolveFirstShareReward(): Promise<number> {
  const channels = await findAllActiveChannels()
  const shareChannel = channels.find(
    (c) =>
      c.code === 'share' ||
      c.code === 'first_share' ||
      c.name.includes('分享') ||
      c.name.includes('首次'),
  )
  if (!shareChannel) return DEFAULT_FIRST_SHARE_REWARD
  const { list } = await findPoints({ page: 1, pageSize: 1, channelId: shareChannel.id, status: 1 })
  const rule = list[0]
  return rule && rule.point > 0 ? rule.point : DEFAULT_FIRST_SHARE_REWARD
}

export const shareFirstRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /api/share/first-status — 查询首次分享奖励状态
  server.get(
    '/share/first-status',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 0 },
              message: { type: 'string', example: 'success' },
              data: {
                type: 'object',
                properties: {
                  rewarded: { type: 'boolean' },
                  rewardPoints: { type: 'number' },
                  canClaim: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const memberId = request.userId!
      const [rewarded, rewardPoints] = await Promise.all([
        hasClaimedFirstShare(memberId),
        resolveFirstShareReward(),
      ])
      return reply.send(
        success({
          rewarded,
          rewardPoints,
          canClaim: !rewarded,
        }),
      )
    },
  )

  // POST /api/share/first-claim — 领取首次分享奖励
  server.post(
    '/share/first-claim',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 0 },
              message: { type: 'string', example: 'success' },
              data: {
                type: 'object',
                properties: {
                  points: { type: 'number' },
                  balance: { type: 'number' },
                },
              },
            },
          },
          409: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 409 },
              message: { type: 'string', example: '已领取过首次分享奖励' },
              data: { type: 'null' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const memberId = request.userId!
      const rewardPoints = await resolveFirstShareReward()
      await awardFirstSharePoints(memberId, rewardPoints)
      const balance = await findUserPointsBalance(memberId)
      return reply.send(success({ points: rewardPoints, balance }))
    },
  )
}
