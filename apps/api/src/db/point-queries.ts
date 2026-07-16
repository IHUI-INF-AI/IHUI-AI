import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import {
  eduPointChannels,
  eduPoints,
  eduPointChannelRelations,
  eduPointRecords,
  type EduPointChannel,
  type EduPoint,
  type EduPointChannelRelation,
  type EduPointRecord,
} from '@ihui/database'
import { AppError } from '../errors/AppError.js'

// =============================================================================
// Channels 积分渠道
// =============================================================================

export interface FindChannelsOpts {
  page: number
  pageSize: number
  name?: string
  status?: number
}

export async function findChannels(
  opts: FindChannelsOpts,
): Promise<{ list: EduPointChannel[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, name, status } = opts
  const conds = []
  if (name) conds.push(ilike(eduPointChannels.name, `%${name}%`))
  if (status !== undefined) conds.push(eq(eduPointChannels.status, status))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPointChannels)
      .where(where)
      .orderBy(asc(eduPointChannels.sort), desc(eduPointChannels.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduPointChannels)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 查询所有启用的渠道(公开)。 */
export async function findAllActiveChannels(): Promise<EduPointChannel[]> {
  return db
    .select()
    .from(eduPointChannels)
    .where(eq(eduPointChannels.status, 1))
    .orderBy(asc(eduPointChannels.sort), asc(eduPointChannels.id))
}

export async function findChannelById(id: string): Promise<EduPointChannel | undefined> {
  const rows = await db.select().from(eduPointChannels).where(eq(eduPointChannels.id, id)).limit(1)
  return rows[0]
}

export interface CreateChannelInput {
  name: string
  code?: string | null
  description?: string | null
  sort?: number
  status?: number
}

export async function createChannel(data: CreateChannelInput): Promise<EduPointChannel> {
  const rows = await db
    .insert(eduPointChannels)
    .values({
      name: data.name,
      code: data.code,
      description: data.description,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建积分渠道失败')
  return row
}

export interface UpdateChannelInput {
  name?: string
  code?: string | null
  description?: string | null
  sort?: number
  status?: number
}

export async function updateChannel(
  id: string,
  data: UpdateChannelInput,
): Promise<EduPointChannel | undefined> {
  const rows = await db
    .update(eduPointChannels)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(eq(eduPointChannels.id, id))
    .returning()
  return rows[0]
}

/** Admin: 删除渠道(关联的 point_relations 会因外键级联或置空而自动处理)。 */
export async function deleteChannel(id: string): Promise<void> {
  await db.delete(eduPointChannels).where(eq(eduPointChannels.id, id))
}

// =============================================================================
// Points 积分规则
// =============================================================================

export interface FindPointsOpts {
  page: number
  pageSize: number
  name?: string
  channelId?: string
  status?: number
}

export async function findPoints(
  opts: FindPointsOpts,
): Promise<{ list: EduPoint[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, name, channelId, status } = opts
  const conds = []
  if (name) conds.push(ilike(eduPoints.name, `%${name}%`))
  if (channelId) conds.push(eq(eduPoints.channelId, channelId))
  if (status !== undefined) conds.push(eq(eduPoints.status, status))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPoints)
      .where(where)
      .orderBy(asc(eduPoints.sort), desc(eduPoints.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduPoints)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

export async function findPointById(id: string): Promise<EduPoint | undefined> {
  const rows = await db.select().from(eduPoints).where(eq(eduPoints.id, id)).limit(1)
  return rows[0]
}

export interface CreatePointInput {
  name: string
  code?: string | null
  channelId?: string | null
  point?: number
  description?: string | null
  sort?: number
  status?: number
}

export async function createPoint(data: CreatePointInput): Promise<EduPoint> {
  const rows = await db
    .insert(eduPoints)
    .values({
      name: data.name,
      code: data.code,
      channelId: data.channelId,
      point: data.point,
      description: data.description,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建积分规则失败')
  return row
}

export interface UpdatePointInput {
  name?: string
  code?: string | null
  channelId?: string | null
  point?: number
  description?: string | null
  sort?: number
  status?: number
}

export async function updatePoint(
  id: string,
  data: UpdatePointInput,
): Promise<EduPoint | undefined> {
  const rows = await db
    .update(eduPoints)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.channelId !== undefined ? { channelId: data.channelId } : {}),
      ...(data.point !== undefined ? { point: data.point } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(eq(eduPoints.id, id))
    .returning()
  return rows[0]
}

export async function deletePoint(id: string): Promise<void> {
  await db.delete(eduPoints).where(eq(eduPoints.id, id))
}

// =============================================================================
// Relations 渠道关联
// =============================================================================

export interface FindRelationsOpts {
  page: number
  pageSize: number
  pointId?: string
  channelId?: string
}

export async function findRelations(
  opts: FindRelationsOpts,
): Promise<{ list: EduPointChannelRelation[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, pointId, channelId } = opts
  const conds = []
  if (pointId) conds.push(eq(eduPointChannelRelations.pointId, pointId))
  if (channelId) conds.push(eq(eduPointChannelRelations.channelId, channelId))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPointChannelRelations)
      .where(where)
      .orderBy(desc(eduPointChannelRelations.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduPointChannelRelations)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 全量覆盖某积分规则关联的渠道列表。 */
export async function updatePointRelations(
  pointId: string,
  channelIds: string[],
): Promise<{ pointId: string; channelIds: string[] }> {
  await db.delete(eduPointChannelRelations).where(eq(eduPointChannelRelations.pointId, pointId))
  if (channelIds.length > 0) {
    await db
      .insert(eduPointChannelRelations)
      .values(channelIds.map((channelId) => ({ pointId, channelId })))
  }
  return { pointId, channelIds }
}

// =============================================================================
// Records 积分记录
// =============================================================================

export interface FindRecordsOpts {
  page: number
  pageSize: number
  memberId?: string
  type?: string
}

export async function findRecords(
  opts: FindRecordsOpts,
): Promise<{ list: EduPointRecord[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, memberId, type } = opts
  const conds = []
  if (memberId) conds.push(eq(eduPointRecords.memberId, memberId))
  if (type) conds.push(eq(eduPointRecords.type, type))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPointRecords)
      .where(where)
      .orderBy(desc(eduPointRecords.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduPointRecords)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/**
 * 查询用户当前积分余额（取最新一条记录的 balance，无记录返回 0）。
 */
export async function findUserPointsBalance(memberId: string): Promise<number> {
  const rows = await db
    .select({ balance: eduPointRecords.balance })
    .from(eduPointRecords)
    .where(eq(eduPointRecords.memberId, memberId))
    .orderBy(desc(eduPointRecords.createdAt))
    .limit(1)
  return rows[0]?.balance ?? 0
}

// =============================================================================
// Increase / Decrease / Fallback 积分增减(事务包装 + 阈值校验)
// =============================================================================

/** 单次积分操作上限(防超发)。 */
export const MAX_POINT_OPERATION = 10000

export interface PointOperationInput {
  memberId: string
  channelId: string
  pointId: string
  amount: number
  remark?: string
}

export interface PointOperationResult {
  record: EduPointRecord
  beforeBalance: number
  afterBalance: number
}

/** 查询某条积分记录(用于 fallback 回溯原记录)。 */
export async function findRecordById(id: string): Promise<EduPointRecord | undefined> {
  const rows = await db.select().from(eduPointRecords).where(eq(eduPointRecords.id, id)).limit(1)
  return rows[0]
}

/** 检查某条记录是否已被回退(存在 refId 指向该记录的 fallback 记录)。 */
export async function hasRecordBeenReverted(recordId: string): Promise<boolean> {
  const rows = await db
    .select({ id: eduPointRecords.id })
    .from(eduPointRecords)
    .where(and(eq(eduPointRecords.refId, recordId), eq(eduPointRecords.type, 'fallback')))
    .limit(1)
  return rows.length > 0
}

/**
 * 积分增减内部实现:校验渠道/规则 → 阈值校验 → 事务内读余额 + 写记录。
 * channel.code 用于渠道路由校验(渠道须存在且启用);amount 为实际变动值。
 */
async function adjustEduPoints(
  input: PointOperationInput,
  type: 'increase' | 'decrease',
): Promise<PointOperationResult> {
  const channel = await findChannelById(input.channelId)
  if (!channel) throw new AppError('渠道不存在', 404, 'NOT_FOUND')
  if (channel.status !== 1) throw new AppError('渠道已禁用', 400, 'VALIDATION_FAILED')

  const point = await findPointById(input.pointId)
  if (!point) throw new AppError('积分规则不存在', 404, 'NOT_FOUND')
  if (point.status !== 1) throw new AppError('积分规则已禁用', 400, 'VALIDATION_FAILED')

  if (input.amount > MAX_POINT_OPERATION) {
    throw new AppError(`单次操作不得超过 ${MAX_POINT_OPERATION}`, 400, 'VALIDATION_FAILED')
  }

  const delta = type === 'increase' ? input.amount : -input.amount

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ balance: eduPointRecords.balance })
      .from(eduPointRecords)
      .where(eq(eduPointRecords.memberId, input.memberId))
      .orderBy(desc(eduPointRecords.createdAt))
      .limit(1)
    const beforeBalance = rows[0]?.balance ?? 0
    const afterBalance = beforeBalance + delta

    if (afterBalance < 0) throw new AppError('积分余额不足', 400, 'VALIDATION_FAILED')

    const inserted = await tx
      .insert(eduPointRecords)
      .values({
        memberId: input.memberId,
        point: delta,
        balance: afterBalance,
        type,
        description: input.remark ?? null,
      })
      .returning()
    const record = inserted[0]
    if (!record) throw new Error('写入积分记录失败')
    return { record, beforeBalance, afterBalance }
  })
}

/** 增加积分(admin):校验渠道/规则 + 阈值 + 事务写入 increase 记录。 */
export async function increasePoints(input: PointOperationInput): Promise<PointOperationResult> {
  return adjustEduPoints(input, 'increase')
}

/** 扣减积分(admin):校验渠道/规则 + 阈值 + 余额 + 事务写入 decrease 记录。 */
export async function decreasePoints(input: PointOperationInput): Promise<PointOperationResult> {
  return adjustEduPoints(input, 'decrease')
}

/**
 * 积分回退(admin,用于订单退款等场景):
 * 查原 record → 幂等校验(不可重复回退)→ 反向操作 → 写入 fallback 记录(refId 指向原记录)。
 */
export async function fallbackPoints(
  recordId: string,
  remark?: string,
): Promise<PointOperationResult> {
  const original = await findRecordById(recordId)
  if (!original) throw new AppError('原积分记录不存在', 404, 'NOT_FOUND')
  if (original.type === 'fallback')
    throw new AppError('不可回退已回退的记录', 400, 'VALIDATION_FAILED')
  if (!original.memberId) throw new AppError('原记录无关联会员', 400, 'VALIDATION_FAILED')

  const reverted = await hasRecordBeenReverted(recordId)
  if (reverted) throw new AppError('该记录已被回退', 409, 'CONFLICT')

  const reverseAmount = -original.point

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ balance: eduPointRecords.balance })
      .from(eduPointRecords)
      .where(eq(eduPointRecords.memberId, original.memberId!))
      .orderBy(desc(eduPointRecords.createdAt))
      .limit(1)
    const beforeBalance = rows[0]?.balance ?? 0
    const afterBalance = beforeBalance + reverseAmount

    if (afterBalance < 0) throw new AppError('积分余额不足以回退', 400, 'VALIDATION_FAILED')

    const inserted = await tx
      .insert(eduPointRecords)
      .values({
        memberId: original.memberId,
        point: reverseAmount,
        balance: afterBalance,
        type: 'fallback',
        description: remark ?? null,
        refId: recordId,
      })
      .returning()
    const record = inserted[0]
    if (!record) throw new Error('写入回退记录失败')
    return { record, beforeBalance, afterBalance }
  })
}
