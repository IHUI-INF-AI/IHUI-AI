import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from './index.js';
import { ossDrivers, type OssDriver } from '@ihui/database';
import {
  encryptJSON,
  decryptJSON,
  isEncryptedPayload,
  type EncryptedPayload,
} from '../utils/crypto.js';

/** 解密单条驱动的 credentials(若已加密),原地修改并返回。 */
function decryptOssCredentials(row: OssDriver | undefined): OssDriver | undefined {
  if (row && row.credentials && isEncryptedPayload(row.credentials)) {
    row.credentials = decryptJSON(row.credentials as EncryptedPayload);
  }
  return row;
}

// =============================================================================
// 列表字段：列表接口不返回 credentials 明文
// =============================================================================

const listFields = {
  id: ossDrivers.id,
  name: ossDrivers.name,
  driver: ossDrivers.driver,
  isEnabled: ossDrivers.isEnabled,
  isDefault: ossDrivers.isDefault,
  sort: ossDrivers.sort,
  description: ossDrivers.description,
  config: ossDrivers.config,
  createdAt: ossDrivers.createdAt,
  updatedAt: ossDrivers.updatedAt,
};

export type OssDriverListRow = {
  id: string;
  name: string;
  driver: string;
  isEnabled: boolean;
  isDefault: boolean;
  sort: number;
  description: string | null;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// =============================================================================
// 查询
// =============================================================================

/** 列表(按 sort 升序、updatedAt 降序),不返回 credentials。 */
export async function findOssDrivers(driver?: string): Promise<OssDriverListRow[]> {
  const where = driver ? eq(ossDrivers.driver, driver) : undefined;
  return db
    .select(listFields)
    .from(ossDrivers)
    .where(where)
    .orderBy(asc(ossDrivers.sort), asc(ossDrivers.updatedAt));
}

/** 详情(含 credentials,仅 admin,自动解密)。 */
export async function findOssDriverById(id: string): Promise<OssDriver | undefined> {
  const rows = await db.select().from(ossDrivers).where(eq(ossDrivers.id, id)).limit(1);
  return decryptOssCredentials(rows[0]);
}

export async function findOssDriverByName(name: string): Promise<OssDriver | undefined> {
  const rows = await db.select().from(ossDrivers).where(eq(ossDrivers.name, name)).limit(1);
  return decryptOssCredentials(rows[0]);
}

/** 获取当前默认驱动(业务上传时使用,自动解密)。 */
export async function findDefaultOssDriver(): Promise<OssDriver | undefined> {
  const rows = await db
    .select()
    .from(ossDrivers)
    .where(and(eq(ossDrivers.isDefault, true), eq(ossDrivers.isEnabled, true)))
    .limit(1);
  return decryptOssCredentials(rows[0]);
}

// =============================================================================
// 写入
// =============================================================================

export interface CreateOssDriverInput {
  name: string;
  driver: string;
  credentials?: unknown;
  config?: unknown;
  isEnabled?: boolean;
  isDefault?: boolean;
  sort?: number;
  description?: string;
  updatedBy?: string;
}

export async function createOssDriver(
  input: CreateOssDriverInput,
): Promise<OssDriver | undefined> {
  // 若设为默认,先清除其他默认
  if (input.isDefault) await clearOtherDefaults();
  const encryptedCredentials =
    input.credentials !== undefined ? encryptJSON(input.credentials) : undefined;
  const rows = await db
    .insert(ossDrivers)
    .values({
      name: input.name,
      driver: input.driver,
      credentials: encryptedCredentials,
      config: input.config,
      isEnabled: input.isEnabled,
      isDefault: input.isDefault,
      sort: input.sort,
      description: input.description,
      updatedBy: input.updatedBy,
    })
    .returning();
  return decryptOssCredentials(rows[0]);
}

export interface UpdateOssDriverInput {
  name?: string;
  driver?: string;
  credentials?: unknown;
  config?: unknown;
  isEnabled?: boolean;
  isDefault?: boolean;
  sort?: number;
  description?: string | null;
  updatedBy?: string;
}

export async function updateOssDriver(
  id: string,
  patch: UpdateOssDriverInput,
): Promise<OssDriver | undefined> {
  if (patch.isDefault) await clearOtherDefaults(id);
  const { credentials, ...rest } = patch;
  const encryptedCredentials =
    credentials !== undefined ? encryptJSON(credentials) : undefined;
  const rows = await db
    .update(ossDrivers)
    .set({
      ...rest,
      ...(encryptedCredentials !== undefined ? { credentials: encryptedCredentials } : {}),
      updatedAt: new Date(),
    })
    .where(eq(ossDrivers.id, id))
    .returning();
  return decryptOssCredentials(rows[0]);
}

export async function deleteOssDriver(id: string): Promise<OssDriver | undefined> {
  const rows = await db.delete(ossDrivers).where(eq(ossDrivers.id, id)).returning();
  return rows[0];
}

/** 清除其他驱动的默认标记(excludeId 排除当前正在设置的驱动)。 */
export async function clearOtherDefaults(excludeId?: string): Promise<void> {
  const cond = excludeId
    ? and(eq(ossDrivers.isDefault, true), sql`${ossDrivers.id} != ${excludeId}`)
    : eq(ossDrivers.isDefault, true);
  await db.update(ossDrivers).set({ isDefault: false, updatedAt: new Date() }).where(cond);
}
