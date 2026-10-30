// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Anthropic Claude 专有代理路由(2026-09-20 四大模态补齐)。
 *
 * Anthropic Messages API 与 OpenAI chat/completions 协议不同,不能走 proxy-openai-compat:
 *   - POST /api/ai/anthropic/chat   → {base}/v1/messages(原生全参数透传,max_tokens 缺省 4096)
 *   - GET  /api/ai/anthropic/models → {base}/v1/models(官方模型列表)
 *
 * 鉴权:callVendor 自动携带 x-api-key + anthropic-version(见 VENDORS.anthropic.authHeader)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { buildSchema } from '../../utils/swagger.js'
import { success } from '../../utils/response.js'
import { callVendor, recordUsage, VENDORS } from './_shared.js'
import { ensurePointsBalance, chargePointsForCall } from './proxy-llm.js'

// Anthropic Messages API 官方参数集
const anthropicChatBody = z.object({
  model: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  max_tokens: z.number().int().optional(),
  system: z.union([z.string(), z.array(z.unknown())]).optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().optional(),
  top_k: z.number().int().optional(),
  stop_sequences: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // --- 2026-09-21 官方最新参数补齐 ---
  // 扩展思考:{type:'enabled',budget_tokens:N} 或 {type:'disabled'};
  // budget_tokens 需 ≥1024 且 max_tokens>budget_tokens
  thinking: z.unknown().optional(),
  // 服务层级:'auto'|'standard_only'
  service_tier: z.string().optional(),
  // 结构化输出 beta:{type:'json_schema',schema}(需 anthropic-beta header)
  output_format: z.unknown().optional(),
  // beta 特性列表:转发时转为 'anthropic-beta' header,不透传 body
  betas: z.array(z.string()).max(10).optional(),
  // MCP 连接器(最多 20 个)
  mcp_servers: z.array(z.unknown()).max(20).optional(),
  // 上下文编辑 beta:{edits:[...]}
  context_management: z.unknown().optional(),
  // 快速模式 beta:'fast'
  speed: z.string().optional(),
})

const BASE = VENDORS.anthropic!.baseUrl // https://api.anthropic.com

export const anthropicVendorRoutes: FastifyPluginAsync = async (server) => {
  // ---- POST /anthropic/chat → {base}/v1/messages ----
  server.post(
    '/anthropic/chat',
    {
      schema: buildSchema({
        summary: 'Anthropic Claude 对话补全',
        description:
          '代理调用 https://api.anthropic.com/v1/messages(Messages API 官方全参数透传)。' +
          'max_tokens 缺省 4096;messages 中的 system 角色自动拆分到 system 字段。',
        tags: ['AI', 'Anthropic', 'Claude'],
        body: anthropicChatBody,
      }),
    },
    async (request, reply) => {
      const body = anthropicChatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      // 兼容 OpenAI 风格入参:messages 里混入的 system 消息拆到顶层 system 字段
      const msgs: unknown[] = []
      let systemField: string | unknown[] | undefined = body.system
      for (const m of body.messages ?? []) {
        const rec = m as { role?: string; content?: unknown }
        if (rec.role === 'system' && systemField === undefined) {
          systemField =
            typeof rec.content === 'string'
              ? rec.content
              : Array.isArray(rec.content)
                ? (rec.content as unknown[])
                : String(rec.content ?? '')
          continue
        }
        msgs.push(m)
      }
      const payload: Record<string, unknown> = {
        model: body.model ?? 'claude-sonnet-4-5',
        messages: msgs,
        max_tokens: body.max_tokens ?? 4096,
      }
      if (systemField !== undefined) payload.system = systemField
      if (body.temperature !== undefined) payload.temperature = body.temperature
      if (body.top_p !== undefined) payload.top_p = body.top_p
      if (body.top_k !== undefined) payload.top_k = body.top_k
      if (body.stop_sequences !== undefined) payload.stop_sequences = body.stop_sequences
      if (body.stream !== undefined) payload.stream = body.stream
      if (body.tools !== undefined) payload.tools = body.tools
      if (body.tool_choice !== undefined) payload.tool_choice = body.tool_choice
      if (body.metadata !== undefined) payload.metadata = body.metadata
      // --- 2026-09-21 官方最新参数补齐:新字段透传到 /v1/messages ---
      if (body.thinking !== undefined) payload.thinking = body.thinking
      if (body.service_tier !== undefined) payload.service_tier = body.service_tier
      if (body.output_format !== undefined) payload.output_format = body.output_format
      if (body.mcp_servers !== undefined) payload.mcp_servers = body.mcp_servers
      if (body.context_management !== undefined) payload.context_management = body.context_management
      if (body.speed !== undefined) payload.speed = body.speed
      // betas 不进透传 body,转为 'anthropic-beta' header(逗号连接)
      const extraHeaders: Record<string, string> = {}
      if (body.betas !== undefined) extraHeaders['anthropic-beta'] = body.betas.join(',')
      const data = await callVendor('anthropic', `${BASE}/v1/messages`, reply, {
        method: 'POST',
        headers: extraHeaders,
        body: JSON.stringify(payload),
      })
      if (data === null) return
      recordUsage(request.userId!, 'anthropic')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  // ---- GET /anthropic/models → {base}/v1/models ----
  server.get(
    '/anthropic/models',
    {
      schema: buildSchema({
        summary: 'Anthropic Claude 模型列表',
        description: '代理调用 https://api.anthropic.com/v1/models 动态获取官方全量模型',
        tags: ['AI', 'Anthropic', 'Claude'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('anthropic', `${BASE}/v1/models`, reply, { method: 'GET' })
      if (data === null) return
      return reply.send(success(data))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
