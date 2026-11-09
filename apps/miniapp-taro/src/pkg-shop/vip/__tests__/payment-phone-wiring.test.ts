// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-038 / XUI-039 / XUI-043 接线锁(小程序端)。
 * node 环境无 Taro 运行时,页面渲染级断言不可用,沿用本仓既有的源码级自证:
 * 断言消费点确实走真实支付/服务端校验,而不是本地状态直接置成功。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const END_ROOT = join(__dirname, '..', '..', '..', '..')
const read = (p: string) => readFileSync(join(END_ROOT, p), 'utf8')

const VIP_INDEX = read('src/pkg-shop/vip/index.tsx')
const VIP_SUCCESS = read('src/pkg-shop/vip/success.tsx')
const PHONE = read('src/pkg-user/user/phone.tsx')

describe('XUI-038 会员支付方式确认必须走真实支付', () => {
  it('onPayMethodConfirm 只关弹层并转入 onConfirmPay,不再本地置成功', () => {
    const block = VIP_INDEX.match(
      /const onPayMethodConfirm = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/,
    )?.[0]
    expect(block).toBeDefined()
    expect(block).toContain('onConfirmPay()')
    expect(block).not.toContain('setShowSuccess(true)')
  })

  it('onConfirmPay 仍走 upgradeVip + dispatchVipPay(真实 requestPayment)', () => {
    expect(VIP_INDEX).toContain('await upgradeVip(selectedPlan.id)')
    expect(VIP_INDEX).toContain('dispatchVipPay(res.payInfo, res.orderNo')
    expect(VIP_INDEX).toContain('requestWxPayment(payInfo')
  })
})

describe('XUI-039 支付成功页只认服务端 paid', () => {
  it('落本地 paid 标记前必须先 confirmVipPaid', () => {
    const verifyAt = VIP_SUCCESS.indexOf('const paid = await verifyServerPaid()')
    const writeAt = VIP_SUCCESS.indexOf('setStorageSync(VIP_PAID_STATUS_KEY, true)')
    expect(verifyAt).toBeGreaterThanOrEqual(0)
    expect(writeAt).toBeGreaterThan(verifyAt)
    expect(VIP_SUCCESS).toContain('if (!paid) {')
  })

  it('服务端查询走 /vip/order/:orderNo/payinfo', () => {
    expect(VIP_SUCCESS).toContain('/vip/order/${encodeURIComponent(no)}/payinfo')
  })
})

describe('XUI-043 已绑定手机号换绑必须提交旧号验证码', () => {
  it('currentPhone 存在时走 replacePhone(oldPhone/oldCode/newPhone/newCode)', () => {
    const replaceAt = PHONE.indexOf('await replacePhone({')
    const bindAt = PHONE.indexOf('await bindPhone(phone, code)')
    expect(replaceAt).toBeGreaterThanOrEqual(0)
    expect(bindAt).toBeGreaterThan(replaceAt)
    expect(PHONE).toContain('oldPhone: currentPhone')
    expect(PHONE).toContain('oldCode: oldCode.trim()')
  })

  it('首次绑定(无旧号)仍走 bindPhone', () => {
    expect(PHONE).toMatch(/if \(currentPhone\) \{[\s\S]*?\} else \{[\s\S]*?await bindPhone/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
