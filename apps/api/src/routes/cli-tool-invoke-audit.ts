// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86A2「工具证据流水的 HTTP 摄入路由」(2026-09-28)。
 *
 * CLI 侧(86A)每轮流式工具账本快照经 `reportToolLedgerSnapshotToAudit` 上报到
 * `POST /api/cli/audit/tool-invokes`(apps/cli/src/commands/agent.ts 的
 * TOOL_LEDGER_AUDIT_INGEST_PATH 逐字为该路径)。此前该路径在 apps/api 面**零命中**
 * —— CLI 报 404、点名一次后停止本进程重试,证据永远进不了审计链。本文件就是把这
 * 最后一段链路挂上:路由 → `recordToolLedgerAuditIngest`(audit-log-service 既有
 * 出口,HMAC 链 + pg_advisory_xact_lock,**0 新表 0 新列**)。
 *
 * 三条不许漂的纪律:
 * 1. **属主只取令牌主体**(AGENTS §5「已登录不等于可以动这条数据」):userId 一律
 *    `request.userId`(由 authenticate 从 JWT/apiKey 注入),路由**不读** body/query
 *    里任何自报身份;body 形状复用服务层导出的同一份 zod strict schema,混入
 *    userId/user_id 即 400,路由侧不开后门。
 * 2. **非 UUID 主体入口即拒**:audit_logs_chain.user_id 是 ::uuid cast,脏主体
 *    外溢会伪装成 DB 故障(错误归位原则)。
 * 3. **失败必须响**:批量摄入若有 failed>0,响应**不得**为 success —— 回 207 且
 *    code≠0(api-client 的 fetchApi 按 code===0 判成功,207 分支 CLI 每轮如实报
 *    failed);`data` 恒为 `{requested, accepted, failed}` 三个诚实计数,
 *    accepted 取库侧确认集(recordToolLedgerAuditIngest 的 recorded),不是请求侧长度。
 *
 * 鉴权面:本插件自带 preHandler `authenticate`,未登录在进 handler 前即 401;
 * 路径不在任何公开白名单(全仓 grep 确认此路径唯一调用方是 CLI 登录态分支)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import {
  recordToolLedgerAuditIngest,
  toolLedgerAuditIngestSchema,
  type ToolLedgerAuditIngest,
} from '../services/audit-log-service.js'

/** 摄入结果的诚实计数:请求侧条数 / 库侧确认落库条数 / 落库失败条数。requested = accepted + failed 由两侧实现共同保证。 */
interface IngestOutcome {
  requested: number
  accepted: number
  failed: number
}

/**
 * 主体必须是 uuid 形状 —— 入口把关,失败在路由侧归位为 401 而不是 DB 错。
 * 注:zod v4 的 z.uuid() 额外校版本/variant nibble,**严于**服务层的形状正则;
 * 方向是保守侧(只会多拒、不会放过脏主体),真实 DB 生成的 uuid 两者都通过。
 */
const uuidPrincipal = z.uuid()

export const cliToolInvokeAuditRoutes: FastifyPluginAsync = async (server) => {
  // 统一登录鉴权(与 audit.ts 的 preHandler 同形,去掉 admin 档):
  // authenticate 抛错 → 按其 statusCode 回 401/403,handler 与落库都不会执行。
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '鉴权失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // POST /audit/tool-invokes(挂 /api/cli 前缀后为 /api/cli/audit/tool-invokes)
  server.post(
    '/audit/tool-invokes',
    {
      schema: {
        summary: 'CLI 工具账本快照摄入审计链(86A2)',
        tags: ['cli', 'audit'],
        // 刻意不写 Fastify body JSON schema:校验的唯一实现是服务层导出的
        // toolLedgerAuditIngestSchema(strict),此处再抄一份就是第二份真相。
      },
    },
    async (request, reply) => {
      // 纪律 1+2:身份只从令牌主体进,且必须是 UUID
      const userId = request.userId
      if (!userId || !uuidPrincipal.safeParse(userId).success) {
        return reply.status(401).send(error(401, '令牌主体不是合法的 UUID 用户 ID,拒绝摄入'))
      }

      // body 用服务层导出的**同一份** strict schema 预检(400 归位;
      // 混入 userId/user_id 等任何未声明字段都落在这里被拒,零写入)
      const parsed = toolLedgerAuditIngestSchema.safeParse(request.body)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        const detail = first ? `${first.path.join('.')}: ${first.message}` : 'schema'
        return reply.status(400).send(error(400, `参数校验失败: ${detail}`))
      }
      const ingest: ToolLedgerAuditIngest = parsed.data
      const requested = ingest.facts.length

      // 走唯一落库出口(逐条 recordAuditLog,HMAC 链 + advisory lock),不另起 insert
      const result = await recordToolLedgerAuditIngest(userId, ingest, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      })

      // accepted 取库侧确认集,不回请求侧长度(守门 134「批量写计数诚实性」同族)
      const data: IngestOutcome = {
        requested,
        accepted: result.recorded,
        failed: result.failed,
      }
      if (result.failed > 0) {
        // 纪律 3:有失败就不得回 success(code≠0 ⇒ fetchApi 判失败并每轮喊出)
        return reply.status(207).send({ code: 207, message: '部分条目落库失败', data })
      }
      return success(data)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
