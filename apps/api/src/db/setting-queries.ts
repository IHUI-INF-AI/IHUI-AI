import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { eduSettings, type EduSetting } from '@ihui/database'
import {
  encryptJSON,
  decryptJSON,
  isEncryptedPayload,
  type EncryptedPayload,
} from '../utils/crypto.js'

/** 解密单条配置的 credentials(若已加密),原地修改并返回。 */
function decryptSettingCredentials(row: EduSetting | undefined): EduSetting | undefined {
  if (row && row.credentials && isEncryptedPayload(row.credentials)) {
    row.credentials = decryptJSON(row.credentials as EncryptedPayload)
  }
  return row
}

// =============================================================================
// 公开字段(不含 credentials)
// =============================================================================

const publicFields = {
  id: eduSettings.id,
  group: eduSettings.group,
  key: eduSettings.key,
  value: eduSettings.value,
  type: eduSettings.type,
  description: eduSettings.description,
  isPublic: eduSettings.isPublic,
  sort: eduSettings.sort,
  status: eduSettings.status,
  updatedAt: eduSettings.updatedAt,
}

export type EduSettingPublicRow = {
  id: string
  group: string
  key: string
  value: string | null
  type: string
  description: string | null
  isPublic: boolean
  sort: number
  status: number
  updatedAt: Date
}

// =============================================================================
// 查询
// =============================================================================

/** 查询所有公开配置(is_public=true 且 status=1)。 */
export async function findPublicEduSettings(): Promise<EduSettingPublicRow[]> {
  return db
    .select(publicFields)
    .from(eduSettings)
    .where(and(eq(eduSettings.isPublic, true), eq(eduSettings.status, 1)))
    .orderBy(asc(eduSettings.sort), asc(eduSettings.key))
}

/** 分页查询,支持 group 筛选 + key 模糊搜索。 */
export async function findEduSettings(
  page: number,
  pageSize: number,
  opts: { group?: string; key?: string },
): Promise<{ list: EduSettingPublicRow[]; total: number }> {
  const conds = []
  if (opts.group) conds.push(eq(eduSettings.group, opts.group))
  if (opts.key) conds.push(ilike(eduSettings.key, `%${opts.key}%`))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select(publicFields)
      .from(eduSettings)
      .where(where)
      .orderBy(asc(eduSettings.sort), desc(eduSettings.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduSettings)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0 }
}

/** 详情(含 credentials,仅 admin,自动解密)。 */
export async function findEduSettingById(id: string): Promise<EduSetting | undefined> {
  const rows = await db.select().from(eduSettings).where(eq(eduSettings.id, id)).limit(1)
  return decryptSettingCredentials(rows[0])
}

/** 按 group + key 查询(用于判断唯一性,自动解密)。 */
export async function findEduSettingByGroupKey(
  group: string,
  key: string,
): Promise<EduSetting | undefined> {
  const rows = await db
    .select()
    .from(eduSettings)
    .where(and(eq(eduSettings.group, group), eq(eduSettings.key, key)))
    .limit(1)
  return decryptSettingCredentials(rows[0])
}

/** 按 group 查询单组配置(公开接口可用)。 */
export async function findEduSettingsByGroup(group: string): Promise<EduSettingPublicRow[]> {
  return db
    .select(publicFields)
    .from(eduSettings)
    .where(and(eq(eduSettings.group, group), eq(eduSettings.status, 1)))
    .orderBy(asc(eduSettings.sort), asc(eduSettings.key))
}

// =============================================================================
// 写入
// =============================================================================

export interface CreateEduSettingInput {
  group?: string
  key: string
  value?: string | null
  type?: string
  credentials?: unknown
  description?: string | null
  isPublic?: boolean
  sort?: number
  status?: number
  updatedBy?: string
}

export async function createEduSetting(
  input: CreateEduSettingInput,
): Promise<EduSetting | undefined> {
  const encryptedCredentials =
    input.credentials !== undefined ? encryptJSON(input.credentials) : undefined
  const rows = await db
    .insert(eduSettings)
    .values({
      group: input.group,
      key: input.key,
      value: input.value,
      type: input.type,
      credentials: encryptedCredentials,
      description: input.description,
      isPublic: input.isPublic,
      sort: input.sort,
      status: input.status,
      updatedBy: input.updatedBy,
    })
    .returning()
  return decryptSettingCredentials(rows[0])
}

export interface UpdateEduSettingInput {
  group?: string
  key?: string
  value?: string | null
  type?: string
  credentials?: unknown
  description?: string | null
  isPublic?: boolean
  sort?: number
  status?: number
  updatedBy?: string
}

export async function updateEduSetting(
  id: string,
  patch: UpdateEduSettingInput,
): Promise<EduSetting | undefined> {
  const { credentials, ...rest } = patch
  const encryptedCredentials = credentials !== undefined ? encryptJSON(credentials) : undefined
  const rows = await db
    .update(eduSettings)
    .set({
      ...rest,
      ...(encryptedCredentials !== undefined ? { credentials: encryptedCredentials } : {}),
      updatedAt: new Date(),
    })
    .where(eq(eduSettings.id, id))
    .returning()
  return decryptSettingCredentials(rows[0])
}

export async function deleteEduSetting(id: string): Promise<EduSetting | undefined> {
  const rows = await db.delete(eduSettings).where(eq(eduSettings.id, id)).returning()
  return rows[0]
}

// =============================================================================
// 分组管理 + 批量导入（P0-5 补齐）
// =============================================================================

/** 列出所有 group 及其配置数量。 */
export async function findEduSettingGroups(): Promise<
  { group: string; count: number; updatedAt: Date }[]
> {
  return db
    .select({
      group: eduSettings.group,
      count: sql<number>`count(*)::int`,
      updatedAt: sql<Date>`max(${eduSettings.updatedAt})`,
    })
    .from(eduSettings)
    .groupBy(eduSettings.group)
    .orderBy(asc(eduSettings.group))
}

/** 按 group 批量删除，返回删除条数。 */
export async function deleteEduSettingsByGroup(group: string): Promise<number> {
  const rows = await db
    .delete(eduSettings)
    .where(eq(eduSettings.group, group))
    .returning({ id: eduSettings.id })
  return rows.length
}

/** 重命名 group：将该 group 下所有配置的 group 字段更新为新名。 */
export async function renameEduSettingGroup(
  oldGroup: string,
  newGroup: string,
  updatedBy?: string,
): Promise<number> {
  const rows = await db
    .update(eduSettings)
    .set({ group: newGroup, updatedBy, updatedAt: new Date() })
    .where(eq(eduSettings.group, oldGroup))
    .returning({ id: eduSettings.id })
  return rows.length
}

/** 导出所有配置（含 credentials 解密后字段，仅 admin 调用）。 */
export async function exportAllEduSettings(): Promise<EduSetting[]> {
  const rows = await db
    .select()
    .from(eduSettings)
    .orderBy(asc(eduSettings.group), asc(eduSettings.key))
  return rows.map((row) => decryptSettingCredentials(row)!).filter(Boolean)
}

/**
 * 批量 upsert：按 (group, key) 判定是否存在，存在则更新，不存在则创建。
 * 返回 { inserted, updated, skipped }。
 */
export async function importEduSettings(
  items: Array<{
    group?: string
    key: string
    value?: string | null
    type?: string
    credentials?: unknown
    description?: string | null
    isPublic?: boolean
    sort?: number
    status?: number
  }>,
  updatedBy?: string,
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0
  let updated = 0
  let skipped = 0
  for (const item of items) {
    if (!item.group || !item.key) {
      skipped++
      continue
    }
    const existing = await findEduSettingByGroupKey(item.group, item.key)
    if (existing) {
      await updateEduSetting(existing.id, { ...item, updatedBy })
      updated++
    } else {
      await createEduSetting({ ...item, updatedBy })
      inserted++
    }
  }
  return { inserted, updated, skipped }
}
