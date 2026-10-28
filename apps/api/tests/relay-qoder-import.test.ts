// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 账号导入映射单测(2026-10-23 立)。
 *
 * 覆盖 importAccounts 的 providerCode==='qoder' 分支:
 * - 显式 uid(auth.v1.dat 的 user.id)+ ISO 8601 expiresAt → 原样落库
 * - user.id 兜底(无顶层 uid);全缺 → auto: 哈希 uid(不阻塞,诚实退化)
 * - refreshTokenExpiresAt 落 extraMetadata + refresh_expires_at 列
 * - Cosy 头族(machineToken 等)落 extraMetadata.cosy
 * - 缺 token → failed;name 兜底 nickname → phone
 *
 * 测试模式:vi.mock 掉 db / crypto(对齐 relay-codearts-import.test.ts),不发网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsertValues } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
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
        returning: () => Promise.resolve([{ id: 'row-qoder', credVersion: 1 }]),
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

function extraOf(row: Record<string, unknown>): Record<string, unknown> {
  return (row['extraMetadata'] ?? {}) as Record<string, unknown>
}

beforeEach(() => {
  mockInsertValues.mockClear()
})

describe('Qoder 导入映射', () => {
  it('显式 uid + ISO expiresAt 原样落库(真机 auth.v1.dat 形态)', async () => {
    const r = await importAccounts('qoder', [
      {
        name: 'nick8855347730',
        phone: '15330637579',
        nickname: 'nick8855347730',
        token: 'dt-lHpaPB9p7cSvTrsA1FEAoaci',
        refreshToken: 'drt-7nB5JVVDDBFezao2OEdPvaey',
        uid: '01a16367-b9e2-7ac3-9943-8974fb16ca2d',
        expiresAt: '2026-11-21T11:38:26Z',
        refreshTokenExpiresAt: '2027-10-17T11:38:26Z',
        deviceId: 'dev-1',
        machineId: 'mac-1',
      },
    ])
    expect(r.imported).toBe(1)
    expect(r.items[0]!.uid).toBe('01a16367-b9e2-7ac3-9943-8974fb16ca2d')
    const row = lastInsert()
    expect(row['providerCode']).toBe('qoder')
    // 统一名称 = 官方绑定手机号:载荷里的昵称/显示名不得盖掉 phone(2026-10-28 定)
    expect(row['name']).toBe('15330637579')
    expect(row['uid']).toBe('01a16367-b9e2-7ac3-9943-8974fb16ca2d')
    expect((row['tokenExpiresAt'] as Date).toISOString()).toBe('2026-11-21T11:38:26.000Z')
    expect((row['refreshExpiresAt'] as Date).toISOString()).toBe('2027-10-17T11:38:26.000Z')
    expect(row['tokenEnc']).toBe('enc:dt-lHpaPB9p7cSvTrsA1FEAoaci')
    expect(row['refreshTokenEnc']).toBe('enc:drt-7nB5JVVDDBFezao2OEdPvaey')
    expect(row['deviceId']).toBe('dev-1')
    expect(row['machineId']).toBe('mac-1')
    expect(extraOf(row)['refreshTokenExpiresAt']).toBe('2027-10-17T11:38:26.000Z')
  })

  it('无顶层 uid 时按 user.id 兜底', async () => {
    const r = await importAccounts('qoder', [
      {
        token: 'dt-abc',
        user: { id: 'uid-from-user' },
        expiresAt: '2026-12-01T00:00:00+08:00',
      },
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['uid']).toBe('uid-from-user')
    // +08:00 偏移按字面换算成 UTC
    expect((lastInsert()['tokenExpiresAt'] as Date).toISOString()).toBe('2026-11-30T16:00:00.000Z')
  })

  it('uid 与 expiresAt 全缺 → auto: 哈希 uid + 无过期(诚实退化,不阻塞)', async () => {
    const r = await importAccounts('qoder', [{ token: 'dt-opaque-only' }])
    expect(r.imported).toBe(1)
    const row = lastInsert()
    expect(row['uid']).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(row['tokenExpiresAt']).toBeNull()
  })

  it('epoch 秒 expiresAt 也认(与 checkin_qoder._parse_expiry_value 同判据)', async () => {
    const r = await importAccounts('qoder', [
      { token: 'dt-epoch', uid: 'u-epoch', expiresAt: 1769505600 },
    ])
    expect(r.imported).toBe(1)
    // 1769505600 = 2026-01-27T09:20:00Z
    expect((lastInsert()['tokenExpiresAt'] as Date).toISOString()).toBe('2026-01-27T09:20:00.000Z')
  })

  /**
   * 入口归一化(2026-10-23 立)。dev 库实测的失败链:用户从 JSON 整段复制凭据,把包裹引号
   * 一起粘进表单 ⇒ 落库本体是 `"drt-…`(比正常值长 2 字符)⇒ 上游 DeviceRefreshTokenPrefixInvalid
   * ⇒ 号池自刷新连撞 3 次被摘除(down)⇒ 签到侧天天「活动查询失败 HTTP 401」,
   * 而用户界面只看得到"签到失败"。归一化必须发生在加密落库之前,两枚分支(mapped/裸值)同盖。
   */
  it('粘贴值带包裹引号 ⇒ 剥净后入库(不是拒收,也不是原样存坏票)', async () => {
    const r = await importAccounts('qoder', [
      {
        token: ' "dt-lHpaPB9p7cSvTrsA1FEAoaci" ',
        refreshToken: '"drt-7nB5JVVDDBFezao2OEdPvaey"',
        uid: '"01a16367-b9e2-7ac3-9943-8974fb16ca2d"',
      },
    ])
    expect(r.imported).toBe(1)
    const row = lastInsert()
    expect(row['tokenEnc']).toBe('enc:dt-lHpaPB9p7cSvTrsA1FEAoaci')
    expect(row['refreshTokenEnc']).toBe('enc:drt-7nB5JVVDDBFezao2OEdPvaey')
    // uid 同样归一:带引号的 uid 会造出"同上游号两行"的身份分裂
    expect(row['uid']).toBe('01a16367-b9e2-7ac3-9943-8974fb16ca2d')
  })

  it('归一后仍不合形(qoder refreshToken 非 drt- 前缀)⇒ 当场拒并给可执行原因', async () => {
    const r = await importAccounts('qoder', [
      { token: 'dt-x', refreshToken: 'dX-7nB5JVVDDBFezao2OEdPvaey', uid: 'u-shape' },
    ])
    expect(r.imported).toBe(0)
    expect(r.failed).toBe(1)
    expect(r.items[0]?.status).toBe('failed')
    expect(String(r.items[0]?.reason)).toContain('drt-')
    // 拒收即零写入(坏票不许进池,免得两天后以 401 的形式回来找用户)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('阳性对照:同一形态判据不外溢到其他平台(trae 的 rt 无 drt- 约束)', async () => {
    const r = await importAccounts('trae', [{ token: 'eyJx.eyJy.z', refreshToken: 'rt-trae' }])
    expect(r.imported).toBe(1)
    expect(lastInsert()['refreshTokenEnc']).toBe('enc:rt-trae')
  })

  it('Cosy 设备头族落 extraMetadata.cosy(蛇形键,对齐 checkin_qoder 契约)', async () => {
    await importAccounts('qoder', [
      {
        token: 'dt-cosy',
        uid: 'u-cosy',
        machineToken: 'mt-1',
        machineCode: 'mc-1',
        machineType: 'mty-1',
        version: '1.2.3',
      },
    ])
    const cosy = extraOf(lastInsert())['cosy'] as Record<string, string>
    expect(cosy).toEqual({
      machine_token: 'mt-1',
      machine_code: 'mc-1',
      machine_type: 'mty-1',
      version: '1.2.3',
    })
  })

  it('缺 token → failed(不落库)', async () => {
    const r = await importAccounts('qoder', [{ uid: 'u-no-token', name: 'x' }])
    expect(r.failed).toBe(1)
    expect(r.imported).toBe(0)
    expect(r.items[0]!.reason).toBe('Qoder 导入缺少 token')
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('name 缺省按 nickname → phone 兜底', async () => {
    await importAccounts('qoder', [{ token: 'dt-n', uid: 'u-n', nickname: 'nick6870552894' }])
    expect(lastInsert()['name']).toBe('nick6870552894')
    await importAccounts('qoder', [{ token: 'dt-p', uid: 'u-p', phone: '15330637579' }])
    expect(lastInsert()['name']).toBe('15330637579')
  })
})

// 一键导入脚本的纯函数单测(2026-10-23 补)。
// buildQoderImportAccount / extractAccountsFromJson 是脚本导出的纯函数,
// 不依赖 DB / 网络,这里只测形状与兜底逻辑。
import { buildQoderImportAccount, extractAccountsFromJson } from '../scripts/relay-import-qoder.js'

describe('relay-import-qoder 纯函数', () => {
  describe('extractAccountsFromJson', () => {
    it('裸数组原样返回', () => {
      const arr = [{ token: 't' }]
      expect(extractAccountsFromJson(arr)).toBe(arr)
    })
    it('{accounts:[…]} 取 accounts', () => {
      expect(extractAccountsFromJson({ accounts: [{ token: 't' }] })).toEqual([{ token: 't' }])
    })
    it('{providerCode,accounts:[…]} 取 accounts', () => {
      expect(
        extractAccountsFromJson({ providerCode: 'qoder', accounts: [{ token: 't' }] }),
      ).toEqual([{ token: 't' }])
    })
    it('{sessions:[…]} 取 sessions', () => {
      expect(extractAccountsFromJson({ sessions: [{ accessToken: 'a' }] })).toEqual([
        { accessToken: 'a' },
      ])
    })
    it('顶层单条(含 token)自动包数组', () => {
      expect(extractAccountsFromJson({ token: 't', uid: 'u' })).toEqual([{ token: 't', uid: 'u' }])
    })
    it('顶层单条(含 user)自动包数组', () => {
      expect(extractAccountsFromJson({ token: 't', user: { id: 'u' } })).toEqual([
        { token: 't', user: { id: 'u' } },
      ])
    })
    it('无法识别的形状抛错', () => {
      expect(() => extractAccountsFromJson({ foo: 'bar' })).toThrow(/无法识别/)
      expect(() => extractAccountsFromJson(123)).toThrow(/无法识别/)
      expect(() => extractAccountsFromJson(null)).toThrow(/无法识别/)
    })
  })

  describe('buildQoderImportAccount', () => {
    it('ps1 产物(accessToken/uid/phone/nickname/name)正确映射', () => {
      const a = buildQoderImportAccount({
        uid: 'u1',
        accessToken: 'a1',
        refreshToken: 'r1',
        expiresAt: '2026-11-21T11:38:26Z',
        refreshTokenExpiresAt: '2027-10-17T11:38:26Z',
        phone: '15330637579',
        nickname: 'nick',
        name: 'nm',
        deviceId: 'dev1',
        machineId: 'mac1',
        machineToken: 'mt1',
        machineCode: 'mc1',
        machineType: 'win32',
        version: '1.2.3',
      })!
      expect(a.token).toBe('a1')
      expect(a.uid).toBe('u1')
      expect(a.refreshToken).toBe('r1')
      expect(a.expiresAt).toBe('2026-11-21T11:38:26Z')
      expect(a.deviceId).toBe('dev1')
      expect(a.machineToken).toBe('mt1')
      // name 兜底:phone 优先于 nickname/name
      expect(a.name).toBe('15330637579')
    })
    it('原生导出(token 别名 + 内联 user{id,name,phone})正确提取', () => {
      const a = buildQoderImportAccount({
        token: 'a2',
        refreshToken: 'r2',
        expiresAt: '2026-11-21T11:38:26Z',
        user: { id: 'u2', name: 'nick6870552894', phone: '15330637579', email: 'x@y.com' },
      })!
      expect(a.token).toBe('a2')
      expect(a.uid).toBe('u2')
      expect(a.name).toBe('15330637579')
      expect(a.email).toBe('x@y.com')
    })
    it('缺 token/accessToken → null(被过滤,不入池)', () => {
      expect(buildQoderImportAccount({ uid: 'u', name: 'x' })).toBeNull()
      expect(buildQoderImportAccount({} as never)).toBeNull()
    })
    it('name 统一取手机号(无平台前缀),取不到才走兜底链', () => {
      expect(buildQoderImportAccount({ token: 't', phone: '138' })!.name).toBe('138')
      expect(buildQoderImportAccount({ token: 't', phone: '138', nickname: 'nn' })!.name).toBe(
        '138',
      )
      expect(buildQoderImportAccount({ token: 't', nickname: 'nn' })!.name).toBe('nn')
      expect(buildQoderImportAccount({ token: 't', name: 'nm' })!.name).toBe('nm')
      expect(buildQoderImportAccount({ token: 't', user: { email: 'abc@x.com' } })!.name).toBe(
        'abc',
      )
      expect(buildQoderImportAccount({ token: 't', uid: '0123456789abcdef' })!.name).toBe(
        '01234567',
      )
      expect(buildQoderImportAccount({ token: 't' })!.name).toBe('未知号')
    })
  })

  describe('buildCosyHeaders(键位兼容)', () => {
    it('蛇形键(正)+ 驼峰键(历史行兼容)都能出 Cosy 头族', async () => {
      const { buildCosyHeaders } =
        await import('../src/services/upstream-adapters/qoder-adapter.js')
      const mkCtx = (cosy: Record<string, unknown>) =>
        ({
          row: { extraMetadata: { cosy }, machineId: 'mid-1' },
        }) as never
      const snake = buildCosyHeaders(
        mkCtx({ machine_token: 'mt-s', machine_code: 'mc-s', machine_type: 't-s', version: '1.0' }),
      )
      expect(snake['Cosy-MachineToken']).toBe('mt-s')
      expect(snake['Cosy-MachineCode']).toBe('mc-s')
      expect(snake['Cosy-MachineType']).toBe('t-s')
      expect(snake['Cosy-Version']).toBe('1.0')
      expect(snake['Cosy-ClientType']).toBe('10')
      expect(snake['Cosy-MachineOS']).toBe('x86_64_windows')
      expect(snake['Cosy-MachineId']).toBe('mid-1')
      const camel = buildCosyHeaders(mkCtx({ machineToken: 'mt-c', machineCode: 'mc-c' }))
      expect(camel['Cosy-MachineToken']).toBe('mt-c')
      expect(camel['Cosy-MachineCode']).toBe('mc-c')
      // cosy 缺失时只发固定头,不抛
      const none = buildCosyHeaders(mkCtx({}))
      expect(none['Cosy-ClientType']).toBe('10')
      expect(none['Cosy-MachineToken']).toBeUndefined()
    })
  })

  describe('getQuota(add-on credits 余额)', () => {
    /**
     * 键序取自本仓参考实现 apps/ai-service/app/services/checkin_qoder.py 的
     * qoder_query_credits(data 包裹 → addOnQuota / add_on_quota → remaining)。
     * 2026-10-23 号池两枚在册 qoder 号真跑该端点已实证 200(remaining 100 / 388);
     * 判序仍是"认不出就落未判定",因为该上游响应细节属防御解析面。
     */
    it('addOnQuota.remaining 可解析(顶层与 data 包裹两形)', async () => {
      const { extractAddOnRemaining } =
        await import('../src/services/upstream-adapters/qoder-adapter.js')
      expect(extractAddOnRemaining({ addOnQuota: { remaining: 118.7 } })).toBe(118)
      expect(extractAddOnRemaining({ data: { add_on_quota: { remaining: 300 } } })).toBe(300)
    })

    it('认不出 remaining ⇒ null(布尔/字符串/缺字段都不算余额)', async () => {
      const { extractAddOnRemaining } =
        await import('../src/services/upstream-adapters/qoder-adapter.js')
      expect(extractAddOnRemaining({ addOnQuota: { remaining: true } })).toBeNull()
      expect(extractAddOnRemaining({ addOnQuota: { remaining: '12' } })).toBeNull()
      expect(extractAddOnRemaining({ usage: { remaining: 12 } })).toBeNull()
      expect(extractAddOnRemaining('<html>challenge</html>')).toBeNull()
      expect(extractAddOnRemaining(null)).toBeNull()
    })

    it('适配器:200 可解析 ⇒ ok:true;200 但认不出 ⇒ ok:false 未判定;永不抛', async () => {
      const { qoderAdapter } = await import('../src/services/upstream-adapters/qoder-adapter.js')
      const ctx = {
        row: { extraMetadata: {}, machineId: 'mid-1' },
        credentials: { token: 'dt-token', cookies: [], secrets: {} },
      } as never
      const stub = (payload: unknown, status = 200) =>
        ({
          ok: status >= 200 && status < 300,
          status,
          json: async () => payload,
          text: async () => JSON.stringify(payload),
        }) as never
      const hit = await qoderAdapter.getQuota!(ctx, {
        fetchImpl: (async (url: string) => {
          expect(String(url)).toContain('/api/v2/quota/usage')
          return stub({ addOnQuota: { remaining: 120 } })
        }) as never,
      })
      expect(hit.ok).toBe(true)
      expect(hit.quota?.remaining).toBe(120)

      const unknown = await qoderAdapter.getQuota!(ctx, {
        fetchImpl: (async () => stub({ data: {} })) as never,
      })
      expect(unknown.ok).toBe(false)
      expect(unknown.error).toContain('未判定')
      expect(unknown.quota).toBeUndefined()
      // 200 但认不出字段 ≠ 鉴权失效 ⇒ 不许触发换票重试
      expect(unknown.authFailed).toBeFalsy()

      const denied = await qoderAdapter.getQuota!(ctx, {
        fetchImpl: (async () =>
          stub({ code: 'TOKEN_INVALID', message: 'invalid token' }, 401)) as never,
      })
      expect(denied.ok).toBe(false)
      expect(denied.authFailed).toBe(true)

      const boom = await qoderAdapter.getQuota!(ctx, {
        fetchImpl: (async () => {
          throw new Error('socket hang up')
        }) as never,
      })
      expect(boom.ok).toBe(false)
      expect(boom.error).toContain('socket hang up')
    })
  })
})
