// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { __test__ as loginRegion } from '../login-region.js'

/**
 * 登录呈现地区判据(2026-10-27 立)。
 *
 * 需求:国内访客的登录窗把微信扫码排第一,海外访客把邮箱 + Google/GitHub 排第一。
 * 本文件钉的是**产出侧**——「这个请求算国内还是海外、依据哪一腿、判不出时怎么办」。
 * 排序判据在前端侧 `packages/ui-react/.../region-policy.ts`,两侧各管一段、互不复算。
 *
 * 判据 import 源文件的 `__test__`(§22c),这里不复制任何国家码表或正则。
 */

const lookupMock = vi.hoisted(() => vi.fn())

vi.mock('../geoip.js', () => ({
  getGeoIpService: () => ({ lookup: lookupMock }),
}))

const PUBLIC_IP = '203.0.113.9'

function makeRequest(headers: Record<string, string>, ip = PUBLIC_IP) {
  return { headers, ip }
}

beforeEach(() => {
  loginRegion.clearVerdictCache()
  loginRegion.clearLookupQuota()
  lookupMock.mockReset()
})

/* ── 国家码 → 地区 ───────────────────────────────────────────────────────── */

describe('countryToRegion', () => {
  it('CN 算国内,其余国家码算海外', () => {
    expect(loginRegion.countryToRegion('CN')).toBe('domestic')
    expect(loginRegion.countryToRegion('cn')).toBe('domestic')
    expect(loginRegion.countryToRegion('US')).toBe('overseas')
    expect(loginRegion.countryToRegion('JP')).toBe('overseas')
  })

  it('非两字母形态一律不判:CF 的 XX 哨兵、国名全称、空串、脏值', () => {
    expect(loginRegion.countryToRegion('XX')).toBeNull()
    expect(loginRegion.countryToRegion('CHINA')).toBeNull()
    expect(loginRegion.countryToRegion('')).toBeNull()
    expect(loginRegion.countryToRegion('C')).toBeNull()
    expect(loginRegion.countryToRegion('CN ')).toBeNull()
  })
})

/* ── 判序:边缘头优先 ─────────────────────────────────────────────────────── */

describe('resolveLoginRegion — CF 边缘头', () => {
  it('cf-ipcountry=CN 直接判国内,并且一次都不问 GeoIP(零网络是这条腿的全部意义)', async () => {
    const verdict = await loginRegion.resolveLoginRegion(makeRequest({ 'cf-ipcountry': 'CN' }))
    expect(verdict).toEqual({ region: 'domestic', source: 'cf-ipcountry' })
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('cf-ipcountry=US 判海外,压过 GeoIP 会给出的别的答复', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    const verdict = await loginRegion.resolveLoginRegion(makeRequest({ 'cf-ipcountry': 'US' }))
    expect(verdict).toEqual({ region: 'overseas', source: 'cf-ipcountry' })
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('小写头值与 XX 哨兵:XX 不算国家码,落到下一腿', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    expect(
      (await loginRegion.resolveLoginRegion(makeRequest({ 'cf-ipcountry': 'us' }))).region,
    ).toBe('overseas')
    loginRegion.clearVerdictCache()
    const xx = await loginRegion.resolveLoginRegion(makeRequest({ 'cf-ipcountry': 'XX' }))
    expect(xx.source).toBe('geoip')
  })

  it('重复请求头(数组形态)不被当成国家码,回落 GeoIP 而不是崩', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    const weird = { 'cf-ipcountry': ['CN', 'US'] } as unknown as Record<string, string>
    const verdict = await loginRegion.resolveLoginRegion(makeRequest(weird))
    expect(verdict.source).toBe('geoip')
  })
})

/* ── 判序:GeoIP 兜底腿 ───────────────────────────────────────────────────── */

describe('resolveLoginRegion — GeoIP 兜底', () => {
  it('无边缘头时按 GeoIP 的国家码判', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    expect(await loginRegion.resolveLoginRegion(makeRequest({}))).toEqual({
      region: 'domestic',
      source: 'geoip',
    })
    loginRegion.clearVerdictCache()
    lookupMock.mockResolvedValue({ countryCode: 'DE' })
    expect((await loginRegion.resolveLoginRegion(makeRequest({}))).region).toBe('overseas')
  })

  it('只给 country 人名的答复判不出 —— 判据必须吃 countryCode,不能被「中国/China」骗过', async () => {
    lookupMock.mockResolvedValue({ country: 'China' })
    const verdict = await loginRegion.resolveLoginRegion(makeRequest({}))
    expect(verdict).toEqual({ region: null, source: 'undetermined' })
  })

  it('查不到(null)与远程抛错都落未判定,不抛、不猜方向', async () => {
    lookupMock.mockResolvedValue(null)
    expect(await loginRegion.resolveLoginRegion(makeRequest({}))).toEqual({
      region: null,
      source: 'undetermined',
    })
    loginRegion.clearVerdictCache()
    lookupMock.mockRejectedValue(new Error('ip-api 45 req/min 撞限'))
    expect(await loginRegion.resolveLoginRegion(makeRequest({}))).toEqual({
      region: null,
      source: 'undetermined',
    })
  })

  it('回环/内网一律不查远程并落未判定(本机与局域网不该被算成某个国家)', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.7', '::1']) {
      const verdict = await loginRegion.resolveLoginRegion(makeRequest({}, ip))
      expect(verdict, ip).toEqual({ region: null, source: 'undetermined' })
    }
    expect(lookupMock).not.toHaveBeenCalled()
  })
})

/* ── 限流保护:同 IP 不重复问远程 ─────────────────────────────────────────── */

describe('resolveLoginRegion — 按 IP 的结果缓存', () => {
  it('同一 IP 连续两次只问一次远程(免费版 45 req/min,登录页会反复开)', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    await loginRegion.resolveLoginRegion(makeRequest({}))
    await loginRegion.resolveLoginRegion(makeRequest({}))
    expect(lookupMock).toHaveBeenCalledTimes(1)
    expect(loginRegion.verdictCacheSize()).toBe(1)
  })

  it('未判定同样进缓存:判不出的 IP 反复重试只会更快撞穿限流', async () => {
    lookupMock.mockResolvedValue(null)
    await loginRegion.resolveLoginRegion(makeRequest({}))
    await loginRegion.resolveLoginRegion(makeRequest({}))
    expect(lookupMock).toHaveBeenCalledTimes(1)
  })

  it('反向断言:换了 IP 必须重新判(缓存不能把第一个访客的地区发给所有人)', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    await loginRegion.resolveLoginRegion(makeRequest({}, PUBLIC_IP))
    lookupMock.mockResolvedValue({ countryCode: 'US' })
    const other = await loginRegion.resolveLoginRegion(makeRequest({}, '198.51.100.4'))
    expect(other.region).toBe('overseas')
    expect(lookupMock).toHaveBeenCalledTimes(2)
  })
})

/* ── 远程腿配额:request.ip 来自客户端可自报的 XFF ⇒ 不能让人拿伪造 IP 耗尽 ip-api ── */

describe('resolveLoginRegion — 远程 GeoIP 腿的每分钟配额', () => {
  it('预算内每个新 IP 各问一次;超预算后一枪都不放,并落未判定', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'US' })
    for (let i = 1; i <= 20; i++) {
      const verdict = await loginRegion.resolveLoginRegion(makeRequest({}, `203.0.113.${i}`))
      expect(verdict.region, `第 ${i} 个 IP 还在预算内`).toBe('overseas')
    }
    expect(lookupMock).toHaveBeenCalledTimes(20)

    const exhausted = await loginRegion.resolveLoginRegion(makeRequest({}, '203.0.113.99'))
    expect(exhausted).toEqual({ region: null, source: 'undetermined' })
    expect(lookupMock, '超预算不得再发起远程查询').toHaveBeenCalledTimes(20)
  })

  it('反向断言:超预算那一轮不写缓存(否则窗口过去后仍被自己的拒绝钉死 6 小时)', async () => {
    lookupMock.mockResolvedValue({ countryCode: 'CN' })
    for (let i = 1; i <= 21; i++) {
      await loginRegion.resolveLoginRegion(makeRequest({}, `198.51.100.${i}`))
    }
    expect(loginRegion.verdictCacheSize()).toBe(20)
  })

  it('CF 边缘头命中时一份额度都不消耗 —— 零网络那条腿不该被远程预算限住', async () => {
    for (let i = 1; i <= 40; i++) {
      const verdict = await loginRegion.resolveLoginRegion(
        makeRequest({ 'cf-ipcountry': 'CN' }, `203.0.113.${i}`),
      )
      expect(verdict.source).toBe('cf-ipcountry')
    }
    expect(lookupMock).not.toHaveBeenCalled()

    lookupMock.mockResolvedValue({ countryCode: 'US' })
    const after = await loginRegion.resolveLoginRegion(makeRequest({}, '192.0.2.1'))
    expect(after.region).toBe('overseas')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
