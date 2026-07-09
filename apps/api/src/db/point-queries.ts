import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm';
import { db } from './index.js';
import {
  eduPointChannels,
  eduPoints,
  eduPointChannelRelations,
  eduPointRecords,
  type EduPointChannel,
  type EduPoint,
  type EduPointChannelRelation,
  type EduPointRecord,
} from '@ihui/database';

// =============================================================================
// Channels 积分渠道
// =============================================================================

export interface FindChannelsOpts {
  page: number;
  pageSize: number;
  name?: string;
  status?: number;
}

export async function findChannels(
  opts: FindChannelsOpts,
): Promise<{ list: EduPointChannel[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, name, status } = opts;
  const conds = [];
  if (name) conds.push(ilike(eduPointChannels.name, `%${name}%`));
  if (status !== undefined) conds.push(eq(eduPointChannels.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPointChannels)
      .where(where)
      .orderBy(asc(eduPointChannels.sort), desc(eduPointChannels.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduPointChannels).where(where),
  ]);

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

/** 查询所有启用的渠道(公开)。 */
export async function findAllActiveChannels(): Promise<EduPointChannel[]> {
  return db
    .select()
    .from(eduPointChannels)
    .where(eq(eduPointChannels.status, 1))
    .orderBy(asc(eduPointChannels.sort), asc(eduPointChannels.id));
}

export async function findChannelById(id: string): Promise<EduPointChannel | undefined> {
  const rows = await db
    .select()
    .from(eduPointChannels)
    .where(eq(eduPointChannels.id, id))
    .limit(1);
  return rows[0];
}

export interface CreateChannelInput {
  name: string;
  code?: string | null;
  description?: string | null;
  sort?: number;
  status?: number;
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
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建积分渠道失败');
  return row;
}

export interface UpdateChannelInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  sort?: number;
  status?: number;
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
    .returning();
  return rows[0];
}

/** Admin: 删除渠道(关联的 point_relations 会因外键级联或置空而自动处理)。 */
export async function deleteChannel(id: string): Promise<void> {
  await db.delete(eduPointChannels).where(eq(eduPointChannels.id, id));
}

// =============================================================================
// Points 积分规则
// =============================================================================

export interface FindPointsOpts {
  page: number;
  pageSize: number;
  name?: string;
  channelId?: string;
  status?: number;
}

export async function findPoints(
  opts: FindPointsOpts,
): Promise<{ list: EduPoint[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, name, channelId, status } = opts;
  const conds = [];
  if (name) conds.push(ilike(eduPoints.name, `%${name}%`));
  if (channelId) conds.push(eq(eduPoints.channelId, channelId));
  if (status !== undefined) conds.push(eq(eduPoints.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPoints)
      .where(where)
      .orderBy(asc(eduPoints.sort), desc(eduPoints.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduPoints).where(where),
  ]);

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findPointById(id: string): Promise<EduPoint | undefined> {
  const rows = await db.select().from(eduPoints).where(eq(eduPoints.id, id)).limit(1);
  return rows[0];
}

export interface CreatePointInput {
  name: string;
  code?: string | null;
  channelId?: string | null;
  point?: number;
  description?: string | null;
  sort?: number;
  status?: number;
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
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建积分规则失败');
  return row;
}

export interface UpdatePointInput {
  name?: string;
  code?: string | null;
  channelId?: string | null;
  point?: number;
  description?: string | null;
  sort?: number;
  status?: number;
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
    .returning();
  return rows[0];
}

export async function deletePoint(id: string): Promise<void> {
  await db.delete(eduPoints).where(eq(eduPoints.id, id));
}

// =============================================================================
// Relations 渠道关联
// =============================================================================

export interface FindRelationsOpts {
  page: number;
  pageSize: number;
  pointId?: string;
  channelId?: string;
}

export async function findRelations(
  opts: FindRelationsOpts,
): Promise<{ list: EduPointChannelRelation[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, pointId, channelId } = opts;
  const conds = [];
  if (pointId) conds.push(eq(eduPointChannelRelations.pointId, pointId));
  if (channelId) conds.push(eq(eduPointChannelRelations.channelId, channelId));
  const where = conds.length ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPointChannelRelations)
      .where(where)
      .orderBy(desc(eduPointChannelRelations.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduPointChannelRelations).where(where),
  ]);

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

/** 全量覆盖某积分规则关联的渠道列表。 */
export async function updatePointRelations(
  pointId: string,
  channelIds: string[],
): Promise<{ pointId: string; channelIds: string[] }> {
  await db
    .delete(eduPointChannelRelations)
    .where(eq(eduPointChannelRelations.pointId, pointId));
  if (channelIds.length > 0) {
    await db.insert(eduPointChannelRelations).values(
      channelIds.map((channelId) => ({ pointId, channelId })),
    );
  }
  return { pointId, channelIds };
}

// =============================================================================
// Records 积分记录
// =============================================================================

export interface FindRecordsOpts {
  page: number;
  pageSize: number;
  memberId?: string;
  type?: string;
}

export async function findRecords(
  opts: FindRecordsOpts,
): Promise<{ list: EduPointRecord[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, memberId, type } = opts;
  const conds = [];
  if (memberId) conds.push(eq(eduPointRecords.memberId, memberId));
  if (type) conds.push(eq(eduPointRecords.type, type));
  const where = conds.length ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduPointRecords)
      .where(where)
      .orderBy(desc(eduPointRecords.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduPointRecords).where(where),
  ]);

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
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
    .limit(1);
  return rows[0]?.balance ?? 0;
}
