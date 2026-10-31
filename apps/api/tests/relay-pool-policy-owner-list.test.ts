// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, type SQL } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { aiRelayAccountPool } from '@ihui/database'
import { describe, expect, it } from 'vitest'
import { ownerListCondition } from '../src/services/relay-pool-policy.js'

const ADMIN = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'
const OTHER = '6301462a-9a8e-4fbd-a18e-159defe10c94'

/**
 * 不连库取 SQL 文本:postgres client 只构造不 connect(假 DSN + 端口 1 兜底),
 * toSQL() 是纯 SQL 生成,查询永不执行 —— §5 测试隔离铁律不受影响。
 */
const client = postgres('postgres://unit:test@127.0.0.1:1/none', {
  max: 0,
  connect_timeout: 1,
})
const db = drizzle(client)

function whereOf(cond: SQL | null): { sql: string; params: unknown[] } {
  const q = db.select().from(aiRelayAccountPool).where(and(cond) ?? undefined).toSQL()
  return { sql: q.sql.toLowerCase(), params: q.params }
}

describe('ownerListCondition(admin 号池列表归属筛选四分支)', () => {
  it('ops/缺省 ⇒ 运营池(owner IS NULL,存量视图零变化)', () => {
    for (const owner of [undefined, 'ops']) {
      const { sql } = whereOf(ownerListCondition(owner, ADMIN))
      expect(sql).toContain('"owner_user_id" is null')
    }
  })

  it('me + 登录态 ⇒ 当前登录用户个人池(= 传入的 meUserId,不是写死的任何人)', () => {
    const adminHit = whereOf(ownerListCondition('me', ADMIN))
    expect(adminHit.sql).toContain('"owner_user_id" =')
    expect(adminHit.params).toContain(ADMIN)
    // 另一个登录用户拿到的是他自己的池,绝不是 admin 的
    const otherHit = whereOf(ownerListCondition('me', OTHER))
    expect(otherHit.params).toContain(OTHER)
    expect(otherHit.params).not.toContain(ADMIN)
  })

  it('me 无登录态 ⇒ null(handler 层负责 401 fail-closed,绝不回落全局池)', () => {
    expect(ownerListCondition('me', undefined)).toBeNull()
  })

  it('all ⇒ null(不限归属);其余值 ⇒ 按 ownerUserId 精确筛', () => {
    expect(ownerListCondition('all', ADMIN)).toBeNull()
    const exact = whereOf(ownerListCondition(OTHER, ADMIN))
    expect(exact.params).toContain(OTHER)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
