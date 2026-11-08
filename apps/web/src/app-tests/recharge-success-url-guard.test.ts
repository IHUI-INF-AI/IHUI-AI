// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return fs.readFileSync(path.resolve(here, rel), 'utf8')
}

describe('充值成功页不接受 URL 里的金额/二维码(W-07)', () => {
  const success = read('../../app/(main)/wallet/recharge/success/PageClient.tsx')
  const recharge = read('../../app/(main)/wallet/recharge/page.tsx')
  const topup = read('../../app/(main)/purchase/TopupTab.tsx')

  it('成功页只从 URL 取 orderNo,金额/支付方式来自服务端订单详情', () => {
    expect(success).toContain("searchParams.get('orderNo')")
    expect(success).not.toContain("searchParams.get('amount')")
    expect(success).not.toContain("searchParams.get('method')")
    expect(success).not.toContain("searchParams.get('codeUrl')")
    expect(success).not.toContain("searchParams.get('payUrl')")
    expect(success).toContain('readRechargeQr')
    expect(success).toContain('order?.amount')
    expect(success).toContain('order?.paymentMethod')
  })

  it('两个下单页不再把二维码/金额拼进 URL,只写 sessionStorage + orderNo', () => {
    for (const src of [recharge, topup]) {
      expect(src).toContain('saveRechargeQr')
      expect(src).not.toContain("params.set('codeUrl'")
      expect(src).not.toContain("params.set('payUrl'")
      expect(src).toMatch(/wallet\/recharge\/success\?orderNo=/)
    }
  })
})
