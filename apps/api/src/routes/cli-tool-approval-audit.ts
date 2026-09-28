// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86H:CLI 审批决策摄入路由 —— `POST /api/cli/audit/tool-approvals`。
 *
 * 形态逐条对齐 86A2 的 `cli-tool-invoke-audit.ts`(同一条通道的姊妹入口):
 * 1. **身份只从令牌主体进**:body 由服务层 strict schema 校验,混入 userId/user_id
 *    等任何未声明字段 ⇒ 400 且**零写入**(不是先写后拒);
 * 2. **主体必须是 UUID**:入口把关,脏主体归位 401 而不是 DB 错;
 * 3. **失败必须响**:failed>0 ⇒ 207 且 code≠0(api-client 按 code===0 判成功),
 *    `data` 恒为 `{requested, accepted, failed}` 诚实计数,accepted 取库侧确认数。
 *
 * 鉴权面:插件自带 preHandler `authenticate`,未登录在进 handler 前即 401;
 * 路径不在任何公开白名单(唯一调用方是 CLI 登录态分支,门 8 对账可见)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import {
  recordToolApprovalAuditIngest,
  toolApprovalAuditIngestSchema,
  type ToolApprovalAuditIngest,
} from '../services/tool-approval-audit.js'

/** 主体 uuid 形状把关(zod v4 z.uuid() 严于服务层正则,方向保守:只多拒、放过脏主体不可能)。 */
const uuidPrincipal = z.uuid()

export const cliToolApprovalAuditRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '鉴权失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  server.post(
    '/audit/tool-approvals',
    {
      schema: {
        summary: 'CLI agent 审批决策摄入审计链(86H)',
        tags: ['cli', 'audit'],
        // 校验的唯一实现是服务层导出的 strict schema,此处不抄第二份。
      },
    },
    async (request, reply) => {
      const userId = request.userId
      if (!userId || !uuidPrincipal.safeParse(userId).success) {
        return reply.status(401).send(error(401, '令牌主体不是合法的 UUID 用户 ID,拒绝摄入'))
      }

      const parsed = toolApprovalAuditIngestSchema.safeParse(request.body)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        const detail = first ? `${first.path.join('.')}: ${first.message}` : 'schema'
        return reply.status(400).send(error(400, `参数校验失败: ${detail}`))
      }
      const ingest: ToolApprovalAuditIngest = parsed.data

      const outcome = await recordToolApprovalAuditIngest(userId, ingest, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      })

      // accepted 取库侧确认集,不回请求侧长度(守门 134「批量写计数诚实性」同族)
      const data = {
        requested: outcome.requested,
        accepted: outcome.recorded,
        failed: outcome.failed,
      }
      if (outcome.failed > 0) {
        // 纪律 3:有失败就不得回 success(code≠0 ⇒ fetchApi 判失败并喊出)
        return reply.status(207).send({ code: 207, message: '部分审批决策未落链', data })
      }
      return reply.send(success(data))
    },
  )
}
