import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { userPreferences, type UserPreference } from '@ihui/database'

export type UserPreferenceRow = {
  id: string
  group: string
  key: string
  value: string | null
  updatedAt: Date
}

const rowFields = {
  id: userPreferences.id,
  group: userPreferences.group,
  key: userPreferences.key,
  value: userPreferences.value,
  updatedAt: userPreferences.updatedAt,
}

/** 查询用户偏好,可选 group 筛选。返回 { list, total }。 */
export async function findUserPreferences(
  userId: string,
  group?: string,
): Promise<{ list: UserPreferenceRow[]; total: number }> {
  const conds = [eq(userPreferences.userId, userId)]
  if (group) conds.push(eq(userPreferences.group, group))
  const where = and(...conds)

  const [list, totalRows] = await Promise.all([
    db
      .select(rowFields)
      .from(userPreferences)
      .where(where)
      .orderBy(asc(userPreferences.group), asc(userPreferences.key)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userPreferences)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0 }
}

/** 按 (userId, group, key) upsert 一条偏好。返回写入后的行。 */
export async function upsertUserPreference(
  userId: string,
  group: string,
  key: string,
  value: string | null,
): Promise<UserPreference | undefined> {
  const rows = await db
    .insert(userPreferences)
    .values({ userId, group, key, value })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.group, userPreferences.key],
      set: { value, updatedAt: new Date() },
    })
    .returning()
  return rows[0]
}

/** 按 (userId, group, key) 删除单条。返回是否删除。 */
export async function deleteUserPreference(
  userId: string,
  group: string,
  key: string,
): Promise<boolean> {
  const rows = await db
    .delete(userPreferences)
    .where(
      and(
        eq(userPreferences.userId, userId),
        eq(userPreferences.group, group),
        eq(userPreferences.key, key),
      ),
    )
    .returning({ id: userPreferences.id })
  return rows.length > 0
}

/** 按 (userId, group) 删除整组,返回删除条数。 */
export async function deleteUserPreferencesByGroup(userId: string, group: string): Promise<number> {
  const rows = await db
    .delete(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.group, group)))
    .returning({ id: userPreferences.id })
  return rows.length
}
