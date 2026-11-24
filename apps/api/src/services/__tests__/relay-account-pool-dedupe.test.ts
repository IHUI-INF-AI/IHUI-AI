// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨池重复自愈的决策单测(2026-11-14 立)。
 *
 * 钉住四条判据 —— 这四条错了就会静默删掉活号或把失效票盖到活行上:
 * 1. 有个人池行 ⇒ 幸存行必须是它(归属是用户可见资产,删了找不回),哪怕它票更旧;
 * 2. 幸存行票旧、另一行票新 ⇒ 凭证从新行搬过来(credSourceId 指向新行),而不是留一张旧票;
 * 3. 已知失效(down)的行永远不得当凭证源盖掉 healthy 行;
 * 4. 组内只要有一行 shared_to_ops=true,合并后仍为 true(可用性不减)。
 * 另加:多人各持一行(归属冲突)⇒ 退化为「最健康最新」;单行组不动作。
 *
 * 纯函数测试:db/logger 仍照惯例 mock 掉,避免 import 期连库。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { planDedupeGroup, type DedupeRow } from '../relay-account-pool-dedupe.js'

const DAY = 24 * 3600 * 1000
const T0 = new Date('2026-11-14T12:00:00+08:00')

function row(p: Partial<DedupeRow> & { id: string }): DedupeRow {
  return {
    providerCode: 'trae',
    uid: '146677888728619',
    ownerUserId: 'user-1',
    healthStatus: 'healthy',
    hasRefreshToken: true,
    tokenExpiresAt: new Date(T0.getTime() + 14 * DAY),
    lastRefreshAt: T0,
    updatedAt: T0,
    sharedToOps: true,
    ...p,
  }
}

describe('planDedupeGroup 跨池重复合并判据', () => {
  it('单行组不动作(null)', () => {
    expect(planDedupeGroup([row({ id: 'only' })])).toBeNull()
  })

  it('个人池行票更新 ⇒ 留个人行、不搬凭证、删运营池副本', () => {
    const plan = planDedupeGroup([
      row({ id: 'personal', tokenExpiresAt: new Date(T0.getTime() + 14 * DAY) }),
      row({
        id: 'global',
        ownerUserId: null,
        tokenExpiresAt: new Date(T0.getTime() + 1 * DAY),
      }),
    ])
    expect(plan).not.toBeNull()
    expect(plan!.survivorId).toBe('personal')
    expect(plan!.dropIds).toEqual(['global'])
    expect(plan!.credSourceId).toBeNull()
  })

  it('个人池行票旧、运营池行票新 ⇒ 仍留个人行,但凭证从运营行搬过来', () => {
    const plan = planDedupeGroup([
      row({ id: 'personal', tokenExpiresAt: new Date(T0.getTime() + 1 * DAY) }),
      row({ id: 'global', ownerUserId: null, tokenExpiresAt: new Date(T0.getTime() + 20 * DAY) }),
    ])
    expect(plan!.survivorId).toBe('personal')
    expect(plan!.dropIds).toEqual(['global'])
    expect(plan!.credSourceId).toBe('global')
  })

  it('down 行即便票更晚也不得当凭证源(不把失效票盖到活行上)', () => {
    const plan = planDedupeGroup([
      row({ id: 'personal', healthStatus: 'healthy', tokenExpiresAt: new Date(T0.getTime() + 1 * DAY) }),
      row({
        id: 'global',
        ownerUserId: null,
        healthStatus: 'down',
        tokenExpiresAt: new Date(T0.getTime() + 30 * DAY),
      }),
    ])
    expect(plan!.survivorId).toBe('personal')
    expect(plan!.credSourceId).toBeNull()
  })

  it('组内任一行共享 ⇒ 合并后仍共享(可用性不减)', () => {
    const plan = planDedupeGroup([
      row({ id: 'personal', sharedToOps: false }),
      row({ id: 'global', ownerUserId: null, sharedToOps: true }),
    ])
    expect(plan!.sharedToOps).toBe(true)
  })

  it('多人各持一行(归属冲突)⇒ 留最健康最新的那行,另一行删除', () => {
    const plan = planDedupeGroup([
      row({ id: 'older', ownerUserId: 'user-1', tokenExpiresAt: new Date(T0.getTime() + 1 * DAY) }),
      row({ id: 'newer', ownerUserId: 'user-2', tokenExpiresAt: new Date(T0.getTime() + 9 * DAY) }),
    ])
    expect(plan!.survivorId).toBe('newer')
    expect(plan!.dropIds).toEqual(['older'])
  })

  it('纯运营池两行(无归属)⇒ 按新鲜度留一行', () => {
    const plan = planDedupeGroup([
      row({ id: 'stale', ownerUserId: null, healthStatus: 'down', tokenExpiresAt: null }),
      row({ id: 'fresh', ownerUserId: null, tokenExpiresAt: new Date(T0.getTime() + 5 * DAY) }),
    ])
    expect(plan!.survivorId).toBe('fresh')
    expect(plan!.dropIds).toEqual(['stale'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
