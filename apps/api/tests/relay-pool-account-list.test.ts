// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SAFE_COLUMN_KEYS,
  listMain,
  rowLine,
  sortByExpiry,
  type ListOutcome,
  type PoolRow,
} from '../scripts/relay-pool-account-list.js'

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
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
