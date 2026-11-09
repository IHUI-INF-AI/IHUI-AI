// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// XUI-009 夹具:小程序充值
//   ① 后端 `/payments/wechat/create` 返回**扁平** JSAPI 签名,页面不得再读 `res.payParams`;
//   ② 充值必须带 orderType=2(缺省 0 ⇒ 后端不按充值入账);
//   ③ 微信下单 amount 单位为分,页面输入是元;
//   ④ mock/缺签名不得直接跳 paid。
// 改前必红:旧页面读 res.payParams(恒 undefined)且把元当分传。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildWechatPayParams, yuanToCents } from '../src/pkg-shop/wallet/recharge/recharge-props'

const ROOT = resolve(__dirname, '..')

describe('XUI-009 小程序充值支付契约', () => {
  it('yuanToCents:元按分换算,四舍五入到整数分', () => {
    expect(yuanToCents(10)).toBe(1000)
    expect(yuanToCents(50)).toBe(5000)
    expect(yuanToCents(0.1)).toBe(10)
    expect(yuanToCents(1.234)).toBe(123)
  })

  it('buildWechatPayParams:读扁平签名,不读 payParams 包络', () => {
    const params = buildWechatPayParams({
      outTradeNo: 'R1',
      timeStamp: '1700000000',
      nonceStr: 'n1',
      package: 'prepay_id=wx1',
      signType: 'RSA',
      paySign: 'sig',
    })
    expect(params).toEqual({
      timeStamp: '1700000000',
      nonceStr: 'n1',
      package: 'prepay_id=wx1',
      signType: 'RSA',
      paySign: 'sig',
    })
  })

  it('buildWechatPayParams:mock 或缺 paySign 一律 null(不得当成功)', () => {
    expect(buildWechatPayParams({ outTradeNo: 'R2', mock: true })).toBeNull()
    expect(
      buildWechatPayParams({
        outTradeNo: 'R3',
        timeStamp: '1',
        nonceStr: 'n',
        package: 'prepay_id=x',
      }),
    ).toBeNull()
  })

  it('createRecharge 固定 orderType=2 且 amount 为分', () => {
    const src = readFileSync(resolve(ROOT, 'src/api/index.ts'), 'utf8')
    const block = src.slice(src.indexOf('export const createRecharge'))
    expect(block).toContain('orderType=2')
    expect(block).toContain('amountCents')
  })

  it('充值页走 buildWechatPayParams,不再读 res.payParams', () => {
    const src = readFileSync(resolve(ROOT, 'src/pkg-shop/wallet/recharge/index.tsx'), 'utf8')
    expect(src).toContain('buildWechatPayParams(res)')
    expect(src).not.toContain('res.payParams')
    expect(src).toContain('createRecharge(yuanToCents(amount), method)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
