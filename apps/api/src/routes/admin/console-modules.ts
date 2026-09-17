/**
 * /api/admin 运营控制台模块 CRUD(2026-09-17 立,4-4-12)。
 *
 * 端点清单(requireAdmin,均由 registerCrud 生成 GET list/GET :id/POST/PUT :id/DELETE :id/DELETE batch):
 * 1. /promotions/lottery    — 抽奖活动管理(lotteries 表)
 * 2. /points/mall           — 积分商城商品管理(points_mall_products 表)
 * 3. /promotions/rules      — 促销规则管理(promotion_rules 表)
 * 4. /billing/tax           — 税率规则管理(billing_tax_rates 表)
 *
 * 消费关系:web 管理端 admin/lottery|points-mall|promotion-rule|tax 四个列表页,
 * 列表分页/搜索走 paginationSchema 的 search 参数(前端 qs.set('search', ...) 已对齐)。
 * prizes 为 JSONB(管理端配置展示;真实抽奖引擎上线时再拆 prizes 表,避免过早建模)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { lotteries, pointsMallProducts, promotionRules, billingTaxRates } from '@ihui/database'
import { registerCrud, fields } from './_shared.js'
import { requireAdmin } from '../../plugins/require-permission.js'

export const consoleModulesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 抽奖活动
  registerCrud(server, '/promotions/lottery', lotteries, {
    searchField: lotteries.name,
    map: fields({
      name: 'string',
      cover: 'string',
      costPoints: 'number',
      freeQuota: 'number',
      prizes: 'json',
      participants: 'number',
      winners: 'number',
      status: 'string',
      startTime: 'date',
      endTime: 'date',
    }),
  })

  // 2. 积分商城商品
  registerCrud(server, '/points/mall', pointsMallProducts, {
    searchField: pointsMallProducts.name,
    map: fields({
      name: 'string',
      cover: 'string',
      category: 'string',
      pointsCost: 'number',
      stock: 'number',
      sold: 'number',
      limitPerUser: 'number',
      status: 'string',
      startTime: 'date',
      endTime: 'date',
    }),
  })

  // 3. 促销规则
  registerCrud(server, '/promotions/rules', promotionRules, {
    searchField: promotionRules.name,
    map: fields({
      name: 'string',
      type: 'string',
      threshold: 'number',
      discount: 'number',
      discountType: 'string',
      scope: 'string',
      scopeRef: 'string',
      priority: 'number',
      status: 'string',
      startTime: 'date',
      endTime: 'date',
    }),
  })

  // 4. 税率规则
  registerCrud(server, '/billing/tax', billingTaxRates, {
    searchField: billingTaxRates.name,
    map: fields({
      name: 'string',
      category: 'string',
      rate: 'number',
      threshold: 'number',
      description: 'string',
      status: 'string',
      effectiveAt: 'date',
    }),
  })
}
