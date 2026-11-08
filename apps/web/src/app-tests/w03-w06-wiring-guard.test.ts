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

describe('W-03/W-06 接线守卫', () => {
  const refund = read('../../app/(main)/refund/[id]/PageClient.tsx')
  const confirm = read('../../app/(main)/learn/payment/confirm/PageClient.tsx')

  it('退款详情只走 loadRefundDetail,降级时展示可见提示', () => {
    expect(refund).toContain('loadRefundDetail')
    expect(refund).toContain('data?.degraded')
    expect(refund).not.toContain('page=1&pageSize=100')
  })

  it('支付确认页不再用无界 setInterval,轮询走统一 hook', () => {
    expect(confirm).not.toContain('setInterval(')
    expect(confirm).toContain('usePaymentStatusPoll')
    expect(confirm).toContain('pollExhausted')
  })
})
