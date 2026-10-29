// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号导入格式纯函数 + 预检单测(2026-10-23 立)。
 * 零 IO / 零 DB:只测 relay-account-format.ts 的判据,与服务端导入共用同一实现。
 */
import { describe, it, expect } from 'vitest'
import {
  buildCookieHeader,
  earliestCookieExpiry,
  extractTenantId,
  extractTokenExpiry,
  extractUid,
  parseJwtClaims,
  toImportRequestBody,
  validateAccountExport,
  webkitEpochToUnixMs,
} from '../src/services/relay-account-format.js'

const NOW = new Date('2026-10-23T00:00:00.000Z')

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const FUTURE = Math.floor(new Date('2026-11-01T00:00:00.000Z').getTime() / 1000)
const EXPIRED = Math.floor(new Date('2026-10-22T00:00:00.000Z').getTime() / 1000)

function account(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '账号501',
    token: jwt({ data: { id: '501', tenant_id: 'tenant-x' }, exp: FUTURE }),
    refreshToken: 'rt-501',
    enabled: true,
    cookies: [
      { name: 'd_ticket', value: 'v1', expires_utc: 13467354232000000 },
      { name: 'session', value: 'v2', expires_utc: 0 },
    ],
    ...overrides,
  }
}

describe('JWT / Cookie 纯解析', () => {
  it('parseJwtClaims 解出 payload;非三段式/坏 base64 → null', () => {
    expect(parseJwtClaims(jwt({ sub: 'u-1', exp: FUTURE }))).toMatchObject({ sub: 'u-1' })
    expect(parseJwtClaims('not-a-jwt')).toBeNull()
    expect(parseJwtClaims('a.%%%.c')).toBeNull()
  })

  it('webkitEpochToUnixMs:微秒换算 / 0 与会话 cookie / 负数', () => {
    expect(new Date(webkitEpochToUnixMs(13467354232000000)!).toISOString()).toBe(
      '2027-10-07T03:43:52.000Z',
    )
    expect(webkitEpochToUnixMs(0)).toBeNull()
    expect(webkitEpochToUnixMs(-1)).toBeNull()
    expect(webkitEpochToUnixMs('13467354232000000')).toBe(
      new Date('2027-10-07T03:43:52.000Z').getTime(),
    )
  })

  it('earliestCookieExpiry 取最早且忽略会话 cookie', () => {
    expect(
      new Date(
        earliestCookieExpiry([
          { expires_utc: 13467354232000000 },
          { expires_utc: 13300000000000000 },
          { expires_utc: 0 },
        ])!,
      ).toISOString(),
    ).toBe(new Date(Math.floor(13300000000000000 / 1000) - 11644473600000).toISOString())
    expect(earliestCookieExpiry([{ expires_utc: 0 }])).toBeNull()
  })

  it('extractUid 优先级 data.id → sub → uid → data.user_id → 哈希兜底', () => {
    expect(extractUid(jwt({ data: { id: 'd-id' }, sub: 's' }))).toBe('d-id')
    expect(extractUid(jwt({ sub: 's' }))).toBe('s')
    expect(extractUid(jwt({ uid: 'u' }))).toBe('u')
    expect(extractUid(jwt({ data: { user_id: 42 } }))).toBe('42')
    const hashed = extractUid('opaque-token')
    expect(hashed).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(extractUid('opaque-token')).toBe(hashed)
  })

  it('extractTokenExpiry / extractTenantId', () => {
    const token = jwt({ exp: FUTURE, data: { tenant_id: 't-1' } })
    expect(extractTokenExpiry(token)?.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(extractTenantId(token)).toBe('t-1')
    expect(extractTokenExpiry('opaque')).toBeNull()
    expect(extractTenantId('opaque')).toBeNull()
  })

  it('buildCookieHeader 跳过缺 name/value 的条目', () => {
    expect(
      buildCookieHeader([
        { name: 'a', value: '1' },
        { name: 'b' },
        { value: '2' },
        { name: 'c', value: '3' },
      ]),
    ).toBe('a=1; c=3')
  })
})

describe('validateAccountExport', () => {
  it('合法批次:结构通过,过期号只给警告', () => {
    const report = validateAccountExport(
      {
        accounts: [
          account(),
          account({ name: '账号502', token: jwt({ data: { id: '502' }, exp: EXPIRED }) }),
        ],
      },
      { providerCode: 'trae', now: NOW },
    )
    expect(report.ok).toBe(true)
    expect(report.total).toBe(2)
    expect(report.valid).toBe(2)
    expect(report.invalid).toBe(0)
    expect(report.expired).toBe(1)
    expect(report.accounts[0]?.uid).toBe('501')
    expect(report.accounts[0]?.tokenExpiresAt).toBe('2026-11-01T00:00:00.000Z')
    expect(report.accounts[0]?.cookieCount).toBe(2)
    expect(report.accounts[1]?.issues.map((i) => i.code)).toContain('token-expired')
  })

  it('裸数组也认;空批次/错误顶层结构 → 文件级 error', () => {
    const ok = validateAccountExport([account()], { providerCode: 'trae', now: NOW })
    expect(ok.ok).toBe(true)
    expect(ok.total).toBe(1)

    const empty = validateAccountExport({ accounts: [] }, { providerCode: 'trae', now: NOW })
    expect(empty.ok).toBe(false)
    expect(empty.issues[0]?.code).toBe('empty-accounts')

    const bad = validateAccountExport({ rows: [] }, { providerCode: 'trae', now: NOW })
    expect(bad.ok).toBe(false)
    expect(bad.issues[0]?.code).toBe('top-level-shape')
  })

  it('name 缺省时 phone 是全平台统一兜底位(O66:trae/workbuddy 也认 phone)', () => {
    for (const provider of ['trae', 'workbuddy'] as const) {
      const r = validateAccountExport(
        { accounts: [account({ name: undefined, phone: '15330637579' })] },
        { providerCode: provider, now: NOW },
      )
      expect(r.ok).toBe(true)
      expect(r.accounts[0]!.name).toBe('15330637579')
    }
  })

  it('显式 name 恒最优先;qoder 同给 nickname+phone 时 phone 胜(O66)', () => {
    const r = validateAccountExport(
      {
        accounts: [
          account({ name: 'nm', phone: '15330637579' }),
          account({ name: undefined, nickname: 'nn', phone: '15330637579' }),
        ],
      },
      { providerCode: 'qoder', now: NOW },
    )
    expect(r.ok).toBe(true)
    expect(r.accounts[0]!.name).toBe('nm')
    expect(r.accounts[1]!.name).toBe('15330637579')
  })

  it('trae/workbuddy 缺 token → error;enabled 非布尔 → error', () => {
    const report = validateAccountExport(
      {
        accounts: [{ name: '无token' }, account({ enabled: 'yes' })],
      },
      { providerCode: 'workbuddy', now: NOW },
    )
    expect(report.ok).toBe(false)
    expect(report.invalid).toBe(2)
    const codes = report.accounts.flatMap((a) => a.issues.map((i) => i.code))
    expect(codes).toContain('missing-token')
    expect(codes).toContain('enabled-invalid')
  })

  it('WorkBuddy 长 refreshToken(实测 700)必须通过;超过 4096 才拦', () => {
    const ok = validateAccountExport(
      { accounts: [account({ refreshToken: 'r'.repeat(700) })] },
      { providerCode: 'workbuddy', now: NOW },
    )
    expect(ok.ok).toBe(true)

    const tooLong = validateAccountExport(
      { accounts: [account({ refreshToken: 'r'.repeat(4097) })] },
      { providerCode: 'workbuddy', now: NOW },
    )
    expect(tooLong.ok).toBe(false)
    expect(tooLong.accounts[0]?.issues.map((i) => i.code)).toContain('refreshToken-invalid')
  })

  it('codearts:缺 STS → error;完整两套导出格式都能解出 uid/到期', () => {
    const missing = validateAccountExport(
      { accounts: [{ name: '坏号' }] },
      { providerCode: 'codearts', now: NOW },
    )
    expect(missing.ok).toBe(false)
    expect(missing.accounts[0]?.issues[0]?.code).toBe('codearts-credentials')

    const valid = validateAccountExport(
      {
        accounts: [
          {
            accessKey: 'ak-1',
            secretKey: 'sk-1',
            securitytoken: 'sts-1',
            refresh_token: 'rt-1',
            expires_at: '2026-12-01T00:00:00Z',
            account: { id: 'user-7', label: '小号A' },
          },
          {
            user_id: 'u-8',
            access_key_id: 'ak-2',
            secret_access_key: 'sk-2',
            cloud_dragon_token: 'cdt-2',
            expiration: '2026-11-15T08:00:00Z',
          },
        ],
      },
      { providerCode: 'codearts', now: NOW },
    )
    expect(valid.ok).toBe(true)
    expect(valid.accounts[0]?.uid).toBe('user-7')
    expect(valid.accounts[0]?.name).toBe('小号A')
    expect(valid.accounts[0]?.tokenExpiresAt).toBe('2026-12-01T00:00:00.000Z')
    expect(valid.accounts[1]?.uid).toBe('u-8')
  })

  it('批内重复 uid → 警告并计数', () => {
    const report = validateAccountExport(
      { accounts: [account(), account({ name: '副本' })] },
      { providerCode: 'trae', now: NOW },
    )
    expect(report.ok).toBe(true)
    expect(report.duplicateUids).toBe(1)
    expect(report.accounts[1]?.issues.map((i) => i.code)).toContain('duplicate-uid')
  })

  it('临期 24h 内、缺 refreshToken 的过期号、非 JWT 都给对应警告', () => {
    const soon = Math.floor(new Date('2026-10-23T12:00:00.000Z').getTime() / 1000)
    const report = validateAccountExport(
      {
        accounts: [
          account({ token: jwt({ data: { id: 'a' }, exp: soon }) }),
          account({
            name: '过期无刷新',
            token: jwt({ data: { id: 'b' }, exp: EXPIRED }),
            refreshToken: '',
          }),
          account({ name: '裸令牌', token: 'opaque-token', refreshToken: '' }),
        ],
      },
      { providerCode: 'trae', now: NOW },
    )
    expect(report.ok).toBe(true)
    expect(report.expiringSoon).toBe(1)
    expect(report.expiredWithoutRefresh).toBe(1)
    const codes = report.accounts.flatMap((a) => a.issues.map((i) => i.code))
    expect(codes).toContain('token-expiring-soon')
    expect(codes).toContain('token-not-jwt')
  })

  it('cookies/代理/字段类型:结构错为 error,可疑值只给 warning', () => {
    const report = validateAccountExport(
      {
        accounts: [
          account({ cookies: 'not-array' }),
          account({
            name: '可疑值',
            proxyUrl: 'ftp://proxy',
            cookies: [{ name: 'a' }, { name: 'b', value: '2', expires_utc: 'soon' }],
          }),
        ],
      },
      { providerCode: 'trae', now: NOW },
    )
    expect(report.ok).toBe(false)
    expect(report.invalid).toBe(1)
    const codes = report.accounts.flatMap((a) => a.issues.map((i) => i.code))
    expect(codes).toContain('cookies-invalid')
    expect(codes).toContain('proxy-url-invalid')
    expect(codes).toContain('cookie-name-value')
    expect(codes).toContain('cookie-expires-utc')
  })

  it('strict 档:警告也判不通过', () => {
    const raw = { accounts: [account({ token: jwt({ data: { id: 'x' }, exp: EXPIRED }) })] }
    expect(validateAccountExport(raw, { providerCode: 'trae', now: NOW }).ok).toBe(true)
    expect(validateAccountExport(raw, { providerCode: 'trae', now: NOW, strict: true }).ok).toBe(
      false,
    )
  })

  it('超过单批上限 → error', () => {
    const accounts = Array.from({ length: 501 }, (_, i) =>
      account({ name: `a${i}`, token: jwt({ data: { id: `id-${i}` }, exp: FUTURE }) }),
    )
    const report = validateAccountExport({ accounts }, { providerCode: 'trae', now: NOW })
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.code === 'too-many-accounts')).toBe(true)
  })

  it('toImportRequestBody 包装出接口请求体,不修改原对象', () => {
    const raw = { accounts: [account()] }
    const body = toImportRequestBody(raw, 'trae')
    expect(body.providerCode).toBe('trae')
    expect(body.accounts).toHaveLength(1)
    expect(Object.keys(raw)).toEqual(['accounts'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
