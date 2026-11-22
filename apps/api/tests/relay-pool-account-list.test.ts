// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SAFE_COLUMN_KEYS,
  formatQuotaLine,
  listMain,
  rowLine,
  sortByExpiry,
  type ListOutcome,
  type PoolRow,
  type QuotaView,
} from '../scripts/relay-pool-account-list.js'
import { hasVerifiedQuotaEndpoint } from '../src/services/relay-upstream-adapters.js'

// 测试隔离铁律:本文件一律 deps.fetch 注入,库连接依赖延迟在 listPoolAccounts 内,不建连。
const HERE = dirname(fileURLToPath(import.meta.url))
const LIST_TS = resolve(HERE, '..', 'scripts', 'relay-pool-account-list.ts')
const TRAE_TS = resolve(HERE, '..', 'scripts', 'relay-trae-client-switch.ts')

function row(over: Partial<PoolRow> = {}): PoolRow {
  return {
    uid: 'u-1',
    name: '13800000000',
    healthStatus: 'healthy',
    isEnabled: true,
    tempUnschedulable: false,
    tokenExpiresAt: new Date('2026-12-05T10:00:00.000Z'),
    refreshExpiresAt: new Date('2027-10-29T10:00:00.000Z'),
    credVersion: 9,
    ownerUserId: '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35',
    deviceId: 'dev-1',
    lastRefreshAt: null,
    updatedAt: null,
    ...over,
  }
}

function capture() {
  const so: string[] = []
  const se: string[] = []
  return {
    so,
    se,
    deps: {
      write: (c: string) => so.push(c),
      writeErr: (c: string) => se.push(c),
      isProviderCode: (raw: string) => raw === 'qoder' || raw === 'workbuddy',
    },
  }
}

describe('号池名单只读出口', () => {
  it('形状锁:投影字段集与 Trae 那条 --list 逐字同形(两处漂移即红)', () => {
    const src = readFileSync(TRAE_TS, 'utf8')
    const start = src.indexOf('const SAFE_COLUMNS = {')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, src.indexOf('\n}', start))
    const traeKeys = [...block.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1])
    expect(traeKeys.length).toBeGreaterThan(0)
    expect(SAFE_COLUMN_KEYS).toEqual(traeKeys)
  })

  it('密文列绝不入选投影(名单面零凭据暴露的硬前提)', () => {
    for (const forbidden of [
      'tokenEnc',
      'refreshTokenEnc',
      'cookiesEnc',
      'secretsEnc',
      'token_enc',
      'refresh_token_enc',
      'cookies_enc',
      'secrets_enc',
    ]) {
      expect(SAFE_COLUMN_KEYS).not.toContain(forbidden)
    }
    // 源文件里也不得出现密文列名(连 import 都不许)
    const src = readFileSync(LIST_TS, 'utf8')
    expect(src).not.toMatch(/tokenEnc|refreshTokenEnc|cookiesEnc|secretsEnc/)
  })

  it('sortByExpiry:到期最晚在前、无到期沉底、一行不丢', () => {
    const rows = [
      row({ uid: 'b-none', tokenExpiresAt: null }),
      row({ uid: 'a-soon', tokenExpiresAt: new Date('2026-11-01T00:00:00.000Z') }),
      row({ uid: 'c-late', tokenExpiresAt: new Date('2027-01-01T00:00:00.000Z') }),
    ]
    const sorted = sortByExpiry(rows)
    expect(sorted.map((r) => r.uid)).toEqual(['c-late', 'a-soon', 'b-none'])
    expect(sorted.length).toBe(rows.length)
    // 入参不被就地改动(调用方还要拿原序做别的事)
    expect(rows.map((r) => r.uid)).toEqual(['b-none', 'a-soon', 'c-late'])
  })

  it('rowLine:如实投影归属两桶,且不含任何令牌形态字段', () => {
    const line = rowLine(row({ ownerUserId: null, deviceId: null }))
    expect(line).toContain('归属=运营池')
    expect(line).toContain('设备=无')
    expect(line).toContain('健康=healthy')
    const mine = rowLine(row())
    expect(mine).toContain('归属=30763d9f')
    expect(mine).not.toMatch(/accessToken|refreshToken\b/)
  })

  it('参数牙:缺 --provider / 空值 / 未知平台 ⇒ exit 2 且不猜', async () => {
    const c = capture()
    expect(await listMain([], c.deps)).toBe(2)
    expect(c.so.join('')).toBe('')
    expect(await listMain(['--provider'], c.deps)).toBe(2)
    expect(await listMain(['--provider', '--json'], c.deps)).toBe(2)
    expect(await listMain(['--provider', 'nosuch'], c.deps)).toBe(2)
    expect(c.se.join('')).toContain('未知平台')
  })

  it('取不到行 ⇒ 未判定 exit 2,不冒绿也不冒"没号"', async () => {
    const c = capture()
    const rc = await listMain(['--provider', 'qoder'], {
      ...c.deps,
      fetch: () => Promise.reject(new Error('connection refused')),
    })
    expect(rc).toBe(2)
    expect(c.se.join('')).toContain('未判定')
  })

  it('枚举到 0 枚 ⇒ exit 0 并如实给下一步,不冒充门坏', async () => {
    const c = capture()
    const empty: ListOutcome = {
      providerCode: 'workbuddy',
      total: 0,
      accounts: [],
      asOf: '2026-11-05T12:00:00.000Z',
    }
    expect(
      await listMain(['--provider', 'workbuddy'], { ...c.deps, fetch: async () => empty }),
    ).toBe(0)
    expect(c.so.join('')).toContain('共 0 枚')
    expect(c.so.join('')).toContain('relay-account-pool')
  })

  it('正常档:计数行 + 每号一行 + --json 可机读', async () => {
    const c = capture()
    const outcome: ListOutcome = {
      providerCode: 'qoder',
      total: 2,
      accounts: [row({ uid: 'u-a' }), row({ uid: 'u-b', tokenExpiresAt: null })],
      asOf: '2026-11-05T12:00:00.000Z',
    }
    expect(await listMain(['--provider', 'qoder'], { ...c.deps, fetch: async () => outcome })).toBe(
      0,
    )
    const text = c.so.join('')
    expect(text).toContain('共 2 枚')
    expect(text.match(/uid=u-/g)?.length).toBe(2)

    const c2 = capture()
    expect(
      await listMain(['--provider', 'qoder', '--json'], { ...c2.deps, fetch: async () => outcome }),
    ).toBe(0)
    const parsed = JSON.parse(c2.so.join('')) as ListOutcome
    expect(parsed.providerCode).toBe('qoder')
    expect(parsed.accounts.map((r) => r.uid)).toEqual(['u-a', 'u-b'])
    // 机读面同样没有密文键
    for (const k of ['tokenEnc', 'cookiesEnc', 'secretsEnc'])
      expect(parsed.accounts[0]).not.toHaveProperty(k)
  })

  it('--counts:与 --provider 互斥、量不到不冒绿、0 行如实说没号', async () => {
    const c = capture()
    expect(await listMain(['--counts', '--provider', 'qoder'], c.deps)).toBe(2)
    expect(c.se.join('')).toContain('互斥')

    const c2 = capture()
    expect(
      await listMain(['--counts'], {
        ...c2.deps,
        counts: () => Promise.reject(new Error('connection refused')),
      }),
    ).toBe(2)
    expect(c2.se.join('')).toContain('未判定')

    const c3 = capture()
    expect(await listMain(['--counts'], { ...c3.deps, counts: async () => [] })).toBe(0)
    expect(c3.so.join('')).toContain('0 行')
  })

  it('--counts:逐平台枚数为人读与机读两脸同数', async () => {
    const rows = [
      { providerCode: 'doubao', total: 12, enabled: 12 },
      { providerCode: 'qoder', total: 11, enabled: 11 },
    ]
    const c = capture()
    expect(await listMain(['--counts'], { ...c.deps, counts: async () => rows })).toBe(0)
    const text = c.so.join('')
    expect(text).toContain('共 23 行')
    expect(text).toContain('doubao 总=12 启用=12')

    const c2 = capture()
    expect(await listMain(['--counts', '--json'], { ...c2.deps, counts: async () => rows })).toBe(0)
    const parsed = JSON.parse(c2.so.join('')) as { counts: typeof rows }
    expect(parsed.counts.reduce((s, r) => s + r.total, 0)).toBe(23)
  })

  it('已过期的票在人读行当场标出来(写回腿不校验票效,名单就得把现值说到眼前)', () => {
    const now = new Date('2026-11-05T12:00:00.000Z')
    const dead = row({ tokenExpiresAt: new Date('2026-11-05T03:33:25.000Z') })
    const alive = row({ tokenExpiresAt: new Date('2026-12-05T03:33:25.000Z') })
    const none = row({ tokenExpiresAt: null })
    expect(rowLine(dead, now)).toContain('token到期=2026-11-05T03:33:25.000Z(已过)')
    expect(rowLine(alive, now)).not.toContain('(已过)')
    // 无到期字段 ≠ 过期:如实留 '-',不替上游判死
    expect(rowLine(none, now)).toContain('token到期=-')
    expect(rowLine(none, now)).not.toContain('(已过)')
    // 刻意只陈述现值:本投影不含"刷新材料在不在册"那一列,所以不许下"登不进"这种后果断言
    expect(rowLine(dead, now)).not.toMatch(/登不进|救不回|不可能/)
  })

  it('--mask:名称按单源掩码,uid 仍留全值,两面都不外泄全号', async () => {
    const outcome: ListOutcome = {
      providerCode: 'qoder',
      total: 1,
      accounts: [row({ uid: 'u-keep', name: '15699571035' })],
      asOf: '2026-11-05T12:00:00.000Z',
    }
    const c = capture()
    expect(
      await listMain(['--provider', 'qoder', '--mask'], { ...c.deps, fetch: async () => outcome }),
    ).toBe(0)
    expect(c.so.join('')).not.toMatch(/15699571035/)
    expect(c.so.join('')).toContain('u-keep')
    // 带 --mask 时不该再多嘴提示
    expect(c.so.join('')).not.toContain('未带 --mask')
    // 反向:手敲不带 --mask 的那条路径必须自报"名称是原值"(净检出复量抓到的缺口)
    const c3 = capture()
    expect(
      await listMain(['--provider', 'qoder'], { ...c3.deps, fetch: async () => outcome }),
    ).toBe(0)
    expect(c3.so.join('')).toContain('未带 --mask')
    expect(c3.so.join('')).toContain('15699571035')
    // 人读档必须点出取数时刻(两屏之间池可能被别的会话改)
    expect(c.so.join('')).toContain('取数时刻=2026-11-05T12:00:00.000Z')

    const c2 = capture()
    await listMain(['--provider', 'qoder', '--mask', '--json'], {
      ...c2.deps,
      fetch: async () => outcome,
    })
    const j = JSON.parse(c2.so.join('')) as ListOutcome
    expect(j.accounts[0].name).not.toBe('15699571035')
    expect(j.accounts[0].uid).toBe('u-keep')
    expect(j.asOf).toBe('2026-11-05T12:00:00.000Z')
  })

  it('--help ⇒ exit 0 并点名日常入口', async () => {
    const c = capture()
    expect(await listMain(['--help'], c.deps)).toBe(0)
    expect(c.so.join('')).toContain('switch-client-account.mjs')
  })

  it('--with-quota 用法行必须交代"无实证端点标未支持、不编 0"', async () => {
    const c = capture()
    expect(await listMain(['--help'], c.deps)).toBe(0)
    const help = c.so.join('')
    expect(help).toContain('--with-quota')
    expect(help).toContain('未支持')
    expect(help).toContain('不编 0')
  })
})

describe('实时额度视图(--with-quota)', () => {
  const outcome: ListOutcome = {
    providerCode: 'qoder',
    total: 2,
    accounts: [row({ uid: 'u-a' }), row({ uid: 'u-b' })],
    asOf: '2026-11-10T09:30:00.000Z',
  }
  /** 全列取行的注入桩:只给 uid,零凭据(测试隔离铁律:不连库、不解密) */
  const quotaRows = async () => [{ uid: 'u-a' }, { uid: 'u-b' }] as never

  it('四态人话:已查到/未支持/凭据失效(过期与否)/未判定,绝不给假数', () => {
    expect(
      formatQuotaLine({ ok: true, remaining: 900, used: 2100, total: 3000, unit: 'trae 积分' }),
    ).toContain('剩余=900')
    expect(formatQuotaLine({ ok: false, unsupported: true })).toContain('未支持')
    // 确凿过期才说"需重登";否则只说"被上游拒收",不对确认废的号暗示重登能救
    expect(formatQuotaLine({ ok: false, authFailed: true })).toContain('凭据被上游拒收')
    expect(formatQuotaLine({ ok: false, authFailed: true, tokenExpired: true })).toContain(
      '令牌已过期',
    )
    expect(formatQuotaLine({ ok: false, error: '上游未给判定依据' })).toContain('未判定')
    // 未支持/未判定一律不得出现任何数字冒充额度
    expect(formatQuotaLine({ ok: false, unsupported: true })).not.toMatch(/\d/)
    expect(formatQuotaLine({ ok: false, error: '网络超时' })).not.toMatch(/剩余=|已用=/)
    expect(formatQuotaLine(undefined)).toContain('未拉取')
  })

  it('JSON 与人读两面都带 quota,按 uid 映射、零凭据外泄', async () => {
    const views: Record<string, QuotaView> = {
      'u-a': { ok: true, remaining: 900, used: 2100, total: 3000, ratio: 0.7, unit: 'trae 积分' },
      'u-b': { ok: false, unsupported: true },
    }
    const quotaOf = async (r: { uid: string }) => views[r.uid]
    const c = capture()
    expect(
      await listMain(['--provider', 'qoder', '--json', '--with-quota'], {
        ...c.deps,
        fetch: async () => outcome,
        quotaRows,
        quotaOf,
      }),
    ).toBe(0)
    const parsed = JSON.parse(c.so.join('')) as ListOutcome
    expect(parsed.quota?.['u-a']).toMatchObject({ ok: true, remaining: 900 })
    expect(parsed.quota?.['u-b']).toMatchObject({ ok: false, unsupported: true })
    expect(c.so.join('')).not.toMatch(/tokenEnc|cookiesEnc|secretsEnc|token_enc/)

    const c2 = capture()
    expect(
      await listMain(['--provider', 'qoder', '--with-quota'], {
        ...c2.deps,
        fetch: async () => outcome,
        quotaRows,
        quotaOf,
      }),
    ).toBe(0)
    const text = c2.so.join('')
    expect(text).toContain('剩余=900')
    expect(text).toContain('未支持')
    // 名单照常,额度是附加行,不吞任何一枚账号
    expect(text.match(/uid=u-/g)?.length).toBe(2)
  })

  it('不带 --with-quota 时零额度查询、输出里没有 quota 字段', async () => {
    let called = 0
    const c = capture()
    expect(
      await listMain(['--provider', 'qoder', '--json'], {
        ...c.deps,
        fetch: async () => outcome,
        quotaRows: async () => {
          called += 1
          return quotaRows()
        },
        quotaOf: async () => ({ ok: true, remaining: 1 }),
      }),
    ).toBe(0)
    expect(called).toBe(0)
    expect(JSON.parse(c.so.join(''))).not.toHaveProperty('quota')
  })

  it('某枚查不动不致命:名单照常、额度行如实标未判定(§0.3 取不到≠失效)', async () => {
    const c = capture()
    expect(
      await listMain(['--provider', 'qoder', '--with-quota', '--json'], {
        ...c.deps,
        fetch: async () => outcome,
        quotaRows,
        quotaOf: async (r: { uid: string }) =>
          r.uid === 'u-b' ? { ok: false, error: '上游 5xx(未判定)' } : { ok: true, remaining: 42 },
      }),
    ).toBe(0)
    const parsed = JSON.parse(c.so.join('')) as ListOutcome
    expect(parsed.accounts).toHaveLength(2)
    expect(parsed.quota?.['u-a']).toMatchObject({ ok: true, remaining: 42 })
    expect(parsed.quota?.['u-b']).toMatchObject({ ok: false })
    expect(parsed.quota?.['u-b']?.remaining).toBeUndefined()
  })

  it('全列取行整趟炸 ⇒ 名单仍 exit 0,stderr 如实报未判定', async () => {
    const c = capture()
    expect(
      await listMain(['--provider', 'qoder', '--with-quota'], {
        ...c.deps,
        fetch: async () => outcome,
        quotaRows: async () => {
          throw new Error('connection refused')
        },
      }),
    ).toBe(0)
    expect(c.so.join('')).toContain('共 2 枚')
    expect(c.se.join('')).toContain('未判定')
  })
})

describe('额度端点能力判据(单一真相源)', () => {
  it('方法存在 ≠ 有已实证端点:quotaSupported:false 直接判未支持,零探测', () => {
    const getQuota = async () => ({ ok: false })
    expect(hasVerifiedQuotaEndpoint(null)).toBe(false)
    expect(hasVerifiedQuotaEndpoint(undefined)).toBe(false)
    expect(hasVerifiedQuotaEndpoint({} as never)).toBe(false)
    expect(hasVerifiedQuotaEndpoint({ getQuota } as never)).toBe(true)
    expect(hasVerifiedQuotaEndpoint({ getQuota, quotaSupported: true } as never)).toBe(true)
    expect(hasVerifiedQuotaEndpoint({ getQuota, quotaSupported: false } as never)).toBe(false)
  })

  it('四个无公开端点适配器都必须显式声明 false(漏一枚就白发探测)', async () => {
    const mods = await Promise.all([
      import('../src/services/upstream-adapters/doubao-adapter.js'),
      import('../src/services/upstream-adapters/lingma-adapter.js'),
      import('../src/services/upstream-adapters/codex-adapter.js'),
      import('../src/services/upstream-adapters/opencode-adapter.js'),
    ])
    const keys = ['doubaoAdapter', 'lingmaAdapter', 'codexAdapter', 'opencodeAdapter']
    for (const [i, m] of mods.entries()) {
      const a = (m as unknown as Record<string, { quotaSupported?: boolean }>)[keys[i]]
      expect(a, `${keys[i]} 应导出适配器对象`).toBeTruthy()
      expect(a.quotaSupported, `${keys[i]} 必须声明 quotaSupported:false`).toBe(false)
      expect(hasVerifiedQuotaEndpoint(a as never)).toBe(false)
    }
  })

  it('loomy 余额端点 2026-11-10 实证:必须判为已支持(不得再标未支持)', async () => {
    const { loomyAdapter } = await import('../src/services/upstream-adapters/loomy-adapter.js')
    expect(hasVerifiedQuotaEndpoint(loomyAdapter as never)).toBe(true)
  })

  it('trae 走真端点:不得被误标为未支持', async () => {
    const { traeAdapter } = await import('../src/services/upstream-adapters/trae-adapter.js')
    expect(hasVerifiedQuotaEndpoint(traeAdapter as never)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
