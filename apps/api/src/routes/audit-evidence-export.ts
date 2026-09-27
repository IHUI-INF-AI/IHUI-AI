// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审计证据导出 — 非对称签名的出口层(86C,只读 admin 面)。
 *
 * 端点(均走既有 `requireAdmin` preHandler,即 authenticate + roleId >= 1,
 * 且**只认人用 JWT** —— internal service token 链路开不了本面):
 * - GET /signed      生成并返回"已签名"的导出信封(数据体 + 签名 + 验签元信息)
 * - GET /public-key  发布验签所需公钥与 kid(**绝不返回私钥**)
 *
 * 为什么要这一层:链内的 HMAC 是**对称**的 —— 能验证的人就能伪造。收件方(审计方 /
 * 监管方)必须**不持任何对称密钥**也能确认"这份导出没被改过、且确实出自我们",
 * 所以导出产物改用 RSA-SHA256 签名,验签只需公钥。签名/验签的具体口径住在
 * `services/siem-exporter.ts`(唯一实现),本文件只做鉴权、参数校验与错误归因。
 *
 * 身份口径(§5 硬规矩:"已登录"不等于"可以动这条数据"):
 * 本面**不接受**任何来自请求体/Query 的身份作为权限依据 —— `userId` 只是
 * 审计链的**过滤维度**(与既有 `/api/admin/audit-logs/export` 同口径,审计链本身
 * 是全量管理面数据),能不能读由 `requireAdmin` 从 JWT payload 的 roleId 单独判定。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { buildResponseSchema } from '../utils/api-schemas.js'
import {
  AuditExportSignatureError,
  buildSignedAuditExport,
  getAuditExportPublicKeyInfo,
  verifySignedAuditExport,
} from '../services/siem-exporter.js'

// =============================================================================
// Zod schemas
// =============================================================================

const signedExportQuerySchema = z.object({
  userId: z.string().optional().transform(emptyToUndefined).pipe(z.uuid().optional()),
  action: z.string().optional().transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  resourceType: z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.string().max(64).optional()),
  startDate: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endDate: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  format: z.enum(['json', 'cef', 'leef']).optional().default('json'),
  limit: z.coerce.number().int().min(1).max(50000).optional().default(10000),
})

/**
 * 签名机制不可用的统一出口:503 + 可归因文案,**不返回任何未签名数据**。
 *
 * 刻意不用 200 + warning:那样收件方拿到的仍是一份"看起来交付成功"的无签名导出,
 * 而它恰恰是本票要消灭的那一格(§5e "失败必须响"同一条禁令)。
 */
function signatureUnavailable(reply: FastifyReply, e: AuditExportSignatureError): FastifyReply {
  return reply.status(503).send(error(503, e.message))
}

// =============================================================================
// 路由
// =============================================================================

export const auditEvidenceExportRoutes: FastifyPluginAsync = async (server) => {
  // 既有 admin 闸门:authenticate + roleId >= 1(只认人用 JWT),不在本文件另写一套
  server.addHook('preHandler', requireAdmin)

  // GET /signed - 已签名的审计导出信封
  server.get(
    '/signed',
    {
      schema: {
        summary: '生成带 RSA-SHA256 签名的审计日志导出信封(收件方仅需公钥即可离线验签)',
        tags: ['audit-evidence-export'],
        querystring: {
          type: 'object',
          // 刻意只声明类型、不声明 format/enum/maximum:实读探针对比过,一旦让 Fastify 的
          // ajv 先拒(如 `format:'uuid'`),它返回的默认错误体把 `code` 写成**字符串**
          // ("FST_ERR_VALIDATION"),而 `utils/api-schemas.ts` 的 errorResponseSchema 声明
          // `code: number` ⇒ 序列化不匹配,客户端的 400 会被掩盖成 **500**。
          // 真正的参数校验一律由下方 Zod 做,产出的 `error(400, msg)` 形状与 schema 一致。
          // (既有的 `/api/admin/audit-logs*` 面同时声明了 format 与 400 schema,同一型待清。)
          properties: {
            userId: {
              type: 'string',
              description: '按用户 ID 过滤(UUID,服务端 Zod 校验;仅作查询维度)',
            },
            action: { type: 'string', description: '按动作筛选(auth.login/data.read 等)' },
            resourceType: { type: 'string', description: '按资源类型筛选' },
            startDate: { type: 'string', description: '开始时间(ISO)' },
            endDate: { type: 'string', description: '结束时间(ISO)' },
            format: { type: 'string', description: '导出格式:json(默认)/ cef / leef' },
            limit: { type: 'integer', description: '导出行数上限,默认 10000,最大 50000' },
          },
        },
        response: buildResponseSchema(400, 401, 403, 500, 503),
      },
    },
    async (request, reply) => {
      const parsed = signedExportQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { userId, action, resourceType, startDate, endDate, format, limit } = parsed.data

      let envelope: Awaited<ReturnType<typeof buildSignedAuditExport>>
      try {
        envelope = await buildSignedAuditExport(
          { userId, action, resourceType, startDate, endDate },
          format,
          limit,
        )
      } catch (e) {
        if (e instanceof AuditExportSignatureError) {
          request.log.error({ reason: e.reason }, '审计签名导出不可用')
          return signatureUnavailable(reply, e)
        }
        request.log.error({ err: e }, '审计签名导出失败')
        return reply.status(500).send(error(500, '签名导出失败'))
      }

      // 出口自证:发出去之前先用**公钥**验一遍自己刚产出的信封。
      // 私钥与公钥不配对、或序列化口径在两侧漂移,都会在这里现形 ——
      // 而不是等到收件方拿着信封来问"为什么验不过"才发现我们一直在发验不了的东西。
      const selfCheck = verifySignedAuditExport(envelope)
      if (!selfCheck.ok) {
        request.log.error({ reason: selfCheck.reason }, '审计签名导出自检未通过')
        return reply
          .status(500)
          .send(error(500, `签名导出自检未通过:${selfCheck.reason ?? '未知原因'}`))
      }

      return reply.send(success(envelope))
    },
  )

  // GET /public-key - 公钥发布(收件方取验签材料;响应里不存在私钥的任何形态)
  server.get(
    '/public-key',
    {
      schema: {
        summary: '获取审计导出验签公钥与 kid',
        tags: ['audit-evidence-export'],
        response: buildResponseSchema(401, 403, 500, 503),
      },
    },
    async (request, reply) => {
      try {
        return reply.send(success(getAuditExportPublicKeyInfo()))
      } catch (e) {
        if (e instanceof AuditExportSignatureError) {
          request.log.error({ reason: e.reason }, '审计导出公钥不可用')
          return signatureUnavailable(reply, e)
        }
        request.log.error({ err: e }, '审计导出公钥读取失败')
        return reply.status(500).send(error(500, '公钥读取失败'))
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
