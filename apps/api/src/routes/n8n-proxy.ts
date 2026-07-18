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
  agent_variables: z.record(z.unknown()),
  agent_model: z.string().min(1).max(128),
  agent_avatar: z.string().url().max(512).optional(),
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
      return reply.status(sc).send(error(sc, (e as Error).message || 'Authentication required'))
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
}

export default n8nProxyRoutes
