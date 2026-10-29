// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 覆盖导入「保留既有 refreshToken」语义单测(2026-10-27 立)。
 *
 * 立因:网页一键重登只能换到 access token(Trae GetUserToken / WorkBuddy cookie
 * 换登录态都不发 refreshToken),而覆盖导入的默认语义是「缺字段即写 NULL」——
 * 两者相遇,一次重登就把能自续的号抹成 expired-dead(救号的动作本身把号弄死)。
 * 本套件钉住:
 * - 纯判据 resolveOverwriteRefresh 四态(单源 relay-account-format,§0.6 不复制)
 * - 服务端 importAccounts 在 preserveMissingRefresh 下 update 不写 refresh_token_enc
 *   列;缺省时保持存量语义(refreshTokenEnc=null),不让普通导入静默变成删不掉。
 * - secretsEnc 单列合并(2026-10-27 加):只带凭证的导入不得抹掉既有会话模板/设备材料,
 *   带模板的导入也不得丢掉既有设备材料(同列共存,整列覆盖会互相踩踏)。
 *
 * 测试模式:vi.mock 掉 db / crypto / 签到同步(对齐 relay-qoder-import.test.ts),零真实 IO。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  mockSelectRows: [] as Array<Record<string, unknown>>,
  mockUpdateSet: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(hoisted.mockSelectRows) }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 'row-new', credVersion: 1 }]),
      }),
    }),
    update: () => ({
      set: (set: unknown) => {
        hoisted.mockUpdateSet(set)
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
  checkinPlatformFor: (p: string) => (p === 'trae' ? 'trae' : null),
  extractCosy: () => null,
  pushPoolSync: async () => ({
    ok: true,
    pushed: 1,
    skipped: 0,
    pending: 0,
    error: null,
    failedIds: [] as number[],
  }),
  markCheckinSyncPending: async () => {},
}))

import { importAccounts } from '../src/services/relay-account-pool-service.js'
import { resolveOverwriteRefresh } from '../src/services/relay-account-format.js'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const FUTURE = Math.floor(Date.UTC(2027, 0, 1) / 1000)

beforeEach(() => {
  hoisted.mockUpdateSet.mockClear()
  hoisted.mockSelectRows.length = 0
})

function lastUpdateSet(): Record<string, unknown> {
  expect(hoisted.mockUpdateSet).toHaveBeenCalled()
  return hoisted.mockUpdateSet.mock.calls.at(-1)![0] as Record<string, unknown>
}

describe('resolveOverwriteRefresh 纯判据四态', () => {
  it('显式新票永远覆盖(显式输入优先,无保留余地)', () => {
    const d = resolveOverwriteRefresh({
      providerCode: 'trae',
      incomingRefreshToken: 'rt-new',
      existingHasRefreshToken: true,
      preserveMissingRefresh: true,
    })
    expect(d.preserve).toBe(false)
    expect(d.note).toBeNull()
  })

  it('未带新票 + 开关关 ⇒ 不保留(存量导入语义不变)', () => {
    const d = resolveOverwriteRefresh({
      providerCode: 'trae',
      incomingRefreshToken: null,
      existingHasRefreshToken: true,
      preserveMissingRefresh: false,
    })
    expect(d.preserve).toBe(false)
  })

  it('未带新票 + 开关开 + 库内有票 ⇒ 保留并给人话说明', () => {
    const d = resolveOverwriteRefresh({
      providerCode: 'trae',
      incomingRefreshToken: null,
      existingHasRefreshToken: true,
      preserveMissingRefresh: true,
    })
    expect(d.preserve).toBe(true)
    expect(d.note).toContain('trae')
    expect(d.note).toContain('保留库内原票')
  })

  it('未带新票 + 开关开 + 库内无票 ⇒ 不保留(没票可保,诚实写 NULL)', () => {
    const d = resolveOverwriteRefresh({
      providerCode: 'trae',
      incomingRefreshToken: null,
      existingHasRefreshToken: false,
      preserveMissingRefresh: true,
    })
    expect(d.preserve).toBe(false)
    expect(d.note).toBeNull()
  })
})

describe('importAccounts preserveMissingRefresh 服务端行为', () => {
  it('覆盖 + preserve:不写 refreshTokenEnc 列,reason 点名保留原票', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    const r = await importAccounts(
      'trae',
      [{ name: '账号A', token: jwt({ sub: 'u1', exp: FUTURE }) }],
      null,
      { preserveMissingRefresh: true },
    )
    expect(r.updated).toBe(1)
    const set = lastUpdateSet()
    expect(set).not.toHaveProperty('refreshTokenEnc')
    expect(set).toHaveProperty('credVersion')
    expect(r.items[0]?.status).toBe('updated')
    expect(String(r.items[0]?.reason)).toContain('保留库内原票')
  })

  it('覆盖 + 缺省:存量语义(refreshTokenEnc 显式写 null),reason 不提保留', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    const r = await importAccounts('trae', [
      { name: '账号A', token: jwt({ sub: 'u1', exp: FUTURE }) },
    ])
    const set = lastUpdateSet()
    expect(set['refreshTokenEnc']).toBeNull()
    expect(String(r.items[0]?.reason)).not.toContain('保留')
  })

  it('覆盖 + preserve + 本批带新票:照常覆盖新票', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    const r = await importAccounts(
      'trae',
      [{ name: '账号A', token: jwt({ sub: 'u1', exp: FUTURE }), refreshToken: 'rt-new' }],
      null,
      { preserveMissingRefresh: true },
    )
    expect(r.updated).toBe(1)
    expect(lastUpdateSet()['refreshTokenEnc']).toBe('enc:rt-new')
  })

  it('覆盖 + preserve + 库内无票:没有可保的,诚实写 null', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: false })
    const r = await importAccounts(
      'trae',
      [{ name: '账号A', token: jwt({ sub: 'u1', exp: FUTURE }) }],
      null,
      { preserveMissingRefresh: true },
    )
    expect(r.updated).toBe(1)
    expect(lastUpdateSet()['refreshTokenEnc']).toBeNull()
    expect(String(r.items[0]?.reason)).not.toContain('保留库内原票')
  })

  // 2026-10-27 真机实证补钉:preserve 只保密文会把元数据一起抹掉 —— 重登载荷带不到
  // refreshTokenExpiresAt(被写成 NULL)、name 只能回退成 uid(覆盖掉库内原名)。
  it('覆盖 + preserve + 载荷无 refreshTokenExpiresAt:不写该列,保留库内到期时刻', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    const r = await importAccounts(
      'trae',
      [{ name: '账号A', token: jwt({ sub: 'u1', exp: FUTURE }) }],
      null,
      { preserveMissingRefresh: true },
    )
    expect(r.updated).toBe(1)
    expect(lastUpdateSet()).not.toHaveProperty('refreshExpiresAt')
  })

  it('覆盖 + preserve + 载荷带 refreshTokenExpiresAt:照常写入新值', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    const r = await importAccounts(
      'trae',
      [
        {
          name: '账号A',
          token: jwt({ sub: 'u1', exp: FUTURE }),
          refreshTokenExpiresAt: '2027-04-07T00:15:04.000Z',
        },
      ],
      null,
      { preserveMissingRefresh: true },
    )
    expect(r.updated).toBe(1)
    const set = lastUpdateSet()
    expect(set['refreshExpiresAt']).toBeInstanceOf(Date)
    expect((set['refreshExpiresAt'] as Date).toISOString()).toBe('2027-04-07T00:15:04.000Z')
  })

  it('覆盖 + preserve + 名字只是 uid 回退:不写 name,保留库内展示名', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    const r = await importAccounts(
      'trae',
      [{ name: 'u1', uid: 'u1', token: jwt({ sub: 'u1', exp: FUTURE }) }],
      null,
      { preserveMissingRefresh: true },
    )
    expect(r.updated).toBe(1)
    expect(lastUpdateSet()).not.toHaveProperty('name')
  })

  it('覆盖 + 缺省(非 preserve):名字是 uid 也照旧写,存量语义不变', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true })
    await importAccounts('trae', [{ name: 'u1', token: jwt({ sub: 'u1', exp: FUTURE }) }])
    expect(lastUpdateSet()['name']).toBe('u1')
  })
})

describe('secretsEnc 单列合并(模板/设备材料同列共存)', () => {
  const EXISTING_SECRETS = {
    sessionTemplate: { userId: 'u1', account: { username: '老账号' } },
    deviceKeyPem: 'PEM-PRIV',
    devicePubPem: 'PEM-PUB',
  }
  const existingRow = () => ({
    id: 'row-1',
    hasRefreshToken: true,
    secretsEnc: `enc:${JSON.stringify(EXISTING_SECRETS)}`,
  })
  /** update set 里的密文解回对象;未写该列时返回 null */
  function writtenSecrets(): Record<string, unknown> | null {
    const raw = lastUpdateSet()['secretsEnc']
    if (typeof raw !== 'string') return null
    return JSON.parse(raw.slice(4)) as Record<string, unknown>
  }

  it('只带凭证(网页重登)→ 不写 secretsEnc,既有模板与设备材料原样留在列里', async () => {
    hoisted.mockSelectRows.push(existingRow())
    const r = await importAccounts('trae', [
      { name: '账号A', token: jwt({ sub: 'u1', exp: FUTURE }) },
    ])
    expect(r.updated).toBe(1)
    // 值必须是 undefined(真 drizzle 会跳过 undefined 列;mock 里对象仍带该键)
    expect(lastUpdateSet()['secretsEnc']).toBeUndefined()
  })

  it('本次带新模板 → 模板被替换,既有设备材料仍在', async () => {
    hoisted.mockSelectRows.push(existingRow())
    await importAccounts('trae', [
      {
        name: '账号A',
        token: jwt({ sub: 'u1', exp: FUTURE }),
        sessionTemplate: { userId: 'u1', account: { username: '新账号' } },
      },
    ])
    expect(writtenSecrets()).toEqual({
      ...EXISTING_SECRETS,
      sessionTemplate: { userId: 'u1', account: { username: '新账号' } },
    })
  })

  it('本次只带设备材料 → 既有模板不被抹掉', async () => {
    hoisted.mockSelectRows.push(existingRow())
    await importAccounts('trae', [
      {
        name: '账号A',
        token: jwt({ sub: 'u1', exp: FUTURE }),
        deviceKeyPem: 'PEM-PRIV-2',
        devicePubPem: 'PEM-PUB-2',
      },
    ])
    expect(writtenSecrets()).toEqual({
      sessionTemplate: EXISTING_SECRETS.sessionTemplate,
      deviceKeyPem: 'PEM-PRIV-2',
      devicePubPem: 'PEM-PUB-2',
    })
  })

  it('既有列解不开(密钥轮换)→ 以本批提供的重建,不让坏密文挡住导入', async () => {
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true, secretsEnc: 'broken' })
    await importAccounts('trae', [
      {
        name: '账号A',
        token: jwt({ sub: 'u1', exp: FUTURE }),
        sessionTemplate: { userId: 'u1' },
      },
    ])
    expect(writtenSecrets()).toEqual({ sessionTemplate: { userId: 'u1' } })
  })
})
