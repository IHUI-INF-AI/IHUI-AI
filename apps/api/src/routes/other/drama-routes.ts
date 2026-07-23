/**
 * 剧本业务域(深化版)。
 *
 * 保留原端点(URL 0 改动):
 * - GET /drama/scripts/:id/enhance(GET 增强历史,返回空)
 * - GET /drama/scripts/:id/scenes/:id/lines/:id/enhance(同上)
 *
 * 新增深化能力:
 * - 统计聚合:GET /drama/stats(总数/观看/点赞/Top5/状态分布)
 * - 审计字段:POST/PUT/DELETE 注入 createdBy/updatedBy(引用 utils/audit.js)
 * - 关联查询:GET /drama 列表 JOIN users 表展示作者 nickname/avatar
 * - 业务校验:Zod 严格校验(title 1-200 / 数值范围 / 唯一性 / 状态枚举)
 * - 批量操作:POST /drama/batch-publish、POST /drama/batch-delete
 * - 状态机:draft → published → archived(禁止 draft → archived 跳跃)
 *
 * 数据存储:packages/database 无 drama 表且本任务禁改 schema,
 * 采用进程内 Map 存储(与 services/ai/plot-advisor-service.js 的 createStory 一致)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { withAudit, withAuditBoth } from '../../utils/audit.js'
import { dbRead } from '../../db/index.js'
import { users } from '@ihui/database'
import { paginationSchema, parseIdParam } from './_shared.js'

// ===== 类型定义 =====
type DramaStatus = 'draft' | 'published' | 'archived'

type DramaRecord = {
  id: string
  title: string
  description: string
  status: DramaStatus
  viewCount: number
  likeCount: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

// ===== 状态机 =====
const STATUS_TRANSITIONS: Record<DramaStatus, DramaStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: [],
}

function canTransition(from: DramaStatus, to: DramaStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

// ===== 进程内存储 =====
const dramaStore = new Map<string, DramaRecord>()
let idSeq = 0

function nextId(): string {
  idSeq += 1
  return `drama_${Date.now()}_${idSeq}`
}

// ===== Zod 业务校验 =====
const createDramaSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(200, '标题长度 1-200'),
  description: z.string().max(5000, '描述最长 5000 字符').optional().default(''),
  status: z.enum(['draft', 'published']).default('draft'),
  viewCount: z.number().int().min(0, '观看数必须 >= 0').default(0),
  likeCount: z.number().int().min(0, '点赞数必须 >= 0').default(0),
})

const updateDramaSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题长度 1-200').optional(),
  description: z.string().max(5000, '描述最长 5000 字符').optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  viewCount: z.number().int().min(0, '观看数必须 >= 0').optional(),
  likeCount: z.number().int().min(0, '点赞数必须 >= 0').optional(),
})

const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(['draft', 'published', 'archived']).optional()),
})

const batchIdsSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, '至少选择 1 条')
    .max(100, '单次最多 100 条'),
})

// ===== 辅助函数 =====

/** 关联查询用户表,批量补齐 author / authorAvatar。 */
async function enrichWithAuthor(records: DramaRecord[]) {
  const userIds = [...new Set(records.map((r) => r.createdBy).filter((id): id is string => !!id))]
  if (userIds.length === 0) {
    return records.map((r) => ({ ...r, author: null, authorAvatar: null }))
  }
  const userRows = await dbRead
    .select({ id: users.id, nickname: users.nickname, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, userIds))
  const userMap = new Map(userRows.map((u) => [u.id, u]))
  return records.map((r) => ({
    ...r,
    author: r.createdBy ? userMap.get(r.createdBy)?.nickname ?? null : null,
    authorAvatar: r.createdBy ? userMap.get(r.createdBy)?.avatar ?? null : null,
  }))
}

function toDto(
  r: DramaRecord & { author?: string | null; authorAvatar?: string | null },
) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    author: r.author ?? null,
    authorAvatar: r.authorAvatar ?? null,
  }
}

export const dramaRoutes: FastifyPluginAsync = async (server) => {
  // ===== 保留原端点(URL 0 改动)=====
  server.get('/drama/scripts/:id/enhance', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/drama/scripts/:id/scenes/:id/lines/:id/enhance', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ===== 统计聚合 =====

  // GET /drama/stats — 总剧集数 / 总观看数 / 总点赞数 / Top 5 热门 / 状态分布
  server.get('/drama/stats', async (_request, reply) => {
    const records = [...dramaStore.values()]
    const total = records.length
    const totalViews = records.reduce((sum, r) => sum + r.viewCount, 0)
    const totalLikes = records.reduce((sum, r) => sum + r.likeCount, 0)
    const top5 = [...records]
      .sort((a, b) => b.viewCount - a.viewCount || b.likeCount - a.likeCount)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        viewCount: r.viewCount,
        likeCount: r.likeCount,
      }))
    const byStatus = {
      draft: records.filter((r) => r.status === 'draft').length,
      published: records.filter((r) => r.status === 'published').length,
      archived: records.filter((r) => r.status === 'archived').length,
    }
    return reply.send(success({ total, totalViews, totalLikes, top5, byStatus }))
  })

  // ===== 关联查询(列表 JOIN 用户表)=====

  // GET /drama — 分页列表,JOIN users 展示作者 nickname/avatar
  server.get('/drama', async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send(error(400, query.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, search } = query.data
    let records = [...dramaStore.values()]
    if (status) records = records.filter((r) => r.status === status)
    if (search) records = records.filter((r) => r.title.includes(search))
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const total = records.length
    const paged = records.slice((page - 1) * pageSize, page * pageSize)
    const enriched = await enrichWithAuthor(paged)
    return reply.send(success({ list: enriched.map(toDto), total, page, pageSize }))
  })

  // ===== CRUD =====

  // POST /drama — 创建(注入 createdBy + updatedBy 审计字段)
  server.post('/drama', async (request, reply) => {
    const body = createDramaSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    // 唯一性校验
    const dup = [...dramaStore.values()].some((r) => r.title === body.data.title)
    if (dup) return reply.status(409).send(error(409, '标题已存在'))
    const now = new Date()
    const operatorId = request.userId ?? null
    const record = withAuditBoth(
      {
        id: nextId(),
        title: body.data.title,
        description: body.data.description,
        status: body.data.status,
        viewCount: body.data.viewCount,
        likeCount: body.data.likeCount,
        createdAt: now,
        updatedAt: now,
      },
      operatorId,
    ) as DramaRecord
    dramaStore.set(record.id, record)
    request.log.info({ id: record.id, operatorId, action: 'create' }, 'drama audit: created')
    return reply.status(201).send(success({ id: record.id }))
  })

  // POST /drama/batch-publish — 批量发布(状态机校验:draft → published)
  server.post('/drama/batch-publish', async (request, reply) => {
    const body = batchIdsSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const operatorId = request.userId ?? null
    const now = new Date()
    let published = 0
    const skipped: Array<{ id: string; reason: string }> = []
    for (const id of body.data.ids) {
      const record = dramaStore.get(id)
      if (!record) {
        skipped.push({ id, reason: '不存在' })
        continue
      }
      if (!canTransition(record.status, 'published')) {
        skipped.push({ id, reason: `状态 ${record.status} 不可发布` })
        continue
      }
      const updated = withAudit(
        { ...record, status: 'published' as DramaStatus, updatedAt: now },
        operatorId,
      ) as DramaRecord
      dramaStore.set(id, updated)
      published++
    }
    request.log.info({ published, skippedCount: skipped.length, operatorId }, 'drama audit: batch-publish')
    return reply.send(success({ published, skipped }))
  })

  // POST /drama/batch-delete — 批量删除
  server.post('/drama/batch-delete', async (request, reply) => {
    const body = batchIdsSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const operatorId = request.userId ?? null
    let deleted = 0
    const skipped: Array<{ id: string; reason: string }> = []
    for (const id of body.data.ids) {
      if (dramaStore.delete(id)) {
        deleted++
      } else {
        skipped.push({ id, reason: '不存在' })
      }
    }
    request.log.info({ deleted, skippedCount: skipped.length, operatorId }, 'drama audit: batch-delete')
    return reply.send(success({ deleted, skipped }))
  })

  // GET /drama/:id — 详情(JOIN users 展示作者)
  server.get('/drama/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const record = dramaStore.get(id)
    if (!record) return reply.status(404).send(error(404, '剧本不存在'))
    const [enriched] = await enrichWithAuthor([record])
    if (!enriched) return reply.status(500).send(error(500, '数据错误'))
    return reply.send(success(toDto(enriched)))
  })

  // PUT /drama/:id — 更新(注入 updatedBy + 状态机校验 + 唯一性校验)
  server.put('/drama/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = updateDramaSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = dramaStore.get(id)
    if (!existing) return reply.status(404).send(error(404, '剧本不存在'))
    // 状态机校验(禁止跳跃,如 draft → archived)
    if (body.data.status && body.data.status !== existing.status) {
      if (!canTransition(existing.status, body.data.status)) {
        return reply
          .status(400)
          .send(error(400, `状态流转非法:${existing.status} → ${body.data.status}`))
      }
    }
    // 唯一性校验(title 变更时检查重名)
    if (body.data.title && body.data.title !== existing.title) {
      const dup = [...dramaStore.values()].some((r) => r.id !== id && r.title === body.data.title)
      if (dup) return reply.status(409).send(error(409, '标题已存在'))
    }
    const operatorId = request.userId ?? null
    const updated = withAudit(
      {
        ...existing,
        ...body.data,
        updatedAt: new Date(),
      },
      operatorId,
    ) as DramaRecord
    dramaStore.set(id, updated)
    request.log.info(
      { id, operatorId, action: 'update', status: updated.status },
      'drama audit: updated',
    )
    return reply.send(success({ updated: true }))
  })

  // DELETE /drama/:id — 删除(审计日志)
  server.delete('/drama/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const existing = dramaStore.get(id)
    if (!existing) return reply.status(404).send(error(404, '剧本不存在'))
    dramaStore.delete(id)
    request.log.info(
      { id, operatorId: request.userId ?? null, action: 'delete', title: existing.title },
      'drama audit: deleted',
    )
    return reply.send(success({ deleted: true }))
  })
}
