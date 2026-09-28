// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D154(2026-09-30 立)MCP 连接状态的 per-user 下行入口。
 *
 * 载体与 D153 同一枚拍板(V4 §11.3):复用 `plugins/ws-broadcast.ts` 装饰出的
 * `server.broadcastToUser(userId, event, data)`,事件名 `mcp:status` 的形态与校验
 * 唯一出口在 `@ihui/types`(三个消费面共用一份描述),**不得**另开第二条 per-user 通道。
 *
 * 为什么需要一个 HTTP 入口而不是像 D153 那样在路由里直接发射:
 * MCP 连接的生死发生在 **ai-service**(Python 侧 `services/mcp_client.py` 的
 * connect / _reconnect / EOF 位),而 WS 连接表住在 **apps/api** 进程里。
 * 时序上 MCP 启动还早于任何 SSE 流,所以状态只能搭载 WS 常连(票第 8 栏拍板①)。
 *
 * 三条不可漂的写法:
 *  ① **主体只能从承载层进来**(AGENTS §5「认证不等于授权」):收信人取
 *     `checkInternalServiceToken` 验票后注入的 `request.userId`,请求体里没有 userId
 *     这个键位(schema 是 strict,多一个键直接 400)。谁收到这一帧由"这台 server 是谁
 *     注册的"决定,而不是由发帧方决定。
 *  ② **构造必须走 @ihui/types 的唯一出口**(`mcpStatusEvent`):坏值在构造点就抛,
 *     而不是把一帧没人能渲染的东西推上线 —— 这一族的缺陷形态恰恰是"用户什么都看不到"。
 *  ③ **发射失败不得改响应状态**:投递没成功是"下行没到"(端上退回拉取制),
 *     把 200 变成 500 会把病因指错。但必须出声(`request.log.warn`,§5e「失败必须响」)。
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'
import { mcpStatusEvent, MCP_CONNECTION_STATES, type McpConnectionState } from '@ihui/types'
import { checkInternalServiceToken } from '../plugins/internal-service-token.js'
import { error, success } from '../utils/response.js'

/**
 * 载荷 schema 与 `@ihui/types` 的 `isMcpStatusData` 同形(字段、封闭集、attempt 成对)。
 *
 * 为什么不直接信类型层:类型只在编译期存在,线上帧来自另一个进程(Python)。
 * 两层各判一次不是冗余 —— zod 挡下的是"发帧方代码写错",`parseUserBroadcastFrame`
 * 挡下的是"链路中间被改过"。少任何一层,坏帧就只剩"端上渲染成空白"这一种表现。
 */
const mcpStatusBodySchema = z.strictObject({
  server: z.string().min(1).max(128),
  state: z.enum(MCP_CONNECTION_STATES),
  reason: z.string().optional(),
  attempt: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().optional(),
  tools: z.array(z.string().min(1)).optional(),
})

/**
 * 「有 attempt 必须有 maxAttempts」这一条 zod 表达不了(它是两键关系),
 * 由 `mcpStatusEvent` 抛出后归到 400。文案 `chat.mcp.state.reconnecting` 需要
 * {{attempt}}/{{maxAttempts}} 两格,只给一半会渲染成"第 2/ 次重连"。
 */
export const mcpStatusIngestFailureMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'mcp:status 载荷不合法'

const internalUserBroadcastRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/api/internal/user-broadcast/mcp-status',
    {
      preHandler: async (request, reply) => {
        // 只认内部服务凭据:这条通道不接受用户 JWT —— 端上不能自己声明"我的 MCP 挂了",
        // 那会让任何一台设备给自己推任意状态(状态表的真值只能来自持有连接的那个进程)。
        return checkInternalServiceToken(request, reply)
      },
    },
    async (request, reply) => {
      const parsed = mcpStatusBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const userId = request.userId
      if (!userId) {
        // checkInternalServiceToken 验票成功后必注入 request.userId;走到这里说明鉴权面
        // 被改动过。**宁拒不猜**:没有主体就没有收信人,静默广播等于广播给全表。
        request.log.error({}, '[d154] internal user-broadcast 缺少已验证主体,拒发')
        return reply.status(401).send(error(401, 'Verified principal required'))
      }

      let evt: ReturnType<typeof mcpStatusEvent>
      try {
        evt = mcpStatusEvent({
          server: parsed.data.server,
          state: parsed.data.state as McpConnectionState,
          reason: parsed.data.reason,
          attempt: parsed.data.attempt,
          maxAttempts: parsed.data.maxAttempts,
          tools: parsed.data.tools,
        })
      } catch (e) {
        return reply.status(400).send(error(400, mcpStatusIngestFailureMessage(e)))
      }

      try {
        server.broadcastToUser(userId, evt.event, evt.data)
      } catch (err) {
        request.log.warn(
          { err, userId, server: evt.data.server, state: evt.data.state },
          'D154 MCP 状态广播发射失败(端上退回下次打开时同步)',
        )
      }
      return reply.send(success({ accepted: true }))
    },
  )
}

export default fp(internalUserBroadcastRoutes, { name: 'internal-user-broadcast' })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
