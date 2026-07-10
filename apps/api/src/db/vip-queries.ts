import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { db } from './index.js';
import { vipLevels, userVips, users } from '@ihui/database';

// ============================================================================
// VIP Levels
// ============================================================================

export async function listVipLevels(activeOnly = false) {
  const where = activeOnly ? eq(vipLevels.status, 1) : undefined;
  const query = db.select().from(vipLevels).orderBy(vipLevels.sortOrder);
  return where ? query.where(where) : query;
}

export async function findVipLevel(id: string) {
  const rows = await db.select().from(vipLevels).where(eq(vipLevels.id, id)).limit(1);
  return rows[0];
}

export async function createVipLevel(input: {
  levelName: string;
  levelValue: number;
  price: number;
  durationDays: number;
  benefits: unknown[];
}) {
  const [level] = await db
    .insert(vipLevels)
    .values({
      levelName: input.levelName,
      levelValue: input.levelValue,
      price: input.price,
      durationDays: input.durationDays,
      benefits: input.benefits,
      status: 1,
    })
    .returning();
  return level;
}

export async function updateVipLevel(id: string, input: Partial<{
  levelName: string;
  price: number;
  durationDays: number;
  status: number;
}>) {
  await db.update(vipLevels).set({ ...input, updatedAt: new Date() }).where(eq(vipLevels.id, id));
}

export async function deleteVipLevel(id: string) {
  await db.delete(vipLevels).where(eq(vipLevels.id, id));
}

// ============================================================================
// User VIP
// ============================================================================

export async function getMyVip(userId: string) {
  const rows = await db
    .select({
      userVip: userVips,
      levelName: vipLevels.levelName,
    })
    .from(userVips)
    .leftJoin(vipLevels, eq(userVips.vipLevelId, vipLevels.id))
    .where(and(eq(userVips.userId, userId), eq(userVips.status, 1), gte(userVips.endTime, new Date())))
    .orderBy(desc(userVips.createdAt))
    .limit(1);
  return rows[0];
}

export async function purchaseVip(input: {
  userId: string;
  vipLevelId: string;
  orderId?: string;
}): Promise<void> {
  const level = await findVipLevel(input.vipLevelId);
  if (!level) throw new Error('VIP 等级不存在');
  const now = new Date();
  const endTime = new Date(now.getTime() + level.durationDays * 86400_000);
  await db.insert(userVips).values({
    userId: input.userId,
    vipLevelId: input.vipLevelId,
    levelValue: level.levelValue,
    startTime: now,
    endTime,
    status: 1,
    orderId: input.orderId,
  });
  // 更新 users.isVip
  await db
    .update(users)
    .set({ isVip: level.levelValue })
    .where(eq(users.id, input.userId));
}

export async function listUserVips(page: number, limit: number, filterUserId?: string) {
  const where = filterUserId ? eq(userVips.userId, filterUserId) : undefined;
  const query = db
    .select()
    .from(userVips)
    .orderBy(desc(userVips.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const rows = where ? await query.where(where) : await query;
  const countQuery = db.select({ count: sql<number>`count(*)::int` }).from(userVips);
  const countRows = where ? await countQuery.where(where) : await countQuery;
  const count = countRows[0]?.count ?? 0;
  return { items: rows, total: count };
}

export async function cancelUserVip(id: string) {
  await db.update(userVips).set({ status: 2, updatedAt: new Date() }).where(eq(userVips.id, id));
}
