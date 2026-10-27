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
  expireEpochToMs,
  extractTenantId,
  extractTokenExpiry,
  extractUid,
  foreignPassthroughMetadata,
  normalizeForeignAccountShape,
  parseJwtClaims,
  recognizeImportShape,
  toImportRequestBody,
  validateAccountExport,
  webkitEpochToUnixMs,
  type RelayProviderCode,
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

/**
 * 外来格式自适应(2026-10-26 立)。
 * 立因:第三方账号工具(workbuddy-switch 等)的备份是 access_token/refresh_token/
 * expires_at(毫秒)/uid/nickname 这套蛇形字段,而我方契约是 token/refreshToken 驼峰;
 * 判据只认驼峰 ⇒ 别人家的备份拖进来直接判「缺少 token」。判据单源在这份文件,
 * 服务端 importAccounts 与 CLI 预检共用同一函数,这里锁的就是那一份。
 */
describe('expireEpochToMs:秒/毫秒量纲自适应', () => {
  it('10 位 epoch 秒按秒;13 位毫秒按毫秒;字符串数字同判;非正值 null', () => {
    expect(expireEpochToMs(1_795_356_026)).toBe(1_795_356_026_000)
    expect(expireEpochToMs(1_795_356_026_000)).toBe(1_795_356_026_000)
    expect(expireEpochToMs('1795356026')).toBe(1_795_356_026_000)
    expect(expireEpochToMs('1795356026000')).toBe(1_795_356_026_000)
    expect(expireEpochToMs(0)).toBeNull()
    expect(expireEpochToMs(-5)).toBeNull()
    expect(expireEpochToMs('not-a-number')).toBeNull()
    expect(expireEpochToMs(undefined)).toBeNull()
  })

  it('回归:毫秒值不得被当秒放大成公元 5138 年的"永不过期"(临期/保活失明即源于此)', () => {
    const ms = expireEpochToMs(1_795_356_026_000)!
    // 旧实现(裸数字一律 ×1000)会得到 1.79e15 ≈ 58857 年
    expect(new Date(ms).getUTCFullYear()).toBe(2026)
    expect(ms).toBeLessThan(4_102_444_800_000) // 2100 年上限 sanity
  })
})

describe('normalizeForeignAccountShape:第三方备份字段搬运', () => {
  it('我方规范形状原样通过(不加标记、不改字段)', () => {
    const mine = account()
    expect(normalizeForeignAccountShape(mine)).toBe(mine)
  })

  it('裸数组条目(access_token/expires_at 毫秒)→ 补 canonical + foreignShape 标记与 ISO 到期', () => {
    const out = normalizeForeignAccountShape({
      access_token: jwt({ sub: 'u-keycloak', exp: FUTURE }),
      refresh_token: 'rt-k',
      nickname: '192****0269',
      expires_at: 1_795_356_026_000,
    })
    expect(out.foreignShape).toBe(true)
    expect(out.token).toContain('sig')
    expect(out.refreshToken).toBe('rt-k')
    expect(out.name).toBe('192****0269')
    // ISO 串(不是裸毫秒):把量纲归一折在入口,下游通道一律只见 ISO
    expect(typeof out.expiresAt).toBe('string')
    expect(String(out.expiresAt).endsWith('Z')).toBe(true)
  })

  it('uid 别名补位;显式 expiresAt 仅当早于 JWT exp 才采信(保守取早,绝不冒充长效)', () => {
    const late = normalizeForeignAccountShape({
      access_token: jwt({ sub: 'u-1', exp: FUTURE }),
      expires_at: Math.floor(new Date('2027-01-01T00:00:00Z').getTime() / 1000) * 1000,
    })
    // 显式值比 JWT 晚 3 年?不,FUTURE=11-01 < 2027-01,显式更晚 ⇒ 必须取 JWT exp(更早),显式被弃
    expect(new Date(String(late.expiresAt)).getTime()).toBe(FUTURE * 1000)

    const early = normalizeForeignAccountShape({
      access_token: jwt({ sub: 'u-1', exp: FUTURE }),
      expires_at: Math.floor(NOW.getTime()) + 3_600_000, // 一小时内(早于 FUTURE)
    })
    expect(new Date(String(early.expiresAt)).getTime()).toBe(NOW.getTime() + 3_600_000)
  })

  it('没有 token 别名也命中不上 ⇒ 原样返回(不把坏数据伪装成"已归一")', () => {
    const junk = { foo: 'bar' }
    expect(normalizeForeignAccountShape(junk)).toBe(junk)
    expect(normalizeForeignAccountShape(null)).toEqual({})
  })
})

describe('foreignPassthroughMetadata:未知字段原样进档(兑现导入格式文档 §2)', () => {
  it('canonical 与别名集一律不吃;陌生标量/短对象留着,超长值丢掉防爆库', () => {
    const extra = foreignPassthroughMetadata({
      token: 't',
      refreshToken: 'r',
      access_token: 't',
      foreignShape: true,
      payment_type: 'p1',
      dosage_notify_code: '',
      checkin_streak: 3,
      meta: { a: 1 },
      huge: 'x'.repeat(1025),
    })
    expect(extra).toEqual({ payment_type: 'p1', checkin_streak: 3, meta: { a: 1 } })
  })
})

describe('validateAccountExport 吃外来备份形状', () => {
  it('裸数组 + access_token + 毫秒 expires_at:结构通过,到期如实(不是 5138 年)', () => {
    const report = validateAccountExport(
      [
        {
          access_token: jwt({ sub: 'u-keycloak', exp: FUTURE }),
          refresh_token: 'rt-k',
          uid: 'u-keycloak',
          nickname: '手机号账号',
          expires_at: FUTURE * 1000,
        },
      ],
      { providerCode: 'workbuddy', now: NOW },
    )
    expect(report.ok).toBe(true)
    expect(report.valid).toBe(1)
    const acc = report.accounts[0]
    expect(acc.uid).toBe('u-keycloak')
    expect(acc.hasRefreshToken).toBe(true)
    expect(acc.tokenExpiresAt).toBe(new Date(FUTURE * 1000).toISOString())
  })

  it('归一后仍按 canonical 面工作:token 在场 ⇒ 零漂移(既有形状零回归)', () => {
    const report = validateAccountExport(
      { accounts: [account()] },
      { providerCode: 'trae', now: NOW },
    )
    expect(report.ok).toBe(true)
    expect(report.accounts[0].uid).toBe('501')
  })
})

/**
 * 导入形状闸门(2026-10-27 立):Web 拖拽导入与 CLI 导入共用同一份判据。
 *
 * 缺口:路由 Zod 曾硬性要求顶层 `token` ⇒ 12 平台里 10 个平台的原生提取器载荷
 * (codex 的 tokens.access_token / opencode 的 auth.key / minimax 的 accessToken …)
 * 在路由层就被挡掉,Web 拖拽导入全线不可用;而 CLI 直调 importAccounts 不过 Zod ⇒
 * CLI 能导、Web 不能导,两套口径割裂。
 *
 * 修复口径:形状判据单源在 recognizeImportShape(键位表 RELAY_IMPORT_CREDENTIAL_SLOTS),
 * Web 路由闸门 / CLI 预检 / 服务端落库三处共用 ⇒ 口径不可能再分叉。这里锁的就是那一份。
 */
describe('导入形状闸门 recognizeImportShape:Web 路由 / CLI 预检 / 服务端落库同源', () => {
  /** 12 平台代表性原生形状(与路由契约测试同一份键位认知) */
  const NATIVE: Array<[RelayProviderCode, Record<string, unknown>]> = [
    ['trae', { token: 'trae-native' }],
    ['workbuddy', { token: 'wb-native' }],
    ['codearts', { securitytoken: 'sts', accessKey: 'ak', secretKey: 'sk' }],
    ['qoder', { token: 'dt-opaque' }],
    ['codex', { tokens: { access_token: 'codex-at' } }],
    ['opencode', { auth: { type: 'api', key: 'oc-key' } }],
    ['minimax', { accessToken: 'mm-at' }],
    ['zcode', { 'oauth:bigmodel:access_token': 'zc-at' }],
    ['loomy', { source: 's', key: 'k', host: 'h', value: 'loomy-v' }],
    ['doubao', { source: 's', key: 'k', host: 'h', value: 'doubao-v' }],
    ['lingma', { token: 'lingma-native' }],
    ['grokbot', { credential: { sandSealedFile: 1, data: 'sealed' } }],
  ]

  it('11 个平台的原生形状:认得 + 认得出明文凭据(只报键名,不回显值)', () => {
    for (const [providerCode, row] of NATIVE) {
      if (providerCode === 'grokbot') continue
      const v = recognizeImportShape(providerCode, row)
      expect(v.recognized, providerCode).toBe(true)
      expect(v.importable, providerCode).toBe(true)
      expect(v.reason, providerCode).toBeNull()
      expect(v.credentialKeys.length, providerCode).toBeGreaterThan(0)
    }
  })

  it('GrokBot:形状认得(密封串)但没有明文凭据 —— 形状与可导性是两件事', () => {
    const v = recognizeImportShape('grokbot', { credential: { sandSealedFile: 1, data: 'sealed' } })
    expect(v.recognized).toBe(true)
    expect(v.importable).toBe(false)
    expect(v.credential).toBeNull()
    expect(v.reason).toContain('密封')
  })

  it('垃圾形状:认不出 + 点名缺哪个键(绝不静默放过)', () => {
    expect(recognizeImportShape('trae', {}).recognized).toBe(false)
    expect(recognizeImportShape('trae', { foo: 'bar' }).recognized).toBe(false)
    expect(recognizeImportShape('codex', { tokens: {} }).reason).toContain('tokens.access_token')
    expect(recognizeImportShape('codearts', { securitytoken: 'sts' }).reason).toContain('accessKey')
    expect(recognizeImportShape('opencode', { auth: { type: 'api' } }).reason).toContain('key')
  })

  it('口径统一:CLI 预检说能导的,形状闸门必须也认得(不许分叉)', () => {
    for (const [providerCode, row] of NATIVE) {
      const report = validateAccountExport({ accounts: [row] }, { providerCode, now: NOW })
      const shape = recognizeImportShape(providerCode, row)
      if (providerCode === 'grokbot') {
        // 唯一"形状对但导不进去"的平台:预检与落库都必须如实点名,不静默放过
        expect(report.ok, providerCode).toBe(false)
        expect(report.accounts[0]?.issues.map((i) => i.code)).toContain('grokbot-sealed')
        continue
      }
      expect(
        report.ok,
        `${providerCode} 预检未通过:${JSON.stringify(report.accounts[0]?.issues ?? [])}`,
      ).toBe(true)
      expect(shape.importable, providerCode).toBe(true)
    }
  })

  it('外来别名形状(access_token)两处口径一致:预检通过 + 闸门认得', () => {
    const row = { access_token: jwt({ sub: 'u-1', exp: FUTURE }) }
    expect(
      validateAccountExport({ accounts: [row] }, { providerCode: 'workbuddy', now: NOW }).ok,
    ).toBe(true)
    expect(recognizeImportShape('workbuddy', row).importable).toBe(true)
  })

  it('形状与平台不匹配(codex 载荷拖进 trae)→ 预检与闸门都判不通过', () => {
    const row = { tokens: { access_token: 'codex-at' } }
    expect(validateAccountExport({ accounts: [row] }, { providerCode: 'trae', now: NOW }).ok).toBe(
      false,
    )
    expect(recognizeImportShape('trae', row).recognized).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
