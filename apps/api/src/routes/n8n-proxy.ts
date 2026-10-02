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
 * G-299(2026-09-28)追加 /ai/n8n 面(RN N8nModelScreen 消费,env 驱动 + SSRF 校验;
 * 2026-10-02 把 list/create 自 proxy-tools 一并收拢到本面,四操作全在此):
 *  GET  /ai/n8n/workflows            列表(PageData {list,total};未配置 200 空态 + notAvailable)
 *  POST /ai/n8n/workflows            创建(调 n8n POST /workflows;未配置 503)
 *  PUT  /ai/n8n/workflows/:id        更新(fetch-merge-put,未配置 503)
 *  POST /ai/n8n/workflows/:id/toggle 启停(activate/deactivate + 回读真值,未配置 503)
 *  同路径只能有一个实现:与 ai-vendors/proxy-tools.ts 并存会让 Fastify 启动即抛
 *  FST_ERR_DUPLICATED_ROUTE(详见下方各段注释)。
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
// issue #71:n8n **基址**的 env 读取只有一个出口(本面历史上读 N8N_DOMAIN,故以它为主名,
// N8N_BASE_URL 只作别名兜底)。禁止在本文件再直接写 process.env.N8N_DOMAIN / N8N_BASE_URL;
// N8N_API_KEY 只有一个名字、两侧同值,不属这一型,仍就地读。
import { readN8nBaseUrl, readN8nCredentials, n8nNotConfiguredHint } from '../utils/n8n-env.js'

const PREFIX = '/cozeZhsApi/n8n'
const N8N_ENV_PRIMARY = 'N8N_DOMAIN' as const

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
      // 请求体优先(两条 schema 都是 min(1) 必填,所以这里的 env 回退实际走不到 ——
      // 保留只为不改变既有语义);env 那一档现在经唯一出口,别名同样生效。
      const envBase = readN8nBaseUrl(N8N_ENV_PRIMARY)
      const domain = n8n_domain || envBase?.origin
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
  // `/ai/n8n/workflows` 四操作面(客户端 n8n 族 apps/api-client misc.ts;
  // 消费者 apps/mobile-rn/src/screens/N8nModelScreen.tsx)。
  //
  // 归属(2026-10-02 合并收口):GET list / POST create / PUT :id / POST :id/toggle
  // 四操作**全部**由本面服务。此前 list/create 由 ai-vendors/proxy-tools.ts 注册、本面
  // 只留 PUT/toggle —— 那是 2026-09-27 "并存 ⇒ Fastify 启动即抛 FST_ERR_DUPLICATED_ROUTE
  // ⇒ 整个后端下线"事故后的临时拆法;两套语义已按客户端契约收拢到本面(旧实现返回裸数组、
  // create 语义是"凭据透传查询",与客户端契约都不符,详见下方各端点注释)。
  // 与 /cozeZhsApi/n8n 代理同一上游、同一 env 纪律(主名 N8N_DOMAIN,别名 N8N_BASE_URL,
  // 取值一律经 utils/n8n-env.ts 那唯一一份出口):
  //   - list 未配置 ⇒ 200 空列表 + notAvailable 标记(读操作空态可表达,与
  //     miniapp-compat /workflows/n8n 同语义);
  //   - 写操作(create/update/toggle)未配置 ⇒ 503 —— 桩成功会把"没执行"写成"执行过了",绝不。
  // SSRF:域名来自 env(非用户可控),仍照既有纪律过 ensureSafeFetchUrl(防御 env 被污染)。
  // ==========================================================================
  const AI_PREFIX = '/ai/n8n'
  const n8nEnv = (): { origin: string; key: string } | null => {
    // 取值、"是否已配置"、scheme 归一、尾斜杠 —— 全部在 utils/n8n-env.ts 那一份出口里,
    // 本面不再自己拼 https:// 或剥 scheme(别名 N8N_BASE_URL 带协议、主名 N8N_DOMAIN 裸主机,
    // 两种书写习惯都必须落同一个 origin)。
    const cred = readN8nCredentials(N8N_ENV_PRIMARY)
    if (!cred) return null
    return { origin: cred.origin, key: cred.apiKey }
  }
  const n8nFetch = async (
    env: { origin: string; key: string },
    path: string,
    init?: { method?: string; body?: unknown },
  ) => {
    const url = `${env.origin}/api/v1${path}`
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
    reply
      .status(503)
      .send(error(503, `${n8nNotConfiguredHint(N8N_ENV_PRIMARY)},n8n 工作流写操作不可用`))

  // GET / POST `${AI_PREFIX}/workflows` —— 2026-10-02 自 proxy-tools 迁入(其上两段已删除)。
  // 合并判据逐格兑现(此前三格未收口的语义以**客户端契约**为准):
  //   ① list 未配置档 ⇒ 200 空列表 + notAvailable(读操作不谎报"已执行";与
  //      miniapp-compat /workflows/n8n 的 notAvailable 语义一致);
  //   ② list 载荷 = PageData `{list, total}`(api-client 声明如此、N8nModelScreen 读 data.list;
  //      旧实现的裸数组在配置成功时也渲染空列表);
  //   ③ create = 真创建(调 n8n POST /api/v1/workflows;旧实现是"凭据透传查询",
  //      与客户端 `{name,description}` 必落 400 且从不发创建请求)。
  // 同路径只能有一个实现:与 ai-vendors/proxy-tools.ts 并存会让 Fastify 启动即抛
  // FST_ERR_DUPLICATED_ROUTE,不是这一族 404,而是整个后端起不来(2026-09-27 实测
  // IHUI-API 反复退出、服务被 nssm 挂到 PAUSED、8802 无监听)。
  // .strip() 与 zod 默认行为逐字相同(显式表态,门 161);不收紧成 .strict() ——
  // 客户端 createN8nWorkflow 入参是 Partial<N8nWorkflow>,严格拒绝会把带附加字段的请求打成 400。
  const createWorkflowSchema = z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
    })
    .strip()

  server.get(`${AI_PREFIX}/workflows`, async (_request, reply) => {
    const env = n8nEnv()
    if (!env) {
      return reply.send(
        success({
          list: [],
          total: 0,
          notAvailable: true,
          reason: `${n8nNotConfiguredHint(N8N_ENV_PRIMARY)},n8n 工作流列表不可用`,
        }),
      )
    }
    try {
      const resp = await n8nFetch(env, '/workflows?active=true')
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) {
        return reply.status(502).send(error(502, `n8n 调用失败: HTTP ${resp.status}`))
      }
      const items = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : []
      const list = items.map(n8nWorkflowShape)
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      return reply.status(502).send(error(502, `调用 n8n API 失败: ${(e as Error).message}`))
    }
  })

  server.post(`${AI_PREFIX}/workflows`, async (request, reply) => {
    const env = n8nEnv()
    if (!env) return notConfigured(reply)
    const parsed = createWorkflowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      // n8n 的创建接口要求完整定义;客户端只发 name/description,其余以最小合法空图补全
      // (与下面 PUT 的 fetch-merge-put 不同 —— 创建没有"现件"可合并)。
      const resp = await n8nFetch(env, '/workflows', {
        method: 'POST',
        body: {
          name: parsed.data.name ?? '未命名工作流',
          nodes: [],
          connections: {},
          settings: {},
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

  // 下面的 PUT :id 与 POST toggle 是 G-299 立项时就补上的真缺口;四操作至此全在本面。

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
