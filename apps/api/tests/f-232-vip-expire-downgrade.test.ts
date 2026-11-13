// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-232 回归锁(2026-11-13)。
 *
 * 病灶:VIP 到期降级把 users.is_vip **无条件覆盖** —— 旧实现「查不到 status=1 的 VIP
 * 就 update users set is_vip=0」,两步之间用户续费写入的生效卡片会被覆盖误降;
 * 并且先全量加载过期记录再逐条 UPDATE、逐用户 1 查 1 改(N+1)。
 *
 * 本文件锁:
 *   ① 降级判据是「该用户已无任何未过期 VIP」,而不是「某条 VIP 记录过期」:
 *      窗口内续费(仍有未过期 VIP)的用户不得进入降级集合;
 *   ② 多条记录全部过期 → 去重后只降级一次;
 *   ③ 没有任何 VIP 记录的用户保持 is_vip 原状(不在到期集合里,绝不进候选集);
 *   ④ 源锁:生产实现是同一事务内两条集合 SQL,降级条件必须是 NOT EXISTS(未过期 VIP),
 *      且不再出现逐用户循环(无 N+1)。
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
  userVips: { id: 'id', userId: 'user_id', endTime: 'end_time', status: 'status' },
  users: { id: 'id', isVip: 'is_vip' },
}))

import { collectVipDowngradeCandidates } from '../src/services/vip-expire-service.js'

describe('F-232 VIP 到期降级:只降级「已无任何未过期 VIP」的用户', () => {
  it('① 刚续费(仍有未过期 VIP)的用户不在降级集合', () => {
    const candidates = collectVipDowngradeCandidates(
      ['u-renewed', 'u-expired'],
      new Map([
        ['u-renewed', 1],
        ['u-expired', 0],
      ]),
    )
    expect(candidates).toEqual(['u-expired'])
    expect(candidates).not.toContain('u-renewed')
  })

  it('② 多条 VIP 记录全部过期 → 去重后降级一次', () => {
    const candidates = collectVipDowngradeCandidates(
      ['u-a', 'u-a', 'u-b'],
      new Map([
        ['u-a', 0],
        ['u-b', 0],
      ]),
    )
    expect(candidates).toEqual(['u-a', 'u-b'])
  })

  it('③ 无 VIP 记录的用户保持原状(不在到期集合 → 不进降级集合)', () => {
    const candidates = collectVipDowngradeCandidates(
      ['u-expired'],
      new Map([
        ['u-expired', 0],
        ['u-no-vip', 0],
      ]),
    )
    expect(candidates).toEqual(['u-expired'])
    expect(candidates).not.toContain('u-no-vip')
  })

  it('④ 源锁:同一事务内两条集合 SQL,降级条件是 NOT EXISTS(未过期 VIP),无逐用户循环', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/vip-expire-service.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf('export async function expireVipMembers')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start)

    // 集合式到期 + 集合式降级,同一事务
    expect(block).toContain('db.transaction(')
    expect(block).toContain('.returning({ userId: userVips.userId')
    expect(block).toContain('inArray(users.id, userIds)')
    // 唯一降级判据:该用户已无任何未过期 VIP
    expect(block).toContain('notExists(')
    expect(block).toContain('eq(userVips.status, 1)')
    expect(block).toContain('gt(userVips.endTime, now)')
    // 旧实现的 N+1 循环不得复活
    expect(block).not.toContain('for (const record of expiredRecords)')
    expect(block).not.toContain('for (const userId of userIds)')
    expect(block).not.toContain('.limit(1)')
  })
})
