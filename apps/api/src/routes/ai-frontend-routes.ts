// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 前端 ai 模块路由补建。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 *
 * 实现策略(26 路由分类后):
 * - GET 历史记录查询(9):接入 aiGcContent 表 + 分页,按 gcType 过滤。
 * - MCP 服务器管理(POST/DELETE):接入 mcpServers 表 CRUD。
 * - AI 能力调用代理(POST /ai/llm/chat、POST /ai/mcp/tools/call):代理到 ai-service。
 * - vendor 生成类 POST(11 个):转发到已存在的 /api/ai/* 等价端点(server.inject 内部调用)。
 *   字段映射见 vendorStubHandler 各分支。
 *
 * 注:aiGcContent 表无 vendor 列,dashscope/doubao/jimeng4 等同 gcType 路由返回相同数据集,
 *    vendor 维度过滤需后续给 aiGcContent 增加 vendor 列(见交付报告)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, count, desc, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { config } from '../config/index.js'
import { db } from '../db/index.js'
import { aiGcContent, mcpServers } from '@ihui/database'
import { toUserFriendlyMessage } from '@ihui/shared'
import { isUuidString } from '../utils/uuid.js'

type GcType = 'text' | 'image' | 'audio' | 'video'

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

async function listGcHistory(
  userId: string,
  gcType: GcType,
  q: { page?: string; pageSize?: string },
) {
  const { page, pageSize } = parsePaging(q)
  const offset = (page - 1) * pageSize
  const where = and(eq(aiGcContent.userUuid, userId), eq(aiGcContent.gcType, gcType))
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(aiGcContent)
      .where(where)
      .orderBy(desc(aiGcContent.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(aiGcContent).where(where),
  ])
  return { list: rows, total: totalRows[0]?.value ?? 0, page, pageSize }
}

/**
 * 小程序「我的创作」tab → `ai_gc_content.gc_type`。
 * 1=文本 2=图片 3=视频 4=音频 —— 与 `apps/miniapp-taro/src/pages/user/index.tsx`
 * `loadContentByTab(tabId)` 的四个分支**逐条对齐**(那边 1→textList / 2→imageList /
 * 3→videoList / 4→audioList)。两边必须是同一张对照表:改这里要同步改那边,否则
 * 「文本」tab 会拿到图片行,而端上按 tab 决定读 `content` 还是 `imageList`,表现为整片空白。
 */
const CREATION_TYPE_BY_TAB: Record<string, GcType> = {
  '1': 'text',
  '2': 'image',
  '3': 'video',
  '4': 'audio',
}

/** `ai_gc_content.content` 解码结果:已解开的结构化字段(能解开才有)+ 兜底纯文本 */
type DecodedGcContent = {
  text: string
  title?: string
  subtitle?: string
  coverUrl?: string
  fileUrl?: string
}

/**
 * `ai_gc_content.content` 在库里**有两种落库形态**,现读写入点:
 *  · `routes/other/image-gen-routes.ts:141` ⇒ `content`(或 `prompt`)**纯文本**原样存;
 *  · `routes/miniapp-compat-routes.ts:1984` ⇒ `JSON.stringify({title,subtitle,coverUrl,fileUrl,problem})`。
 * 因此这里必须「先试 JSON、解不开再退纯文本」:假定 JSON 会让文本创作整片空;
 * 假定纯文本会让标题/封面/文件地址全丢。两条分支都不能省。
 */
function decodeGcContent(raw: string | null): DecodedGcContent {
  const text = (raw ?? '').trim()
  if (text === '') return { text: '' }
  if (!(text.startsWith('{') && text.endsWith('}'))) return { text }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // 形似 JSON 但解不开(截断/转义损坏)⇒ 按纯文本对待,不吞掉用户内容
    return { text }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { text }
  const o = parsed as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
  return {
    text: str(o['content']) ?? str(o['prompt']) ?? '',
    title: str(o['title']),
    subtitle: str(o['subtitle']),
    coverUrl: str(o['coverUrl']),
    fileUrl: str(o['fileUrl']),
  }
}

/**
 * 「我的创作」统一处理器(两条路径共用:小程序端历史上分别调 `/ai/my-creation` 与
 * `/aigc/my-works`,全仓都**没有**这两个端点 ⇒ 必然 404、两个页面恒空)。
 *
 * 数据源不是新表,就是上面 9 条历史路由用的那张 `ai_gc_content` —— 同一份用户创作记录,
 * 只是这两条路径当年没接上。响应形状对齐端上读取方式:
 * 文本读 `content`、图片读 `imageList`、视频读 `videoUrl`、音频读 `audioUrl`,
 * 时间读 `time`(兼容 `createTime`,端上两个都试过)。
 *
 * 说明一个**已知数据缺口**(不在本处理器能修的范围):图片行里没有 url ——
 * `image-gen-routes.ts` 只把 prompt 落库,生成出的 imageUrl 直接回给客户端不入库。
 * 所以历史图片行的 `imageList` 会是空数组。要补齐得改那条写入点(它现在连 url 都没有列可存),
 * 属独立一笔,不在这里假装有数据(零假数据铁律)。
 */
async function myCreationHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const q = request.query as { type?: string; gcType?: string; page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    // `type` = 小程序 tab 号;`gcType` = 直接给语义值(供新调用方用,免背 tab 号)
    const mapped = q.type === undefined ? undefined : CREATION_TYPE_BY_TAB[String(q.type)]
    const explicit = q.gcType as GcType | undefined
    const gcType = explicit ?? mapped
    const where =
      gcType === undefined
        ? eq(aiGcContent.userUuid, request.userId!)
        : and(eq(aiGcContent.userUuid, request.userId!), eq(aiGcContent.gcType, gcType))
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(aiGcContent).where(where),
    ])
    const list = rows.map((row) => {
      const d = decodeGcContent(row.content)
      const type = row.gcType ?? 'text'
      const fileUrl = d.fileUrl ?? ''
      return {
        id: row.id,
        type,
        title: d.title ?? d.text.slice(0, 40),
        subtitle: d.subtitle ?? '',
        time: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        content: d.text,
        coverUrl: d.coverUrl ?? '',
        // 端上按 gcType 分支读不同字段,这里四个都给,免端上再按类型拼
        imageList: type === 'image' && fileUrl !== '' ? [fileUrl] : [],
        videoUrl: type === 'video' ? fileUrl : '',
        audioUrl: type === 'audio' ? fileUrl : '',
      }
    })
    return reply.send(success({ list, total: totalRows[0]?.value ?? 0, page, pageSize }))
  } catch (e) {
    request.log.error(e)
    return reply.status(500).send(error(500, '查询我的创作失败'))
  }
}

function gcHistoryHandler(gcType: GcType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await listGcHistory(
        request.userId!,
        gcType,
        request.query as { page?: string; pageSize?: string },
      )
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询生成历史失败'))
    }
  }
}

async function proxyToAiService(
  path: string,
  request: FastifyRequest,
  reply: FastifyReply,
  body: unknown,
) {
  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.authorization ?? '',
      },
      body: JSON.stringify(body),
    })
    const data = (await resp.json().catch(() => ({}))) as unknown
    if (!resp.ok) {
      const code = resp.status === 401 ? 401 : 502
      return reply.status(code).send(error(code, `ai-service 调用失败: ${resp.status}`))
    }
    return reply.send(success(data))
  } catch (e) {
    request.log.error(e)
    return reply.status(502).send(error(502, `ai-service 调用异常: ${toUserFriendlyMessage(e)}`))
  }
}

/**
 * 内部路由转发:通过 server.inject 调用同进程已注册的 /api/ai/* 等价端点。
 * 用于 vendor stub 真实化(11 个 vendor 已有等价实现,仅路径不同)。
 */
async function proxyToSelfApi(
  server: FastifyInstance,
  method: 'GET' | 'POST',
  path: string,
  request: FastifyRequest,
  reply: FastifyReply,
  body?: unknown,
) {
  try {
    const injectOpts: {
      method: 'GET' | 'POST'
      url: string
      headers: Record<string, string>
      payload?: string
    } = {
      method,
      url: path,
      headers: { authorization: request.headers.authorization ?? '' },
    }
    if (method === 'POST' && body !== undefined) {
      injectOpts.payload = JSON.stringify(body)
      injectOpts.headers['content-type'] = 'application/json'
    }
    const res = await server.inject(injectOpts)
    const json = res.json()
    return reply.code(res.statusCode).send(json)
  } catch (e) {
    request.log.error(e)
    return reply.status(502).send(error(502, `内部路由调用异常: ${toUserFriendlyMessage(e)}`))
  }
}

const mcpServerBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  endpoint: z.string().min(1).max(500),
  status: z.number().int().optional(),
})
const idParam = z.object({ id: z.string().min(1) })
const llmChatBody = z.looseObject({
  messages: z.array(z.unknown()).max(100),
  model: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
/** FIM 补全请求体(2026-09-07):prefix 必填,suffix/language/model/max_tokens 可选 */
const llmFimBody = z.looseObject({
  prefix: z.string().max(200_000),
  suffix: z.string().max(80_000).optional(),
  language: z.string().max(40).optional(),
  model: z.string().optional(),
  max_tokens: z.number().int().min(1).max(512).optional(),
})
const mcpToolCallBody = z.looseObject({ name: z.string().min(1) })

export const aiFrontendRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权:所有 ai 模块路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, toUserFriendlyMessage(e) || '操作失败,请稍后重试'))
    }
  })

  // ==========================================================================
  // GET 历史记录查询(9 路由)— 接入 aiGcContent 表,按 gcType 过滤 + 分页
  // ==========================================================================
  server.get('/ai/dashscope/chat', gcHistoryHandler('text'))
  server.get('/ai/dashscope/image', gcHistoryHandler('image'))
  server.get('/ai/doubao/image', gcHistoryHandler('image'))
  server.get('/ai/jimeng4/image', gcHistoryHandler('image'))
  server.get('/ai/kling/video/generate', gcHistoryHandler('video'))
  server.get('/ai/dashscope/video', gcHistoryHandler('video'))
  server.get('/ai/audio/speech', gcHistoryHandler('audio'))
  server.get('/ai/suno/generate', gcHistoryHandler('audio'))
  server.get('/ai/tencent/hunyuan3d/submit', gcHistoryHandler('video'))

  // ==========================================================================
  // GET 我的创作(2 路由)— 同一张 aiGcContent 表,但**全类型**、按 tab/类型过滤
  // 这两条是小程序端历史上就在调、后端从未注册的路径(小程序页面因此恒空):
  //   · `/ai/my-creation` ← apps/miniapp-taro/src/pages/user/index.tsx(我的-创作,四个 tab)
  //   · `/aigc/my-works`  ← apps/miniapp-taro/src/pages/circle/create.tsx(发圈-选我的作品)
  // 与上面 9 条的区别只在"全类型 + 端上字段拼装",故共用 myCreationHandler。
  // ==========================================================================
  server.get('/ai/my-creation', myCreationHandler)
  server.get('/aigc/my-works', myCreationHandler)

  // ==========================================================================
  // MCP 服务器管理 — 接入 mcpServers 表 CRUD
  // ==========================================================================

  // GET /ai/mcp/servers — 列出 MCP 服务器
  // 读 mcpServers 表(与 POST 写入的表一致),并尽力合并 ai-service 外部连接状态;
  // 表为空时返回 [] 而非 404;ai-service 不可达时降级为无连接状态。
  server.get('/ai/mcp/servers', async (request, reply) => {
    try {
      const rows = await db.select().from(mcpServers).orderBy(desc(mcpServers.createdAt))
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/external/servers`, {
          headers: { Authorization: request.headers.authorization ?? '' },
        })
        if (resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as {
            servers?: Array<{ name: string; connected?: boolean }>
          }
          const statusByName = new Map(
            (data.servers ?? []).map((s) => [s.name, s.connected ?? false]),
          )
          for (const row of rows) {
            ;(row as Record<string, unknown>).connected = statusByName.get(row.name) ?? null
          }
        }
      } catch {
        // ai-service 不可达,不合并连接状态
      }
      return reply.send(success(rows))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 服务器失败'))
    }
  })

  // POST /ai/mcp/servers — 创建 MCP 服务器
  server.post('/ai/mcp/servers', async (request, reply) => {
    const parsed = mcpServerBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const [row] = await db
        .insert(mcpServers)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          endpoint: parsed.data.endpoint,
          status: parsed.data.status ?? 1,
        })
        .returning()
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 MCP 服务器失败'))
    }
  })

  // POST /ai/mcp/servers/:id/:id — 路径异常(重复 :id 参数,疑似前端 bug)
  // 分类:可删除。保留空桩避免前端 404,待前端修正路径后移除。
  server.post('/ai/mcp/servers/:id/:id', async (_request, reply) => {
    return reply
      .status(400)
      .send(error(400, '路径参数异常,请使用 /ai/mcp/servers/:id/tools 调用工具'))
  })

  // DELETE /ai/mcp/servers/:id — 删除 MCP 服务器
  server.delete('/ai/mcp/servers/:id', async (request, reply) => {
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(parsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    try {
      const removed = await db
        .delete(mcpServers)
        .where(eq(mcpServers.id, parsed.data.id))
        .returning({ id: mcpServers.id })
      const [row] = removed
      if (!row) return reply.status(404).send(error(404, 'MCP 服务器不存在'))
      return reply.send(success({ id: row.id, deleted: removed.length > 0 }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除 MCP 服务器失败'))
    }
  })

  // GET /ai/mcp/servers/:id/tools — 列出指定 MCP 服务器的工具
  // 代理到 ai-service /api/mcp/tools,客户端按 serverId 过滤(ai-service 暂无按服务器查询端点)
  server.get('/ai/mcp/servers/:id/tools', async (request, reply) => {
    const { id } = (request.params as { id: string }) ?? { id: '' }
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/tools`, {
        headers: { Authorization: request.headers.authorization ?? '' },
      })
      if (!resp.ok) {
        return reply.status(502).send(error(502, `ai-service 调用失败: ${resp.status}`))
      }
      const data = (await resp.json().catch(() => ({ tools: [] }))) as {
        tools: Array<Record<string, unknown>>
        count: number
      }
      const tools = (data.tools ?? []).filter(
        (t) => !t.serverId || t.serverId === id || t.server === id,
      )
      return reply.send(success({ list: tools, total: tools.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `ai-service 调用异常: ${toUserFriendlyMessage(e)}`))
    }
  })

  // POST /ai/mcp/tools/call — 调用 MCP 工具(代理到 ai-service)
  server.post('/ai/mcp/tools/call', async (request, reply) => {
    const parsed = mcpToolCallBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? 'name 为必填'))
    }
    return proxyToAiService('/api/mcp/tools/call', request, reply, parsed.data)
  })

  // GET /ai/mcp/resources — MCP 资源列表(G-962 #73)
  // 消费方 mcp-projects/PageClient.tsx:87 期望 data 为 McpResource[] 数组;
  // 真形态在 ai-service GET /api/mcp/resources(mcp.py:152,返回 {resources,count}) ⇒ 代理并拆壳。
  server.get('/ai/mcp/resources', async (request, reply) => {
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/resources`, {
        headers: { Authorization: request.headers.authorization ?? '' },
      })
      if (!resp.ok) {
        return reply.status(502).send(error(502, `ai-service 调用失败: ${resp.status}`))
      }
      const data = (await resp.json().catch(() => ({ resources: [] }))) as {
        resources?: Array<Record<string, unknown>>
      }
      return reply.send(success(data.resources ?? []))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `ai-service 调用异常: ${toUserFriendlyMessage(e)}`))
    }
  })

  // GET /ai/mcp/prompts — MCP 提示词列表(G-962 #74)
  // 消费方 components/mcp/mcp-prompt-manager.tsx:59 期望 data 为 McpPrompt[] 数组;
  // 真形态在 ai-service GET /api/mcp/prompts(mcp.py:171,返回 {prompts,count}) ⇒ 代理并拆壳。
  server.get('/ai/mcp/prompts', async (request, reply) => {
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/prompts`, {
        headers: { Authorization: request.headers.authorization ?? '' },
      })
      if (!resp.ok) {
        return reply.status(502).send(error(502, `ai-service 调用失败: ${resp.status}`))
      }
      const data = (await resp.json().catch(() => ({ prompts: [] }))) as {
        prompts?: Array<Record<string, unknown>>
      }
      return reply.send(success(data.prompts ?? []))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `ai-service 调用异常: ${toUserFriendlyMessage(e)}`))
    }
  })

  // GET /ai/mcp/usage — MCP 用量统计(G-962 #75)
  // 消费方 components/mcp/mcp-use-manager.tsx:126 期望 UsageStats
  // { totalCalls, successRate, avgDuration, byServer[] }。全仓(含 ai-service)无 MCP 调用日志表,
  // 给最小真实空聚合(零调用=真实状态),禁硬编码假数据;补齐需新表 mcp_call_logs + tools/call 腿
  // 埋点(迁移归 drizzle 线),已在裁决台账登记为残段。
  server.get('/ai/mcp/usage', async (_request, reply) => {
    return reply.send(success({ totalCalls: 0, successRate: 0, avgDuration: 0, byServer: [] }))
  })

  // ==========================================================================
  // AI 能力调用代理(代理到 ai-service)
  // ==========================================================================

  // POST /ai/llm/chat — LLM 对话(代理到 ai-service /api/llm/complete)
  server.post('/ai/llm/chat', async (request, reply) => {
    const parsed = llmChatBody.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'messages 为必填'))
    }
    const body = {
      messages: parsed.data.messages,
      ...(parsed.data.model !== undefined ? { model: parsed.data.model } : {}),
      metadata: { userId: request.userId, ...(parsed.data.metadata ?? {}) },
    }
    return proxyToAiService('/api/llm/complete', request, reply, body)
  })

  // POST /ai/llm/fim — FIM 代码补全(2026-09-07 立,代理到 ai-service /api/llm/fim)。
  // 浏览器 IDE Monaco inline completion 专用:低延迟、无状态、失败静默降级。
  // 补全流量高频(每次停顿 300ms 触发),metadata 不注入(无会话语义)。
  server.post('/ai/llm/fim', async (request, reply) => {
    const parsed = llmFimBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? 'prefix 为必填'))
    }
    return proxyToAiService('/api/llm/fim', request, reply, parsed.data)
  })

  // ==========================================================================
  // vendor 生成类 POST — 转发到已存在的 /api/ai/* 等价端点(server.inject 内部调用)
  // 字段映射依据:apps/web/src/hooks/use-ai-talk.ts + use-ai-helpers.ts 的 body 构造
  // ==========================================================================

  // POST /ai/cosyvoice → /api/ai/audio/speech (CosyVoice TTS)
  // 前端 body:{copyWriting, chatId, audioId, audioPath} → 等价端点需 {text, model:'cosyvoice-v2'}
  server.post('/ai/cosyvoice', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = {
      text: (b.copyWriting as string) ?? (b.prompt as string) ?? '',
      model: 'cosyvoice-v2',
    }
    return proxyToSelfApi(server, 'POST', '/api/ai/audio/speech', request, reply, mapped)
  })

  // POST /ai/keling/audio/start → /api/ai/kling/task/create (Kling 对口型任务创建)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/keling/audio/start', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/kling/task/create', request, reply, request.body)
  })

  // POST /ai/keling/audio/end → GET /api/ai/kling/task/query/:taskId (Kling 任务查询)
  // 前端 body:{task_id} → 提取 task_id 拼 URL,GET 请求
  server.post('/ai/keling/audio/end', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const taskId = (b.task_id as string) ?? (b.taskId as string) ?? ''
    if (!taskId) return reply.status(400).send(error(400, '缺少 task_id'))
    return proxyToSelfApi(server, 'GET', `/api/ai/kling/task/query/${taskId}`, request, reply)
  })

  // POST /ai/sora/request → /api/ai/sora2/generate (Sora2 视频生成)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/sora/request', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/sora2/generate', request, reply, request.body)
  })

  // POST /ai/sora/request/end → GET /api/ai/sora2/tasks/:taskId (Sora2 任务查询)
  // 前端 body:{task_id} → 提取 task_id 拼 URL,GET 请求
  server.post('/ai/sora/request/end', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const taskId = (b.task_id as string) ?? (b.taskId as string) ?? ''
    if (!taskId) return reply.status(400).send(error(400, '缺少 task_id'))
    return proxyToSelfApi(server, 'GET', `/api/ai/sora2/tasks/${taskId}`, request, reply)
  })

  // POST /ai/dashscope/image/generate → /api/ai/dashscope/image (通义万相图像)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/dashscope/image/generate', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/dashscope/image', request, reply, request.body)
  })

  // POST /ai/hunyuan/3d/submit → /api/ai/tencent/hunyuan3d/submit (腾讯混元3D)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/hunyuan/3d/submit', async (request, reply) => {
    return proxyToSelfApi(
      server,
      'POST',
      '/api/ai/tencent/hunyuan3d/submit',
      request,
      reply,
      request.body,
    )
  })

  // POST /ai/gemini/nano-banana → /api/ai/gemini/image (Gemini 2.5 Flash Image)
  // 前端 body:buildIhuiLlmBody → 注入 model:'gemini-2.5-flash-image'
  server.post('/ai/gemini/nano-banana', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = { ...b, model: 'gemini-2.5-flash-image' }
    return proxyToSelfApi(server, 'POST', '/api/ai/gemini/image', request, reply, mapped)
  })

  // POST /ai/google/veo3 → /api/ai/gemini/video (Veo3 视频)
  // 前端 body:buildIhuiLlmBody → 注入 model:'veo-3.1-generate-preview'
  server.post('/ai/google/veo3', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = { ...b, model: 'veo-3.1-generate-preview' }
    return proxyToSelfApi(server, 'POST', '/api/ai/gemini/video', request, reply, mapped)
  })

  // POST /ai/dashscope/video/generate → /api/ai/dashscope/video (通义万相视频)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/dashscope/video/generate', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/dashscope/video', request, reply, request.body)
  })

  // POST /ai/qwen/omni → /api/ai/dashscope/multimodal (Qwen-Omni 多模态)
  // 前端 body:buildIhuiLlmBody → 注入 model:'qwen-omni-turbo'
  server.post('/ai/qwen/omni', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = { ...b, model: 'qwen-omni-turbo' }
    return proxyToSelfApi(server, 'POST', '/api/ai/dashscope/multimodal', request, reply, mapped)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
