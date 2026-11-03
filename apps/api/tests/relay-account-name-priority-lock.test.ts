// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池统一名「优先级链」行为锁 —— 台账票 O66 第④件(手机号优先,所有平台导入兜底链补 phone)。
 *
 * 与既有 `relay-account-name-phone-first.test.ts` 的分工:那份锁"12 平台同序 + 两面不分叉",
 * 本份锁**票面点名的三条优先级**与**两张键位表的结构不变量**(判据层的表一旦被人改写,
 * 行为测试只会跟着改,钉不住"手机号只许判一遍"这条纪律):
 * 1. qoder 给 `nickname` + `phone` ⇒ 落库名是手机号(phone 在 nickname 之前);
 * 2. 显式 `name` 不被平台合成名(`minimax:cn` / `codex:<id8>` / `#序号`)覆盖 ——
 *    但**手机号仍压过显式 name**(机主令「名称应该都统一为手机号 所有平台都是」;
 *    个人池 `POST /api/account-pool` 的载荷结构上不含 `phone` 键 ⇒ 用户自取名照常生效);
 * 3. trae / workbuddy 无 `name` 时走 `phone`(workbuddy 的官方绑定手机号还住在票内
 *    `preferred_username`,这一格也必须落到手机号)。
 *
 * 测试模式:纯函数 + vi.mock 掉 db / crypto / 签到同步,**绝不连生产库(PG 8810 / Redis 8811)**。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  mockSelectRows: [] as Array<Record<string, unknown>>,
  mockInsertValues: [] as Array<Record<string, unknown>>,
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
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 'row-existing', credVersion: 5 }]),
        }),
      }),
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
  RELAY_ACCOUNT_NAME_KEYS,
  RELAY_ACCOUNT_PHONE_KEYS,
  RELAY_PROVIDERS,
  resolveRelayAccountName,
  type RelayProviderCode,
} from '../src/services/relay-account-format.js'
import {
  importAccounts,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'

const FULL = '19390097993'
const MASK = '193*****993'
const EMAIL = 'someone@example.com'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function fakeJwt(claims: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}.sig`
}
function lastInsert(): Record<string, unknown> {
  const v = hoisted.mockInsertValues.at(-1)
  expect(v, '应有 insert 落库列图').toBeDefined()
  return v!
}

beforeEach(() => {
  hoisted.mockSelectRows = []
  hoisted.mockInsertValues = []
})

// =============================================================================
// 1. 两张键位表的结构不变量(表是判据的真相源,必须先钉住表)
// =============================================================================

describe('键位表不变量:手机号只判一遍、平台特化序不改', () => {
  it('正例:12 个平台的手机号键位表都含顶层 phone(没有任何平台从未看过 phone)', () => {
    for (const provider of RELAY_PROVIDERS as readonly RelayProviderCode[]) {
      const keys = RELAY_ACCOUNT_PHONE_KEYS[provider]
      expect(Array.isArray(keys), `${provider} 手机号键位必须登记`).toBe(true)
      expect(keys, `${provider} 必须含顶层 phone`).toContain('phone')
    }
  })

  it('实证嵌套位只有两格:qoder=user.phone、codearts=account.phone', () => {
    expect(RELAY_ACCOUNT_PHONE_KEYS.qoder).toContain('user.phone')
    expect(RELAY_ACCOUNT_PHONE_KEYS.codearts).toContain('account.phone')
    // 反面对照:没实证的平台不得吃嵌套位(会把"取不到手机号"读成"取到别人的值")
    for (const provider of RELAY_PROVIDERS as readonly RelayProviderCode[]) {
      if (provider === 'qoder' || provider === 'codearts') continue
      const nested = RELAY_ACCOUNT_PHONE_KEYS[provider].filter((k) => k.includes('.'))
      expect(nested, `${provider} 不得出现无实证的嵌套手机号位`).toEqual([])
    }
  })

  it('手机号不得混进"退化名"键位表:NAME_KEYS 任何平台都不含 phone 形态键', () => {
    for (const provider of RELAY_PROVIDERS as readonly RelayProviderCode[]) {
      const leaked = RELAY_ACCOUNT_NAME_KEYS[provider].filter((k) => k.includes('phone'))
      expect(leaked, `${provider} 的退化名链里不该出现手机号键(判两遍必然漂移)`).toEqual([])
    }
  })

  it('qoder 既有优先关系保留:手机号取不到时 nickname 仍压过自带 name', () => {
    expect(RELAY_ACCOUNT_NAME_KEYS.qoder).toEqual(['nickname', 'name'])
    const d = resolveRelayAccountName({
      providerCode: 'qoder',
      payload: { nickname: '昵称8855', name: '自带名', phone: EMAIL },
      index: 0,
    })
    expect(d.name).toBe('昵称8855')
    expect(d.source).toBe('payload-name')
    expect(d.fallback).toBe('phone-not-shape')
  })
})

// =============================================================================
// 2. 优先级链(票面①):phone → 载荷名 → 平台映射名 → #序号
// =============================================================================

describe('resolveRelayAccountName:四档优先级的相对次序', () => {
  it('手机号压过一切显式输入(全号 > 掩码 > 载荷名 > 平台名)', () => {
    const full = resolveRelayAccountName({
      providerCode: 'qoder',
      payload: { phone: FULL, nickname: '昵称', name: '自带名' },
      platformName: 'qoder:xxx',
    })
    expect(full.name).toBe(FULL)
    expect(full.source).toBe('phone')

    // 现码语义(与票面早期措辞「name→phone」不同,以 2026-10-30 收口后的单源为准):
    // 掩码手机号同样压过显式 name —— 统一名的定义是"官方绑定手机号",昵称只是退化档
    const masked = resolveRelayAccountName({
      providerCode: 'trae',
      payload: { phone: MASK, name: '客户端昵称' },
      platformName: '不该被用到',
    })
    expect(masked.name).toBe(MASK)
    expect(masked.source).toBe('phone')
  })

  it('没有手机号时:载荷名 > 平台映射名 > #序号,且每档都带退化归因', () => {
    const withPayloadName = resolveRelayAccountName({
      providerCode: 'minimax',
      payload: { name: '我的运营号' },
      platformName: 'minimax:cn',
      index: 4,
    })
    expect(withPayloadName.name).toBe('我的运营号')
    expect(withPayloadName.source).toBe('payload-name')
    expect(withPayloadName.fallback).toBe('phone-absent')

    const onlyPlatform = resolveRelayAccountName({
      providerCode: 'minimax',
      payload: {},
      platformName: 'minimax:cn',
      index: 4,
    })
    expect(onlyPlatform.name).toBe('minimax:cn')
    expect(onlyPlatform.source).toBe('platform-name')

    const seq = resolveRelayAccountName({ providerCode: 'minimax', payload: {}, index: 4 })
    expect(seq.name).toBe('#5')
    expect(seq.source).toBe('sequence')
    // 归因说明绝不回显候选原值(PII)
    expect(seq.fallbackReason).not.toContain(FULL)
  })
})

// =============================================================================
// 3. 入库面(票面④点名的三格)
// =============================================================================

describe('importAccounts:落库名 = 统一名(手机号优先)', () => {
  it('workbuddy 无 name、载荷带 phone ⇒ 落库名是手机号(票面点名的补兜底平台之一)', async () => {
    const r = await importAccounts('workbuddy', [
      { token: fakeJwt({ sub: 'wb-1', exp: 4e9 }), phone: FULL } as ImportAccountInput,
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe(FULL)
    expect(r.items[0]!.nameSource).toBe('phone')
    expect(r.items[0]!.nameFallback).toBeNull()
  })

  it('workbuddy 只有 name、票内 preferred_username 是手机号 ⇒ 仍落手机号(官方绑定号权威)', async () => {
    const r = await importAccounts('workbuddy', [
      {
        name: '客户端昵称',
        token: fakeJwt({ sub: 'wb-2', preferred_username: FULL, exp: 4e9 }),
      } as ImportAccountInput,
    ])
    expect(lastInsert()['name']).toBe(FULL)
    expect(r.items[0]!.nameSource).toBe('phone')
  })

  it('trae 无 name、带 phone ⇒ 落库名是手机号(票面点名的补兜底平台之一)', async () => {
    await importAccounts('trae', [
      { token: fakeJwt({ data: { id: 'trae-1' }, exp: 4e9 }), phone: FULL } as ImportAccountInput,
    ])
    expect(lastInsert()['name']).toBe(FULL)
  })

  it('qoder:nickname + phone ⇒ 手机号;无 phone ⇒ nickname;两者皆缺 ⇒ #序号', async () => {
    await importAccounts('qoder', [
      {
        token: 'dt-both',
        uid: 'q-1',
        nickname: '昵称8855',
        name: '自带名',
        phone: FULL,
      } as ImportAccountInput,
    ])
    expect(lastInsert()['name']).toBe(FULL)

    await importAccounts('qoder', [
      { token: 'dt-nick', uid: 'q-2', nickname: '昵称8855' } as ImportAccountInput,
    ])
    expect(lastInsert()['name']).toBe('昵称8855')

    await importAccounts('qoder', [{ token: 'dt-none', uid: 'q-3' } as ImportAccountInput])
    expect(lastInsert()['name']).toBe('#1')
  })

  it('显式 name 不被平台合成名覆盖(运营池无手机号那一档);个人池用户自取名同样不改', async () => {
    const ops = await importAccounts('minimax', [
      { accessToken: 'mm-ops', region: 'cn', name: '我的运营号' } as ImportAccountInput,
    ])
    expect(ops.items[0]!.nameSource).toBe('payload-name')
    expect(lastInsert()['name']).toBe('我的运营号')

    hoisted.mockInsertValues = []
    await importAccounts(
      'trae',
      [{ name: '我自己起的名字', token: fakeJwt({ data: { id: 'trae-9' }, exp: 4e9 }) }],
      'user-1',
    )
    expect(lastInsert()['name']).toBe('我自己起的名字')
  })

  it('现码语义(与票面取舍的边界,docs §5 第 8 条):个人池的票内含手机号时统一名同样取手机号', async () => {
    // 判据层不按 ownerUserId 分档 —— 这一格钉住"现状",不是给它背书:
    // 若机主要求"个人池一律保住自取名",改法在 importAccounts 里对 ownerUserId!==null
    // 不喂 extraPhoneCandidates(本票未擅改行为,只如实钉住并交主席裁定)。
    const r = await importAccounts(
      'trae',
      [
        {
          name: '我自己起的名字',
          token: fakeJwt({ data: { id: 'trae-10' }, preferred_username: FULL, exp: 4e9 }),
        },
      ],
      'user-1',
    )
    expect(lastInsert()['name']).toBe(FULL)
    expect(r.items[0]!.nameSource).toBe('phone')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
