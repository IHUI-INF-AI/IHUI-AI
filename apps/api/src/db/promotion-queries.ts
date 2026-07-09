import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { db } from './index.js';
import {
  invitationCodes,
  activities,
  activityParticipants,
  coupons,
  users,
  type InvitationCode,
  type Activity,
  type ActivityParticipant,
  type Coupon,
} from '@ihui/database';

// =============================================================================
// 字段选择
// =============================================================================

const invitationFields = {
  id: invitationCodes.id,
  code: invitationCodes.code,
  inviterId: invitationCodes.inviterId,
  inviteeId: invitationCodes.inviteeId,
  status: invitationCodes.status,
  rewardInviter: invitationCodes.rewardInviter,
  rewardInvitee: invitationCodes.rewardInvitee,
  expiresAt: invitationCodes.expiresAt,
  usedAt: invitationCodes.usedAt,
  createdAt: invitationCodes.createdAt,
};

const activityFields = {
  id: activities.id,
  title: activities.title,
  slug: activities.slug,
  description: activities.description,
  banner: activities.banner,
  startAt: activities.startAt,
  endAt: activities.endAt,
  status: activities.status,
  rules: activities.rules,
  createdAt: activities.createdAt,
  updatedAt: activities.updatedAt,
};

const participantFields = {
  id: activityParticipants.id,
  activityId: activityParticipants.activityId,
  userId: activityParticipants.userId,
  data: activityParticipants.data,
  createdAt: activityParticipants.createdAt,
};

const couponFields = {
  id: coupons.id,
  code: coupons.code,
  name: coupons.name,
  type: coupons.type,
  value: coupons.value,
  minAmount: coupons.minAmount,
  maxUses: coupons.maxUses,
  usedCount: coupons.usedCount,
  startsAt: coupons.startsAt,
  endsAt: coupons.endsAt,
  isActive: coupons.isActive,
  createdAt: coupons.createdAt,
};

export type InvitationRow = typeof invitationFields;
export type ActivityRow = typeof activityFields;
export type ParticipantRow = typeof participantFields;
export type CouponRow = typeof couponFields;

export type InviteeRow = {
  invitationId: string;
  code: string;
  inviteeId: string | null;
  inviteeNickname: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  status: string;
  rewardInviter: number;
  rewardInvitee: number;
  usedAt: Date | null;
  createdAt: Date;
};

export type ParticipantWithUserRow = {
  id: string;
  activityId: string;
  userId: string;
  data: unknown;
  createdAt: Date;
  userNickname: string | null;
  userEmail: string | null;
  userPhone: string | null;
};

// =============================================================================
// Invitation Codes
// =============================================================================

/** 邀请码字符集：去除 O/0/I/1 等易混淆字符。 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInvitationCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export interface CreateInvitationInput {
  inviterId: string;
  rewardInviter?: number;
  rewardInvitee?: number;
  expiresInDays?: number;
}

export async function createInvitationCode(data: CreateInvitationInput): Promise<InvitationCode> {
  const expiresAt =
    data.expiresInDays && data.expiresInDays > 0
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  // 重试以应对极小概率的 unique 冲突
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInvitationCode();
    try {
      const rows = await db
        .insert(invitationCodes)
        .values({
          code,
          inviterId: data.inviterId,
          rewardInviter: data.rewardInviter ?? 0,
          rewardInvitee: data.rewardInvitee ?? 0,
          expiresAt,
        })
        .returning();
      const row = rows[0];
      if (row) return row;
    } catch (e) {
      // unique 冲突则重试
      if (attempt === 2) throw e;
    }
  }
  throw new Error('生成邀请码失败');
}

export async function findInvitationCodesByUser(userId: string): Promise<InvitationCode[]> {
  return db
    .select(invitationFields)
    .from(invitationCodes)
    .where(eq(invitationCodes.inviterId, userId))
    .orderBy(desc(invitationCodes.createdAt));
}

export async function findInvitationByCode(code: string): Promise<InvitationCode | undefined> {
  const rows = await db
    .select(invitationFields)
    .from(invitationCodes)
    .where(eq(invitationCodes.code, code))
    .limit(1);
  return rows[0];
}

export interface MarkUsedInput {
  id: string;
  inviteeId: string;
}

export async function markInvitationUsed(data: MarkUsedInput): Promise<InvitationCode | undefined> {
  const rows = await db
    .update(invitationCodes)
    .set({
      inviteeId: data.inviteeId,
      status: 'used',
      usedAt: new Date(),
    })
    .where(eq(invitationCodes.id, data.id))
    .returning(invitationFields);
  return rows[0];
}

export async function findInviteesByUser(inviterId: string): Promise<InviteeRow[]> {
  return db
    .select({
      invitationId: invitationCodes.id,
      code: invitationCodes.code,
      inviteeId: invitationCodes.inviteeId,
      inviteeNickname: users.nickname,
      inviteeEmail: users.email,
      inviteePhone: users.phone,
      status: invitationCodes.status,
      rewardInviter: invitationCodes.rewardInviter,
      rewardInvitee: invitationCodes.rewardInvitee,
      usedAt: invitationCodes.usedAt,
      createdAt: invitationCodes.createdAt,
    })
    .from(invitationCodes)
    .leftJoin(users, eq(invitationCodes.inviteeId, users.id))
    .where(eq(invitationCodes.inviterId, inviterId))
    .orderBy(desc(invitationCodes.createdAt));
}

// =============================================================================
// Activities
// =============================================================================

/** 公开查询：返回所有 published 活动（含即将开始/进行中/已结束），前端按时间计算展示态。 */
export async function findActivities(): Promise<Activity[]> {
  return db
    .select(activityFields)
    .from(activities)
    .where(eq(activities.status, 'published'))
    .orderBy(asc(activities.startAt));
}

export async function findActivityBySlug(slug: string): Promise<Activity | undefined> {
  const rows = await db
    .select(activityFields)
    .from(activities)
    .where(eq(activities.slug, slug))
    .limit(1);
  return rows[0];
}

export async function findActivityById(id: string): Promise<Activity | undefined> {
  const rows = await db.select(activityFields).from(activities).where(eq(activities.id, id)).limit(1);
  return rows[0];
}

export interface CreateActivityInput {
  title: string;
  slug: string;
  description?: string;
  banner?: string;
  startAt: Date;
  endAt: Date;
  status?: string;
  rules?: unknown;
}

export async function createActivity(data: CreateActivityInput): Promise<Activity> {
  const rows = await db
    .insert(activities)
    .values({
      title: data.title,
      slug: data.slug,
      description: data.description,
      banner: data.banner,
      startAt: data.startAt,
      endAt: data.endAt,
      status: data.status ?? 'draft',
      rules: data.rules ?? {},
    })
    .returning(activityFields);
  const row = rows[0];
  if (!row) throw new Error('创建活动失败');
  return row;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  banner?: string;
  startAt?: Date;
  endAt?: Date;
  status?: string;
  rules?: unknown;
}

export async function updateActivity(
  id: string,
  data: UpdateActivityInput,
): Promise<Activity | undefined> {
  const rows = await db
    .update(activities)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.banner !== undefined ? { banner: data.banner } : {}),
      ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
      ...(data.endAt !== undefined ? { endAt: data.endAt } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.rules !== undefined ? { rules: data.rules } : {}),
      updatedAt: new Date(),
    })
    .where(eq(activities.id, id))
    .returning(activityFields);
  return rows[0];
}

export async function deleteActivity(id: string): Promise<void> {
  await db.delete(activities).where(eq(activities.id, id));
}

export async function joinActivity(
  activityId: string,
  userId: string,
  data?: unknown,
): Promise<ActivityParticipant | undefined> {
  try {
    const rows = await db
      .insert(activityParticipants)
      .values({ activityId, userId, data: data as Record<string, unknown> | null })
      .returning(participantFields);
    return rows[0];
  } catch {
    // 已参与（unique 冲突）→ 返回 undefined，由上层处理
    return undefined;
  }
}

export async function leaveActivity(activityId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(activityParticipants)
    .where(
      and(
        eq(activityParticipants.activityId, activityId),
        eq(activityParticipants.userId, userId),
      ),
    )
    .returning({ id: activityParticipants.id });
  return rows.length > 0;
}

export async function findActivityParticipants(
  activityId: string,
  page: number,
  pageSize: number,
): Promise<{ list: ParticipantWithUserRow[]; total: number }> {
  const where = eq(activityParticipants.activityId, activityId);
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: activityParticipants.id,
        activityId: activityParticipants.activityId,
        userId: activityParticipants.userId,
        data: activityParticipants.data,
        createdAt: activityParticipants.createdAt,
        userNickname: users.nickname,
        userEmail: users.email,
        userPhone: users.phone,
      })
      .from(activityParticipants)
      .leftJoin(users, eq(activityParticipants.userId, users.id))
      .where(where)
      .orderBy(desc(activityParticipants.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(activityParticipants).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

// =============================================================================
// Coupons
// =============================================================================

export interface CreateCouponInput {
  code: string;
  name: string;
  type: string;
  value: number;
  minAmount?: number;
  maxUses?: number | null;
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean;
}

export async function createCoupon(data: CreateCouponInput): Promise<Coupon> {
  const rows = await db
    .insert(coupons)
    .values({
      code: data.code,
      name: data.name,
      type: data.type,
      value: data.value,
      minAmount: data.minAmount ?? 0,
      maxUses: data.maxUses,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      isActive: data.isActive ?? true,
    })
    .returning(couponFields);
  const row = rows[0];
  if (!row) throw new Error('创建优惠券失败');
  return row;
}

export async function findCoupons(page: number, pageSize: number): Promise<{ list: Coupon[]; total: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select(couponFields)
      .from(coupons)
      .orderBy(desc(coupons.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(coupons),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function findCouponByCode(code: string): Promise<Coupon | undefined> {
  const rows = await db
    .select(couponFields)
    .from(coupons)
    .where(eq(coupons.code, code))
    .limit(1);
  return rows[0];
}

/**
 * 验证优惠券：检查 active、有效期、使用次数、满减门槛。
 * 返回折扣金额（分）。失败抛错或返回 { valid: false }。
 */
export interface VerifyCouponResult {
  valid: boolean;
  reason?: string;
  coupon?: Coupon;
  discountAmount: number;
}

export async function verifyCoupon(code: string, amount: number): Promise<VerifyCouponResult> {
  const coupon = await findCouponByCode(code);
  if (!coupon) {
    return { valid: false, reason: '优惠券不存在', discountAmount: 0 };
  }
  if (!coupon.isActive) {
    return { valid: false, reason: '优惠券已停用', coupon, discountAmount: 0 };
  }
  const now = new Date();
  if (now < coupon.startsAt) {
    return { valid: false, reason: '优惠券尚未开始', coupon, discountAmount: 0 };
  }
  if (now > coupon.endsAt) {
    return { valid: false, reason: '优惠券已过期', coupon, discountAmount: 0 };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: '优惠券已被领完', coupon, discountAmount: 0 };
  }
  if (amount < coupon.minAmount) {
    return {
      valid: false,
      reason: `订单金额未满 ${coupon.minAmount} 分，无法使用该优惠券`,
      coupon,
      discountAmount: 0,
    };
  }
  let discount = 0;
  if (coupon.type === 'fixed') {
    discount = coupon.value;
  } else if (coupon.type === 'percent') {
    discount = Math.floor((amount * coupon.value) / 100);
  } else {
    return { valid: false, reason: '优惠券类型无效', coupon, discountAmount: 0 };
  }
  // 折扣不能超过订单金额
  if (discount > amount) discount = amount;
  return { valid: true, coupon, discountAmount: discount };
}

export async function incrementCouponUsedCount(id: string): Promise<void> {
  await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.id, id));
}
