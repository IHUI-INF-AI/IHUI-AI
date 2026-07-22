import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  findExchangeRates,
  findRate,
  createExchangeRate,
  updateExchangeRate,
  deleteExchangeRate,
} from '../db/exchange-rate-queries.js'

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

const listQuerySchema = z.object({
  page: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).default(1)),
  pageSize: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).max(100).default(20)),
  status: z.preprocess(
    (v) => emptyToUndefined(v),
    z.coerce.number().int().min(0).max(1).optional(),
  ),
})

const createSchema = z.object({
  fromCurrency: z.string().min(1).max(20),
  toCurrency: z.string().min(1).max(20),
  rate: z.number().positive(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateSchema = z.object({
  fromCurrency: z.string().min(1).max(20).optional(),
  toCurrency: z.string().min(1).max(20).optional(),
  rate: z.number().positive().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const rateQuerySchema = z.object({
  from: z.string().min(1).max(20),
  to: z.string().min(1).max(20),
})

/** 公共路由：查询汇率（不需要管理员权限） */
export const exchangeRatePublicRoutes: FastifyPluginAsync = async (server) => {
  // GET /exchange-rates/rate?from=USD&to=CNY — 查询两个货币之间的汇率
  server.get('/exchange-rates/rate', async (request, reply) => {
    const parsed = rateQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await findRate(parsed.data.from, parsed.data.to)
    if (!item) return reply.status(404).send(error(404, '未找到该货币对的汇率'))
    return reply.send(success(item))
  })

  // GET /exchange-rates/convert?from=USD&to=CNY&amount=100 — 汇率换算
  server.get('/exchange-rates/convert', async (request, reply) => {
    const parsed = z
      .object({
        from: z.string().min(1).max(20),
        to: z.string().min(1).max(20),
        amount: z.coerce.number().positive(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await findRate(parsed.data.from, parsed.data.to)
    if (!item) return reply.status(404).send(error(404, '未找到该货币对的汇率'))
    const converted = parsed.data.amount * item.rate
    return reply.send(
      success({
        from: parsed.data.from,
        to: parsed.data.to,
        rate: item.rate,
        amount: parsed.data.amount,
        converted: Math.round(converted * 100) / 100,
      }),
    )
  })
}

/** 管理路由：CRUD */
export const adminExchangeRateRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /exchange-rates — 列表
  server.get('/exchange-rates', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findExchangeRates(parsed.data)
    return reply.send(success(result))
  })

  // POST /exchange-rates — 创建
  server.post('/exchange-rates', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await createExchangeRate(parsed.data)
    return reply.status(201).send(success(item))
  })

  // PUT /exchange-rates/:id — 更新
  server.put('/exchange-rates/:id', async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await updateExchangeRate(parsedParams.data.id, parsed.data)
    if (!item) return reply.status(404).send(error(404, '汇率记录不存在'))
    return reply.send(success(item))
  })

  // DELETE /exchange-rates/:id — 删除
  server.delete('/exchange-rates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ok = await deleteExchangeRate(parsed.data.id)
    if (!ok) return reply.status(404).send(error(404, '汇率记录不存在'))
    return reply.send(success({ deleted: true }))
  })
}
