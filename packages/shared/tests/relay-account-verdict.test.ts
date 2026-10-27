// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @ihui/shared 号池体检判据单源用例(2026-10-26 立)。
 * 这一份是 admin 列表徽章与 CLI `relay:inspect` **共用的那把尺子** —— 没有它,
 * 判据等于"造好了没接线"(AGENTS §0.9)；断言只锁行为，不锁中文文案标点。
 */
import { describe, it, expect } from 'vitest'

import {
  RELAY_ACCOUNT_VERDICT_ACTION,
  RELAY_ACCOUNT_VERDICT_KINDS,
  relayAccountIdleDays,
  relayAccountRemainingDays,
  resolveRelayAccountVerdict,
} from '../src/relay-account-verdict.js'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 26, 12)

describe('relayAccountRemainingDays', () => {
  it('未来取正、过去取负、一位小数；null/非数取 null（取不到≠已过期）', () => {
    expect(relayAccountRemainingDays(NOW + DAY, NOW)).toBe(1)
    expect(relayAccountRemainingDays(NOW + 1.25 * DAY, NOW)).toBe(1.3)
    expect(relayAccountRemainingDays(NOW - DAY, NOW)).toBe(-1)
    expect(relayAccountRemainingDays(null, NOW)).toBeNull()
    expect(relayAccountRemainingDays(Number.NaN, NOW)).toBeNull()
  })
})

describe('resolveRelayAccountVerdict', () => {
  it('六态：远到期 usable；≤1 天 expiring-soon；过期带 rt 可救回；无 rt 待重登', () => {
    expect(
      resolveRelayAccountVerdict({ tokenExpiryMs: NOW + 30 * DAY, hasRefreshCredential: true }, NOW)
        .verdict,
    ).toBe('usable')
    expect(resolveRelayAccountVerdict({ tokenExpiryMs: NOW + 6 * 3600_000 }, NOW).verdict).toBe(
      'expiring-soon',
    )
    expect(
      resolveRelayAccountVerdict({ tokenExpiryMs: NOW - DAY, hasRefreshCredential: true }, NOW)
        .verdict,
    ).toBe('expired-renewable')
    expect(
      resolveRelayAccountVerdict({ tokenExpiryMs: NOW - DAY, hasRefreshCredential: false }, NOW)
        .verdict,
    ).toBe('expired-dead')
  })

  it('信封不冒判任何一边：无到期数且 canSelfRenew 为 false', () => {
    const r = resolveRelayAccountVerdict({ tokenExpiryMs: 5, envelope: true }, NOW)
    expect(r.verdict).toBe('envelope-only')
    expect(r.tokenRemainingDays).toBeNull()
  })

  it('无凭据/读不到到期 ⇒ indeterminate（取不到不写成判过，§0.3；也绝不写成 expired）', () => {
    expect(
      resolveRelayAccountVerdict(
        { tokenExpiryMs: null, hasCredential: false, hasRefreshCredential: true },
        NOW,
      ).verdict,
    ).toBe('indeterminate')
    expect(resolveRelayAccountVerdict({ tokenExpiryMs: null }, NOW).verdict).toBe('indeterminate')
  })

  it('六枚枚举两两都有下一步文案，且枚举集合与文案表键集同源', () => {
    expect([...RELAY_ACCOUNT_VERDICT_KINDS].sort()).toEqual(
      Object.keys(RELAY_ACCOUNT_VERDICT_ACTION).sort(),
    )
    for (const k of RELAY_ACCOUNT_VERDICT_KINDS)
      expect(RELAY_ACCOUNT_VERDICT_ACTION[k]?.trim().length).toBeGreaterThan(4)
  })
})

describe('relayAccountIdleDays（展示面时钟，等价调度 SQL 那把 greatest/last_refresh 语义）', () => {
  it('使用/刷新取较新者；都为空回落 createdAt；三个全缺 ⇒ null 不冒 0', () => {
    expect(
      relayAccountIdleDays({ lastUsedAt: NOW - 10 * DAY, lastRefreshAt: NOW - DAY }, NOW),
    ).toBe(1)
    expect(relayAccountIdleDays({ createdAt: NOW - 3 * DAY }, NOW)).toBe(3)
    expect(relayAccountIdleDays({}, NOW)).toBeNull()
    const t = relayAccountIdleDays({ lastUsedAt: new Date(NOW - 2 * DAY) }, NOW)
    expect(typeof t).toBe('number')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
