// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type {
  SkillPayoutManifestResponse,
  SkillSellerAccountRow,
  SkillSellerAccountsResponse,
} from '@ihui/shared/skills/market'
import { computeSkillPayoutManifest } from '../src/services/skill-market-purchase-service.js'
import {
  buildSkillPayoutManifestCsv,
  payoutManifestCsvFilename,
} from '../src/services/skill-payout-manifest-csv.js'

function seller(overrides: Partial<SkillSellerAccountRow> = {}): SkillSellerAccountRow {
  return {
    sellerUserId: 'seller-1',
    sellerNickname: '卖家一',
    paidCount: 0,
    refundedCount: 0,
    grossSalesCents: 0,
    refundedGrossCents: 0,
    netGmvCents: 0,
    authorShareEarnedCents: 0,
    authorShareActiveCents: 0,
    authorShareOnRefundedCents: 0,
    sellerClawbackCents: 0,
    platformBorneCents: 0,
    authorNetCents: 0,
    skillActiveCommissionCents: 0,
    skillInvalidCommissionCents: 0,
    activeCommissionCents: 0,
    walletBalanceCents: 0,
    withdrawalOccupiedCents: 0,
    pendingWithdrawalCents: 0,
    completedWithdrawalCents: 0,
    withdrawableCents: 0,
    commissionGapCents: 0,
    flags: [],
    ...overrides,
  }
}

function accounts(items: SkillSellerAccountRow[]): SkillSellerAccountsResponse {
  return {
    items,
    summary: {
      sellers: items.length,
      platformBorneCents: items.reduce((sum, item) => sum + item.platformBorneCents, 0),
      walletBalanceCents: items.reduce((sum, item) => sum + item.walletBalanceCents, 0),
      withdrawableCents: items.reduce((sum, item) => sum + item.withdrawableCents, 0),
      mismatchCount: items.filter((item) => item.commissionGapCents !== 0).length,
    },
    currency: 'CNY',
    period: {
      month: '2026-11',
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    },
  }
}

describe('skill payout manifest', () => {
  const data = computeSkillPayoutManifest(
    accounts([
      seller({ sellerUserId: 'ready', authorNetCents: 1000, withdrawableCents: 1200 }),
      seller({
        sellerUserId: 'capped',
        authorNetCents: 1000,
        withdrawableCents: 400,
        pendingWithdrawalCents: 100,
      }),
      seller({ sellerUserId: 'no-cash', authorNetCents: 500, withdrawableCents: 0 }),
      seller({
        sellerUserId: 'review',
        authorNetCents: 300,
        withdrawableCents: 300,
        flags: ['commission_mismatch'],
        commissionGapCents: 50,
      }),
      seller({ sellerUserId: 'negative', authorNetCents: -100, flags: ['platform_borne'] }),
    ]),
  )

  it('参考上限不超过本月净额与当前可提现', () => {
    expect(data.items.map((item) => item.suggestedPayoutCents)).toEqual([1000, 400, 0, 300, 0])
    expect(data.items[1]?.flags).toContain('capped_by_withdrawable')
    expect(data.items[4]?.flags).toContain('month_negative')
  })

  it('需核查优先于可打款，且负净额不进入 ready', () => {
    expect(data.items.map((item) => item.status)).toEqual([
      'ready',
      'ready',
      'not_withdrawable',
      'needs_review',
      'no_net',
    ])
    expect(data.summary).toEqual({
      sellers: 5,
      monthAuthorNetCents: 2700,
      suggestedPayoutCents: 1700,
      readyCount: 2,
      needsReviewCount: 1,
      notWithdrawableCount: 1,
    })
  })

  it('固定免责声明说明不发起转账', () => {
    expect(data.disclaimer).toContain('不发起转账')
    expect(data.period.month).toBe('2026-11')
  })
})

describe('payout manifest CSV', () => {
  const data: SkillPayoutManifestResponse = {
    period: {
      month: '2026-11',
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    },
    currency: 'CNY',
    disclaimer: '只读参考清单，不发起转账。',
    summary: {
      sellers: 2,
      monthAuthorNetCents: 1400,
      suggestedPayoutCents: 400,
      readyCount: 1,
      needsReviewCount: 1,
      notWithdrawableCount: 0,
    },
    items: [
      {
        sellerUserId: 's1',
        sellerNickname: '=evil, "seller"',
        monthAuthorNetCents: 1000,
        withdrawableCents: 400,
        pendingWithdrawalCents: 0,
        completedWithdrawalCents: 200,
        suggestedPayoutCents: 400,
        status: 'ready',
        flags: ['capped_by_withdrawable'],
      },
      {
        sellerUserId: 's2',
        sellerNickname: '卖家二',
        monthAuthorNetCents: 400,
        withdrawableCents: 400,
        pendingWithdrawalCents: 100,
        completedWithdrawalCents: 0,
        suggestedPayoutCents: 400,
        status: 'needs_review',
        flags: ['commission_mismatch'],
      },
    ],
  }

  it('带 BOM，金额转元，状态与标记可读', () => {
    const csv = buildSkillPayoutManifestCsv(data, {
      exportedAt: new Date('2026-11-28T10:00:00.000Z'),
    })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('技能市场人工出款参考清单')
    expect(csv).toContain('参考出款上限(元)')
    expect(csv).toContain('可进入人工复核')
    expect(csv).toContain('被可提现余额截断')
    expect(csv).toContain('"\'=evil, ""seller"""')
  })

  it('文件名按账期区分', () => {
    const now = new Date('2026-11-28T10:00:00.000Z')
    expect(payoutManifestCsvFilename('2026-11', now)).toBe(
      'skill-market-payout-manifest-2026-11.csv',
    )
    expect(payoutManifestCsvFilename(null, now)).toBe(
      'skill-market-payout-manifest-all-20261128.csv',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
