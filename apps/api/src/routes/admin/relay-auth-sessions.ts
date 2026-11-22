// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/relay/auth-sessions —— 号池自助授权会话管理面（2026-11-17 立）。
 *
 * 是什么：把「免客户端把上游账号捞进号池」做成可发起、可查询、可撤销、可轮询的会话端点族，
 * 对标并超越 qoder2api 系开源网关（shuishuipingan/qoder2api-hub 等）的「+ 添加账号 (OAuth)」。
 * 判据与 IO 分层：响应分档/迁移/退避全部住在 `relay-auth-session.ts`（纯函数）与
 * `relay-auth-session-service.ts`（IO），本文件只接线，不复算任何一条判据（AGENTS §0.6）。
 *
 * 端点（requireAdmin 全族）：
 *  1. GET  /relay/auth-sessions/capabilities   能力声明表（哪家的哪一档可用／未实证＋出路）
 *  2. POST /relay/auth-sessions                发起会话（pat 直贴即入池；device_flow 出码）
 *  3. GET  /relay/auth-sessions                当前非终局会话（?includeTerminal=true 看历史）
 *  4. GET  /relay/auth-sessions/:id            单会话回显
 *  5. POST /relay/auth-sessions/:id/poll       轮询一次（受 nextPollAt 退避闸约束）
 *  6. POST /relay/auth-sessions/:id/cancel     撤销并销毁把手
 *  7. POST /relay/auth-sessions/sweep          到期清扫 + 到期轮询（调度腿的手动出口）
 *
 * 归属口径与号池导入完全一致（李总 2026-10-31 永久指令 + 2016-11-07 共享模型）：
 * 会话产生的账号落**发起者本人个人池**，不提供"静默落运营池"的出路；运营池由号池页
 * 「共享到运营池」动作显式填充。因此这里 requireAdmin 之后还强制要求 userId 存在。
 *
 * 公网可用性：与号池管理面同域同策略（机主 2026-11-10 永久指令），沿用同一放行出口；
 * 鉴权面未新增任何公开路径（AGENTS §5 鉴权面白名单不靠兜底正则）。
 *
 * 凭据纪律：PAT / secret 只作为请求体穿过一次，绝不回显、绝不写日志（错误消息里也只给指纹）。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { error, success } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { exposeRelayPoolRoutesToPublicNetwork, idParamSchema } from './_shared.js'
import { AUTH_SESSION_KINDS, AUTH_SESSION_STATUSES, type AuthSessionStatus } from '@ihui/database'
import {
  cancelAuthSession,
  createAuthSession,
  listAuthCapabilities,
  listAuthSessions,
  pollAuthSession,
  runAuthSessionPollSweep,
  sweepExpiredAuthSessions,
} from '../../services/relay-auth-session-service.js'

const kindSchema = z.enum(AUTH_SESSION_KINDS)
const statusSchema = z.enum(AUTH_SESSION_STATUSES)

const capabilitiesQuerySchema = z.object({
  provider: z.string().trim().min(1).max(64).optional(),
})

const createBodySchema = z.object({
  providerCode: z.string().trim().min(1).max(64),
  kind: kindSchema.optional(),
  /** PAT 直贴形态的票本体：只穿这一次，响应与日志里都不出现 */
  secret: z.string().trim().min(1).max(4096).optional(),
  scene: z.string().trim().max(64).optional(),
})

const listQuerySchema = z.object({
  provider: z.string().trim().min(1).max(64).optional(),
  status: statusSchema.optional(),
  includeTerminal: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

/** 会话族统一出口：service 的结构化结果 → HTTP 响应（不在这一层重新解释判据） */
function sendCommand(reply: FastifyReply, r: Awaited<ReturnType<typeof pollAuthSession>>) {
  if (r.ok) return reply.send(success(r.data))
  return reply.status(r.status).send(error(r.status, r.message, r.code))
}

const adminRelayAuthSessionRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  // 号池管理面族公网可用（与 relay-account-pool 同一出口、同一理由；不新增公开路径）
  exposeRelayPoolRoutesToPublicNetwork(server)

  // 1. 能力声明表：前端据此渲染可用档，并把未实证的出路原样显示（UI 不复写一套说法）
  server.get('/relay/auth-sessions/capabilities', async (request, reply) => {
    const q = capabilitiesQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const items = listAuthCapabilities(q.data.provider).map((c) => ({
      providerCode: c.providerCode,
      kind: c.kind,
      mapper: c.mapper,
      verified: c.verified,
      issuanceUrl: c.issuanceUrl ?? null,
      note: c.note,
      /** 端点只回「有没有声明」，不把 URL 之外的实现细节推给前端 */
      hasEndpoints: Boolean(c.authorizationEndpoint && c.tokenEndpoint && c.clientId),
    }))
    return reply.send(
      success({
        items,
        // 未实证档的数量也要能被量到：把「这一家还开不了」变成可观测事实而不是静默缺一行
        unverifiedCount: items.filter((i) => !i.verified).length,
        generatedAt: new Date().toISOString(),
      }),
    )
  })

  // 2. 发起会话
  server.post('/relay/auth-sessions', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 与号池导入同口径：没有身份就不许建会话（避免落一枚无主的运营池号）
    if (!request.userId) return reply.status(401).send(error(401, '未登录'))
    const r = await createAuthSession({
      providerCode: parsed.data.providerCode,
      kind: parsed.data.kind,
      secret: parsed.data.secret,
      ownerUserId: request.userId,
      requestedBy: request.userId,
      scene: parsed.data.scene ?? 'admin-pool',
    })
    return sendCommand(reply, r)
  })

  // 3. 会话列表
  server.get('/relay/auth-sessions', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const items = await listAuthSessions({
      providerCode: q.data.provider,
      status: q.data.status as AuthSessionStatus | undefined,
      includeTerminal: q.data.includeTerminal,
      limit: q.data.limit,
    })
    return reply.send(
      success({ items, total: items.length, generatedAt: new Date().toISOString() }),
    )
  })

  // 4. 单会话回显
  server.get('/relay/auth-sessions/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success)
      return reply.status(400).send(error(400, p.error.issues[0]?.message ?? 'id 非法'))
    const items = await listAuthSessions({ includeTerminal: true, limit: 200 })
    const one = items.find((i) => i.id === p.data.id)
    if (!one) return reply.status(404).send(error(404, '授权会话不存在'))
    return reply.send(success(one))
  })

  // 5. 轮询一次（前端「我已完成授权」按钮；未到退避点则原样回显、不打上游）
  server.post('/relay/auth-sessions/:id/poll', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success)
      return reply.status(400).send(error(400, p.error.issues[0]?.message ?? 'id 非法'))
    return sendCommand(reply, await pollAuthSession(p.data.id))
  })

  // 6. 撤销（终局即销毁把手）
  server.post('/relay/auth-sessions/:id/cancel', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success)
      return reply.status(400).send(error(400, p.error.issues[0]?.message ?? 'id 非法'))
    return sendCommand(reply, await cancelAuthSession(p.data.id, request.userId ?? 'system'))
  })

  // 7. 调度腿手动出口：先清过期，再把到期的各轮一次
  server.post('/relay/auth-sessions/sweep', async (_request, reply) => {
    const now = new Date()
    const swept = await sweepExpiredAuthSessions(now)
    const polled = await runAuthSessionPollSweep(20, now)
    return reply.send(success({ swept, polled, generatedAt: now.toISOString() }))
  })
}

export default adminRelayAuthSessionRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
