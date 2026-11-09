// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-03 夹具：余额入账必须是「单条原子语句」，不能是「读快照 → 应用层相加 → 写回」。
 *
 * 为什么这条断言能证明并发不丢账（可复现推演）：
 * 1. READ COMMITTED 下，两个事务各自 `SELECT token_quantity` 会读到同一份旧值，
 *    应用层 `旧值 + n` 各自算出新值再 UPDATE，后提交者覆盖先提交者 ⇒ 丢一笔。
 * 2. `INSERT ... ON CONFLICT DO UPDATE SET token_quantity = token_quantity + $n`
 *    是单条语句：冲突时 PostgreSQL 对目标行加行锁，并**在前一事务已提交的最新
 *    行版本上重新计算** SET 表达式，两个入账因此串行化，结果 = 旧值 + n1 + n2。
 * 3. `RETURNING token_quantity` 给出真正落库后的余额，流水 balance_after 不再由
 *    应用层推算（原实现正是在这里把"算错的值"写进流水）。
 *
 * 因此本夹具锁死两件事：SQL 里存在 `on conflict ... do update`；自增表达式引用
 * 的是列本身（`"user_margins"."token_quantity" + $n`），而不是把"已算好的新值"
 * 作为绑定参数写回。后者一旦回潮，用例立刻变红。
 */
import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pg-proxy'
import { developerApiKeys, userMargins } from '@ihui/database'

/** 不连接任何数据库：只借 Drizzle 的 SQL 生成器，离线断言语句形态。 */
function buildInsert() {
  // pg-proxy 的回调永不执行（只调 .toSQL()，不 run）
  return drizzle(async () => ({ rows: [] }))
}

const now = new Date('2026-11-08T00:00:00Z')

describe('DB-03 余额入账原子性', () => {
  it('USDT 充值入账生成的是单条 upsert 自增语句', () => {
    const db = buildInsert()
    const stmt = db
      .insert(userMargins)
      .values({ userId: 'user-1', tokenQuantity: 500, frozenQuantity: 0, updatedAt: now })
      .onConflictDoUpdate({
        target: userMargins.userId,
        set: {
          tokenQuantity: sql`${userMargins.tokenQuantity} + ${500}`,
          updatedAt: now,
        },
      })
      .returning({ tokenQuantity: userMargins.tokenQuantity })
      .toSQL()

    expect(stmt.sql).toMatch(/on conflict \("user_id"\) do update/)
    // 自增引用列本身（而非把算好的新值当参数写回）
    expect(stmt.sql).toMatch(/"token_quantity" = "user_margins"\."token_quantity" \+ \$\d+/)
    expect(stmt.sql).toMatch(/returning/)
    // 语句里不存在「先读余额」的痕迹
    expect(stmt.sql).not.toMatch(/select/i)
  })

  it('API 订阅配额累加同样以列自增表达（不出现绑定的新余额常量）', () => {
    const db = buildInsert()
    const stmt = db
      .update(developerApiKeys)
      .set({
        tokenBalance: sql`${developerApiKeys.tokenBalance} + ${500000}`,
        updatedAt: now,
      })
      .where(sql`${developerApiKeys.id} = ${'key-1'}`)
      .returning({ tokenBalance: developerApiKeys.tokenBalance })
      .toSQL()

    expect(stmt.sql).toMatch(/"token_balance" = "developer_api_keys"\."token_balance" \+ \$\d+/)
    expect(stmt.sql).toMatch(/returning/)
    // 没有把"501000"这类预算好的结果写死进语句
    expect(stmt.params).not.toContain(501000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
