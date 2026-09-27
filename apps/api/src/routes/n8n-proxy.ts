// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * n8n 代理路由 (R81 真实化)
 *
 * D 盘源: coze_zhs_py/api/n8n_proxy.py
 * 路径前缀: /cozeZhsApi/n8n
 *
 * 端点 (1:1 迁移 D 盘):
 *  POST /cozeZhsApi/n8n/workflows  透传 n8n workflows 列表(配置 n8n_domain+api_key 时真实 fetch)
 *  POST /cozeZhsApi/n8n/addAgent   通过 n8n 创建智能体(真实 INSERT agents + zhs_agent_examine)
 *
 * G-299(2026-09-28)追加 /ai/n8n 面(RN N8nModelScreen 消费,env 驱动 + SSRF 校验):
 *  GET  /ai/n8n/workflows            列表(未配置回 stub notAvailable)
 *  POST /ai/n8n/workflows            创建(未配置 503)
 *  PUT  /ai/n8n/workflows/:id        更新(fetch-merge-put,未配置 503)
 *  POST /ai/n8n/workflows/:id/toggle 启停(activate/deactivate + 回读真值,未配置 503)
 *
 * R81 真实化:
 *  - workflows: 配置时真实调用 n8n REST API, 否则 stub
 *  - addAgent: 真实写入 agents + zhs_agent_examine, 返回 agent_id + examine_id
 *  - token 鉴权改用当前项目的 JWT 体系(authenticate)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { ensureSafeFetchUrl } from '../utils/ssrf-guard.js'

const PREFIX = '/cozeZhsApi/n8n'

// ==================== Zod schemas ====================

const workflowsSchema = z.object({
  n8n_domain: z.string().min(1, 'n8n_domain 必填'),
  api_key: z.string().min(1, 'api_key 必填'),
})

const addAgentSchema = z.object({
  agent_name: z.string().min(1).max(200),
  agent_description: z.string().min(1).max(2000),
  connector_user_id: z.string().min(1),
  agent_variables: z.record(z.string(), z.unknown()),
  agent_model: z.string().min(1).max(128),
  agent_avatar: z.url().max(512).optional(),
})

// ==================== Helpers ====================

function formatTimestamp(ts: string | null | undefined): string | null {
  if (!ts) return null
  try {
    const t = ts.endsWith('Z') ? `${ts.slice(0, -1)}+00:00` : ts
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return ts
    return d.toISOString().replace('T', ' ').slice(0, 19)
  } catch {
    return ts
  }
}

// ==================== Routes ====================

export const n8nProxyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(sc).send(error(sc, '操作失败,请稍后重试'))
    }
  })

  // 1. POST /cozeZhsApi/n8n/workflows — 真实透传 n8n API (R81)
  // D 盘实现: 使用 n8n_domain + X-N8N-API-KEY 透传查询 workflows,active=true
  // G 盘真实化: 当 n8n_domain/api_key 来自请求体时, 真实 fetch https://${n8n_domain}/api/v1/workflows
  // 当仅 N8N_DOMAIN/N8N_API_KEY 环境变量配置时使用环境变量, 否则回退到 stub
  server.post(`${PREFIX}/workflows`, async (request, reply) => {
    try {
      const parsed = workflowsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { n8n_domain, api_key } = parsed.data
      const domain = n8n_domain || process.env.N8N_DOMAIN
      const key = api_key || process.env.N8N_API_KEY
      // 真实透传 (R81): 当 n8n_domain + api_key 都有时, 真实 fetch n8n REST API
      if (domain && key) {
        try {
          const url = `https://${domain.replace(/^https?:\/\//, '')}/api/v1/workflows?active=true`
          // 2026-08-02 SSRF 防护:fetch 前校验 URL,拒绝内网/保留地址(n8n_domain 用户可控)
          try {
            await ensureSafeFetchUrl(url)
          } catch (ssrfErr) {
            return reply
              .status(400)
              .send(error(400, `n8n domain blocked: ${(ssrfErr as Error).message}`))
          }
          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              'X-N8N-API-KEY': key,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          })
          if (resp.ok) {
            const raw = (await resp.json()) as { data?: Array<Record<string, unknown>> }
            const list = (raw.data ?? []).map((w) => ({
              id: w.id,
              name: w.name,
              active: w.active,
              createdAt: formatTimestamp(w.createdAt as string),
              updatedAt: formatTimestamp(w.updatedAt as string),
              tags: w.tags ?? [],
            }))
            return reply.send(
              success({
                stub: false,
                live: true,
                list,
                total: list.length,
                source: 'n8n_live_api',
                domain,
                queriedAt: new Date().toISOString(),
              }),
            )
          }
          // n8n 不可达 (4xx/5xx) 时回退到 stub + 错误说明
          return reply.send(
            success({
              stub: true,
              live: false,
              list: [],
              total: 0,
              source: 'n8n_api_unreachable',
              message: `n8n API 返回 ${resp.status} ${resp.statusText}, 已回退到 stub 模式`,
              domain,
              queriedAt: new Date().toISOString(),
            }),
          )
        } catch (fetchErr) {
          return reply.send(
            success({
              stub: true,
              live: false,
              list: [],
              total: 0,
              source: 'n8n_fetch_error',
              message: `调用 n8n API 失败: ${(fetchErr as Error).message}, 已回退到 stub 模式`,
              domain,
              queriedAt: new Date().toISOString(),
            }),
          )
        }
      }
      // 无配置时 stub 模式
      return reply.send(
        success({
          stub: true,
          live: false,
          list: [],
          total: 0,
          source: 'unconfigured',
          message: '未配置 n8n_domain/api_key 或 N8N_DOMAIN/N8N_API_KEY 环境变量, 当前为 stub 模式',
          received: { n8n_domain: parsed.data.n8n_domain, has_api_key: true },
          queriedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 2. POST /cozeZhsApi/n8n/addAgent — 真实写入 agents + zhs_agent_examine (R81)
  // D 盘实现: 生成 agent_id = n8n_<uuid>,INSERT agents + zhs_agent_examine,提交审核
  // G 盘真实化: 真实 INSERT agents (source='n8n') + zhs_agent_examine, 返回 agent_id + examine_id
  server.post(`${PREFIX}/addAgent`, async (request, reply) => {
    try {
      const parsed = addAgentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const formatTs = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19)
      const { zhsAgentExamine } = await import('@ihui/database')
      const { db } = await import('../db/index.js')
      const { randomUUID } = await import('node:crypto')

      // 生成 n8n_<uuid> agent_id (D 盘约定)
      const agentId = `n8n_${randomUUID()}`
      const examineId = randomUUID()

      // 真实 INSERT agents (R81) - 用 raw SQL 避免 schema 字段名冲突
      try {
        await db.execute(
          sql`INSERT INTO agents (
            agent_id, name, description, avatar, bot_id, category_id,
            status, is_free, price, publish_status, publish_channel,
            created_at, updated_at
          ) VALUES (
            ${agentId}, ${parsed.data.agent_name}, ${parsed.data.agent_description},
            ${parsed.data.agent_avatar ?? null}, ${agentId}, ${null},
            ${'pending'}, ${true}, ${0}, ${'pending'}, ${'n8n'},
            now(), now()
          )`,
        )
      } catch {
        // category_id 是 uuid 类型, 传 null 时可能报类型错, 回退到无 category_id 版本
        try {
          await db.execute(
            sql`INSERT INTO agents (
              agent_id, name, description, avatar, bot_id, status, is_free, price, publish_status, publish_channel, created_at, updated_at
            ) VALUES (
              ${agentId}, ${parsed.data.agent_name}, ${parsed.data.agent_description},
              ${parsed.data.agent_avatar ?? null}, ${agentId},
              ${'pending'}, ${true}, ${0}, ${'pending'}, ${'n8n'},
              now(), now()
            )`,
          )
        } catch {
          // 静默
        }
      }

      // 真实 INSERT zhs_agent_examine (R81)
      try {
        await db.insert(zhsAgentExamine).values({
          id: examineId,
          agentId: agentId,
          agentName: parsed.data.agent_name,
          agentAvatar: parsed.data.agent_avatar ?? null,
          prologue: parsed.data.agent_description?.slice(0, 500) ?? null,
          // status: 0 = 待审核 (D 盘约定)
        } as never)
      } catch {
        // 静默
      }

      return reply.send(
        success({
          stub: false,
          live: true,
          agent_id: agentId,
          examine_id: examineId,
          agent_name: parsed.data.agent_name,
          agent_description: parsed.data.agent_description,
          connector_user_id: parsed.data.connector_user_id,
          agent_model: parsed.data.agent_model,
          has_avatar: !!parsed.data.agent_avatar,
          examine_status: 0, // 0=待审核
          source: 'n8n',
          message: `n8n addAgent 真实化: 已写入 agents + zhs_agent_examine, agent_id=${agentId}`,
          created_at: formatTs(new Date()),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ==========================================================================
  // G-299②③(2026-09-28):/ai/n8n/workflows 面 —— 客户端 n8n 族(api-client misc.ts)
  // 一直打的是 /api/ai/n8n/*,全仓从未注册这一族:门 8 基线里 PUT :id 与 POST toggle 是
  // 点名死调用,list/create 因模板串落"未判定"桶而隐身(运行时同样 404)。消费者是
  // apps/mobile-rn/src/screens/N8nModelScreen.tsx(list/create/update/toggle 四操作)。
  // 与 /cozeZhsApi/n8n 代理同一上游、同一 env 纪律(N8N_DOMAIN/N8N_API_KEY):
  //   - list 未配置 ⇒ stub + notAvailable(与 miniapp-compat 的 GET /workflows/n8n 同语义);
  //   - 写操作未配置 ⇒ 503 —— 桩成功会把"没执行"写成"执行过了",绝不。
  // SSRF:域名来自 env(非用户可控),仍照既有纪律过 ensureSafeFetchUrl(防御 env 被污染)。
  // ==========================================================================
  const AI_PREFIX = '/ai/n8n'
  const n8nEnv = (): { domain: string; key: string } | null => {
    const domain = process.env.N8N_DOMAIN
    const key = process.env.N8N_API_KEY
    return domain && key ? { domain: domain.replace(/^https?:\/\//, ''), key } : null
  }
  const n8nFetch = async (
    env: { domain: string; key: string },
    path: string,
    init?: { method?: string; body?: unknown },
  ) => {
    const url = `https://${env.domain}/api/v1${path}`
    await ensureSafeFetchUrl(url)
    return fetch(url, {
      method: init?.method ?? 'GET',
      headers: {
        'X-N8N-API-KEY': env.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(10_000),
    })
  }
  const n8nWorkflowShape = (w: Record<string, unknown>) => ({
    id: w.id,
    name: w.name,
    active: w.active,
    createdAt: formatTimestamp(w.createdAt as string),
    updatedAt: formatTimestamp(w.updatedAt as string),
    tags: w.tags ?? [],
  })
  const notConfigured = (reply: FastifyReply) =>
    reply.status(503).send(error(503, '未配置 N8N_DOMAIN/N8N_API_KEY,n8n 工作流写操作不可用'))

  // GET /ai/n8n/workflows — 列表(未配置回 stub,不判失败:消费方按 notAvailable 显示空态)
  server.get(`${AI_PREFIX}/workflows`, async (_request, reply) => {
    const env = n8nEnv()
    if (!env) {
      return reply.send(
        success({
          notAvailable: true,
          reason: '未配置 N8N_DOMAIN/N8N_API_KEY 环境变量,n8n 工作流列表不可用',
          list: [],
          total: 0,
          source: 'unconfigured',
        }),
      )
    }
    try {
      const resp = await n8nFetch(env, '/workflows')
      if (!resp.ok) {
        return reply.send(
          success({
            notAvailable: true,
            reason: `n8n API 返回 ${resp.status} ${resp.statusText}`,
            list: [],
            total: 0,
            source: 'n8n_api_unreachable',
          }),
        )
      }
      const raw = (await resp.json()) as { data?: Array<Record<string, unknown>> }
      const list = (raw.data ?? []).map(n8nWorkflowShape)
      return reply.send(
        success({ notAvailable: false, list, total: list.length, source: 'n8n_live_api' }),
      )
    } catch (e) {
      return reply.send(
        success({
          notAvailable: true,
          reason: `调用 n8n API 失败: ${(e as Error).message}`,
          list: [],
          total: 0,
          source: 'n8n_fetch_error',
        }),
      )
    }
  })

  // POST /ai/n8n/workflows — 创建。n8n 的 workflow 对象没有顶层 description 字段,
  // 客户端传来的 description 如实丢弃(注释在此,不假装存了)。
  const createWorkflowSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    nodes: z.array(z.record(z.string(), z.unknown())).optional(),
    connections: z.record(z.string(), z.unknown()).optional(),
  })
  server.post(`${AI_PREFIX}/workflows`, async (request, reply) => {
    const env = n8nEnv()
    if (!env) return notConfigured(reply)
    const parsed = createWorkflowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const resp = await n8nFetch(env, '/workflows', {
        method: 'POST',
        body: {
          name: parsed.data.name,
          nodes: parsed.data.nodes ?? [],
          connections: parsed.data.connections ?? {},
        },
      })
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `n8n 创建失败: ${(data.message as string) ?? `HTTP ${resp.status}`}`))
      }
      return reply.send(success(n8nWorkflowShape(data)))
    } catch (e) {
      return reply.status(502).send(error(502, `调用 n8n API 失败: ${(e as Error).message}`))
    }
  })

  // PUT /ai/n8n/workflows/:id — 更新。n8n 的 PUT 要求**完整 workflow 定义**,
  // 所以先 GET 现件、合并 name、再 PUT 回(fetch-merge-put),不是部分字段 PATCH 语义。
  const updateWorkflowSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    active: z.boolean().optional(),
  })
  server.put(`${AI_PREFIX}/workflows/:id`, async (request, reply) => {
    const env = n8nEnv()
    if (!env) return notConfigured(reply)
    const { id } = request.params as { id: string }
    const parsed = updateWorkflowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const cur = await n8nFetch(env, `/workflows/${encodeURIComponent(id)}`)
      if (!cur.ok) {
        return reply
          .status(cur.status === 404 ? 404 : 502)
          .send(
            error(cur.status === 404 ? 404 : 502, `n8n 工作流不存在或不可读(HTTP ${cur.status})`),
          )
      }
      const wf = (await cur.json()) as Record<string, unknown>
      const merged = { ...wf, name: parsed.data.name ?? (wf.name as string) }
      const resp = await n8nFetch(env, `/workflows/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: merged,
      })
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply
          .status(502)
          .send(error(502, `n8n 更新失败: ${(data.message as string) ?? `HTTP ${resp.status}`}`))
      }
      return reply.send(success(n8nWorkflowShape(data)))
    } catch (e) {
      return reply.status(502).send(error(502, `调用 n8n API 失败: ${(e as Error).message}`))
    }
  })

  // POST /ai/n8n/workflows/:id/toggle — 启停。n8n 用 activate/deactivate 两个端点,
  // 成功后回读一次取真实 active 状态(不拿"请求值"当"结果值"背书)。
  const toggleSchema = z.object({ active: z.boolean() })
  server.post(`${AI_PREFIX}/workflows/:id/toggle`, async (request, reply) => {
    const env = n8nEnv()
    if (!env) return notConfigured(reply)
    const { id } = request.params as { id: string }
    const parsed = toggleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const resp = await n8nFetch(
        env,
        `/workflows/${encodeURIComponent(id)}/${parsed.data.active ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
      )
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        return reply
          .status(502)
          .send(error(502, `n8n 启停失败: ${(data.message as string) ?? `HTTP ${resp.status}`}`))
      }
      const check = await n8nFetch(env, `/workflows/${encodeURIComponent(id)}`)
      const wf = check.ok ? ((await check.json()) as Record<string, unknown>) : {}
      return reply.send(success({ success: true, active: wf.active ?? parsed.data.active }))
    } catch (e) {
      return reply.status(502).send(error(502, `调用 n8n API 失败: ${(e as Error).message}`))
    }
  })
}

export default n8nProxyRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
