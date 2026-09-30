// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D179 会话/新对话 Issue 绑定流(2026-09-30 用户拍板立项)—— 绑定读写 + Issue 搜索转发。
 *
 * 绑定数据是**业务元数据**:只落 chat_conversations.metadata.issueBinding(jsonb 扩展字段,
 * 与既有 workspacePath 同一通道),不新增列/表。与身份元数据(ai-service session_store 的
 * IDENTITY_METADATA_KEYS)严格无关 —— 本文件不碰线程身份键,属主校验的身份只从承载层
 * request.userId(承载层 JWT)进来,客户端自报不参与判定。
 *
 * 竞品口径:bindIssue 绑定/换绑(POST,覆盖旧绑定);unbindIssue「改为独立任务」
 * = 清空绑定(DELETE);关联 Issue 随既有会话查询(serializeConversation 已带出
 * metadata)自然可达,无独立 GET。搜索走 ai-service 既有 mcp_client 通道(本文件只转发)。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { findConversationById, patchConversationMetadata } from '../db/chat-queries.js'

// G-261 同口径:uuid 校验在本层 safeParse 产统一错误信封,不进 DB 查询非法 id。
const idParam = z.object({
  id: z
    .string()
    .regex(/^(?:urn:uuid:)?[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i, '无效的对话 ID'),
})

const issueBindingSchema = z.object({
  provider: z.enum(['github', 'linear']),
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  url: z.string().min(1).max(2000),
})

const issueSearchSchema = z.object({
  provider: z.enum(['github', 'linear']),
  query: z.string().min(1).max(500),
})

export const chatIssueBindingRoutes: FastifyPluginAsync = async (server) => {
  // 与 routes/chat.ts 的 requireAuth 同模板(统一中文兜底错误)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    try {
      await authenticate(request)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, '操作失败,请稍后重试'))
      return false
    }
  }

  // 与 routes/chat.ts 的 ensureOwnedConversation 同模板:存在且属当前用户(身份从承载层)
  const ensureOwned = async (
    id: string,
    userId: string,
    reply: FastifyReply,
  ): Promise<boolean> => {
    const conversation = await findConversationById(id)
    if (!conversation) {
      reply.status(404).send(error(404, '对话不存在'))
      return false
    }
    if (conversation.userId !== userId) {
      reply.status(403).send(error(403, '无权访问该对话'))
      return false
    }
    return true
  }

  // G-261 同口径:非法 uuid 在本层 safeParse 产统一 400 信封,不进 DB 查询
  const parseConversationId = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): string | null => {
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '无效的对话 ID'))
      return null
    }
    return parsed.data.id
  }

  // POST /conversations/:id/issue —— 绑定/换绑(body 含 issue 元数据,覆盖旧绑定)
  server.post('/conversations/:id/issue', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    if (!request.userId) return
    const userId = request.userId
    const id = parseConversationId(request, reply)
    if (id === null) return
    const parsed = issueBindingSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!(await ensureOwned(id, userId, reply))) return

    const binding = { ...parsed.data, boundAt: new Date().toISOString() }
    const updated = await patchConversationMetadata(id, userId, { issueBinding: binding })
    if (!updated) return reply.status(404).send(error(404, '对话不存在'))
    return reply.send(success({ issueBinding: binding }))
  })

  // DELETE /conversations/:id/issue —— 解绑(竞品 unbindIssue「改为独立任务」= 清空绑定)
  server.delete('/conversations/:id/issue', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    if (!request.userId) return
    const userId = request.userId
    const id = parseConversationId(request, reply)
    if (id === null) return
    if (!(await ensureOwned(id, userId, reply))) return

    const updated = await patchConversationMetadata(id, userId, { issueBinding: null })
    if (!updated) return reply.status(404).send(error(404, '对话不存在'))
    return reply.send(success({ unbound: true }))
  })

  // POST /issues/search —— ai-service MCP Issue 搜索转发(D176 recap 同款转发形态:
  // 身份经 aiServiceFetch 自动透传调用者 JWT,ai-service 侧 get_current_user_id 鉴权)
  server.post('/issues/search', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = issueSearchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const resp = await aiServiceFetch(request, '/api/agent/issues/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        const status = resp.status === 401 ? 401 : resp.status === 504 ? 504 : 502
        return reply
          .status(status)
          .send(error(status, `Issue 搜索失败: ${resp.status} ${text.slice(0, 200)}`))
      }
      const payload = (await resp.json()) as {
        code: number
        message?: string
        data?: {
          provider: string
          serverName: string | null
          configured: boolean
          error: string | null
          items: Array<{ id: string; title: string; url: string; provider: string }>
        }
      }
      if (payload.code !== 0 || !payload.data) {
        return reply.status(502).send(error(502, payload.message ?? 'ai-service 响应缺少搜索结果'))
      }
      return reply.send(success(payload.data))
    } catch (e) {
      request.log.error({ err: e }, 'issue search forward failed')
      return reply.status(502).send(error(502, 'Issue 搜索失败,请稍后重试'))
    }
  })
}

export default chatIssueBindingRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
