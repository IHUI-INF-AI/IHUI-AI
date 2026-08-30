/**
 * TBox 设备积分路由。
 *
 * 表结构说明:
 *   tbox_bean(id, bean_type, bean_data, status, create_time, created_at, updated_at) ——
 *   该表为通用 Bean 存储,本身没有 device_id/points/event_type 积分字段,
 *   因此积分流水以 beanType='points' + beanData(JSON:{deviceId,eventType,points,createdAt}) 写入。
 *   tbox_device / tbox_command 为既有设备与指令表,仅做列表查询。
 *
 * 积分规则(内置,未知事件类型默认 1 分):
 *   task_complete=10、login=5、activity=20。
 * 幂等:同 deviceId+eventType 30s 内重复上报不重复发分。
 *
 * 注意:本路由未注册到 routes/index.ts(由需求指定),测试与后续接入由调用方自行注册。
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tboxBean, tboxDevice, tboxCommand } from '@ihui/database'
import { success, paginatedSuccess, error, parseOrThrow } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'

// 内置积分规则表:未知事件类型默认 1 分
const EVENT_POINTS_RULES: Record<string, number> = {
  task_complete: 10,
  login: 5,
  activity: 20,
}
const DEFAULT_POINTS = 1
// 幂等去重窗口:同 deviceId+eventType 30s 内重复上报不重复发分
const DEDUP_WINDOW_MS = 30_000
const POINTS_BEAN_TYPE = 'points'

const eventSchema = z.object({
  deviceId: z.string().min(1).max(200),
  eventType: z.string().min(1).max(100),
  // 可选:客户端显式指定积分,缺省按内置规则发放
  points: z.number().int().min(0).max(1_000_000).optional(),
})

const querySchema = z.object({
  deviceId: z.string().min(1).max(200),
})

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

interface PointsRecord {
  deviceId: string
  eventType: string
  points: number
  createdAt: string
}

function parsePointsData(raw: string | null | undefined): PointsRecord {
  if (!raw) return { deviceId: '', eventType: '', points: 0, createdAt: '' }
  try {
    const parsed = JSON.parse(raw) as Partial<PointsRecord>
    return {
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : '',
      eventType: typeof parsed.eventType === 'string' ? parsed.eventType : '',
      points: typeof parsed.points === 'number' ? parsed.points : 0,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
    }
  } catch {
    return { deviceId: '', eventType: '', points: 0, createdAt: '' }
  }
}

/**
 * 拉取某设备全部积分流水(beanType='points'),返回明细数组(按时间倒序)。
 * 在内存按 deviceId 过滤——tbox_bean.bean_data 为 text 存储 JSON,简单实现优先。
 */
async function fetchDevicePoints(deviceId: string): Promise<Array<PointsRecord & { id: number }>> {
  const beanRows = await db.select().from(tboxBean).where(eq(tboxBean.beanType, POINTS_BEAN_TYPE))
  return beanRows
    .map((row) => ({ id: row.id, ...parsePointsData(row.beanData) }))
    .filter((row) => row.deviceId === deviceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const tboxPointsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 设备事件上报:按事件类型发放积分,30s 内同 deviceId+eventType 幂等去重
  server.post('/events', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const body = parseOrThrow(eventSchema, req.body)
    const points = body.points ?? EVENT_POINTS_RULES[body.eventType] ?? DEFAULT_POINTS
    const now = Date.now()

    const rows = await fetchDevicePoints(body.deviceId)
    const totalBase = rows.reduce((sum, r) => sum + r.points, 0)

    // 幂等:窗口期内存在同 deviceId+eventType 记录则不再发分
    const dup = rows.find((r) => {
      if (r.eventType !== body.eventType) return false
      const t = new Date(r.createdAt).getTime()
      return Number.isFinite(t) && t <= now && now - t <= DEDUP_WINDOW_MS
    })
    if (dup) {
      return reply.send(
        success({
          deviceId: body.deviceId,
          eventType: body.eventType,
          points: dup.points,
          total: totalBase,
          duplicate: true,
        }),
      )
    }

    const [inserted] = await db
      .insert(tboxBean)
      .values({
        beanType: POINTS_BEAN_TYPE,
        beanData: JSON.stringify({
          deviceId: body.deviceId,
          eventType: body.eventType,
          points,
          createdAt: new Date(now).toISOString(),
        }),
        status: 1,
      })
      .returning()
    if (!inserted) return reply.status(500).send(error(500, '积分流水写入失败'))

    return reply.send(
      success({
        deviceId: body.deviceId,
        eventType: body.eventType,
        points,
        total: totalBase + points,
      }),
    )
  })

  // 积分查询:入参 deviceId,返回累计积分 + 明细列表
  server.get('/points', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const query = parseOrThrow(querySchema, req.query)
    const items = await fetchDevicePoints(query.deviceId)
    const total = items.reduce((sum, r) => sum + r.points, 0)
    return reply.send(success({ deviceId: query.deviceId, total, items }))
  })

  // 设备列表(tbox_device,分页)
  server.get('/devices', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const { page, pageSize } = parseOrThrow(pageSchema, req.query)
    const offset = (page - 1) * pageSize
    const [countRows, list] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(tboxDevice),
      db
        .select()
        .from(tboxDevice)
        .orderBy(desc(tboxDevice.registeredAt))
        .limit(pageSize)
        .offset(offset),
    ])
    const total = countRows[0]?.count ?? 0
    return reply.send(paginatedSuccess(list, total, { page, pageSize }))
  })

  // 命令列表(tbox_command,分页)
  server.get('/commands', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const { page, pageSize } = parseOrThrow(pageSchema, req.query)
    const offset = (page - 1) * pageSize
    const [countRows, list] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(tboxCommand),
      db
        .select()
        .from(tboxCommand)
        .orderBy(desc(tboxCommand.createdAt))
        .limit(pageSize)
        .offset(offset),
    ])
    const total = countRows[0]?.count ?? 0
    return reply.send(paginatedSuccess(list, total, { page, pageSize }))
  })
}

export { tboxPointsRoutes }
