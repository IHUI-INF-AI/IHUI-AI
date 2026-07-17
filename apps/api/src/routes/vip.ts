import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { env } from 'node:process'
import { db } from '../db/index.js'
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
import { createOrder, findOrderByNo } from '../db/payment-queries.js'
import {
  isWechatPayConfigured,
  jsapiPrepay,
  nativePrepay,
  h5Prepay,
  buildJsapiSign,
} from '../services/wechat-pay.js'
import { listUserBindings } from '../db/oauth-queries.js'

// =============================================================================
// system_configs JSON 存储辅助（用于无独立表的资源 CRUD，按 category 区分）
// =============================================================================

function parseJSONValue(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {}
  try {
    const v = JSON.parse(s)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rowToConfig(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...parseJSONValue(r.value),
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

async function configList(
  category: string,
  page: number,
  pageSize: number,
): Promise<{ list: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "category" = ${category} ORDER BY "created_at" DESC LIMIT ${pageSize} OFFSET ${offset}`,
  )
  const countRows = await db.execute(
    sql`SELECT count(*)::int AS count FROM "system_configs" WHERE "category" = ${category}`,
  )
  const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
  return {
    list: (rows as Record<string, unknown>[]).map(rowToConfig),
    total,
    page,
    pageSize,
  }
}

// =============================================================================
// VIP 预下单共享逻辑(/vip/order、/vip/order/:orderNo/payinfo 复用)
// =============================================================================

type VipPayInfo = {
  mock: boolean
  method: 'jsapi' | 'native' | 'h5'
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
  codeUrl?: string
  h5Url?: string
  error?: string
}

async function createVipPrepay(
  order: { orderNo: string; amount: number },
  paymentMethod: string,
  openId?: string,
  clientIp?: string,
): Promise<VipPayInfo> {
  const method: 'jsapi' | 'native' | 'h5' =
    paymentMethod === 'wechat_native' ? 'native' : paymentMethod === 'wechat_h5' ? 'h5' : 'jsapi'

  if (!isWechatPayConfigured()) {
    return { mock: true, method }
  }

  const description = 'VIP 会员购买'
  const notify = env.WX_PAY_NOTIFY_URL ?? ''

  try {
    if (method === 'jsapi') {
      const prepayId = await jsapiPrepay({
        outTradeNo: order.orderNo,
        amount: order.amount,
        description,
        openId: openId ?? '',
        notifyUrl: notify,
      })
      const sign = buildJsapiSign(prepayId)
      return {
        mock: false,
        method: 'jsapi',
        timeStamp: sign.timestamp,
        nonceStr: sign.nonceStr,
        package: sign.package,
        signType: sign.signType,
        paySign: sign.paySign,
      }
    }
    if (method === 'native') {
      const codeUrl = await nativePrepay({
        outTradeNo: order.orderNo,
        amount: order.amount,
        description,
        notifyUrl: notify,
      })
      return { mock: false, method: 'native', codeUrl }
    }
    const h5Url = await h5Prepay({
      outTradeNo: order.orderNo,
      amount: order.amount,
      description,
      notifyUrl: notify,
      payerClientIp: clientIp ?? '127.0.0.1',
    })
    return { mock: false, method: 'h5', h5Url }
  } catch {
    return { mock: true, method, error: '预下单失败' }
  }
}

async function resolveOpenId(userId: string, bodyOpenId?: string): Promise<string> {
  if (bodyOpenId) return bodyOpenId
  const bindings = await listUserBindings(userId)
  const wechatBinding = bindings.find((b) => b.platform === 'wechat')
  return wechatBinding?.openId ?? ''
}

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

  // ==========================================================================
  // VIP 扩展端点（3 个）
  // ==========================================================================

  // GET /vip/faqs — FAQ 列表（从 system_configs category='vip_faq' 查询）
  server.get('/vip/faqs', async (_request, reply) => {
    try {
      const result = await configList('vip_faq', 1, 100)
      return reply.send(success(result))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询 VIP FAQ 失败'))
    }
  })

  // POST /vip/order — 创建 VIP 订单 + 对接微信支付预下单
  const vipOrderBody = z.object({
    vipLevelId: z.string().min(1),
    paymentMethod: z.string().optional().default('wechat'),
    quantity: z.number().int().positive().optional().default(1),
    openId: z.string().optional(),
  })
  server.post('/vip/order', async (request, reply) => {
    await authenticate(request)
    const parsed = vipOrderBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { vipLevelId, paymentMethod, quantity, openId } = parsed.data
    const level = await findVipLevel(vipLevelId)
    if (!level || level.status !== 1) {
      return reply.status(404).send(error(404, 'VIP 等级不存在'))
    }
    const order = await createOrder({
      userId: request.userId!,
      amount: level.price * quantity,
      orderType: 2,
      productId: level.id,
      payType: paymentMethod,
    })
    const resolvedOpenId = await resolveOpenId(request.userId!, openId)
    const payInfo = await createVipPrepay(order, paymentMethod, resolvedOpenId, request.ip)
    return reply.send(
      success({
        orderId: order.id,
        orderNo: order.orderNo,
        amount: level.price * quantity,
        vipLevelId: level.id,
        quantity,
        payInfo,
      }),
    )
  })

  // GET /vip/order/:orderNo/payinfo — 获取支付参数(prepay_id 2h 有效,过期重新预下单)
  const orderNoParam = z.object({ orderNo: z.string().min(1) })
  server.get('/vip/order/:orderNo/payinfo', async (request, reply) => {
    await authenticate(request)
    const parsed = orderNoParam.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { orderNo } = parsed.data
    const order = await findOrderByNo(orderNo)
    if (!order) {
      return reply.status(404).send(error(404, '订单不存在'))
    }
    if (order.userId && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权查看此订单'))
    }
    if (order.status === 'paid') {
      return reply.send(success({ status: 'paid' }))
    }
    if (order.status !== 'pending') {
      return reply.send(success({ status: order.status }))
    }
    const paymentMethod = order.paymentMethod ?? 'wechat'
    const resolvedOpenId = await resolveOpenId(request.userId!, undefined)
    const payInfo = await createVipPrepay(order, paymentMethod, resolvedOpenId, request.ip)
    return reply.send(success({ status: 'pending', payInfo }))
  })

  // GET /vip/testimonials — 用户评价列表（从 system_configs category='vip_testimonial' 查询）
  server.get('/vip/testimonials', async (_request, reply) => {
    try {
      const result = await configList('vip_testimonial', 1, 100)
      return reply.send(success(result))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询 VIP 用户评价失败'))
    }
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
