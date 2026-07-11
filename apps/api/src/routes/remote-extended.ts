import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { users, userMargins, userVips, agents } from '@ihui/database'

// =============================================================================
// Zod schemas
// =============================================================================

const agentIdParamSchema = z.object({ agentId: z.string().min(1) })

const favoriteAgentSchema = z.object({
  agentId: z.string().min(1, 'agentId 不能为空'),
})

const feedbackSchema = z.object({
  type: z.string().min(1).max(64),
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
  contact: z.string().max(255).optional(),
  images: z.array(z.string()).optional(),
})

const businessCardSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  name: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  title: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().max(255).optional(),
  rawData: z.any().optional(),
})

const withdrawalSwitchSchema = z.object({
  enabled: z.boolean(),
  remark: z.string().max(255).optional(),
})

const asrSchema = z.object({
  audioUrl: z.string().min(1, '音频地址不能为空'),
  language: z.string().max(20).optional(),
  model: z.string().max(64).optional(),
})

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

// =============================================================================
// 路由
// =============================================================================

export const remoteExtendedRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // GET /remote/user/info - 用户信息（含 token 余量、VIP 状态）
  // -------------------------------------------------------------------------
  server.get('/remote/user/info', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    try {
      const [user] = await db
        .select({
          id: users.id,
          phone: users.phone,
          email: users.email,
          username: users.username,
          nickname: users.nickname,
          avatar: users.avatar,
          bio: users.bio,
          gender: users.gender,
          isVip: users.isVip,
          inviteCode: users.inviteCode,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user) return reply.status(404).send(error(404, '用户不存在'))

      // token 余量
      const [margin] = await db
        .select({
          tokenQuantity: userMargins.tokenQuantity,
          frozenQuantity: userMargins.frozenQuantity,
        })
        .from(userMargins)
        .where(eq(userMargins.userId, userId))
        .limit(1)

      // VIP 订阅状态（取最新一条生效记录）
      const [vip] = await db
        .select({
          levelValue: userVips.levelValue,
          startTime: userVips.startTime,
          endTime: userVips.endTime,
          status: userVips.status,
          autoRenew: userVips.autoRenew,
        })
        .from(userVips)
        .where(and(eq(userVips.userId, userId), eq(userVips.status, 1)))
        .orderBy(desc(userVips.createdAt))
        .limit(1)

      return reply.send(
        success({
          ...user,
          token: {
            quantity: margin?.tokenQuantity ?? 0,
            frozen: margin?.frozenQuantity ?? 0,
          },
          vip: vip ?? null,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '获取用户信息失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /remote/business-card/upload - 名片上传
  // -------------------------------------------------------------------------
  server.post('/remote/business-card/upload', async (request, reply) => {
    await authenticate(request)
    const parsed = businessCardSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, name, company, title, phone, email, rawData } = parsed.data
    try {
      const rows = await db.execute(
        sql`INSERT INTO business_cards (user_id, image_url, name, company, title, phone, email, raw_data, created_at)
            VALUES (${request.userId!}, ${imageUrl}, ${name ?? null}, ${company ?? null},
                    ${title ?? null}, ${phone ?? null}, ${email ?? null}, ${rawData ? JSON.stringify(rawData) : null}, NOW())
            RETURNING id, image_url, name, company, title, phone, email, created_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '名片上传失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /remote/agent/favorites - Agent 收藏列表
  // -------------------------------------------------------------------------
  server.get('/remote/agent/favorites', async (request, reply) => {
    await authenticate(request)
    const q = request.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    try {
      const rows = await db.execute(
        sql`SELECT f.id, f.agent_id, f.created_at,
                   a.name, a.avatar, a.cover, a.description, a.status, a.is_free, a.price
            FROM agent_favorites f
            LEFT JOIN agents a ON a.agent_id::text = f.agent_id::text
            WHERE f.user_id = ${request.userId!}
            ORDER BY f.created_at DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM agent_favorites WHERE user_id = ${request.userId!}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询收藏列表失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /remote/agent/favorite - 收藏 Agent
  // -------------------------------------------------------------------------
  server.post('/remote/agent/favorite', async (request, reply) => {
    await authenticate(request)
    const parsed = favoriteAgentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { agentId } = parsed.data
    try {
      // 检查 Agent 是否存在
      const [agent] = await db
        .select({ agentId: agents.agentId })
        .from(agents)
        .where(eq(agents.agentId, agentId))
        .limit(1)
      if (!agent) return reply.status(404).send(error(404, 'Agent 不存在'))

      // 检查是否已收藏
      const existing = await db.execute(
        sql`SELECT id FROM agent_favorites WHERE user_id = ${request.userId!} AND agent_id::text = ${agentId} LIMIT 1`,
      )
      if ((existing as Record<string, unknown>[]).length > 0) {
        return reply.status(409).send(error(409, '已收藏该 Agent'))
      }

      const rows = await db.execute(
        sql`INSERT INTO agent_favorites (user_id, agent_id, created_at)
            VALUES (${request.userId!}, ${agentId}, NOW())
            RETURNING id, agent_id, created_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '收藏 Agent 失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /remote/agent/favorite/:agentId - 取消收藏
  // -------------------------------------------------------------------------
  server.delete('/remote/agent/favorite/:agentId', async (request, reply) => {
    await authenticate(request)
    const parsed = agentIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 agentId'))
    }
    const { agentId } = parsed.data
    try {
      const rows = await db.execute(
        sql`DELETE FROM agent_favorites
            WHERE user_id = ${request.userId!} AND agent_id::text = ${agentId}
            RETURNING id`,
      )
      if ((rows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '未找到收藏记录'))
      }
      return reply.send(success({ agentId, canceled: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '取消收藏失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /remote/tencent/asr - 腾讯云语音识别
  // -------------------------------------------------------------------------
  server.post('/remote/tencent/asr', async (request, reply) => {
    await authenticate(request)
    const parsed = asrSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { audioUrl, language, model } = parsed.data
    try {
      // 调用腾讯云 ASR 服务（通过 ai-vendors 代理或直接调用）
      // 此处返回识别结果占位，实际由调用方注入 TENCENT_SECRET_ID / TENCENT_SECRET_KEY
      const tencentSecretId = process.env.TENCENT_SECRET_ID
      const tencentSecretKey = process.env.TENCENT_SECRET_KEY

      if (!tencentSecretId || !tencentSecretKey) {
        // 无密钥时返回占位数据
        return reply.send(
          success({
            audioUrl,
            language: language ?? 'zh',
            model: model ?? '16k_zh',
            text: '',
            status: 'no_credentials',
            message: '未配置腾讯云密钥，返回空结果',
          }),
        )
      }

      // 调用腾讯云 ASR 一句话识别 API
      const resp = await fetch('https://asr.tencentcloudapi.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TC-Action': 'SentenceRecognition',
          'X-TC-Region': 'ap-guangzhou',
          Authorization: `Bearer ${tencentSecretId}`,
        },
        body: JSON.stringify({
          EngSerViceType: language === 'en' ? 2 : 1,
          SourceType: 0,
          Url: audioUrl,
          VoiceFormat: 'wav',
        }),
      })

      if (!resp.ok) {
        return reply.status(502).send(error(502, '腾讯云 ASR 服务调用失败'))
      }

      const result = (await resp.json()) as Record<string, unknown>
      return reply.send(
        success({
          audioUrl,
          language: language ?? 'zh',
          model: model ?? '16k_zh',
          text: (result.Response as { Result?: string })?.Result ?? '',
          raw: result,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '语音识别失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /remote/withdrawal/switch - 提现开关状态
  // -------------------------------------------------------------------------
  server.get('/remote/withdrawal/switch', async (request, reply) => {
    await authenticate(request)
    try {
      const rows = await db.execute(
        sql`SELECT key, value, remark FROM remote_config WHERE key = 'withdrawal_switch' LIMIT 1`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      const enabled = row ? row.value === '1' || row.value === 'true' : true
      return reply.send(success({ enabled, remark: (row?.remark as string) ?? null }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询提现开关失败'))
    }
  })

  // -------------------------------------------------------------------------
  // PUT /remote/withdrawal/switch - 更新提现开关
  // -------------------------------------------------------------------------
  server.put('/remote/withdrawal/switch', async (request, reply) => {
    await authenticate(request)
    const parsed = withdrawalSwitchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { enabled, remark } = parsed.data
    const value = enabled ? '1' : '0'
    try {
      await db.execute(
        sql`INSERT INTO remote_config (key, value, remark, updated_at)
            VALUES ('withdrawal_switch', ${value}, ${remark ?? null}, NOW())
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, remark = EXCLUDED.remark, updated_at = NOW()`,
      )
      return reply.send(success({ enabled, remark: remark ?? null }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新提现开关失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /remote/user/stats - 用户统计
  // -------------------------------------------------------------------------
  server.get('/remote/user/stats', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    try {
      // token 余额
      const [margin] = await db
        .select({
          tokenQuantity: userMargins.tokenQuantity,
          frozenQuantity: userMargins.frozenQuantity,
        })
        .from(userMargins)
        .where(eq(userMargins.userId, userId))
        .limit(1)

      // 收藏 Agent 数量
      const favRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM agent_favorites WHERE user_id = ${userId}`,
      )
      const favoriteCount = (favRows[0] as { count?: number } | undefined)?.count ?? 0

      // 创建 Agent 数量
      const [agentCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agents)
        .where(eq(agents.userId, userId))

      // 购买 Agent 数量
      const buyRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM zhs_agent_buy WHERE user_id = ${userId}`,
      )
      const boughtCount = (buyRows[0] as { count?: number } | undefined)?.count ?? 0

      // 反馈数量
      const fbRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM user_feedback WHERE user_id = ${userId}`,
      )
      const feedbackCount = (fbRows[0] as { count?: number } | undefined)?.count ?? 0

      return reply.send(
        success({
          token: {
            quantity: margin?.tokenQuantity ?? 0,
            frozen: margin?.frozenQuantity ?? 0,
          },
          favoriteCount,
          createdAgentCount: agentCount?.count ?? 0,
          boughtAgentCount: boughtCount,
          feedbackCount,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '获取用户统计失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /remote/agent/hot - 热门 Agent
  // -------------------------------------------------------------------------
  server.get('/remote/agent/hot', async (request, reply) => {
    await authenticate(request)
    const q = request.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    try {
      const rows = await db.execute(
        sql`SELECT agent_id, name, avatar, cover, description, status, is_free, price,
                   usage_count, like_count, share_count
            FROM agents
            WHERE status = 'published'
            ORDER BY usage_count DESC, like_count DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM agents WHERE status = 'published'`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询热门 Agent 失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /remote/feedback - 用户反馈
  // -------------------------------------------------------------------------
  server.post('/remote/feedback', async (request, reply) => {
    await authenticate(request)
    const parsed = feedbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { type, content, contact, images } = parsed.data
    try {
      const rows = await db.execute(
        sql`INSERT INTO user_feedback (user_id, type, content, contact, images, status, created_at)
            VALUES (${request.userId!}, ${type}, ${content}, ${contact ?? null},
                    ${images ? JSON.stringify(images) : null}, 0, NOW())
            RETURNING id, type, content, contact, images, status, created_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '提交反馈失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /remote/config - 远程配置
  // -------------------------------------------------------------------------
  server.get('/remote/config', async (request, reply) => {
    await authenticate(request)
    const q = request.query as { keys?: string }
    const keys = q.keys
    try {
      let rows: Record<string, unknown>[]
      if (keys) {
        const keyList = keys
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
        if (keyList.length === 0) {
          rows = (await db.execute(
            sql`SELECT key, value, remark FROM remote_config ORDER BY key ASC`,
          )) as Record<string, unknown>[]
        } else {
          rows = (await db.execute(
            sql`SELECT key, value, remark FROM remote_config WHERE key = ANY(${keyList}) ORDER BY key ASC`,
          )) as Record<string, unknown>[]
        }
      } else {
        rows = (await db.execute(
          sql`SELECT key, value, remark FROM remote_config ORDER BY key ASC`,
        )) as Record<string, unknown>[]
      }
      // 转换为 key-value 映射
      const config: Record<string, unknown> = {}
      for (const row of rows) {
        config[row.key as string] = row.value
      }
      return reply.send(success({ config, raw: rows }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '获取远程配置失败'))
    }
  })
}
