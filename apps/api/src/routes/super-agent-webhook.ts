// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * RP-40 超级智能体 webhook 回调落账重放路由（挂载由 routes/index.ts 按
 * IHUI_SUPER_AGENT_PUMP 门控：未开启 = 本插件根本不注册，零行为变化）。
 *
 * 路径（prefix /api）:
 *   POST   /super-agent/webhook-callback/:sourceId   外部回调（HMAC 验签，无登录态）
 *   GET    /admin/super-agent/webhook-sources        来源列表（admin；secret 脱敏 + 账本读数）
 *   POST   /admin/super-agent/webhook-sources        创建/更新来源（admin；secret 仅此回全量）
 *   DELETE /admin/super-agent/webhook-sources/:sourceId  注销来源（admin）
 *
 * 鉴权口径照齐 routes/webhooks-trigger.ts：外部入口凭 HMAC-SHA256（X-Webhook-Signature
 * 头对原始 payload 的 hex 摘要），经全仓唯一比较出口 secretsEqual 防时序攻击；
 * 管理面走 lazy-admin-guard，且 /api/admin/* 前缀由 server.ts onRoute 强制
 * network.allowExternal:false（公网不可达）。
 *
 * 落账后不直接灌 host —— 泵循环经 createWebhookReplayPort 从账上取未消费事件重放，
 * 收单判据全在 @ihui/shared/super-agent（单一真相源，本层零复算）。
 */
import { createHmac } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdminGuardLazy } from '../plugins/lazy-admin-guard.js'
import { secretsEqual } from '../plugins/internal-service-token.js'
import {
  createWebhookReplayPort,
  deleteWebhookSource,
  getWebhookSource,
  listWebhookSources,
  recordWebhookEvent,
  superAgentWebhookLedgerStats,
  upsertWebhookSource,
} from '../services/super-agent-webhook-ledger.js'
import {
  registerTriggerSourcePort,
  unregisterTriggerSourcePort,
} from '../services/super-agent-pump-service.js'
import { error, success } from '../utils/response.js'

const sourceIdSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/, 'sourceId 仅允许字母数字下划线连字符')

const createSourceSchema = z.object({
  sourceId: sourceIdSchema,
  ownerUserId: z.string().min(1).max(200),
  // secret 缺省服务端生成；显式供值仅作轮换/对齐外部系统既有凭据。
  secret: z.string().min(8).max(512).optional(),
})

const callbackBodySchema = z.object({
  eventId: z.string().min(1).max(200),
  text: z.string().min(1).max(8000),
  threadId: z.string().min(1).max(200).optional(),
  actorId: z.string().min(1).max(200).optional(),
  addressed: z.boolean().optional(),
  fromBot: z.boolean().optional(),
})

/** secret 脱敏口径照齐 webhooks-trigger：前 4 位 + 固定掩码。 */
function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****'
  return `${secret.slice(0, 4)}****${secret.slice(-2)}`
}

export const superAgentWebhookRoutes: FastifyPluginAsync = async (server) => {
  // 重启恢复：账上已登记的来源重新挂回泵端口注册表（泵不跑时注册本身零动作）。
  for (const src of listWebhookSources()) {
    registerTriggerSourcePort(createWebhookReplayPort(src))
  }

  // 外部回调入口：不挂 authenticate，凭 HMAC 验身份（照齐 webhooks-trigger /trigger/:id）。
  server.post('/super-agent/webhook-callback/:sourceId', async (request, reply) => {
    const parsedParams = sourceIdSchema.safeParse(
      (request.params as { sourceId?: unknown }).sourceId,
    )
    if (!parsedParams.success) return reply.status(400).send(error(400, 'sourceId 不合法'))
    const source = getWebhookSource(parsedParams.data)
    if (!source) return reply.status(404).send(error(404, '来源未登记'))

    // 签名基于原始字节：body 为字符串直接用，对象按 JSON 序列化（与 webhooks-trigger 同法）。
    const rawPayload =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})
    const signatureHeader = (request.headers['x-webhook-signature'] as string | undefined) ?? ''
    const expected = createHmac('sha256', source.secret).update(rawPayload).digest('hex')
    if (!secretsEqual(expected, signatureHeader)) {
      return reply.status(401).send(error(401, '签名验证失败'))
    }

    let parsedPayload: unknown
    try {
      parsedPayload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    } catch {
      return reply.status(400).send(error(400, 'payload 不是合法 JSON'))
    }
    const parsed = callbackBodySchema.safeParse(parsedPayload)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const outcome = recordWebhookEvent({ sourceId: source.sourceId, ...parsed.data })
    if (outcome === 'unknown_source') return reply.status(404).send(error(404, '来源未登记'))
    if (outcome === 'saturated') {
      return reply.status(429).send(error(429, '账本未消费事件已达上限，泵恢复后重试'))
    }
    if (outcome === 'duplicate') {
      // 幂等：重复回调 200 点名 duplicate，不重复落账（外部系统可安全重发）。
      return reply.send(success({ recorded: false, duplicate: true, sourceId: source.sourceId }))
    }
    return reply.status(202).send(success({ recorded: true, duplicate: false, sourceId: source.sourceId }))
  })

  server.get('/admin/super-agent/webhook-sources', { preHandler: requireAdminGuardLazy }, async () => {
    const list = listWebhookSources().map((s) => ({ ...s, secret: maskSecret(s.secret) }))
    return success({ list, total: list.length, ledger: superAgentWebhookLedgerStats() })
  })

  server.post(
    '/admin/super-agent/webhook-sources',
    { preHandler: requireAdminGuardLazy },
    async (request, reply) => {
      const parsed = createSourceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      let result: { source: { sourceId: string; ownerUserId: string; secret: string; createdAt: string }; created: boolean }
      try {
        result = upsertWebhookSource(parsed.data)
      } catch (e) {
        return reply.status(429).send(error(429, e instanceof Error ? e.message : '来源登记失败'))
      }
      // 来源即刻挂回泵端口注册表；泵未跑时注册本身零动作。
      registerTriggerSourcePort(createWebhookReplayPort(result.source))
      // 响应回完整 secret 仅此一次（调用方需保存）；列表一律脱敏。
      return success({ source: result.source, created: result.created })
    },
  )

  server.delete(
    '/admin/super-agent/webhook-sources/:sourceId',
    { preHandler: requireAdminGuardLazy },
    async (request, reply) => {
      const parsed = sourceIdSchema.safeParse(
        (request.params as { sourceId?: unknown }).sourceId,
      )
      if (!parsed.success) return reply.status(400).send(error(400, 'sourceId 不合法'))
      const deleted = deleteWebhookSource(parsed.data)
      if (!deleted) return reply.status(404).send(error(404, '来源未登记'))
      unregisterTriggerSourcePort(parsed.data)
      return success({ deleted: true, sourceId: parsed.data })
    },
  )
}
