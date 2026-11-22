// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B04 消费面接线(2026-10-27 立):ai-service agent 循环的工具调用事实 → 证据级明细账
 * (`tool_invocation_ledger`,唯一落库出口 `recordToolInvocationLedger`)的内部摄入入口。
 *
 * 形态逐条对齐仓内既有先例,零新造鉴权:
 *  - **载体同 D154** `internal-user-broadcast.ts`:POST `/api/internal/*` + preHandler
 *    `checkInternalServiceToken`(短期票优先、dual 兼容窗;主体经"存在 + 活跃"校验后注入
 *    `request.userId`)。scope 钉 `api-tools`(封闭集既有档,工具面通用;新增专用档须
 *    发票侧与验票侧同笔,本票不做)。路径内网性由 server.ts `INTERNAL_ONLY_PREFIXES`
 *    (`/api/internal/` 整族 `allowExternal:false`)在 onRoute 层自动注入。
 *  - **CSRF 豁免是凭据验真型,不是路径白名单**:`isVerifiedInternalMachineCall` 出口
 *    (密钥验真才免,带错密钥照样 403)。因此本路由**不进** csrf.ts / tenant.ts 任何
 *    路径清单 —— 兄弟路径不带凭据必被拦,由 `tests/internal-tool-ledger-ingest-b04.test.ts`
 *    按 webhook-intake-registration 同型夹具钉住。
 *  - **身份纪律同 86H** `cli-tool-approval-audit.ts`:body 走 ledger service 导出的
 *    strict schema 唯一实现(混入 userId/user_id 等未声明键 ⇒ 400 且零写入),
 *    principal 只从承载层进;主体非 UUID ⇒ 401 归位,不外溢成 DB 错。
 *  - **失败必须响**:`chain_failed`(链写失败 ⇒ 账不落)如实 500,不演成"已落账";
 *    recorded/duplicate 都是账行在位的诚实终态,回 200。
 *
 * sqliGuard 关闭的判据同 `/api/ai/callback`(2026-08-06 生产故障立):input/output 是
 * 工具入参/结果的摘要自由文本(代码 diff、命令行、glob 通配),天然含 `--` / `/**\/`
 * 等强特征形态,开着会把证据行整批误杀成 400 —— 摄入腿是 fail-open 旁路,误杀的表现为
 * "证据静默缺失",比缺一层检测更糟。写路径是 Drizzle 参数化(recordToolInvocationLedger
 * 唯一出口,无 SQL 拼接面),鉴权由内部凭据 preHandler 保证。
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'

import { checkInternalServiceToken } from '../plugins/internal-service-token.js'
import { error, success } from '../utils/response.js'
import {
  recordToolInvocationLedger,
  toolInvocationLedgerEntrySchema,
} from '../services/tool-invocation-ledger-service.js'

/** 主体 uuid 形状把关(86H 同型:脏主体归位 401,不外溢成 DB 错)。 */
const ledgerUuidPrincipal = z.uuid()

const internalToolInvocationLedgerRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/api/internal/tool-ledger/invocation',
    {
      preHandler: async (request, reply) => {
        // 只认内部服务凭据:最终用户主体 = 验票后注入的 request.userId(票主体经
        // 存在 + 活跃校验),请求体结构上不可能自带身份 —— 自报 userId 由 strict
        // schema 在进门处拒(与"裸自报即归属"划清界限,AGENTS §5「认证不等于授权」)。
        return checkInternalServiceToken(request, reply, { scope: 'api-tools' })
      },
      config: { sqliGuard: { enabled: false } },
    },
    async (request, reply) => {
      const userId = request.userId
      if (!userId || !ledgerUuidPrincipal.safeParse(userId).success) {
        // checkInternalServiceToken 验票成功后必注入活跃主体;走到这里 = 承载层主体
        // 缺失或不是 ledger service 的 principal 硬判据要求的 UUID。**宁拒不猜**。
        request.log.warn(
          { hasUserId: !!userId, ip: request.ip },
          '[b04] tool-ledger 摄入缺少已验证 UUID 主体,拒收',
        )
        return reply.status(401).send(error(401, 'Verified UUID principal required'))
      }

      // 校验的唯一实现是服务层导出的 strict schema,此处不抄第二份(86H 纪律)。
      const parsed = toolInvocationLedgerEntrySchema.safeParse(request.body)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        const detail = first ? `${first.path.join('.')}: ${first.message}` : 'schema'
        return reply.status(400).send(error(400, `参数校验失败: ${detail}`))
      }

      try {
        const outcome = await recordToolInvocationLedger({ userId }, parsed.data, {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        })
        if (outcome.status === 'chain_failed') {
          // 链不成 ⇒ 账不落(86A2「禁止绕链」的摄入面镜像):如实 500,让 Python 腿计数出声。
          request.log.error(
            { invocationId: parsed.data.invocationId, userId },
            '[b04] tool-ledger 链写失败,账未落',
          )
          return reply.status(500).send(error(500, 'ledger chain write failed'))
        }
        return reply.send(success(outcome))
      } catch (e) {
        // 预解析已挡 schema/主体两类错;走到这里 = 链/库侧异常,如实 500(不吞成 200)。
        request.log.error(
          { err: e, invocationId: parsed.data.invocationId, userId },
          '[b04] tool-ledger 摄入落库失败',
        )
        return reply.status(500).send(error(500, 'tool ledger ingestion failed'))
      }
    },
  )
}

export default fp(internalToolInvocationLedgerRoutes, {
  name: 'internal-tool-invocation-ledger',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
