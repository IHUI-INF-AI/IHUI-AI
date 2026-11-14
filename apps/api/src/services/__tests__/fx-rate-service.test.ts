// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getFxSnapshot,
  __resetFxCacheForTest,
  __setFxDepsForTest,
} from '../fx-rate-service.js'

/**
 * 实时汇率服务单测(2026-11-14 立)。
 * 覆盖:三源成功 / 主源失败降级 / 全源失败走 DB / DB 也失败走 env / TTL 缓存。
 */

const ER_OK = { result: 'success', rates: { CNY: 6.67 } }
const FRANK_OK = { rates: { CNY: 6.68 } }
const CG_OK = { tether: { cny: 6.66 } }

function fetchByUrl(map: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const hit = Object.entries(map).find(([k]) => url.includes(k))
    if (!hit) throw new Error(`unexpected url ${url}`)
    return hit[1]
  })
}

beforeEach(() => {
  delete process.env['FX_RATE_TTL_SECONDS']
  __resetFxCacheForTest()
})

afterEach(() => {
  __resetFxCacheForTest()
  vi.restoreAllMocks()
  delete process.env['FX_RATE_TTL_SECONDS']
})

describe('fx-rate-service', () => {
  it('三源可用时返回实时价,且 USD/USDT 分开取源', async () => {
    __setFxDepsForTest({
      fetchJson: fetchByUrl({ 'open.er-api.com': ER_OK, 'coingecko.com': CG_OK }),
      findRate: async () => null,
      envUsdCny: () => 7.2,
      now: () => Date.parse('2026-11-14T12:00:00Z'),
    })
    const snap = await getFxSnapshot()
    expect(snap.cnyPer.USD).toBe(6.67)
    expect(snap.cnyPer.USDT).toBe(6.66)
    expect(snap.perCny.USD).toBeCloseTo(1 / 6.67, 6)
    expect(snap.sources.usdCny).toBe('open.er-api.com')
    expect(snap.sources.usdtCny).toBe('coingecko:tether/cny')
    expect(snap.stale).toBe(false)
    expect(snap.fetchedAt).toBe('2026-11-14T12:00:00.000Z')
  })

  it('主源失败时降级到 frankfurter', async () => {
    __setFxDepsForTest({
      fetchJson: fetchByUrl({ 'frankfurter.app': FRANK_OK, 'coingecko.com': CG_OK }),
      // open.er-api 不在 map 中 ⇒ 抛错
      findRate: async () => null,
      envUsdCny: () => 7.2,
      now: () => Date.now(),
    })
    const snap = await getFxSnapshot()
    expect(snap.cnyPer.USD).toBe(6.68)
    expect(snap.sources.usdCny).toBe('frankfurter.app')
  })

  it('上游全挂时走 DB 汇率', async () => {
    __setFxDepsForTest({
      fetchJson: async () => {
        throw new Error('network down')
      },
      findRate: async (from, to) => (from === 'USD' && to === 'CNY' ? { rate: 6.65 } : null),
      envUsdCny: () => 7.2,
      now: () => Date.now(),
    })
    const snap = await getFxSnapshot()
    expect(snap.cnyPer.USD).toBe(6.65)
    // USDT 在 DB 无行 ⇒ 按 USD 锚定
    expect(snap.cnyPer.USDT).toBe(6.65)
    expect(snap.sources.usdCny).toBe('db:zhs_exchange_rate')
    expect(snap.sources.usdtCny).toBe('usdt-peg:USD')
  })

  it('上游与 DB 都不可用时用 env 兜底并标 stale', async () => {
    __setFxDepsForTest({
      fetchJson: async () => {
        throw new Error('network down')
      },
      findRate: async () => null,
      envUsdCny: () => 7.2,
      now: () => Date.now(),
    })
    const snap = await getFxSnapshot()
    expect(snap.cnyPer.USD).toBe(7.2)
    expect(snap.cnyPer.USDT).toBe(7.2)
    expect(snap.stale).toBe(true)
  })

  it('非法汇率被拒绝,不污染整站价格', async () => {
    __setFxDepsForTest({
      fetchJson: fetchByUrl({
        'open.er-api.com': { result: 'success', rates: { CNY: 0 } },
        'frankfurter.app': FRANK_OK,
        'coingecko.com': { tether: { cny: -1 } },
      }),
      findRate: async () => null,
      envUsdCny: () => 7.2,
      now: () => Date.now(),
    })
    const snap = await getFxSnapshot()
    expect(snap.cnyPer.USD).toBe(6.68)
    expect(snap.cnyPer.USDT).toBe(6.68)
  })

  it('TTL 内复用缓存,不重复打上游', async () => {
    const fetchJson = fetchByUrl({ 'open.er-api.com': ER_OK, 'coingecko.com': CG_OK })
    __setFxDepsForTest({
      fetchJson,
      findRate: async () => null,
      envUsdCny: () => 7.2,
      now: () => Date.now(),
    })
    await getFxSnapshot()
    const first = fetchJson.mock.calls.length
    await getFxSnapshot()
    expect(fetchJson.mock.calls.length).toBe(first)
  })
})
