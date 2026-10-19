// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { userPreferences, type UserPreference } from '@ihui/database'

/**
 * `user_preferences.group` 取值的唯一具名出口(2026-10-18 收口单/复数分叉)。
 *
 * 为什么要有这一份:compat 路由(`/settings/notification` 单数)曾把通知偏好写进
 * group='notification'(单数),而权威腿(`/settings/notifications`,user/settings-routes.ts)
 * 与 schema 词表(notifications/privacy/preferences/devices)都写复数 —— 同一个用户的同一份
 * 通知偏好被拆到两个 group,读写互不可见(compat 读到空、web 读到另一批)。这不是 preferences
 * 分叉(language/theme 落 'preferences' 本就正确,见 settings-routes.ts:168 注释),是单复数分叉。
 * 现以复数为准并把 compat 并进权威腿;裸字面量不得再出现在调用侧(§0.6 单一真相源)。
 * 存量单数行由迁移 `20261018150000_user_preferences_notification_group_plural` 一次性并入。
 */
export const USER_PREFERENCE_GROUPS = {
  notifications: 'notifications',
  privacy: 'privacy',
  preferences: 'preferences',
  devices: 'devices',
  sidebar: 'sidebar',
  // 'security' 早在 auth.ts 的 login-preferences(autoLogin/autoRenew)里写库,只是这份具名
  // 出口一直没登记它。移动端安全设置屏读的同一条腿(biometric/loginAlert),不得再抄裸字面量。
  security: 'security',
} as const

export type UserPreferenceGroup =
  (typeof USER_PREFERENCE_GROUPS)[keyof typeof USER_PREFERENCE_GROUPS]

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
