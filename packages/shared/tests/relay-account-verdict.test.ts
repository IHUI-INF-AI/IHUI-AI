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
  RELAY_ACCOUNT_REAUTH_ACTION,
  RELAY_ACCOUNT_VERDICT_ACTION,
  RELAY_ACCOUNT_VERDICT_KINDS,
  relayAccountIdleDays,
  relayAccountRemainingDays,
  resolveRelayAccountReauth,
  resolveRelayAccountVerdict,
  summarizeRelayAccountReauth,
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

describe('resolveRelayAccountReauth（必须人工处理的五类原因）', () => {
  const AUTH_REJECTED = {
    ok: false,
    action: 'claim',
    code: '1001',
    message: 'not able to authenticate you',
    classifiedErrorType: 'BusinessError',
  }

  it('account_down：down 或 tempUnschedulable 都算，且不受健康文案掩盖', () => {
    expect(
      resolveRelayAccountReauth(
        { providerCode: 'opencode', tokenExpiryMs: null, healthStatus: 'down' },
        NOW,
      ),
    ).toMatchObject({ needsReauth: true, reason: 'account_down' })
    expect(
      resolveRelayAccountReauth(
        { providerCode: 'trae', tokenExpiryMs: null, tempUnschedulable: true },
        NOW,
      ),
    ).toMatchObject({ needsReauth: true, reason: 'account_down' })
  })

  it('expired_no_refresh：minimax 到期且适配器无 refresh；healthStatus=healthy 也不能掩盖', () => {
    const r = resolveRelayAccountReauth(
      {
        providerCode: 'minimax',
        tokenExpiryMs: NOW - DAY,
        hasRefreshToken: true,
        refreshSupported: false,
        healthStatus: 'healthy',
      },
      NOW,
    )
    expect(r).toMatchObject({ needsReauth: true, reason: 'expired_no_refresh' })
    expect(r.reasons).toEqual(['expired_no_refresh'])
  })

  it('claim_failed：trae 1001/BusinessError 认证拒绝', () => {
    expect(
      resolveRelayAccountReauth(
        { providerCode: 'trae', tokenExpiryMs: NOW + DAY, lastCheckin: AUTH_REJECTED },
        NOW,
      ),
    ).toMatchObject({ needsReauth: true, reason: 'claim_failed' })
  })

  it('invalid_cookie_decrypt 与 credential_expired 不混：publish_cookie 才叫 cookie 解密失败', () => {
    expect(
      resolveRelayAccountReauth(
        {
          providerCode: 'wechat',
          tokenExpiryMs: null,
          source: 'publish_cookie',
          lastErrorKind: 'expired',
          lastError: '凭证无法解密(InvalidTag),需重新扫码录入该账号',
        },
        NOW,
      ),
    ).toMatchObject({ needsReauth: true, reason: 'invalid_cookie_decrypt' })

    expect(
      resolveRelayAccountReauth(
        {
          providerCode: 'checkin',
          tokenExpiryMs: null,
          source: 'checkin',
          lastErrorKind: 'expired',
          lastError: '签到凭证无法解密(ValueError: JWT 密文解密失败),需重新录入',
        },
        NOW,
      ),
    ).toMatchObject({ needsReauth: true, reason: 'credential_expired' })
  })

  it('反向：正常 skip / 9095 幂等 / qoder 无活动 / 网络限流风控 / 健康无引擎账号，一律不标', () => {
    const negatives = [
      {
        providerCode: 'qoder',
        tokenExpiryMs: NOW + DAY,
        lastCheckin: { ok: true, action: 'skip_already' },
      },
      {
        providerCode: 'trae',
        tokenExpiryMs: NOW + DAY,
        lastCheckin: { ok: false, action: 'claim', code: '9095', message: '当前设备今日已经签到' },
      },
      {
        providerCode: 'qoder',
        tokenExpiryMs: NOW + DAY,
        lastCheckin: {
          ok: false,
          action: 'claim',
          code: '1005',
          message: '活动未下发或已结束(等下一轮)',
        },
      },
      {
        providerCode: 'trae',
        tokenExpiryMs: NOW + DAY,
        lastCheckin: {
          ok: false,
          action: 'claim',
          message: 'fetch failed',
          classifiedErrorType: 'Unknown',
        },
      },
      {
        providerCode: 'trae',
        tokenExpiryMs: NOW + DAY,
        lastCheckin: {
          ok: false,
          action: 'claim',
          message: '429',
          classifiedErrorType: 'SoftRate',
        },
      },
      {
        providerCode: 'trae',
        tokenExpiryMs: NOW + DAY,
        lastCheckin: {
          ok: false,
          action: 'claim',
          message: '403',
          classifiedErrorType: 'Challenge',
        },
      },
      { providerCode: 'doubao', tokenExpiryMs: null, healthStatus: 'healthy', lastCheckin: null },
      {
        providerCode: 'publish_token',
        tokenExpiryMs: null,
        source: 'publish_token',
        lastErrorKind: 'unsupported',
      },
      {
        providerCode: 'publish_cookie',
        tokenExpiryMs: null,
        source: 'publish_cookie',
        lastErrorKind: 'skipped',
      },
    ]
    for (const input of negatives) {
      expect(resolveRelayAccountReauth(input, NOW)).toEqual({
        needsReauth: false,
        reason: null,
        reasons: [],
        detail: null,
        nextAction: null,
      })
    }
  })

  it('down 覆盖 claim_failed：主原因 account_down，证据 reasons 不丢', () => {
    const r = resolveRelayAccountReauth(
      {
        providerCode: 'trae',
        tokenExpiryMs: NOW - DAY,
        hasRefreshToken: true,
        refreshSupported: true,
        healthStatus: 'down',
        tempUnschedulable: true,
        lastCheckin: AUTH_REJECTED,
      },
      NOW,
    )
    expect(r.needsReauth).toBe(true)
    expect(r.reason).toBe('account_down')
    expect(r.reasons).toEqual(['account_down', 'claim_failed'])
  })

  it('多原因按优先级折叠：非 down 的到期无续期压过 claim_failed', () => {
    const r = resolveRelayAccountReauth(
      {
        providerCode: 'minimax',
        tokenExpiryMs: NOW - DAY,
        hasRefreshToken: true,
        refreshSupported: false,
        lastCheckin: AUTH_REJECTED,
      },
      NOW,
    )
    expect(r.reason).toBe('expired_no_refresh')
    expect(r.reasons).toEqual(['expired_no_refresh', 'claim_failed'])
  })

  it('五类枚举与下一步文案表同源，且文案非空', () => {
    expect(Object.keys(RELAY_ACCOUNT_REAUTH_ACTION).sort()).toEqual(
      [
        'account_down',
        'claim_failed',
        'credential_expired',
        'expired_no_refresh',
        'invalid_cookie_decrypt',
      ].sort(),
    )
    for (const action of Object.values(RELAY_ACCOUNT_REAUTH_ACTION)) {
      expect(action.trim().length).toBeGreaterThan(4)
    }
  })
})

describe('summarizeRelayAccountReauth（provider × reason 计数）', () => {
  it('只统计 needsReauth=true，每账号按主原因计一次', () => {
    const counts = summarizeRelayAccountReauth([
      { providerCode: 'trae', needsReauth: true, reason: 'claim_failed' },
      { providerCode: 'trae', needsReauth: true, reason: 'account_down' },
      { providerCode: 'minimax', needsReauth: true, reason: 'expired_no_refresh' },
      { providerCode: 'minimax', needsReauth: false, reason: null },
      { providerCode: 'doubao', needsReauth: false, reason: null },
    ])
    expect(counts).toEqual({
      total: 3,
      byProvider: { trae: 2, minimax: 1 },
      byReason: { claim_failed: 1, account_down: 1, expired_no_refresh: 1 },
      byProviderReason: {
        trae: { claim_failed: 1, account_down: 1 },
        minimax: { expired_no_refresh: 1 },
      },
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
