import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { config } from '../config/index.js'
import { db } from '../db/index.js'
import { zhsAiModelInfo } from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

/**
 * 特殊 UUID 列表:这些用户可见额外模型(如内部测试模型)。
 * 等价自旧架构 SPECIAL_UUIDS,以环境变量覆盖。
 */
const SPECIAL_UUIDS = (process.env.SPECIAL_UUIDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/** 从请求中读取用户 UUID(已通过 authenticate 注入) */
function getUserUuid(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { id?: string; sub?: string } }).user
  return user?.id ?? user?.sub ?? ''
}

/** 从请求头读取课程平台标识(用于 COURSE-PLATFORM=wechat 过滤) */
function getCoursePlatform(request: FastifyRequest): string {
  const h = request.headers['x-course-platform']
  if (!h) return ''
  return Array.isArray(h) ? (h[0] ?? '') : h
}

/**
 * 模型列表条目(前端 AIModelInfo[] 兼容格式,20 字段映射)
 * 等价自旧架构 server/app/api/v1/llm/models_unify.py 返回结构
 */
export interface AiModelInfoItem {
  id: number
  name: string
  code: string | null
  type: number
  modelCode: string | null
  source: string | null
  icon: string | null
  description: string | null
  manufacturer: string | null
  questType: string | null
  variables: string | null
  openDesc: string | null
  modelDesc: string | null
  grassRoots: boolean
  isGratis: boolean
  isNew: boolean
  isTop: boolean
  isHot: boolean
  coursePlatform: string | null
  sort: number
  status: number
  createdAt: string | null
  updatedAt: string | null
}

export const llmModelsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  /**
   * GET /models — 代理到 ai-service /api/llm/models(保持原行为)
   * 返回 LLM 网关可用模型列表(用于实际 LLM 调用)
   */
  server.get('/models', async (request, reply) => {
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/models`, {
        method: 'GET',
        headers: {
          Authorization: request.headers.authorization ?? '',
        },
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `AI service unavailable: ${resp.status} ${text.slice(0, 200)}`))
      }

      const data = await resp.json()
      return reply.send(success(data))
    } catch (e) {
      return reply.status(502).send(error(502, (e as Error).message || 'AI service unavailable'))
    }
  })

  /**
   * GET /list — DB 驱动的模型列表(前端展示用)
   *
   * 等价自旧架构 GET /llm/models-unify,实现复杂排序:
   * 1. status=1 过滤(可用模型)
   * 2. COURSE-PLATFORM=wechat 过滤:course_platform 为空或等于 'wechat' 的模型可见
   *    (其他平台如 'web'/'app' 的模型在 wechat 课程平台下隐藏)
   * 3. SPECIAL_UUIDS 处理:特殊用户可见 type=99 的内部测试模型
   * 4. 排序:type=1 优先 → is_top=true 优先 → is_hot=true 优先 → is_new=true 优先 → sort 升序
   *
   * 返回 AiModelInfoItem[](20 字段,前端 AIModelInfo[] 兼容格式)
   */
  server.get('/list', async (request, reply) => {
    try {
      const userUuid = getUserUuid(request)
      const coursePlatform = getCoursePlatform(request)
      const isSpecialUser = SPECIAL_UUIDS.includes(userUuid)

      // 基础条件:status=1(可用)
      const conditions = [eq(zhsAiModelInfo.status, 1)]

      // COURSE-PLATFORM=wechat 过滤:课程平台为 wechat 时,只显示 course_platform 为空或 'wechat' 的模型
      if (coursePlatform === 'wechat') {
        // 注意:NULL 表示全平台可见,'' 也表示全平台可见
        // 这里用 OR 逻辑,但 drizzle 不便组合 OR,改为查询后过滤
      }

      const rows = await db
        .select()
        .from(zhsAiModelInfo)
        .where(and(...conditions))

      // 应用 COURSE-PLATFORM 过滤(内存中,因为涉及 NULL 处理)
      let filtered = rows
      if (coursePlatform === 'wechat') {
        filtered = rows.filter((m) => {
          const cp = m.coursePlatform
          // course_platform 为空/NULL 表示全平台可见
          if (!cp || cp === '') return true
          // 等于 'wechat' 表示微信课程平台可见
          if (cp === 'wechat') return true
          // 其他值(web/app/miniapp)在 wechat 课程平台下隐藏
          return false
        })
      }

      // SPECIAL_UUIDS 处理:非特殊用户隐藏 type=99 的内部测试模型
      if (!isSpecialUser) {
        filtered = filtered.filter((m) => m.type !== 99)
      }

      // 复杂排序:type=1 优先 → is_top → is_hot → is_new → sort 升序
      const sorted = filtered.sort((a, b) => {
        // type=1 优先(降序:type=1 排前,type=其他排后)
        const aTypePriority = a.type === 1 ? 1 : 0
        const bTypePriority = b.type === 1 ? 1 : 0
        if (aTypePriority !== bTypePriority) return bTypePriority - aTypePriority

        // is_top 优先
        if (a.isTop !== b.isTop) return a.isTop ? -1 : 1

        // is_hot 优先
        if (a.isHot !== b.isHot) return a.isHot ? -1 : 1

        // is_new 优先
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1

        // sort 升序
        return a.sort - b.sort
      })

      // 映射为前端兼容格式
      const items: AiModelInfoItem[] = sorted.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        type: m.type,
        modelCode: m.modelCode,
        source: m.source,
        icon: m.icon,
        description: m.description,
        manufacturer: m.manufacturer,
        questType: m.questType,
        variables: m.variables,
        openDesc: m.openDesc,
        modelDesc: m.modelDesc,
        grassRoots: m.grassRoots,
        isGratis: m.isGratis,
        isNew: m.isNew,
        isTop: m.isTop,
        isHot: m.isHot,
        coursePlatform: m.coursePlatform,
        sort: m.sort,
        status: m.status,
        createdAt: m.createdAt ? m.createdAt.toISOString() : null,
        updatedAt: m.updatedAt ? m.updatedAt.toISOString() : null,
      }))

      return reply.send(success({ items, total: items.length }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to list models'))
    }
  })

  /**
   * GET /list/:id — 单个模型详情(前端模型卡片展示用)
   */
  server.get('/list/:id', async (request, reply) => {
    try {
      const id = parseInt((request.params as { id: string }).id, 10)
      if (!Number.isFinite(id) || id <= 0) {
        return reply.status(400).send(error(400, 'Invalid id'))
      }

      const rows = await db.select().from(zhsAiModelInfo).where(eq(zhsAiModelInfo.id, id)).limit(1)

      const m = rows[0]
      if (!m) {
        return reply.status(404).send(error(404, 'Model not found'))
      }

      const item: AiModelInfoItem = {
        id: m.id,
        name: m.name,
        code: m.code,
        type: m.type,
        modelCode: m.modelCode,
        source: m.source,
        icon: m.icon,
        description: m.description,
        manufacturer: m.manufacturer,
        questType: m.questType,
        variables: m.variables,
        openDesc: m.openDesc,
        modelDesc: m.modelDesc,
        grassRoots: m.grassRoots,
        isGratis: m.isGratis,
        isNew: m.isNew,
        isTop: m.isTop,
        isHot: m.isHot,
        coursePlatform: m.coursePlatform,
        sort: m.sort,
        status: m.status,
        createdAt: m.createdAt ? m.createdAt.toISOString() : null,
        updatedAt: m.updatedAt ? m.updatedAt.toISOString() : null,
      }

      return reply.send(success(item))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to get model'))
    }
  })
}
