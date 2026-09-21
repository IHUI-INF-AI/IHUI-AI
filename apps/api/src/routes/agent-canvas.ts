// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent Canvas 路由(P0 整图 DAG 一次性执行)。
 *
 * 作为 web ↔ ai-service 中间层,转发到 ai-service `/api/langgraph/canvas/run`。
 *
 * 端点:
 *  - POST /run  提交画布 DAG,注册整图执行,返回 { runId }(即 langgraph threadId)
 *
 * SSE 事件流复用 GET /api/agent-langgraph/:runId/stream(agent-langgraph 路由):
 * node_start/node_end 的 nodeId 与 dag.nodes[].id 对齐,data 携带
 * { stdout?, stderr?, exitCode? } 供前端日志面板渲染(见 canvas-api.ts 契约)。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { toUserFriendlyMessage } from '@ihui/shared'

/** POST /run 请求体:对齐 web CanvasDag(宽松透传 position 等额外字段) */
const runSchema = z.object({
  dag: z.looseObject({
    version: z.number().optional(),
    nodes: z
      .array(
        z.looseObject({
          id: z.string().min(1),
          type: z.enum(['agent', 'tool', 'human-review']),
          name: z.string().optional(),
          params: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .min(1),
    edges: z
      .array(
        z.looseObject({
          id: z.string().optional(),
          source: z.string().min(1),
          target: z.string().min(1),
        }),
      )
      .optional(),
  }),
  input: z.string().optional(),
})

/** ai-service 统一响应 {code, message, data} */
interface CanvasRunResp {
  code?: number
  message?: string
  data?: { runId?: string }
}

export const agentCanvasRoutes: FastifyPluginAsync = async (server) => {
  // POST /run — 提交整图 DAG,注册执行并返回 runId(后续走 SSE stream)
  server.post('/run', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const parsed = runSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const resp = await aiServiceFetch(request, '/api/langgraph/canvas/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dag: parsed.data.dag,
          input: parsed.data.input,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        // ai-service 400(DAG 校验失败)原样透传给前端,便于提示环/重复 id 等问题
        const status = resp.status === 400 ? 400 : 502
        return reply
          .status(status)
          .send(error(status, `ai-service canvas run failed: ${resp.status} ${text.slice(0, 200)}`))
      }
      const payload = (await resp.json()) as CanvasRunResp
      if (payload.code !== 0 || !payload.data?.runId) {
        return reply.status(502).send(error(502, payload.message ?? 'ai-service 响应缺少 runId'))
      }
      return reply.send(success({ runId: payload.data.runId }))
    } catch (e) {
      request.log.error({ err: e }, 'agent-canvas run failed')
      return reply.status(502).send(error(502, toUserFriendlyMessage(e)))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
