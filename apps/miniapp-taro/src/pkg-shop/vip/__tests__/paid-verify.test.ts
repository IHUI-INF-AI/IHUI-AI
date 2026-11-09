// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

import { confirmVipPaid } from '../paid-verify'

const noSleep = () => Promise.resolve()

describe('XUI-039 confirmVipPaid:本地落账必须以服务端 paid 为准', () => {
  it('服务端 paid ⇒ 允许落账', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'paid' }))
    await expect(confirmVipPaid('V1', fetchStatus, { sleep: noSleep })).resolves.toBe(true)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('pending 有回调延迟 ⇒ 轮询到 paid', async () => {
    const fetchStatus = vi
      .fn(async () => ({ status: 'pending' as string | undefined }))
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'paid' })
    await expect(confirmVipPaid('V2', fetchStatus, { sleep: noSleep })).resolves.toBe(true)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
  })

  it('终态 failed ⇒ 立即判未支付,不再重试', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'failed' }))
    await expect(confirmVipPaid('V3', fetchStatus, { sleep: noSleep })).resolves.toBe(false)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('一直 pending ⇒ 重试耗尽后判未支付', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'pending' }))
    await expect(
      confirmVipPaid('V4', fetchStatus, { attempts: 3, sleep: noSleep }),
    ).resolves.toBe(false)
    expect(fetchStatus).toHaveBeenCalledTimes(3)
  })

  it('缺订单号 ⇒ 不查服务端,直接判未支付', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'paid' }))
    await expect(confirmVipPaid('', fetchStatus, { sleep: noSleep })).resolves.toBe(false)
    expect(fetchStatus).not.toHaveBeenCalled()
  })

  it('接口异常 ⇒ 重试后判未支付,不抛错到页面', async () => {
    const fetchStatus = vi.fn(async () => {
      throw new Error('network')
    })
    await expect(
      confirmVipPaid('V5', fetchStatus, { attempts: 2, sleep: noSleep }),
    ).resolves.toBe(false)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
