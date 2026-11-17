// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DSML 解析预览面(2026-11-17 立)。
 *
 * `POST /api/admin/relay/dsml/parse` —— 把一段上游正文粘进来,看能不能还原成 tool_call。
 *
 * 为什么先做成 admin 端点而不是直接改公开链路:DSML 可能**跨 SSE chunk** 出现,
 * 自动回退要在流收尾处缓冲并重排 item,属于公开链路的整形改造(风险高、需 fixture 覆盖
 * 流式拼接)。本端点把判据先装车(排障时能立即回答「这段能不能还原」),自动回退的接入点
 * 登记在案:v1-public 的非流式响应整形与流式收尾。
 *
 * 判据全部在 `dsml-tool-call-parser.ts`(纯函数);本文件只做入参校验与投影。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { hasDsmlMarkers, parseDsmlToolCalls } from '../../services/dsml-tool-call-parser.js'

const bodySchema = z.object({
  text: z.string().min(1).max(200_000),
})

export const relayDsmlParseRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.post('/admin/relay/dsml/parse', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send(error(400, 'text 必填且不超过 200000 字符'))

    const { text } = parsed.data
    const markers = hasDsmlMarkers(text)
    const result = parseDsmlToolCalls(text)
    return reply.send(
      success({
        has_markers: markers,
        /** null = 这段正文里没有可解析的 DSML */
        calls: result?.calls ?? null,
        degraded: result?.degraded ?? [],
        note: markers
          ? '检出 DSML 标记;calls=[] 表示标记在但结构与规范不符(仍应原样透传)'
          : '未检出 DSML 标记,原样透传即可',
      }),
    )
  })
}

export default relayDsmlParseRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
