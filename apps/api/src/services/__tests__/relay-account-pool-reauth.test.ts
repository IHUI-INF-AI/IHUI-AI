// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type {
  CheckinLastRecord,
  CheckinSideRow,
  FetchPoolAccountsResult,
} from '../relay-account-pool-reconcile.js'
import { buildReauthReport, type PoolReauthRow } from '../relay-account-pool-reauth.js'

const DAY = 86_400_000
const NOW = Date.now()

function poolRow(overrides: Partial<PoolReauthRow> & { id: string }): PoolReauthRow {
  return {
    providerCode: 'trae',
    uid: overrides.id,
    name: overrides.id,
    isEnabled: true,
    healthStatus: 'healthy',
    tempUnschedulable: false,
    tokenExpiresAt: new Date(NOW + DAY),
    hasRefreshToken: true,
    lastErrorMessage: null,
    refreshSupported: true,
    ...overrides,
  }
}

function record(overrides: Partial<CheckinLastRecord>): CheckinLastRecord {
  return {
    ok: false,
    action: 'claim',
    message: null,
    code: null,
    httpStatus: null,
    classifiedErrorType: null,
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  }
}

function checkinAccount(
  poolAccountId: string,
  lastRecord: CheckinLastRecord | null,
): CheckinSideRow {
  return {
    accountId: 1,
    poolAccountId,
    ownerUserId: null,
    platform: 'trae',
    identityKey: poolAccountId,
    enabled: true,
    poolCredVersion: 1,
    poolPendingCred: null,
    lastRecord,
  }
}

function checkinOk(accounts: CheckinSideRow[]): FetchPoolAccountsResult {
  return { ok: true, accounts, error: null }
}

const AUTH_REJECTED = record({
  ok: false,
  action: 'claim',
  code: '1001',
  message: 'not able to authenticate you',
  classifiedErrorType: 'BusinessError',
})

describe('buildReauthReport（号池 needs_reauth 汇总）', () => {
  it('四类主原因与 provider×reason 计数；down 覆盖 claim 证据不丢', () => {
    const rows = [
      poolRow({ id: 'trae-down', healthStatus: 'down', tempUnschedulable: true }),
      poolRow({ id: 'trae-claim' }),
      poolRow({
        id: 'minimax-1',
        providerCode: 'minimax',
        tokenExpiresAt: new Date(NOW - DAY),
        hasRefreshToken: true,
        refreshSupported: false,
        healthStatus: 'healthy',
      }),
      poolRow({ id: 'opencode-1', providerCode: 'opencode', healthStatus: 'down' }),
      poolRow({ id: 'doubao-1', providerCode: 'doubao', tokenExpiresAt: null }),
      poolRow({ id: 'qoder-skip', providerCode: 'qoder' }),
    ]
    const checkin = checkinOk([
      checkinAccount('trae-down', AUTH_REJECTED),
      checkinAccount('trae-claim', AUTH_REJECTED),
      checkinAccount('minimax-1', AUTH_REJECTED),
      checkinAccount('qoder-skip', record({ ok: true, action: 'skip_already' })),
      checkinAccount('doubao-1', null),
    ])

    const report = buildReauthReport(rows, checkin, NOW)
    expect(report.counts).toEqual({
      total: 4,
      byProvider: { trae: 2, minimax: 1, opencode: 1 },
      byReason: { account_down: 2, claim_failed: 1, expired_no_refresh: 1 },
      byProviderReason: {
        trae: { account_down: 1, claim_failed: 1 },
        minimax: { expired_no_refresh: 1 },
        opencode: { account_down: 1 },
      },
    })
    const down = report.items.find((i) => i.id === 'trae-down')
    expect(down?.reauthReason).toBe('account_down')
    // 证据不丢:down 是主原因,claim 仍留在 reasons 里
    expect(down?.reauthReasons).toEqual(['account_down', 'claim_failed'])
    const skip = report.items.find((i) => i.id === 'qoder-skip')
    expect(skip?.needsReauth).toBe(false)
    expect(skip?.lastCheckin?.action).toBe('skip_already')
  })

  it('9095 幂等已签被误记成失败时，不得标 needs_reauth', () => {
    const report = buildReauthReport(
      [poolRow({ id: 'trae-9095' })],
      checkinOk([
        checkinAccount(
          'trae-9095',
          record({ ok: false, action: 'claim', code: '9095', message: '当前设备今日已经签到' }),
        ),
      ]),
      NOW,
    )
    expect(report.items[0]).toMatchObject({ needsReauth: false, reauthReason: null })
  })

  it('签到侧不可达：只做池侧分类，checkinSource 显式报错', () => {
    const rows = [
      poolRow({ id: 'trae-claim' }),
      poolRow({ id: 'opencode-down', providerCode: 'opencode', healthStatus: 'down' }),
    ]
    const report = buildReauthReport(
      rows,
      { ok: false, accounts: [], error: 'pool-accounts 网络错误: boom' },
      NOW,
    )
    expect(report.checkinSource).toEqual({ ok: false, error: 'pool-accounts 网络错误: boom' })
    expect(report.counts.byProvider).toEqual({ opencode: 1 })
    expect(report.items.find((i) => i.id === 'trae-claim')?.needsReauth).toBe(false)
  })

  it('未传签到侧(null)与正常 skip 记录都不误标', () => {
    const report = buildReauthReport([poolRow({ id: 'qoder-1', providerCode: 'qoder' })], null, NOW)
    expect(report.checkinSource).toEqual({ ok: false, error: '未拉取签到侧' })
    expect(report.items[0]?.needsReauth).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
