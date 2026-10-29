// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池统一名(手机号优先)单测 —— 台账票 O66「所有平台导入兜底链补 phone」。
 *
 * 立因(2026-10-30 现读):O66 的 ①② 两件只落了 12 平台里的 3 个 —— 预检链给
 * qoder/trae/workbuddy 探了 `phone`,入库链只有 qoder(经 mapQoderImport)与
 * workbuddy(经票内 preferred_username)探得到手机号,余下 9 个平台(codearts/codex/
 * opencode/minimax/zcode/loomy/doubao/lingma/grokbot)**从未看过 `phone` 这个键**,
 * 落库名退成 `minimax:cn` / `codex:<id8>` / `#序号` 这类合成名。且预检与入库是两份
 * 各写各的链(同一枚号报告里是手机号、库里是合成名)。
 *
 * 本套件钉四件事:
 * 1. 判据单源 `resolveRelayAccountName` 对 **12 平台同序**(phone → 载荷名 → 平台名 → #序号);
 * 2. 退化必须可归因(nameSource / nameFallback / nameFallbackReason),不许静默;
 * 3. PII:非法手机号候选**不入名**、且归因说明**永不含候选原值**;
 * 4. 两个面不再分叉:同一载荷下预检报出的名 == 入库写下的名。
 *
 * 测试模式:纯函数零 IO;入库面 vi.mock 掉 db / crypto / 签到同步
 * (对齐 relay-account-import-preserve-refresh.test.ts),**绝不连真库**。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  mockSelectRows: [] as Array<Record<string, unknown>>,
  mockInsertValues: [] as Array<Record<string, unknown>>,
  mockUpdateSet: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(hoisted.mockSelectRows) }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        hoisted.mockInsertValues.push(v)
        return { returning: () => Promise.resolve([{ id: 'row-new', credVersion: 1 }]) }
      },
    }),
    update: () => ({
      set: (s: Record<string, unknown>) => {
        hoisted.mockUpdateSet.push(s)
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 'row-existing', credVersion: 5 }]),
          }),
        }
      },
    }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
  dbClient: {},
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

vi.mock('../src/services/relay-account-pool-checkin-sync.js', () => ({
  buildPoolSyncAccount: (x: unknown) => x,
  checkinPlatformFor: () => null,
  extractCosy: () => null,
  pushPoolSync: async () => ({
    ok: true,
    pushed: 0,
    skipped: 1,
    pending: 0,
    error: null,
    failedIds: [] as number[],
  }),
  markCheckinSyncPending: async () => {},
}))

import {
  RELAY_PROVIDERS,
  resolveRelayAccountName,
  validateAccountExport,
  type RelayProviderCode,
} from '../src/services/relay-account-format.js'
import {
  importAccounts,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'

const FULL = '15330637579'
const MASK = '153****7579'
const EMAIL = 'someone@example.com'
const NOW = new Date('2026-10-30T00:00:00Z')

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function fakeJwt(claims: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}.sig`
}
/** 取最近一次 insert 的列图 */
function lastInsert(): Record<string, unknown> {
  const v = hoisted.mockInsertValues.at(-1)
  expect(v, '应有 insert 落库列图').toBeDefined()
  return v!
}

beforeEach(() => {
  hoisted.mockSelectRows = []
  hoisted.mockInsertValues = []
  hoisted.mockUpdateSet = []
})

// =============================================================================
// 1. 判据单源:正反成对
// =============================================================================

describe('resolveRelayAccountName:手机号优先与退化归因(判据单源)', () => {
  it('正例①:有 phone ⇒ 采全号,source=phone,无退化归因', () => {
    const d = resolveRelayAccountName({
      providerCode: 'minimax',
      payload: { phone: FULL, name: '我的号' },
      platformName: 'minimax:cn',
    })
    expect(d).toEqual({ name: FULL, source: 'phone', fallback: null, fallbackReason: null })
  })

  it('反例①:无 phone ⇒ 退化到载荷自带名,且归因点名 phone-absent(不得静默)', () => {
    const d = resolveRelayAccountName({
      providerCode: 'minimax',
      payload: { name: '我的号' },
      platformName: 'minimax:cn',
      index: 0,
    })
    expect(d.name).toBe('我的号')
    expect(d.source).toBe('payload-name')
    expect(d.fallback).toBe('phone-absent')
    expect(d.fallbackReason).toContain('phone-absent')
    expect(d.fallbackReason).toContain('退化为载荷自带名')
  })

  it('反例②(PII):phone 不是手机号形态 ⇒ 不入名,且归因里不含候选原值', () => {
    const d = resolveRelayAccountName({
      providerCode: 'trae',
      payload: { phone: EMAIL, name: '保留名' },
      index: 3,
    })
    // 邮箱形态的 phone 绝不成为统一名(改前 trae 会把邮箱原样当名字用)
    expect(d.name).toBe('保留名')
    expect(d.source).toBe('payload-name')
    expect(d.fallback).toBe('phone-not-shape')
    // 归因只报码与去向,绝不回显号码/候选原文
    expect(d.fallbackReason).toContain('phone-not-shape')
    expect(d.fallbackReason).not.toContain(EMAIL)
    expect(d.fallbackReason).not.toContain('someone')
  })

  it('掩码手机号仍采信(上游只下发脱敏号);全号优先于掩码', () => {
    const masked = resolveRelayAccountName({ providerCode: 'trae', payload: { phone: MASK } })
    expect(masked.name).toBe(MASK)
    expect(masked.source).toBe('phone')

    const both = resolveRelayAccountName({
      providerCode: 'trae',
      payload: { phone: MASK },
      extraPhoneCandidates: [FULL],
    })
    expect(both.name).toBe(FULL)
    expect(both.source).toBe('phone')
  })

  it('票内手机号候选(preferred_username 那类)同样走单源形态判据;非手机号形态不采信', () => {
    const ok = resolveRelayAccountName({
      providerCode: 'trae',
      payload: { name: '客户端昵称' },
      extraPhoneCandidates: [FULL],
    })
    expect(ok.name).toBe(FULL)
    expect(ok.source).toBe('phone')

    const bad = resolveRelayAccountName({
      providerCode: 'trae',
      payload: { name: '客户端昵称' },
      extraPhoneCandidates: [EMAIL, '', null, undefined],
    })
    expect(bad.name).toBe('客户端昵称')
    expect(bad.fallback).toBe('phone-not-shape')
  })

  it('三层皆空 ⇒ #序号(0-based 行号),退化归因仍在', () => {
    const d = resolveRelayAccountName({ providerCode: 'zcode', payload: {}, index: 2 })
    expect(d.name).toBe('#3')
    expect(d.source).toBe('sequence')
    expect(d.fallback).toBe('phone-absent')
    expect(d.fallbackReason).toContain('退化为#序号')
  })

  it('嵌套键位按实证开放:qoder 认 user.phone;没实证的平台不吃嵌套位', () => {
    const qoder = resolveRelayAccountName({
      providerCode: 'qoder',
      payload: { user: { phone: FULL }, nickname: 'nn', name: 'nm' },
    })
    expect(qoder.name).toBe(FULL)
    expect(qoder.source).toBe('phone')

    // minimax 没登记嵌套手机号位(无实证)⇒ 不得把别人的字段当手机号
    const minimax = resolveRelayAccountName({
      providerCode: 'minimax',
      payload: { user: { phone: FULL }, name: 'nm' },
    })
    expect(minimax.name).toBe('nm')
    expect(minimax.fallback).toBe('phone-absent')
  })

  it('昵称仍压过载荷自带名(qoder 既有优先关系不改),但手机号压过昵称', () => {
    const nick = resolveRelayAccountName({
      providerCode: 'qoder',
      payload: { nickname: '昵称', name: '自带名' },
    })
    expect(nick.name).toBe('昵称')
    expect(nick.source).toBe('payload-name')

    const phone = resolveRelayAccountName({
      providerCode: 'qoder',
      payload: { nickname: '昵称', name: '自带名', phone: FULL },
    })
    expect(phone.name).toBe(FULL)
  })

  it('超 128 字符截断到入库列宽,不炸列', () => {
    const longName = 'x'.repeat(300)
    const d = resolveRelayAccountName({ providerCode: 'trae', payload: { name: longName } })
    expect(d.name).toHaveLength(128)
  })

  it('全平台同形:12 个平台给 phone 都出手机号,给掩码也都出手机号(不留半套)', () => {
    for (const provider of RELAY_PROVIDERS as readonly RelayProviderCode[]) {
      const full = resolveRelayAccountName({ providerCode: provider, payload: { phone: FULL } })
      expect(full.name, `${provider} 全号`).toBe(FULL)
      expect(full.source, `${provider} 全号来源`).toBe('phone')

      const masked = resolveRelayAccountName({ providerCode: provider, payload: { phone: MASK } })
      expect(masked.name, `${provider} 掩码`).toBe(MASK)

      // 反面对照:同平台不给 phone 必须退化并报出归因(不是静默换名)
      const none = resolveRelayAccountName({
        providerCode: provider,
        payload: { name: '自带名' },
        index: 0,
      })
      expect(none.name, `${provider} 无手机号应退化到自带名`).toBe('自带名')
      expect(none.fallback, `${provider} 退化归因`).toBe('phone-absent')
      expect(none.fallbackReason, `${provider} 退化说明必须给人话`).toBeTruthy()
    }
  })
})

// =============================================================================
// 2. 预检面:统一口径 + 归因三键
// =============================================================================

describe('validateAccountExport:预检名与统一名同源', () => {
  const base = { name: 'trae号', token: fakeJwt({ data: { id: 'u-1' }, exp: 4e9 }) }

  it('此前不探 phone 的八平台预检也认 phone', () => {
    // 载荷形状必须过各平台凭据槽位,否则预检只会报 missing-token
    const payloadOf: Record<string, Record<string, unknown>> = {
      codearts: {
        securitytoken: 'sts-1',
        accessKey: 'AK1',
        secretKey: 'SK1',
        name: 'ca-name',
        phone: FULL,
      },
      codex: { tokens: { access_token: 'cx-1', account_id: 'acct-9' }, name: 'cx', phone: FULL },
      opencode: { auth: { key: 'oc-1' }, providerID: 'anthropic', name: 'oc', phone: FULL },
      minimax: { accessToken: 'mm-1', name: 'mm', phone: FULL },
      zcode: { 'oauth:bigmodel:access_token': 'zc-1', name: 'zc', phone: FULL },
      loomy: { value: 'lm-1', key: 'loomy-session', name: 'lm', phone: FULL },
      doubao: { value: 'db-1', key: 'session_token', name: 'db', phone: FULL },
      lingma: { token: 'lg-1', name: 'lg', phone: FULL },
    }
    for (const [provider, row] of Object.entries(payloadOf)) {
      const r = validateAccountExport(
        { accounts: [row] },
        { providerCode: provider as RelayProviderCode, now: NOW },
      )
      const a = r.accounts[0]!
      expect(a.name, `${provider} 预检名应是手机号`).toBe(FULL)
      expect(a.nameSource).toBe('phone')
      expect(a.nameFallback).toBeNull()
    }
  })

  it('无 phone ⇒ 预检同样带归因三键(正面对照:退化不是静默)', () => {
    const r = validateAccountExport({ accounts: [base] }, { providerCode: 'trae', now: NOW })
    const a = r.accounts[0]!
    expect(a.name).toBe('trae号')
    expect(a.nameSource).toBe('payload-name')
    expect(a.nameFallback).toBe('phone-absent')
    expect(a.nameFallbackReason).toContain('phone-absent')
  })

  it('非对象条目也带退化归因(不因形状坏就不报名来源)', () => {
    const r = validateAccountExport({ accounts: ['坏条目'] }, { providerCode: 'trae', now: NOW })
    expect(r.accounts[0]!.name).toBe('#1')
    expect(r.accounts[0]!.nameSource).toBe('sequence')
    expect(r.accounts[0]!.nameFallbackReason).toBeTruthy()
  })
})

// =============================================================================
// 3. 入库面:改前拿不到手机号的两族实测补上
// =============================================================================

describe('importAccounts:入库名 = 统一名(手机号优先)', () => {
  it('MiniMax 带 phone ⇒ 落库名是手机号(改前恒为合成名 minimax:cn,同区域全部同名)', async () => {
    const r = await importAccounts('minimax', [
      { accessToken: 'mm-token-1', region: 'cn', name: 'mm', phone: FULL } as ImportAccountInput,
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe(FULL)
    expect(r.items[0]!.nameSource).toBe('phone')
    expect(r.items[0]!.nameFallback).toBeNull()
  })

  it('MiniMax 不带 phone ⇒ 仍落平台映射名,且退化可归因(正反成对)', async () => {
    const r = await importAccounts('minimax', [
      { accessToken: 'mm-token-2', region: 'cn' } as ImportAccountInput,
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe('minimax:cn')
    expect(r.items[0]!.nameSource).toBe('platform-name')
    expect(r.items[0]!.nameFallback).toBe('phone-absent')
    expect(r.items[0]!.nameFallbackReason).toContain('退化为平台映射名')
  })

  it('Trae 带 phone ⇒ 落库名是手机号(改前 trae 的 phone 只进预检报告,库里仍是自带名)', async () => {
    const token = fakeJwt({ data: { id: 'u-trae-1' }, exp: 4e9 })
    const r = await importAccounts('trae', [
      { name: '客户端昵称', token, phone: FULL } as ImportAccountInput,
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe(FULL)
  })

  it('票内 preferred_username 手机号对任意 JWT 平台生效(改前只有 workbuddy 走这一格)', async () => {
    const token = fakeJwt({ data: { id: 'u-trae-2' }, preferred_username: FULL, exp: 4e9 })
    const r = await importAccounts('trae', [{ name: '昵称', token } as ImportAccountInput])
    expect(lastInsert()['name']).toBe(FULL)
    expect(r.items[0]!.nameSource).toBe('phone')
  })

  it('掩码手机号入库即落 extraMetadata.phoneMask 待补全(既有对账链不改)', async () => {
    const r = await importAccounts('trae', [
      {
        token: fakeJwt({ data: { id: 'u-trae-3' }, exp: 4e9 }),
        phone: MASK,
      } as ImportAccountInput,
    ])
    const row = lastInsert()
    expect(row['name']).toBe(MASK)
    expect(r.items[0]!.nameSource).toBe('phone')
    const extra = row['extraMetadata'] as Record<string, unknown>
    expect(extra.phoneMask).toMatchObject({ mask: MASK, prefix: '153', suffix: '7579' })
  })

  it('单源不分叉锁:同一载荷下预检报出的名 == 入库写下的名(逐平台)', async () => {
    const cases: Array<{ provider: RelayProviderCode; row: ImportAccountInput }> = [
      { provider: 'minimax', row: { accessToken: 'x1', region: 'cn', phone: FULL } },
      { provider: 'minimax', row: { accessToken: 'x2', region: 'cn', name: '自带名' } },
      {
        provider: 'trae',
        row: { name: '自带名', token: fakeJwt({ data: { id: 'x' }, exp: 4e9 }) },
      },
      {
        provider: 'trae',
        row: {
          name: '自带名',
          token: fakeJwt({ data: { id: 'x' }, exp: 4e9 }),
          phone: EMAIL,
        },
      },
    ]
    for (const { provider, row } of cases) {
      hoisted.mockInsertValues = []
      const imported = await importAccounts(provider, [row])
      const pre = validateAccountExport({ accounts: [row] }, { providerCode: provider, now: NOW })
      expect(imported.items[0]!.name, `${provider} 两面名必须同源`).toBe(pre.accounts[0]!.name)
      expect(imported.items[0]!.nameSource, `${provider} 两面来源必须同源`).toBe(
        pre.accounts[0]!.nameSource,
      )
      expect(imported.items[0]!.nameFallback, `${provider} 两面退化必须同源`).toBe(
        pre.accounts[0]!.nameFallback,
      )
    }
  })

  it('覆盖导入 preserve 档:带 phone 要更新 name 列;退化到 #序号 不得抹掉库里既有统一名', async () => {
    hoisted.mockSelectRows = [{ id: 'row-existing', hasRefreshToken: true, secretsEnc: null }]
    const token = fakeJwt({ data: { id: 'u-pv' }, exp: 4e9 })
    // 正面:重登只换 access,但载荷给了手机号 ⇒ name 列必须带过去
    await importAccounts('trae', [{ token, phone: FULL } as ImportAccountInput], null, {
      preserveMissingRefresh: true,
    })
    const withPhone = hoisted.mockUpdateSet.find((s) => 'name' in s)
    expect(withPhone, 'preserve 档带手机号必须写 name 列').toBeDefined()
    expect(withPhone!['name']).toBe(FULL)

    // 反面:既没带 phone 也没带 name ⇒ 统一名退化成 #序号,绝不能覆盖库里已有的名
    hoisted.mockUpdateSet = []
    await importAccounts('trae', [{ token } as ImportAccountInput], null, {
      preserveMissingRefresh: true,
    })
    expect(hoisted.mockUpdateSet.some((s) => 'name' in s)).toBe(false)
  })

  it('个人池语义不改:载荷没有 phone 时用户自取名原样入库(POST /api/account-pool 那一型)', async () => {
    const token = fakeJwt({ data: { id: 'u-personal' }, exp: 4e9 })
    await importAccounts('trae', [{ name: '我自己的号', token } as ImportAccountInput], 'user-1')
    expect(lastInsert()['name']).toBe('我自己的号')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
