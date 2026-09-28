// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 审计证据导出 — 非对称签名的出口层(86C 签名/验签 + 86G-1 匿名公钥面)。
 *
 * 端点:
 * - GET /api/admin/audit-evidence/signed      生成并返回"已签名"的导出信封(数据体 + 签名 + 验签元信息)
 * - GET /api/admin/audit-evidence/public-key  发布验签所需公钥与 kid(**绝不返回私钥**)
 *   ↑ 这两条走既有 `requireAdmin` preHandler,即 authenticate + roleId >= 1,
 *     且**只认人用 JWT** —— internal service token 链路开不了本面。
 * - GET /api/audit-evidence/public-key        (86G-1)同上一份公钥发布出口的**免鉴权、限流**形态。
 *
 * 为什么公钥必须有匿名面:外部审计方没有 admin 账号 —— 只把 `/public-key` 摆在
 * `requireAdmin` 之后,他们拿到签名信封也无法自证,导出的"非对称可验证"承诺在最
 * 后一步断了。
 *
 * 为什么它**不能**挂在 `/api/admin/*` 前缀下(这条决定注册表怎么改,值得写死在注释里):
 * `server.ts` 的 onRoute 网络分段对 `/api/admin/*` 强制注入 `network.allowExternal:false`,
 * 而 `plugins/network-segment.ts` 的 preHandler 真的会把外网 IP 判 403 ——
 * 挂在 admin 前缀下是"免了鉴权、仍到不了人",等于没开。故公钥面单立一个封装作用域,
 * 挂在 `/api/audit-evidence` 前缀下,**且该作用域里只显式列举这一条完整路径**
 * (§5 鉴权面公开化铁律:禁止 `/api/<前缀>/[^/]+` 式兜底正则,agents.ts 事故同型)。
 *
 * 为什么要这一层:链内的 HMAC 是**对称**的 —— 能验证的人就能伪造。收件方(审计方 /
 * 监管方)必须**不持任何对称密钥**也能确认"这份导出没被改过、且确实出自我们",
 * 所以导出产物改用 RSA-SHA256 签名,验签只需公钥。签名/验签的具体口径住在
 * `services/siem-exporter.ts`(唯一实现),本文件只做鉴权、参数校验与错误归因。
 *
 * 身份口径(§5 硬规矩:"已登录"不等于"可以动这条数据"):
 * admin 面**不接受**任何来自请求体/Query 的身份作为权限依据 —— `userId` 只是
 * 审计链的**过滤维度**(与既有 `/api/admin/audit-logs/export` 同口径,审计链本身
 * 是全量管理面数据),能不能读由 `requireAdmin` 从 JWT payload 的 roleId 单独判定。
 * 匿名面则连过滤维度都不接受:它**无参数**,响应里只有公钥 PEM、kid 与算法标识。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { buildResponseSchema } from '../utils/api-schemas.js'
import {
  AuditExportSignatureError,
  buildSignedAuditExport,
  getAuditExportPublicKeyInfo,
  getAuditExportPublicKeyInfoForKid,
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

/**
 * 公钥响应的**唯一实现**(86C 的 admin 面与 86G-1 的匿名面共用)。
 *
 * 两处各写一遍,响应形状与错误归因必然漂移(本仓记过最多次的失败型)—— 两个面对
 * "有没有配置密钥"的答复必须逐字同形,差别只允许存在于"挂在哪个封装作用域(要不要
 * 过 requireAdmin)"这一层,而那一层不住在 handler 里。
 *
 * 未配置公钥 ⇒ 503 + 点名该配哪个环境变量,刻意不回 200 + 空字符串:
 * 把"没有"写成"有",收件方会把空公钥当材料去验签,故障点被推到别人系统里。
 */
/**
 * 从 query 里取 `kid` —— 只认"字符串且去空白后非空",其余一律当**没带**。
 *
 * 刻意不写进 ajv 的 `format`/`minLength`:同文件 `/signed` 那段注释记过实读结论 ——
 * ajv 先拒时 Fastify 的默认错误体把 `code` 写成字符串,与 `errorResponseSchema` 的
 * `code: number` 不匹配 ⇒ 客户端的 400 被掩盖成 500。参数判据留在这里,由我们自己
 * 产出形状一致的 `error(400, …)`。
 */
function readKidQuery(query: unknown): { present: false } | { present: true; kid: string } {
  if (typeof query !== 'object' || query === null) return { present: false }
  const raw = (query as Record<string, unknown>).kid
  if (raw === undefined) return { present: false }
  if (typeof raw !== 'string' || raw.trim() === '') return { present: true, kid: '' }
  return { present: true, kid: raw.trim() }
}

async function sendPublicKey(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const wanted = readKidQuery(request.query)
  if (wanted.present && wanted.kid === '') {
    return reply.status(400).send(error(400, 'kid 参数为空:要么不带(取当前签名公钥),要么带信封里记的那个 kid'))
  }
  try {
    if (!wanted.present) return reply.send(success(getAuditExportPublicKeyInfo()))
    const hit = getAuditExportPublicKeyInfoForKid(wanted.kid)
    if (!hit.found) {
      // 查不到就点名"这把没登记",**绝不回落成把当前公钥递出去** —— 那等于让审计方
      // 拿错材料去验,然后把"验不过"当成"证据被改过"(处置动作完全相反)。
      return reply
        .status(404)
        .send(error(404, `未登记的密钥 kid=${hit.keyId}:请把它作为 retired 登记进 services/audit-export-key-registry.ts,旧信封才能验`))
    }
    return reply.send(
      success({
        keyId: hit.keyId,
        algorithm: hit.algorithm,
        publicKey: hit.publicKey,
        keyStatus: hit.keyStatus,
      }),
    )
  } catch (e) {
    if (e instanceof AuditExportSignatureError) {
      request.log.error({ reason: e.reason }, '审计导出公钥不可用')
      return signatureUnavailable(reply, e)
    }
    request.log.error({ err: e }, '审计导出公钥读取失败')
    return reply.status(500).send(error(500, '公钥读取失败'))
  }
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
        // 带上 `status`:出口自证最常见的两种红是 `unknown_key`(配了私钥却把公钥换了/没登记)
        // 与 `signature_invalid`(序列化口径在两侧漂了)—— 只有一句话的话,下一次排查还得重跑。
        request.log.error(
          { reason: selfCheck.reason, status: selfCheck.status },
          '审计签名导出自检未通过',
        )
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
        summary: '获取审计导出验签公钥与 kid(不带 kid = 当前签名公钥;带 kid = 按登记表取那把)',
        tags: ['audit-evidence-export'],
        querystring: {
          type: 'object',
          // 只声明类型、不声明 format/minLength —— 理由同本文件 `/signed` 那段注释
          // (ajv 先拒会把客户端 400 掩盖成 500),空值判断在 sendPublicKey 里自己做。
          properties: {
            kid: {
              type: 'string',
              description: '信封 payload.keyId 记的那个 kid;省略则返回当前签名公钥',
            },
          },
        },
        response: buildResponseSchema(400, 401, 403, 404, 500, 503),
      },
    },
    sendPublicKey,
  )
}

// =============================================================================
// 86G-1:免鉴权的验签公钥端点
// =============================================================================

/**
 * 匿名面的逐路由限流档 —— 复用仓内既有机制 `@fastify/rate-limit`(全局注册见
 * `server.ts`,逐路由 override 的既有形态见 `routes/auth-carrier.ts` /
 * `routes/auth-extended.ts`),**不自写内存计数器**。
 *
 * 30/min/IP 的依据:验签公钥是给外部审计方在交付核验时取用的,不是热路径轮询对象;
 * 全局档(生产 100/min/IP)对一个匿名只读端点仍然偏宽。导出这个常量是为了测试能
 * 按它真实打满阈值,而不是在测试里另抄一个数字(两处数字必漂移)。
 */
export const AUDIT_PUBLIC_KEY_ANON_RATE_LIMIT = { max: 30, timeWindow: '1 minute' } as const

/**
 * 免鉴权、只读、限流的公钥发布面。
 *
 * 公开面 = **这一个封装作用域里的这一条完整路由**,不是任何 URL 正则:
 * 本作用域刻意**不加** authenticate / requireAdmin preHandler,而 admin 面在另一个
 * 作用域里自带闸门 —— 鉴权由"注册在哪个作用域"决定,不由路径匹配决定,所以
 * "把公开清单扩成前缀正则"这一型(§5 鉴权面公开化铁律,agents.ts `/agents/health`
 * 游客可达且 handler 依赖 `request.userId` ⇒ 500 的同型事故)在本文件结构上不成立。
 *
 * 响应不带 `kid` 时只含三样:`publicKey`(SPKI PEM)、`keyId`(公钥 sha256 前 16 位,收件方可自算,
 * 是标识不是凭据)、`algorithm`(固定 'RSA-SHA256')。带 `?kid=`(86G-2 第二半)时多一个
 * `keyStatus`(`active`/`retired`/`bootstrap`)—— 审计方需要知道它拿到的是不是一把已轮换的旧钥匙。
 * 私钥在本函数可达域内不可达 ——
 * 出口 `getAuditExportPublicKeyInfo()` / `getAuditExportPublicKeyInfoForKid()` 只读公钥材料,
 * `sendPublicKey` 不接触任何签名路径。
 *
 * 前缀结论(现读口径):必须挂在 `/api/audit-evidence` 而非既有 admin 前缀下,理由
 * 写在本文件头注(network-segment 对 /api/admin/* 强制 allowExternal:false ⇒ 公网 403)。
 */
export const auditEvidencePublicKeyRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    '/public-key',
    {
      config: { rateLimit: { ...AUDIT_PUBLIC_KEY_ANON_RATE_LIMIT } },
      schema: {
        summary: '获取审计导出验签公钥与 kid(免鉴权 + IP 限流;仅公钥/kid/算法,绝不含私钥材料)',
        tags: ['audit-evidence-export'],
        // 刻意不声明 429:@fastify/rate-limit 的超限响应体是它自己的
        // {statusCode,error,message} 形状(仓内既有形态),套上 errorResponseSchema
        // 反而会把它的 message 之外的键裁掉,给出一个两边都不像的半截体。
        //
        // 404 是本票(86G-2 第二半)新增的一种**答复**,不是鉴权差异:带 `?kid=` 而表里
        // 没登记 ⇒ 点名"这把没登记"。它必须与 200 分得开 —— 把未登记的 kid 回落成
        // "给你当前这把",外部审计方会拿错材料验签,再把"验不过"误读成"证据被改过"。
        querystring: {
          type: 'object',
          properties: {
            kid: {
              type: 'string',
              description: '信封 payload.keyId;省略则返回当前签名公钥(与 86G-1 逐字同形)',
            },
          },
        },
        response: buildResponseSchema(400, 404, 500, 503),
      },
    },
    sendPublicKey,
  )
}
