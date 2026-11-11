// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池导出-重导往返测试(2026-11-10 立,机主 27 枚账号迁移开发库→生产库的防翻车锁)。
 *
 * 判据 = 导出脚本写文件前的硬校验两条(纯函数,零 DB):
 *   1) resolveImportAccountUid(provider, 导出载荷) === 原行 uid
 *   2) resolveRelayAccountName(provider, 导出载荷).name === 原行 name
 * 载荷构造走服务层 buildExportPayload(与 importAccounts 的 mapXxxImport 同文件互镜,
 * 键位单源);validateExportRoundTrip 不过 ⇒ 脚本必须拒出该行。
 *
 * 覆盖本池涉及的 9 平台(trae,qoder,workbuddy,minimax,codearts,loomy,zcode,opencode,doubao),
 * 含 codearts **永久 AK/SK 形态**(tokenEnc=encryptField(''),2026-11-10 修复的缺陷本体)。
 */
import { describe, expect, it } from 'vitest'
import type { AiRelayAccountPool } from '@ihui/database'
import {
  buildExportPayload,
  decryptAccountCredentials,
  resolveImportAccountUid,
  validateExportRoundTrip,
  type AccountCredentials,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'
import { encryptField } from '../src/utils/crypto.js'
import {
  normalizeForeignAccountShape,
  resolveRelayAccountName,
  type RelayProviderCode,
} from '../src/services/relay-account-format.js'

const b64url = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString('base64url')
const makeJWT = (claims: Record<string, unknown>): string =>
  `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}.sig`

/** 行形状只带导出内核消费的列(纯函数不碰其余列,零 DB) */
function poolRow(
  p: RelayProviderCode,
  over: Partial<AiRelayAccountPool> & { creds?: Partial<AccountCredentials> },
): AiRelayAccountPool {
  const { creds, ...cols } = over
  const row = {
    id: `row-${p}`,
    ownerUserId: 'owner-1',
    ownerScope: 'user',
    ownerTenantId: null,
    ownerUsername: '机主',
    providerCode: p,
    uid: '',
    name: null,
    tokenEnc: encryptField(''),
    refreshTokenEnc: null,
    cookiesEnc: null,
    secretsEnc: null,
    extraMetadata: null,
    tokenExpiresAt: null,
    refreshExpiresAt: null,
    deviceId: null,
    machineId: null,
    isEnabled: true,
    ...cols,
  } as unknown as AiRelayAccountPool
  if (creds) {
    row.tokenEnc = encryptField(creds.token ?? '')
    row.refreshTokenEnc = creds.refreshToken ? encryptField(creds.refreshToken) : null
    row.cookiesEnc = creds.cookies?.length ? encryptField(JSON.stringify(creds.cookies)) : null
    row.secretsEnc =
      creds.secrets && Object.keys(creds.secrets).length
        ? encryptField(JSON.stringify(creds.secrets))
        : null
  }
  return row
}

/** 导出 → 硬校验 → 逐条判据断言(拒出原因必须为 null,uid/name 必须逐字复现) */
function expectRoundTrip(row: AiRelayAccountPool): Record<string, unknown> {
  const p = row.providerCode as RelayProviderCode
  const built = buildExportPayload(row, decryptAccountCredentials(row))
  if (typeof built === 'string') throw new Error(`导出构造被拒: ${built}`)
  expect(validateExportRoundTrip(row, built)).toBeNull()
  expect(resolveImportAccountUid(p, built as ImportAccountInput)).toBe(row.uid)
  const name = resolveRelayAccountName({
    providerCode: p,
    payload: normalizeForeignAccountShape(built),
    index: 0,
  }).name
  expect(name).toBe(row.name)
  return built
}

describe('号池导出-重导往返(9 平台 uid/name 复现,零 DB)', () => {
  it('trae: 顶层 token/refreshToken/cookies + 设备材料键,手机号名复现', () => {
    const row = poolRow('trae', {
      uid: 'trae-uid-001',
      name: '13800001111',
      deviceId: 'trae-dev-9',
      creds: {
        token: 'trae-access-token',
        refreshToken: 'trae-refresh-token',
        cookies: [{ name: 'k', value: 'v', domain: '.trae.cn' }],
        secrets: {
          deviceKeyPem: '-----BEGIN PRIVATE KEY-----abc',
          devicePubPem: '-----BEGIN PUBLIC KEY-----def',
          sessionTemplate: { headers: { 'x-machine': '{machineId}' } },
          sealedPaths: { user: 'p1' },
          edition: 'cn',
        },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['token']).toBe('trae-access-token')
    expect(payload['deviceKeyPem']).toBe('-----BEGIN PRIVATE KEY-----abc')
    expect(payload['phone']).toBe('13800001111')
  })

  it('workbuddy: 顶层 token 族 + preferred_username 手机号名复现', () => {
    const row = poolRow('workbuddy', {
      uid: '13800002222',
      name: '13800002222',
      machineId: 'wb-machine-1',
      creds: {
        token: 'wb-access-token',
        refreshToken: 'wb-refresh-token',
        cookies: [{ name: 'wlogin', value: 'qq_123', domain: '.qq.com' }],
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['token']).toBe('wb-access-token')
    expect(payload['uid']).toBe('13800002222')
  })

  it('qoder: 顶层 token 族 + cosy 设备头族/过期键逆向,载荷名复现', () => {
    const row = poolRow('qoder', {
      uid: 'qoder-user-777',
      name: 'Qoder昵称',
      tokenExpiresAt: new Date('2027-03-04T05:06:07.000Z'),
      deviceId: 'qoder-dev-1',
      machineId: 'qoder-mac-1',
      extraMetadata: {
        cosy: {
          machine_token: 'mt-1',
          machine_code: 'mc-1',
          machine_type: 'mtype-1',
          version: 'v9',
        },
        refreshTokenExpiresAt: '2027-06-01T00:00:00.000Z',
      },
      creds: {
        token: 'qoder-opaque-token',
        refreshToken: 'qoder-refresh',
        cookies: [{ name: 'session', value: 'ss', domain: '.qoder.ai' }],
        secrets: { sessionTemplate: { headers: { Authorization: 'Bearer {token}' } } },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['machineToken']).toBe('mt-1')
    expect(payload['expiresAt']).toBe('2027-03-04T05:06:07.000Z')
    expect(payload['refreshTokenExpiresAt']).toBe('2027-06-01T00:00:00.000Z')
  })

  it('minimax: accessToken 键位 + recordKey uid 键源(Y-24)复现', () => {
    // 原行 uid 按导入侧同一枚键源算出(账号级 recordKey,绝不用 client_id)
    const native = { accessToken: 'minimax-at', recordKey: 'acc_12345' } as ImportAccountInput
    const uid = resolveImportAccountUid('minimax', native)
    expect(uid).not.toBeNull()
    const row = poolRow('minimax', {
      uid: uid!,
      name: '19900001111',
      tokenExpiresAt: new Date('2027-01-02T03:04:05.000Z'),
      creds: {
        token: 'minimax-at',
        refreshToken: 'minimax-rt',
        secrets: {
          recordKey: 'acc_12345',
          clientId: 'cli-1',
          audience: 'https://api.minimaxi.chat',
          tokenType: 'Bearer',
          loginEpoch: '1700000000',
          region: 'cn',
          scopes: ['a', 'b'],
        },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['accessToken']).toBe('minimax-at')
    expect(payload['recordKey']).toBe('acc_12345')
    expect(payload['expiresAtMs']).toBe(row.tokenExpiresAt!.getTime())
  })

  it('codearts STS 三件套: 票/AK/SK/PKCE/DPoP 键位全回填', () => {
    const row = poolRow('codearts', {
      uid: 'ca-user-9',
      name: '13700001234',
      tokenExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      creds: {
        token: 'sts-token-abc',
        refreshToken: 'crt-1',
        secrets: {
          accessKeyId: 'HSTAKx',
          secretAccessKey: 'skx-123',
          dpopPrivateKeyJwk: { kty: 'EC', crv: 'P-256', x: 'X', y: 'Y', d: 'D' },
          codeVerifier: 'cv-1',
          clientId: 'codearts-agent',
          domainId: 'dom-1',
          userName: 'ca-uname',
        },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['securitytoken']).toBe('sts-token-abc')
    expect(payload['accessKey']).toBe('HSTAKx')
    expect(payload['secretKey']).toBe('skx-123')
    expect(payload['account']).toEqual({ id: 'ca-user-9' })
    expect(payload['dpop_private_key']).toMatchObject({ kty: 'EC' })
  })

  // 缺陷本体(2026-11-10 修):库里已切永久访问密钥的行 tokenEnc=encryptField('')、
  // refreshTokenEnc=null,三槽位逐槽非空的旧闸门把导出-重导闭环挡死。
  it('codearts 永久 AK/SK 二件套: 空票行可导,uid 取 account.id 不依赖 token', () => {
    const row = poolRow('codearts', {
      uid: 'perm-user-id',
      name: '永久密钥号',
      creds: {
        token: '',
        secrets: { accessKeyId: 'HSTAKperm', secretAccessKey: 'skperm-1', userName: 'permUser' },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['securitytoken']).toBeUndefined()
    expect(payload['accessKey']).toBe('HSTAKperm')
    expect(payload['secretKey']).toBe('skperm-1')
    expect(payload['account']).toEqual({ id: 'perm-user-id' })
    expect(payload['name']).toBe('永久密钥号')
  })

  it('loomy: 会话族形状 {source,key,value,cookies},uid_tt 键源复现', () => {
    const native = {
      source: 'loomy',
      key: 'user:123',
      value: 'loomy-token-value',
      cookies: [{ name: 'uid_tt', value: 'loomy-uid-777' }],
    } as unknown as ImportAccountInput
    const uid = resolveImportAccountUid('loomy', native)
    expect(uid).not.toBeNull()
    const row = poolRow('loomy', {
      uid: uid!,
      name: 'loomy:user:123',
      creds: {
        token: 'loomy-token-value',
        cookies: [{ name: 'uid_tt', value: 'loomy-uid-777', domain: '.loomy.ai' }],
        secrets: { entrySource: 'loomy', entryKey: 'user:123', host: 'a.loomy.ai' },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['value']).toBe('loomy-token-value')
    expect(payload['source']).toBe('loomy')
    expect(payload['key']).toBe('user:123')
  })

  it('doubao: entrySource 缺省(=providerCode)行同样可导,cookies 整族回带', () => {
    const native = {
      key: 'sessionid',
      value: 'db-sess-value',
      cookies: [{ name: 'uid_tt', value: 'db-uid-1' }],
    } as unknown as ImportAccountInput
    const uid = resolveImportAccountUid('doubao', native)
    expect(uid).not.toBeNull()
    const row = poolRow('doubao', {
      uid: uid!,
      name: 'doubao:sessionid',
      creds: {
        token: 'db-sess-value',
        cookies: [{ name: 'uid_tt', value: 'db-uid-1', domain: '.doubao.com' }],
        secrets: { entryKey: 'sessionid', host: 'www.doubao.com' },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['source']).toBeUndefined() // 缺省 ⇒ 重导按 providerCode 默认,同原行
    expect(payload['key']).toBe('sessionid')
    expect(payload['cookies']).toEqual([
      { name: 'uid_tt', value: 'db-uid-1', domain: '.doubao.com' },
    ])
  })

  it('zcode: credentialMap 扁平图直通,JWT claims 键源 uid 复现', () => {
    const jwt = makeJWT({ customer_id: 'zcode-cust-1', exp: 1893456000 })
    const uid = resolveImportAccountUid('zcode', {
      'oauth:bigmodel:access_token': jwt,
    } as unknown as ImportAccountInput)
    expect(uid).not.toBeNull()
    const row = poolRow('zcode', {
      uid: uid!,
      name: 'zcode:cn',
      creds: {
        token: jwt,
        secrets: { credentialMap: { 'oauth:bigmodel:access_token': jwt }, region: 'cn' },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['oauth:bigmodel:access_token']).toBe(jwt)
    expect(payload['region']).toBe('cn')
  })

  it('zcode 前缀键形态(leveldb URL 编码键,过不了 Web 路由白名单):弃非法键改合法同槽拼写,仍可导', () => {
    const jwt = makeJWT({ customer_id: 'zcode-cust-2', exp: 1893456000 })
    const weirdKey = 'project-key-location:v1:%5B%22https%3A%2F%2Fopen.bigmodel.cn%22%5D'
    const uid = resolveImportAccountUid('zcode', {
      [weirdKey]: jwt,
    } as unknown as ImportAccountInput)
    expect(uid).not.toBeNull()
    const row = poolRow('zcode', {
      uid: uid!,
      name: '13600002222',
      creds: { token: jwt, secrets: { credentialMap: { [weirdKey]: jwt } } },
    })
    const payload = expectRoundTrip(row)
    expect(payload[weirdKey]).toBeUndefined() // 非法键弃置
    expect(payload['oauth:bigmodel:access_token']).toBe(jwt) // 同槽合法拼写回填
    expect(payload['phone']).toBe('13600002222')
  })

  it('opencode: auth.key 键位 + accountId uid 键源复现', () => {
    const row = poolRow('opencode', {
      uid: 'oc-account-1',
      name: 'user@opencode.ai',
      tokenExpiresAt: new Date('2027-02-03T04:05:06.000Z'),
      creds: {
        token: 'oc-key-1',
        refreshToken: 'oc-refresh-1',
        secrets: { providerID: 'opencode-go', authType: 'oauth', enterpriseUrl: 'https://e.oc' },
      },
    })
    const payload = expectRoundTrip(row)
    const auth = payload['auth'] as Record<string, unknown>
    expect(auth['key']).toBe('oc-key-1')
    expect(auth['accountId']).toBe('oc-account-1')
    expect(payload['providerID']).toBe('opencode-go')
  })

  it('auto: 键源 uid 行不回填 account.id/auth.accountId,靠键源本身复现', () => {
    const autoUid = resolveImportAccountUid('opencode', {
      providerID: 'opencode-go',
      auth: { key: 'oc-key-2' },
    } as unknown as ImportAccountInput)
    expect(autoUid).toMatch(/^auto:/)
    const row = poolRow('opencode', {
      uid: autoUid!,
      name: 'auto号',
      creds: { token: 'oc-key-2', secrets: { providerID: 'opencode-go' } },
    })
    const payload = expectRoundTrip(row)
    expect((payload['auth'] as Record<string, unknown>)['accountId']).toBeUndefined()
  })
})

describe('导出硬校验:复现不了的行必须拒出(绝不静默产出导不回去的载荷)', () => {
  it('uid 与凭据键源矛盾的行(zcode 行 uid ≠ claims 推导)→ 拒出并点名 uid 判据', () => {
    const jwt = makeJWT({ customer_id: 'real-cust', exp: 1893456000 })
    const row = poolRow('zcode', {
      uid: 'bogus-uid-not-reproducible',
      name: 'zcode:cn',
      creds: { token: jwt, secrets: { credentialMap: { 'oauth:bigmodel:access_token': jwt } } },
    })
    const built = buildExportPayload(row, decryptAccountCredentials(row))
    expect(typeof built).not.toBe('string')
    const issue = validateExportRoundTrip(row, built as Record<string, unknown>)
    expect(issue).not.toBeNull()
    expect(issue).toMatch(/uid 不可复现/)
    // 拒出原因不得回显凭据值
    expect(issue).not.toContain(jwt)
  })

  it('name 为空(重导将落 #序号)的行 → 拒出并点名统一名判据', () => {
    const row = poolRow('trae', { uid: 't-1', name: null, creds: { token: 'tk' } })
    const built = buildExportPayload(row, decryptAccountCredentials(row))
    const issue = validateExportRoundTrip(row, built as Record<string, unknown>)
    expect(issue).toMatch(/统一名不可复现/)
  })

  it('codearts 永久行缺 secretKey(二件套不齐)→ 闸门拒收', () => {
    const row = poolRow('codearts', {
      uid: 'ca-x',
      name: 'ca-x',
      creds: { token: '', secrets: { accessKeyId: 'ak-x' } },
    })
    const built = buildExportPayload(row, decryptAccountCredentials(row))
    expect(typeof built).not.toBe('string')
    expect(validateExportRoundTrip(row, built as Record<string, unknown>)).toMatch(/uid 不可复现/)
  })

  it('raccoon: 单体 Bearer 无续期材料,token/expiresAt/officeIdentity 三键复现', () => {
    const jwt = makeJWT({ sub: 'pu-01a1c8f5-37ee-70a0', exp: 1796000000 })
    // uid 键源 = JWT sub(`pu-<uuid>`,与提取器/适配器同一枚)
    const uid = resolveImportAccountUid('raccoon', { token: jwt } as unknown as ImportAccountInput)
    expect(uid).toBe('pu-01a1c8f5-37ee-70a0')
    const row = poolRow('raccoon', {
      uid: uid!,
      name: '1994489',
      tokenExpiresAt: new Date(1796000000 * 1000),
      creds: {
        token: jwt,
        // auth.json 实测无 refresh_token ⇒ 行上也不该有
        secrets: { meta: { officeIdentity: 'personal' } },
      },
    })
    const payload = expectRoundTrip(row)
    expect(payload['token']).toBe(jwt)
    expect(payload['expiresAt']).toBe(new Date(1796000000 * 1000).toISOString())
    expect(payload['officeIdentity']).toBe('personal')
    // 不得凭空长出续期键(重导侧 mapRaccoonImport 恒 null,适配器 refreshTokenSupported=false)
    expect(payload['refreshToken']).toBeUndefined()
  })

  it('grokbot 密封串行:导出构造即拒(无明文凭据可导)', () => {
    const row = poolRow('grokbot', {
      uid: 'g-1',
      name: 'g-1',
      creds: { token: 'sandSealedFile:blob' },
    })
    const built = buildExportPayload(row, decryptAccountCredentials(row))
    expect(typeof built).toBe('string')
    expect(built as string).toMatch(/密封/)
  })

  it('载荷字段名过不了 Web 路由白名单的行 → 拒出并点名结构判据', () => {
    const row = poolRow('trae', { uid: 't-2', name: 't-2', creds: { token: 'tk' } })
    const built = buildExportPayload(row, decryptAccountCredentials(row)) as Record<string, unknown>
    built['bad key with spaces'] = 'x'
    expect(validateExportRoundTrip(row, built)).toMatch(/路由结构闸门拒收/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
