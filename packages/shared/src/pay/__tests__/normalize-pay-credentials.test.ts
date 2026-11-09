// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 支付凭据归一化夹具(2026-11-08,同型根因自查 shared 信任类)。
 *
 * 缺陷形态:`pickFirst<T>` + `as string` 把服务端下发的任何类型原样当字符串,
 * 数组/对象可直穿到 react-native-wechat-lib / Taro.requestPayment 的签名参数。
 * 红证(legacy):数组/对象/数字断言全部落空(见提交前读数)。
 */
import type { AnyPayParams } from '@ihui/types'
import { describe, expect, it } from 'vitest'
import { buildAppWxOrderInfo, normalizeAliPayParams, normalizeWxPayParams } from '../normalize'

function asAnyPayParams(raw: Record<string, unknown>): AnyPayParams {
  return raw as unknown as AnyPayParams
}

describe('normalizeWxPayParams — 凭据只收标量', () => {
  it('有限数字收敛成字符串;数组/对象按缺失处理,不直穿 as string', () => {
    const out = normalizeWxPayParams({
      appid: 123,
      partnerid: ['p1', 'p2'],
      prepayid: { id: 'x' },
      package: { wrong: true },
      noncestr: 456,
      timestamp: { t: 1 },
      sign: { s: 'sig' },
    })

    expect(out.appid).toBe('123')
    expect(out.partnerid).toBeUndefined()
    expect(out.prepayid).toBeUndefined()
    expect(out.package).toBe('Sign=WXPay')
    expect(out.noncestr).toBe('456')
    expect(out.sign).toBeUndefined()
    // 对象时间戳不得变成 '[object Object]',应回落到当前秒
    expect(out.timestamp).not.toContain('object')
    expect(Number(out.timestamp)).toBeGreaterThan(1_000_000_000)
  })

  it('多命名变体正常收敛(既有行为不回退)', () => {
    const out = normalizeWxPayParams({
      appId: 'wx-app',
      prepay_id: 'pre-1',
      nonceStr: 'nonce-1',
      sign: 'sig-1',
    })
    expect(out).toMatchObject({
      appid: 'wx-app',
      prepayid: 'pre-1',
      noncestr: 'nonce-1',
      sign: 'sig-1',
    })
  })
})

describe('buildAppWxOrderInfo — 不把数组/对象写进 orderInfo', () => {
  it('无 orderInfo 时按归一化结果序列化', () => {
    const parsed = JSON.parse(
      buildAppWxOrderInfo(
        asAnyPayParams({ appid: 1, prepayid: ['a'], sign: { s: 1 }, package: { p: 1 } }),
      ),
    )
    expect(parsed.appid).toBe('1')
    expect(parsed.prepayid).toBeUndefined()
    expect(parsed.sign).toBeUndefined()
    expect(parsed.package).toBe('Sign=WXPay')
  })

  it('orderInfo 是对象时仍原样序列化(合法分支保留)', () => {
    const obj = { appId: 'wx', sign: 's' }
    expect(JSON.parse(buildAppWxOrderInfo(asAnyPayParams({ orderInfo: obj })))).toEqual(obj)
  })
})

describe('normalizeAliPayParams — 数组/对象凭据按缺失处理', () => {
  it('tradeNO 数组 / orderStr 对象 / orderInfo 数组都不直穿', () => {
    const out = normalizeAliPayParams({ tradeNO: ['t1'], orderStr: { s: 'x' }, orderInfo: ['o'] })
    expect(out.tradeNO).toBeUndefined()
    expect(out.orderStr).toBeUndefined()
    expect(out.orderInfo).toBeUndefined()
  })

  it('字符串凭据保留,orderStr 优先于 orderInfo', () => {
    expect(normalizeAliPayParams({ tradeNO: 't', orderStr: 'o1', orderInfo: 'o2' })).toEqual({
      tradeNO: 't',
      orderStr: 'o1',
      orderInfo: 'o2',
    })
    expect(normalizeAliPayParams({ orderInfo: 'o2' }).orderStr).toBe('o2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
