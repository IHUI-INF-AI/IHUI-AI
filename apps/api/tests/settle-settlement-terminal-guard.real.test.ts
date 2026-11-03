// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * settleSettlement 终态不可逆出 — 真实 DB 集成测试(出处 b76-12e G-998159)。
 *
 * 判据:settleSettlement 的 UPDATE where 必须带 `status != 'settled'` 守卫,
 * 对同一行连调两次,第二次必须返回 undefined 且 settledAt 不被覆盖。
 * (原实现 where 只有 eq(id),已 settled 的行可被重复改写并覆盖 settledAt。)
 * 跑法:cd apps/api && node node_modules/vitest/vitest.mjs run --config vitest.real.config.ts tests/settle-settlement-terminal-guard.real.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { agentSettlements } from '@ihui/database'
import { createSettlement, settleSettlement } from '../src/db/agents-queries.js'

describe('settleSettlement — 终态不可逆出(条件 UPDATE + 迟到结果丢弃)', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM agent_settlements`)
  })

  it('同一行连调两次:第二次返回 undefined 且 settledAt 等于第一次的时间', async () => {
    const s = await createSettlement({
      agentId: randomUUID(),
      orderNo: 'ORD-GUARD-1',
      amount: 100,
      status: 'unsettled',
    })
    const first = await settleSettlement(s!.id)
    expect(first?.status).toBe('settled')
    expect(first?.settledAt).toBeInstanceOf(Date)
    const firstAt = first!.settledAt

    // 第二次调用:行已是终态 ⇒ 迁移未发生 ⇒ undefined,且 settledAt 不被覆盖
    const second = await settleSettlement(s!.id)
    expect(second).toBeUndefined()
    const rows = await db
      .select()
      .from(agentSettlements)
      .where(eq(agentSettlements.id, s!.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('settled')
    expect(rows[0]!.settledAt).toEqual(firstAt)
  })

  it('未结算行仍可正常结算(守卫不拦合法迁移)', async () => {
    const s = await createSettlement({
      agentId: randomUUID(),
      orderNo: 'ORD-GUARD-2',
      amount: 200,
      status: 'unsettled',
    })
    const settled = await settleSettlement(s!.id)
    expect(settled?.status).toBe('settled')
    expect(settled?.settledAt).toBeInstanceOf(Date)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
