import { eq, and, desc, sql, ilike, lt, gt } from 'drizzle-orm';
import { db } from './index.js';
import {
  systemConfigs,
  integrationConfigs,
  apiLogs,
  systemEvents,
  type SystemConfig,
  type IntegrationConfig,
  type ApiLog,
  type SystemEvent,
} from '@ihui/database';
import { encryptJSON, decryptJSON, isEncryptedPayload, type EncryptedPayload } from '../utils/crypto.js';

// =============================================================================
// 系统配置
// =============================================================================

/** 公开配置字段：排除 updatedBy（避免泄露内部用户关系）。 */
const configPublicFields = {
  id: systemConfigs.id,
  key: systemConfigs.key,
  value: systemConfigs.value,
  type: systemConfigs.type,
  category: systemConfigs.category,
  description: systemConfigs.description,
  isPublic: systemConfigs.isPublic,
  updatedAt: systemConfigs.updatedAt,
};

export type ConfigPublicRow = {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: Date;
};

/** 查询所有公开配置（is_public=true）。 */
export async function findPublicConfigs(): Promise<ConfigPublicRow[]> {
  return db.select(configPublicFields).from(systemConfigs).where(eq(systemConfigs.isPublic, true));
}

/** 分页查询所有配置，支持 category 筛选。 */
export async function findConfigs(
  page: number,
  pageSize: number,
  category?: string,
): Promise<{ list: ConfigPublicRow[]; total: number }> {
  const where = category ? eq(systemConfigs.category, category) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select(configPublicFields)
      .from(systemConfigs)
      .where(where)
      .orderBy(desc(systemConfigs.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(systemConfigs).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function findConfigByKey(key: string): Promise<SystemConfig | undefined> {
  const rows = await db.select().from(systemConfigs).where(eq(systemConfigs.key, key)).limit(1);
  return rows[0];
}

export async function findConfigById(id: string): Promise<SystemConfig | undefined> {
  const rows = await db.select().from(systemConfigs).where(eq(systemConfigs.id, id)).limit(1);
  return rows[0];
}

export async function createConfig(input: {
  key: string;
  value: string;
  type?: string;
  category?: string;
  description?: string;
  isPublic?: boolean;
  updatedBy?: string;
}): Promise<SystemConfig | undefined> {
  const rows = await db
    .insert(systemConfigs)
    .values({
      key: input.key,
      value: input.value,
      type: input.type,
      category: input.category,
      description: input.description,
      isPublic: input.isPublic,
      updatedBy: input.updatedBy,
    })
    .returning();
  return rows[0];
}

export async function updateConfig(
  id: string,
  patch: {
    value?: string;
    type?: string;
    category?: string;
    description?: string | null;
    isPublic?: boolean;
    updatedBy?: string;
  },
): Promise<SystemConfig | undefined> {
  const rows = await db
    .update(systemConfigs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(systemConfigs.id, id))
    .returning();
  return rows[0];
}

export async function deleteConfig(id: string): Promise<SystemConfig | undefined> {
  const rows = await db.delete(systemConfigs).where(eq(systemConfigs.id, id)).returning();
  return rows[0];
}

// =============================================================================
// 集成配置
// =============================================================================

/** 集成列表字段：排除 credentials（敏感，不在列表接口返回明文）。 */
const integrationListFields = {
  id: integrationConfigs.id,
  name: integrationConfigs.name,
  provider: integrationConfigs.provider,
  isEnabled: integrationConfigs.isEnabled,
  config: integrationConfigs.config,
  createdAt: integrationConfigs.createdAt,
  updatedAt: integrationConfigs.updatedAt,
};

export type IntegrationListRow = {
  id: string;
  name: string;
  provider: string;
  isEnabled: boolean;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export async function findIntegrations(): Promise<IntegrationListRow[]> {
  return db
    .select(integrationListFields)
    .from(integrationConfigs)
    .orderBy(desc(integrationConfigs.updatedAt));
}

export async function findIntegrationById(id: string): Promise<IntegrationConfig | undefined> {
  const rows = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.id, id))
    .limit(1);
  const row = rows[0];
  if (row && row.credentials && isEncryptedPayload(row.credentials)) {
    row.credentials = decryptJSON(row.credentials as EncryptedPayload);
  }
  return row;
}

export async function findIntegrationByName(name: string): Promise<IntegrationConfig | undefined> {
  const rows = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.name, name))
    .limit(1);
  const row = rows[0];
  if (row && row.credentials && isEncryptedPayload(row.credentials)) {
    row.credentials = decryptJSON(row.credentials as EncryptedPayload);
  }
  return row;
}

export async function createIntegration(input: {
  name: string;
  provider: string;
  credentials?: unknown;
  isEnabled?: boolean;
  config?: unknown;
}): Promise<IntegrationConfig | undefined> {
  const encryptedCredentials = input.credentials !== undefined ? encryptJSON(input.credentials) : undefined;
  const rows = await db
    .insert(integrationConfigs)
    .values({
      name: input.name,
      provider: input.provider,
      credentials: encryptedCredentials,
      isEnabled: input.isEnabled,
      config: input.config,
    })
    .returning();
  const row = rows[0];
  if (row && row.credentials && isEncryptedPayload(row.credentials)) {
    row.credentials = decryptJSON(row.credentials as EncryptedPayload);
  }
  return row;
}

export async function updateIntegration(
  id: string,
  patch: {
    name?: string;
    provider?: string;
    credentials?: unknown;
    isEnabled?: boolean;
    config?: unknown;
  },
): Promise<IntegrationConfig | undefined> {
  const encryptedCredentials = patch.credentials !== undefined ? encryptJSON(patch.credentials) : undefined;
  const rows = await db
    .update(integrationConfigs)
    .set({
      ...patch,
      ...(encryptedCredentials !== undefined ? { credentials: encryptedCredentials } : {}),
      updatedAt: new Date(),
    })
    .where(eq(integrationConfigs.id, id))
    .returning();
  const row = rows[0];
  if (row && row.credentials && isEncryptedPayload(row.credentials)) {
    row.credentials = decryptJSON(row.credentials as EncryptedPayload);
  }
  return row;
}

export async function deleteIntegration(id: string): Promise<IntegrationConfig | undefined> {
  const rows = await db
    .delete(integrationConfigs)
    .where(eq(integrationConfigs.id, id))
    .returning();
  return rows[0];
}

// =============================================================================
// API 日志
// =============================================================================

/** 异步写入一条 API 日志（由 api-logger 插件调用，失败忽略）。 */
export async function addApiLog(input: {
  userId?: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  error?: string;
}): Promise<void> {
  await db.insert(apiLogs).values({
    userId: input.userId,
    method: input.method,
    path: input.path,
    statusCode: input.statusCode,
    duration: input.duration,
    ip: input.ip,
    userAgent: input.userAgent,
    error: input.error,
  });
}

/** 批量写入 API 日志(由 api-logger 缓冲 flush 调用,失败忽略)。 */
export async function addApiLogsBatch(
  logs: Array<{
    userId?: string;
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    ip?: string;
    userAgent?: string;
    error?: string;
  }>,
): Promise<void> {
  if (logs.length === 0) return;
  await db.insert(apiLogs).values(
    logs.map((input) => ({
      userId: input.userId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      duration: input.duration,
      ip: input.ip,
      userAgent: input.userAgent,
      error: input.error,
    })),
  );
}

export async function findApiLogs(
  page: number,
  pageSize: number,
  opts: { userId?: string; statusCode?: number; path?: string },
): Promise<{ list: ApiLog[]; total: number }> {
  const conds = [];
  if (opts.userId) conds.push(eq(apiLogs.userId, opts.userId));
  if (opts.statusCode !== undefined) conds.push(eq(apiLogs.statusCode, opts.statusCode));
  if (opts.path) conds.push(ilike(apiLogs.path, `%${opts.path}%`));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(apiLogs)
      .where(where)
      .orderBy(desc(apiLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(apiLogs).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * 清理旧日志（保留最近 N 天）。
 * @param days 保留天数（默认 30）
 * @returns 删除的记录数
 */
export async function cleanupOldApiLogs(days: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.delete(apiLogs).where(lt(apiLogs.createdAt, cutoff)).returning();
  return rows.length;
}

/**
 * 统计日志（按状态码分组）。
 */
export async function getApiLogStats(days: number = 7): Promise<{
  total: number;
  byStatus: { statusCode: number; count: number }[];
  avgDuration: number;
}> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      statusCode: apiLogs.statusCode,
      count: sql<number>`COUNT(*)::int`,
      avgDuration: sql<number>`AVG(duration)::int`,
    })
    .from(apiLogs)
    .where(gt(apiLogs.createdAt, cutoff))
    .groupBy(apiLogs.statusCode);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const totalDuration = rows.reduce((sum, r) => sum + r.avgDuration * r.count, 0);
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

  return {
    total,
    byStatus: rows.map((r) => ({ statusCode: r.statusCode, count: r.count })),
    avgDuration,
  };
}

// =============================================================================
// 系统事件
// =============================================================================

export async function findSystemEvents(
  page: number,
  pageSize: number,
  opts: { type?: string; level?: string },
): Promise<{ list: SystemEvent[]; total: number }> {
  const conds = [];
  if (opts.type) conds.push(eq(systemEvents.type, opts.type));
  if (opts.level) conds.push(eq(systemEvents.level, opts.level));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(systemEvents)
      .where(where)
      .orderBy(desc(systemEvents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(systemEvents).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function createSystemEvent(input: {
  type: string;
  level?: string;
  message: string;
  data?: unknown;
}): Promise<SystemEvent | undefined> {
  const rows = await db
    .insert(systemEvents)
    .values({
      type: input.type,
      level: input.level,
      message: input.message,
      data: input.data,
    })
    .returning();
  return rows[0];
}

/** 按 id 查询单条系统事件。 */
export async function findSystemEventById(id: string): Promise<SystemEvent | undefined> {
  const rows = await db.select().from(systemEvents).where(eq(systemEvents.id, id)).limit(1);
  return rows[0];
}

/** 更新系统事件(允许修正 type/level/message/data)。 */
export async function updateSystemEvent(
  id: string,
  patch: { type?: string; level?: string; message?: string; data?: unknown },
): Promise<SystemEvent | undefined> {
  const set: Record<string, unknown> = {};
  if (patch.type !== undefined) set.type = patch.type;
  if (patch.level !== undefined) set.level = patch.level;
  if (patch.message !== undefined) set.message = patch.message;
  if (patch.data !== undefined) set.data = patch.data;
  if (Object.keys(set).length === 0) {
    return findSystemEventById(id);
  }
  const rows = await db
    .update(systemEvents)
    .set(set)
    .where(eq(systemEvents.id, id))
    .returning();
  return rows[0];
}

/** 删除系统事件。返回被删除的行,不存在返回 undefined。 */
export async function deleteSystemEvent(id: string): Promise<SystemEvent | undefined> {
  const rows = await db.delete(systemEvents).where(eq(systemEvents.id, id)).returning();
  return rows[0];
}
