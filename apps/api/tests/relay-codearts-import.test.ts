// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CodeArts 账号导入映射单测(2026-10-22 立)。
 *
 * 覆盖 importAccounts 的 providerCode==='codearts' 分支:
 * - 桌面端导出 JSON 格式(accessKey/securitytoken/loginContext…)
 * - Seventy73 落盘格式(access_key_id/cloud_dragon_token/dpop_private_key…)
 * - 缺 STS 凭据 → failed(不落库)
 *
 * 测试模式:vi.mock 掉 db / crypto(对齐 relay-health-recovery.test.ts),不发网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsertValues, mockDecryptField } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  mockDecryptField: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }),
    // importAccounts 现在走 `.values(...).returning({id, credVersion})`(O64 凭证版本回写);
    // mock 必须返一行,否则 service 判"未取到回写行"→ 计入 failed。
    insert: () => ({
      values: mockInsertValues.mockImplementation(() => ({
        returning: () => Promise.resolve([{ id: 'row-codearts', credVersion: 1 }]),
      })),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
  dbClient: {},
}))

// 直通式假加密:enc: 前缀,便于断言落库内容
vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: mockDecryptField.mockImplementation((s: string) =>
    s.startsWith('enc:') ? s.slice(4) : s,
  ),
}))

import {
  importAccounts,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'

function lastInsert(): Record<string, unknown> {
  expect(mockInsertValues).toHaveBeenCalled()
  return mockInsertValues.mock.calls[mockInsertValues.mock.calls.length - 1]![0] as Record<
    string,
    unknown
  >
}

function secretsOf(row: Record<string, unknown>): Record<string, unknown> {
  const enc = row['secretsEnc']
  expect(typeof enc).toBe('string')
  return JSON.parse((enc as string).slice('enc:'.length)) as Record<string, unknown>
}

describe('importAccounts codearts 分支', () => {
  beforeEach(() => {
    mockInsertValues.mockReset()
  })

  it('桌面端导出格式:映射进 tokenEnc/refreshTokenEnc/secretsEnc/tokenExpiresAt/uid', async () => {
    const acc = {
      accessKey: 'HSTAKaaaaaaaaaaaaaaaa',
      secretKey: 'skbbbbbbbbbbbbbbbbbbbb',
      securitytoken: 'sts-AAA-security-token',
      refresh_token: 'rt-old-001',
      expires_at: '2027-01-01T00:00:00Z',
      domainId: 'dom-123',
      account: { id: 'user-777', label: '小号A' },
      loginContext: {
        pkcePair: { codeVerifier: 'pkce-verifier-xyz' },
        dpopKeyPair: { privateKeyJwk: { kty: 'EC', crv: 'P-256', x: 'AAA', y: 'BBB', d: 'CCC' } },
      },
    } as unknown as ImportAccountInput

    const out = await importAccounts('codearts', [acc])
    expect(out.imported).toBe(1)
    expect(out.items[0]?.uid).toBe('user-777')

    const row = lastInsert()
    expect(row['providerCode']).toBe('codearts')
    expect(row['uid']).toBe('user-777')
    expect(row['name']).toBe('小号A')
    expect(row['tokenEnc']).toBe('enc:sts-AAA-security-token')
    expect(row['refreshTokenEnc']).toBe('enc:rt-old-001')
    expect(row['tokenExpiresAt']).toEqual(new Date('2027-01-01T00:00:00Z'))

    const secrets = secretsOf(row)
    expect(secrets).toMatchObject({
      accessKeyId: 'HSTAKaaaaaaaaaaaaaaaa',
      secretAccessKey: 'skbbbbbbbbbbbbbbbbbbbb',
      codeVerifier: 'pkce-verifier-xyz',
      clientId: 'codearts-agent', // 缺省兜底
      domainId: 'dom-123',
      userName: '小号A',
    })
    expect(secrets['dpopPrivateKeyJwk']).toMatchObject({ kty: 'EC', crv: 'P-256', d: 'CCC' })
  })

  it('Seventy73 落盘格式:cloud_dragon_token/dpop_private_key(JSON 字符串)都认', async () => {
    const acc = {
      user_id: 'u-900',
      user_name: 'zhang@example',
      domain_id: 'dom-9',
      cloud_dragon_token: 'cdt-security-token',
      access_key_id: 'HSTAK9999',
      secret_access_key: 'sk9999',
      expiration: '2027-06-01T08:30:00Z',
      refresh_token: 'rt-900',
      code_verifier: 'cv-900',
      client_id: 'codearts-agent',
      dpop_private_key: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'X9', y: 'Y9', d: 'D9' }),
    } as unknown as ImportAccountInput

    const out = await importAccounts('codearts', [acc])
    expect(out.imported).toBe(1)

    const row = lastInsert()
    expect(row['uid']).toBe('u-900')
    expect(row['name']).toBe('zhang@example')
    expect(row['tokenEnc']).toBe('enc:cdt-security-token')
    expect(row['refreshTokenEnc']).toBe('enc:rt-900')
    expect(row['tokenExpiresAt']).toEqual(new Date('2027-06-01T08:30:00Z'))

    const secrets = secretsOf(row)
    expect(secrets).toMatchObject({
      accessKeyId: 'HSTAK9999',
      secretAccessKey: 'sk9999',
      codeVerifier: 'cv-900',
      clientId: 'codearts-agent',
      domainId: 'dom-9',
      userName: 'zhang@example',
    })
    expect(secrets['dpopPrivateKeyJwk']).toMatchObject({ x: 'X9', y: 'Y9', d: 'D9' })
  })

  it('缺 STS 凭据 → failed 且不落库', async () => {
    const acc = { name: '坏账号' } as unknown as ImportAccountInput
    const out = await importAccounts('codearts', [acc])
    expect(out.failed).toBe(1)
    expect(out.items[0]?.reason).toMatch(/STS 凭据/)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('已过期且无 refresh_token → 入库即摘除(down + tempUnschedulable)', async () => {
    const acc = {
      securitytoken: 'sts-x',
      accessKey: 'ak-x',
      secretKey: 'sk-x',
      expires_at: '2020-01-01T00:00:00Z',
    } as unknown as ImportAccountInput
    const out = await importAccounts('codearts', [acc])
    expect(out.imported).toBe(1)
    const row = lastInsert()
    expect(row['healthStatus']).toBe('down')
    expect(row['tempUnschedulable']).toBe(true)
    expect(row['refreshTokenEnc']).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
