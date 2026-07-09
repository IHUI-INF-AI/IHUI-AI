import { eq, and, desc, asc, gte, lt, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  userPoints,
  pointTransactions,
  signInRecords,
  levels,
  users,
  type UserPoints,
  type PointTransaction,
  type SignInRecord,
  type Level,
} from '@ihui/database';

// =============================================================================
// 字段选择（与 $inferSelect 等价的完整列集合）
// =============================================================================

const userPointsFields = {
  id: userPoints.id,
  userId: userPoints.userId,
  points: userPoints.points,
  totalEarned: userPoints.totalEarned,
  totalSpent: userPoints.totalSpent,
  level: userPoints.level,
  experience: userPoints.experience,
  updatedAt: userPoints.updatedAt,
};

const transactionFields = {
  id: pointTransactions.id,
  userId: pointTransactions.userId,
  type: pointTransactions.type,
  source: pointTransactions.source,
  amount: pointTransactions.amount,
  balanceAfter: pointTransactions.balanceAfter,
  description: pointTransactions.description,
  referenceId: pointTransactions.referenceId,
  createdAt: pointTransactions.createdAt,
};

const signInFields = {
  id: signInRecords.id,
  userId: signInRecords.userId,
  signInDate: signInRecords.signInDate,
  consecutiveDays: signInRecords.consecutiveDays,
  rewardPoints: signInRecords.rewardPoints,
  createdAt: signInRecords.createdAt,
};

const levelFields = {
  id: levels.id,
  level: levels.level,
  name: levels.name,
  minExperience: levels.minExperience,
  maxExperience: levels.maxExperience,
  icon: levels.icon,
  benefits: levels.benefits,
  createdAt: levels.createdAt,
};

// 等级默认配置（DB 未 seed 时使用，保证“可配置”同时具备开箱默认）
const DEFAULT_LEVELS: Level[] = [
  { id: 'default-1', level: 1, name: '新手', minExperience: 0, maxExperience: 99, icon: null, benefits: {}, createdAt: new Date(0) },
  { id: 'default-2', level: 2, name: '学徒', minExperience: 100, maxExperience: 499, icon: null, benefits: {}, createdAt: new Date(0) },
  { id: 'default-3', level: 3, name: '行家', minExperience: 500, maxExperience: 1499, icon: null, benefits: {}, createdAt: new Date(0) },
  { id: 'default-4', level: 4, name: '专家', minExperience: 1500, maxExperience: 4999, icon: null, benefits: {}, createdAt: new Date(0) },
  { id: 'default-5', level: 5, name: '大师', minExperience: 5000, maxExperience: Number.MAX_SAFE_INTEGER, icon: null, benefits: {}, createdAt: new Date(0) },
];

// =============================================================================
// User Points
// =============================================================================

export async function findUserPoints(userId: string): Promise<UserPoints | undefined> {
  const rows = await db
    .select(userPointsFields)
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);
  return rows[0];
}

/** 确保用户积分行存在，不存在则按默认值创建。 */
export async function ensureUserPoints(userId: string): Promise<UserPoints> {
  const existing = await findUserPoints(userId);
  if (existing) return existing;
  try {
    const rows = await db.insert(userPoints).values({ userId }).returning(userPointsFields);
    const inserted = rows[0];
    if (inserted) return inserted;
  } catch {
    // 并发插入冲突 → 回退查询
  }
  const fallback = await findUserPoints(userId);
  if (!fallback) throw new Error('初始化用户积分失败');
  return fallback;
}

/** 仅更新用户等级字段（由 points-service.updateLevel 调用）。 */
export async function setUserLevel(userId: string, level: number): Promise<void> {
  await db
    .update(userPoints)
    .set({ level, updatedAt: new Date() })
    .where(eq(userPoints.userId, userId));
}

// =============================================================================
// Point Transactions
// =============================================================================

export interface CreateTransactionInput {
  userId: string;
  type: 'earn' | 'spend';
  source: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  referenceId?: string;
}

export async function createPointTransaction(data: CreateTransactionInput): Promise<PointTransaction> {
  const rows = await db
    .insert(pointTransactions)
    .values({
      userId: data.userId,
      type: data.type,
      source: data.source,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      description: data.description,
      referenceId: data.referenceId,
    })
    .returning(transactionFields);
  const row = rows[0];
  if (!row) throw new Error('创建积分流水失败');
  return row;
}

export interface AdjustPointsInput {
  userId: string;
  type: 'earn' | 'spend';
  amount: number; // 正数
  source: string;
  description?: string;
  referenceId?: string;
}

/**
 * 调整积分：更新 user_points 余额/累计/经验（仅 earn 增长经验），并写入流水。
 * 使用 DB 事务包裹更新与流水写入，并在 earn 时同步更新等级，保证三者原子性。
 */
export async function adjustPoints(
  data: AdjustPointsInput,
): Promise<{ points: UserPoints; transaction: PointTransaction }> {
  const amount = Math.abs(data.amount);
  if (amount === 0) throw new Error('调整积分数不能为 0');

  const current = await ensureUserPoints(data.userId);
  let newPoints: number;
  let newTotalEarned = current.totalEarned;
  let newTotalSpent = current.totalSpent;
  let newExperience = current.experience;

  if (data.type === 'earn') {
    newPoints = current.points + amount;
    newTotalEarned = current.totalEarned + amount;
    newExperience = current.experience + amount;
  } else {
    if (current.points < amount) throw new Error('积分余额不足');
    newPoints = current.points - amount;
    newTotalSpent = current.totalSpent + amount;
  }

  // earn 时提前计算新等级(levels 表基本不变,事务外读可接受)
  let newLevel = current.level;
  if (data.type === 'earn') {
    const levelRow = await findLevelByExperience(newExperience);
    newLevel = levelRow.level;
  }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(userPoints)
      .set({
        points: newPoints,
        totalEarned: newTotalEarned,
        totalSpent: newTotalSpent,
        experience: newExperience,
        ...(newLevel !== current.level ? { level: newLevel } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userPoints.id, current.id))
      .returning(userPointsFields);
    const pointsRow = updated[0];
    if (!pointsRow) throw new Error('更新积分失败');

    const transaction = await tx
      .insert(pointTransactions)
      .values({
        userId: data.userId,
        type: data.type,
        source: data.source,
        amount: data.type === 'earn' ? amount : -amount,
        balanceAfter: newPoints,
        description: data.description,
        referenceId: data.referenceId,
      })
      .returning(transactionFields);
    const txRow = transaction[0];
    if (!txRow) throw new Error('创建积分流水失败');

    return { points: pointsRow, transaction: txRow };
  });
}

export interface FindTransactionsInput {
  userId: string;
  page: number;
  pageSize: number;
  type?: string;
  source?: string;
}

export async function findPointTransactions(
  input: FindTransactionsInput,
): Promise<{ list: PointTransaction[]; total: number }> {
  const conds = [eq(pointTransactions.userId, input.userId)];
  if (input.type) conds.push(eq(pointTransactions.type, input.type));
  if (input.source) conds.push(eq(pointTransactions.source, input.source));
  const where = and(...conds);
  const [list, totalRows] = await Promise.all([
    db
      .select(transactionFields)
      .from(pointTransactions)
      .where(where)
      .orderBy(desc(pointTransactions.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(pointTransactions).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

// =============================================================================
// Sign-in
// =============================================================================

/** 按 (userId, signInDate) 查找签到记录。signInDate 为 'YYYY-MM-DD'。 */
export async function findSignInRecord(userId: string, signInDate: string): Promise<SignInRecord | undefined> {
  const rows = await db
    .select(signInFields)
    .from(signInRecords)
    .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, signInDate)))
    .limit(1);
  return rows[0];
}

/** 今日是否已签到。 */
export async function findTodaySignIn(userId: string, today: string): Promise<SignInRecord | undefined> {
  return findSignInRecord(userId, today);
}

export interface CreateSignInInput {
  userId: string;
  signInDate: string;
  consecutiveDays: number;
  rewardPoints: number;
}

export async function createSignInRecord(data: CreateSignInInput): Promise<SignInRecord> {
  const rows = await db
    .insert(signInRecords)
    .values({
      userId: data.userId,
      signInDate: data.signInDate,
      consecutiveDays: data.consecutiveDays,
      rewardPoints: data.rewardPoints,
    })
    .returning(signInFields);
  const row = rows[0];
  if (!row) throw new Error('创建签到记录失败');
  return row;
}

/**
 * 计算连续签到天数：查询昨日记录，若存在则 +1，否则重置为 1。
 */
export async function calculateConsecutiveDays(userId: string, today: string): Promise<number> {
  const yesterday = shiftDate(today, -1);
  const yesterdayRecord = await findSignInRecord(userId, yesterday);
  if (yesterdayRecord) return yesterdayRecord.consecutiveDays + 1;
  return 1;
}

export interface FindSignInHistoryInput {
  userId: string;
  page: number;
  pageSize: number;
  yearMonth?: string; // 'YYYY-MM'
}

export async function findSignInHistory(
  input: FindSignInHistoryInput,
): Promise<{ list: SignInRecord[]; total: number }> {
  const conds = [eq(signInRecords.userId, input.userId)];
  if (input.yearMonth) {
    // 以月份区间过滤：[月初, 下月初)
    conds.push(gte(signInRecords.signInDate, input.yearMonth + '-01'));
    conds.push(lt(signInRecords.signInDate, nextMonthStart(input.yearMonth)));
  }
  const where = and(...conds);
  const [list, totalRows] = await Promise.all([
    db
      .select(signInFields)
      .from(signInRecords)
      .where(where)
      .orderBy(desc(signInRecords.signInDate))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(signInRecords).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

/** 查询最近 N 天的签到记录（含今天），按 signInDate 升序。 */
export async function findRecentSignInRecords(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SignInRecord[]> {
  return db
    .select(signInFields)
    .from(signInRecords)
    .where(
      and(
        eq(signInRecords.userId, userId),
        gte(signInRecords.signInDate, startDate),
        lt(signInRecords.signInDate, endDate),
      ),
    )
    .orderBy(asc(signInRecords.signInDate));
}

// =============================================================================
// Levels
// =============================================================================

export async function findLevels(): Promise<Level[]> {
  const rows = await db.select(levelFields).from(levels).orderBy(asc(levels.level));
  return rows.length > 0 ? rows : DEFAULT_LEVELS;
}

/** 根据经验值返回对应等级（min_experience <= experience 的最高等级）。 */
export async function findLevelByExperience(experience: number): Promise<Level> {
  const all = await findLevels();
  const first = all[0];
  if (!first) throw new Error('等级配置为空');
  let matched = first;
  for (const lv of all) {
    if (lv.minExperience <= experience) matched = lv;
    else break;
  }
  return matched;
}

export interface CurrentLevelInfo {
  current: Level;
  next: Level | null;
  experience: number;
  progress: number; // 0 ~ 1，到下一等级的进度
}

export async function findCurrentLevel(experience: number): Promise<CurrentLevelInfo> {
  const all = await findLevels();
  const first = all[0];
  if (!first) throw new Error('等级配置为空');
  let current = first;
  let next: Level | null = null;
  for (const lv of all) {
    if (lv.minExperience <= experience) {
      current = lv;
    } else {
      next = lv;
      break;
    }
  }
  const span = next ? next.minExperience - current.minExperience : Math.max(0, current.maxExperience - current.minExperience);
  const done = experience - current.minExperience;
  const progress = span > 0 ? Math.min(1, Math.max(0, done / span)) : 1;
  return { current, next, experience, progress };
}

// =============================================================================
// Leaderboard
// =============================================================================

export interface LeaderboardRow {
  userId: string;
  nickname: string | null;
  avatar: string | null;
  points: number;
  level: number;
  experience: number;
}

export async function findLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  return db
    .select({
      userId: userPoints.userId,
      nickname: users.nickname,
      avatar: users.avatar,
      points: userPoints.points,
      level: userPoints.level,
      experience: userPoints.experience,
    })
    .from(userPoints)
    .leftJoin(users, eq(userPoints.userId, users.id))
    .orderBy(desc(userPoints.points), desc(userPoints.experience))
    .limit(limit);
}

// =============================================================================
// 日期辅助
// =============================================================================

/** 日期偏移：传入 'YYYY-MM-DD'，返回偏移 deltaDays 天后的 'YYYY-MM-DD'。 */
export function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** 当前东八区日期的 'YYYY-MM-DD'（签到以用户本地日期为准）。 */
export function todayString(): string {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

/** 由 'YYYY-MM' 计算下个月月初的 'YYYY-MM-DD'。 */
function nextMonthStart(yearMonth: string): string {
  const parts = yearMonth.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  if (y === undefined || m === undefined) throw new Error('yearMonth 格式错误');
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
