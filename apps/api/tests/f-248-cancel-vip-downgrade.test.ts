// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-248 回归锁(2026-11-13)。
 *
 * 病灶:运营取消 VIP 只把 `user_vips.status` 改成 2,不回写 `users.isVip`,
 * 被取消用户仍被 agent-service / token-balance-service / commission-queries 当 VIP 放行;
 * 且路由恒返回 `cancelled:true`,0 行变更不可见。
 *
 * 本文件锁:
 *   ① 该用户仍有其它有效 VIP(取消后 status=1 且未到期)→ 不降级 users.isVip;
 *   ② 该用户已无其它有效 VIP → 降级 users.isVip=0;
 *   ③ 返回命中数正确:目标不存在 / 记录已非 status=1 → 0 命中且不降级;
 *   ④ 源锁:取消与降级在同一事务内;判据是「其它有效 VIP 计数」(排除本张卡 + 未过期,
 *      与 F-232 到期降级同义但为单用户路径),命中数由 RETURNING 派生。
 *
 * 只 mock db / 库表,不触达真实 PG。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  vipLevels: { id: 'id' },
  userVips: { id: 'id', userId: 'user_id', status: 'status', endTime: 'end_time' },
  users: { id: 'id', isVip: 'is_vip' },
}))

import { planVipCancelDowngrade } from '../src/db/vip-queries.js'

describe('F-248 取消 VIP:仅当已无其它有效 VIP 才回写 users.isVip=0', () => {
  it('① 仍有其它有效 VIP → 不降级', () => {
    expect(planVipCancelDowngrade({ userId: 'u-1', status: 1 }, 1)).toEqual({
      hits: 1,
      downgrade: false,
    })
    expect(planVipCancelDowngrade({ userId: 'u-1', status: 1 }, 2)).toEqual({
      hits: 1,
      downgrade: false,
    })
  })

  it('② 已无其它有效 VIP → 降级', () => {
    expect(planVipCancelDowngrade({ userId: 'u-1', status: 1 }, 0)).toEqual({
      hits: 1,
      downgrade: true,
    })
  })

  it('③ 命中数:目标不存在 / 已非有效状态 → 0 命中且不降级', () => {
    expect(planVipCancelDowngrade(null, 0)).toEqual({ hits: 0, downgrade: false })
    expect(planVipCancelDowngrade(undefined, 0)).toEqual({ hits: 0, downgrade: false })
    expect(planVipCancelDowngrade({ userId: 'u-1', status: 2 }, 0)).toEqual({
      hits: 0,
      downgrade: false,
    })
    expect(planVipCancelDowngrade({ userId: 'u-1', status: 0 }, 0)).toEqual({
      hits: 0,
      downgrade: false,
    })
  })

  it('④ 源锁:同一事务内条件取消 + 其它有效 VIP 计数判据 + RETURNING 命中数', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/db/vip-queries.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf('export async function cancelUserVip')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start)

    // 取消与降级必须同一事务
    expect(block).toContain('db.transaction(')
    expect(block).toContain('tx.update(users).set({ isVip: 0 })')
    // 取消是带 status 守卫的条件 UPDATE,命中数由 RETURNING 派生(0 行不再冒充成功)
    expect(block).toContain('.returning({ id: userVips.id })')
    expect(block).toContain('eq(userVips.status, 1)')
    // 其它有效 VIP 判据:排除本张卡 + 未过期(与 F-232 到期降级同义)
    expect(block).toContain('ne(userVips.id, id)')
    expect(block).toContain('gt(userVips.endTime, now)')
    // 旧回退形态(只改 user_vips、恒返回 1)不得复活
    expect(block).not.toContain('return 1')
    expect(block).not.toContain('const remaining')
  })

  it('⑤ 源锁:路由 cancelled 由库侧命中数派生,响应结构仍是 { cancelled: boolean }', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/routes/vip.ts', import.meta.url)), 'utf8')
    expect(src).toContain('const hits = await cancelUserVip(id)')
    expect(src).toContain('success({ cancelled: hits > 0 })')
  })
})
