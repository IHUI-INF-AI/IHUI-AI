import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
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

const idParam = z.object({ id: z.string() })
const purchaseBody = z.object({
  vipLevelId: z.string(),
  paymentMethod: z.string().optional().default('wechat'),
})
const createLevelBody = z.object({
  levelName: z.string(),
  levelValue: z.number().optional().default(1),
  price: z.number(),
  durationDays: z.number().optional().default(30),
  benefits: z.array(z.unknown()).optional().default([]),
})
const updateLevelBody = z.object({
  levelName: z.string().optional(),
  price: z.number().optional(),
  durationDays: z.number().optional(),
  status: z.number().optional(),
})
const listUsersQuery = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  userId: z.string().optional(),
})

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
    const { vipLevelId, paymentMethod } = purchaseBody.parse(request.body)
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
    const { levelName, levelValue, price, durationDays, benefits } = createLevelBody.parse(
      request.body,
    )
    const level = await createVipLevel({
      levelName,
      levelValue,
      price,
      durationDays,
      benefits,
    })
    return reply.send(success(level))
  })

  server.put('/vip/levels/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const body = updateLevelBody.parse(request.body)
    await updateVipLevel(id, body)
    return reply.send(success({ updated: true }))
  })

  server.delete('/vip/levels/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    await deleteVipLevel(id)
    return reply.send(success({ deleted: true }))
  })

  // 用户 VIP 管理
  server.get('/vip/users', async (request, reply) => {
    const { page, limit, userId } = listUsersQuery.parse(request.query)
    const result = await listUserVips(page, limit, userId)
    return reply.send(success(result))
  })

  server.put('/vip/users/:id/cancel', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    await cancelUserVip(id)
    return reply.send(success({ cancelled: true }))
  })
}
