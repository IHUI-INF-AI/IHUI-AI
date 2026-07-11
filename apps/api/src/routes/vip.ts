import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  listVipLevels,
  findVipLevel,
  createVipLevel,
  updateVipLevel,
  deleteVipLevel,
  getMyVip,
  purchaseVip,
  listUserVips,
  cancelUserVip,
} from '../db/vip-queries.js'
import { createOrder } from '../db/payment-queries.js'

const ADMIN_ROLE_ID = 1

export const vipRoutes: FastifyPluginAsync = async (server) => {
  // 公开：VIP 等级列表
  server.get('/vip/levels', async (_request, reply) => {
    const levels = await listVipLevels(true)
    return reply.send(success({ items: levels }))
  })

  server.get('/vip/products', async (_request, reply) => {
    const levels = await listVipLevels(true)
    return reply.send(success({ products: levels }))
  })

  // 我的 VIP
  server.get('/vip/my', async (request, reply) => {
    await authenticate(request)
    const result = await getMyVip(request.userId!)
    const vip = result ? { ...result.userVip, levelName: result.levelName } : null
    return reply.send(success({ vip }))
  })

  // 购买 VIP
  server.post('/vip/purchase', async (request, reply) => {
    await authenticate(request)
    const { vipLevelId, paymentMethod = 'wechat' } = request.body as {
      vipLevelId: string
      paymentMethod?: string
    }
    const level = await findVipLevel(vipLevelId)
    if (!level || level.status !== 1) return reply.status(404).send(error(404, 'VIP 等级不存在'))
    // 创建订单
    const order = await createOrder({
      userId: request.userId!,
      amount: level.price,
      orderType: 2,
      productId: level.id,
      payType: paymentMethod,
    })
    // 开发环境直接激活方便测试，生产环境应等支付回调后激活
    if (process.env.NODE_ENV === 'development') {
      await purchaseVip({ userId: request.userId!, vipLevelId: level.id, orderId: order.id })
    }
    return reply.send(
      success({
        orderId: order.id,
        orderNo: order.orderNo,
        amount: level.price,
        vipLevelId: level.id,
      }),
    )
  })
}

export const adminVipRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    const payload = await authenticate(request)
    if (payload.roleId < ADMIN_ROLE_ID) {
      const err = new Error('需要管理员权限')
      ;(err as Error & { statusCode: number }).statusCode = 403
      throw err
    }
  })

  // VIP 等级管理
  server.post('/vip/levels', async (request, reply) => {
    const {
      levelName,
      levelValue = 1,
      price,
      durationDays = 30,
      benefits = [],
    } = request.body as {
      levelName: string
      levelValue?: number
      price: number
      durationDays?: number
      benefits?: unknown[]
    }
    const level = await createVipLevel({
      levelName,
      levelValue,
      price,
      durationDays,
      benefits: benefits as unknown[],
    })
    return reply.send(success(level))
  })

  server.put('/vip/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      levelName?: string
      price?: number
      durationDays?: number
      status?: number
    }
    await updateVipLevel(id, body)
    return reply.send(success({ updated: true }))
  })

  server.delete('/vip/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await deleteVipLevel(id)
    return reply.send(success({ deleted: true }))
  })

  // 用户 VIP 管理
  server.get('/vip/users', async (request, reply) => {
    const {
      page = '1',
      limit = '20',
      userId,
    } = request.query as {
      page: string
      limit: string
      userId?: string
    }
    const result = await listUserVips(parseInt(page, 10), parseInt(limit, 10), userId)
    return reply.send(success(result))
  })

  server.put('/vip/users/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string }
    await cancelUserVip(id)
    return reply.send(success({ cancelled: true }))
  })
}
