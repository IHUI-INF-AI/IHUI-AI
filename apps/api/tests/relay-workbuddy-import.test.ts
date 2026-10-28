// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 账号导入统一名称单测(2026-10-28 立)。
 *
 * 号池统一名称 = 官方绑定手机号(全号)。WorkBuddy 的 Keycloak JWT 声明
 * preferred_username 即注册手机号全号,导入时必须以它覆盖载荷自带的
 * 昵称/脱敏名;非全号形态(邮箱/昵称/非 JWT)一律不动,维持原兜底命名。
 *
 * 测试模式:vi.mock 掉 db / crypto(对齐 relay-qoder-import.test.ts),不发网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsertValues, mockDbState } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  // existing: 既有行查询回灌值;sets: 捕获所有 update().set() 列图
  // (导入写之后 checkin-sync 挂起标记还会 update 一次,须按含 tokenEnc 的那次取导入写)
  mockDbState: {
    existing: [] as Array<Record<string, unknown>>,
    sets: [] as Array<Record<string, unknown>>,
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(mockDbState.existing) }) }),
    }),
    insert: () => ({
      values: mockInsertValues.mockImplementation(() => ({
        returning: () => Promise.resolve([{ id: 'row-wb', credVersion: 1 }]),
      })),
    }),
    update: () => ({
      set: (arg: Record<string, unknown>) => {
        mockDbState.sets.push(arg)
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 'row-wb', credVersion: 2 }]),
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

import { importAccounts } from '../src/services/relay-account-pool-service.js'

function lastInsert(): Record<string, unknown> {
  expect(mockInsertValues).toHaveBeenCalled()
  return mockInsertValues.mock.calls[mockInsertValues.mock.calls.length - 1]![0] as Record<
    string,
    unknown
  >
}

function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}.sig`
}

beforeEach(() => {
  mockInsertValues.mockClear()
  mockDbState.existing = []
  mockDbState.sets = []
})

/** 取导入写那次 update().set() 的列图(排除 checkin-sync 挂起标记的补写) */
function importSet(): Record<string, unknown> {
  const s = mockDbState.sets.find((x) => 'tokenEnc' in x)
  expect(s).toBeDefined()
  return s!
}

describe('WorkBuddy 导入统一名称 = JWT preferred_username 全号', () => {
  it('载荷名是脱敏号时,以 JWT 全号覆盖', async () => {
    const r = await importAccounts('workbuddy', [
      {
        name: '192****0269',
        token: fakeJwt({ sub: 'u-wb-1', preferred_username: '19269350269', exp: 4e9 }),
        refreshToken: fakeJwt({ sub: 'u-wb-1', preferred_username: '19269350269' }),
      },
    ])
    expect(r.imported).toBe(1)
    const row = lastInsert()
    expect(row['providerCode']).toBe('workbuddy')
    expect(row['name']).toBe('19269350269')
    expect(r.items[0]!.name).toBe('19269350269')
  })

  it('preferred_username 非全号形态(邮箱)时不改名', async () => {
    const r = await importAccounts('workbuddy', [
      {
        name: 'some-nick',
        token: fakeJwt({ sub: 'u-wb-2', preferred_username: 'user@example.com', exp: 4e9 }),
      },
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe('some-nick')
  })

  it('非 JWT token 不改名(维持载荷名)', async () => {
    const r = await importAccounts('workbuddy', [
      { name: 'opaque-name', token: 'opaque-token-value' },
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe('opaque-name')
  })

  it('无载荷名时全号优先于 #N 兜底', async () => {
    const r = await importAccounts('workbuddy', [
      { token: fakeJwt({ sub: 'u-wb-4', preferred_username: '13314346978', exp: 4e9 }) },
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['name']).toBe('13314346978')
  })
})

// 模板三键保留(2026-10-28 立):secretsEnc 里的 sessionTemplate/sealedPaths/edition 由
// worker cron 每 10 分钟经 relay-workbuddy-session-sync 回灌,「登录本机」唯一消费面;
// 重复导入(只带凭证)绝不许把它们抹掉。模板用假形状,零凭据。
describe('重复导入不丢 secretsEnc 模板三键', () => {
  const tpl = {
    sessionTemplate: { fakeDir: 'C:/fake', profile: { account: { id: 'fake-1' } } },
    sealedPaths: ['profile.account.$wbEncrypted'],
    edition: 'workbuddy',
  }

  it('workbuddy 覆盖导入不带 secrets ⇒ secretsEnc 列不进 SET(既有三键原样保留)', async () => {
    mockDbState.existing = [
      { id: 'row-wb', hasRefreshToken: false, secretsEnc: `enc:${JSON.stringify(tpl)}` },
    ]
    const r = await importAccounts('workbuddy', [{ token: fakeJwt({ sub: 'u-wb-tpl', exp: 4e9 }) }])
    expect(r.updated).toBe(1)
    expect('secretsEnc' in importSet()).toBe(true)
    expect(importSet()['secretsEnc']).toBeUndefined()
  })

  it('trae 覆盖导入只带设备材料 ⇒ 新 secrets 合入既有三键', async () => {
    mockDbState.existing = [
      { id: 'row-tr', hasRefreshToken: false, secretsEnc: `enc:${JSON.stringify(tpl)}` },
    ]
    const r = await importAccounts('trae', [
      {
        token: fakeJwt({ sub: 'u-tr-tpl', data: { id: 'u-tr-tpl' }, exp: 4e9 }),
        deviceKeyPem: 'FAKE-KEY-PEM',
        devicePubPem: 'FAKE-PUB-PEM',
      },
    ])
    expect(r.updated).toBe(1)
    const enc = importSet()['secretsEnc']
    expect(typeof enc).toBe('string')
    const secrets = JSON.parse((enc as string).slice('enc:'.length)) as Record<string, unknown>
    expect(secrets['deviceKeyPem']).toBe('FAKE-KEY-PEM')
    expect(secrets['devicePubPem']).toBe('FAKE-PUB-PEM')
    expect(secrets['sessionTemplate']).toEqual(tpl.sessionTemplate)
    expect(secrets['sealedPaths']).toEqual(tpl.sealedPaths)
    expect(secrets['edition']).toBe('workbuddy')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
