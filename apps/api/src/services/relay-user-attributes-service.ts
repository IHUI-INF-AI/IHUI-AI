// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, asc } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { relayUserAttributes, type RelayUserAttribute } from '@ihui/database'

/**
 * 用户自定义属性服务(2026-09-17 立,补强 55,对标竞品 /user-attributes)。
 *
 * 给用户挂 KV 标签(如 tier=vip、source=referral),供分组/风控/运营筛选与导出。
 * 语义:同一 (userId, key) 唯一,set 为覆盖写(PUT),delete 为精确删除。
 *
 * 校验:key ∈ [a-z0-9_] 且 1-64 位;value 1-255 位(去空白后非空)。
 * 校验在 service 层做,路由层只负责转发与 HTTP 语义。
 */
export function validateAttrKey(key: string): boolean {
  return /^[a-z0-9_]{1,64}$/.test(key)
}

export function validateAttrValue(value: string): boolean {
  const v = value.trim()
  return v.length > 0 && v.length <= 255
}

export async function listUserAttributes(userId: string): Promise<RelayUserAttribute[]> {
  const rows = await dbRead
    .select()
    .from(relayUserAttributes)
    .where(eq(relayUserAttributes.userId, userId))
    .orderBy(asc(relayUserAttributes.attrKey))
  return rows as RelayUserAttribute[]
}

/** 覆盖写入(同一 key 已存在则更新值与 updatedBy)。 */
export async function setUserAttribute(input: {
  userId: string
  key: string
  value: string
  updatedBy?: string | null
}): Promise<RelayUserAttribute> {
  const value = input.value.trim()
  const [row] = await db
    .insert(relayUserAttributes)
    .values({
      userId: input.userId,
      attrKey: input.key,
      attrValue: value,
      updatedBy: input.updatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: [relayUserAttributes.userId, relayUserAttributes.attrKey],
      set: { attrValue: value, updatedBy: input.updatedBy ?? null, updatedAt: new Date() },
    })
    .returning()
  return row as RelayUserAttribute
}

export async function deleteUserAttribute(userId: string, key: string): Promise<boolean> {
  const rows = await db
    .delete(relayUserAttributes)
    .where(and(eq(relayUserAttributes.userId, userId), eq(relayUserAttributes.attrKey, key)))
    .returning({ id: relayUserAttributes.id })
  return rows.length > 0
}

/** 按属性值反查用户(运营筛选,如查 tier=vip 的全部 userId)。 */
export async function findUserIdsByAttribute(
  key: string,
  value: string,
  limit = 200,
): Promise<string[]> {
  const rows = await dbRead
    .select({ userId: relayUserAttributes.userId })
    .from(relayUserAttributes)
    .where(
      and(eq(relayUserAttributes.attrKey, key), eq(relayUserAttributes.attrValue, value.trim())),
    )
    .limit(Math.min(Math.max(1, limit), 1000))
  return rows.map((r) => r.userId)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
