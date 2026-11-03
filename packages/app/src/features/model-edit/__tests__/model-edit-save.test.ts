// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import type { ModelEditFieldValues } from '../../../types'
import {
  buildModelEditBillingPayload,
  submitModelEdit,
  type ModelEditUpdateResult,
} from '../model-edit-save'

const FIELDS: ModelEditFieldValues = {
  categories: ['1'],
  dept: 'd1',
  saleType: 'limited',
  cycle: 'month',
  price: '9.9',
  freeDur: '一年',
  audience: 'all',
  discount: '',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('buildModelEditBillingPayload — 只映射后端真有的两列', () => {
  it('付费/限时档:price 取表单数值,isFree=false', () => {
    expect(buildModelEditBillingPayload(FIELDS)).toEqual({ price: 9.9, isFree: false })
  })

  it('免费档:price 归一为 0,isFree=true', () => {
    expect(buildModelEditBillingPayload({ ...FIELDS, saleType: 'free', price: '999' })).toEqual({
      price: 0,
      isFree: true,
    })
  })

  it('空价格不变成 NaN(与 web 的 Number(price)||0 同口径)', () => {
    expect(buildModelEditBillingPayload({ ...FIELDS, price: '' }).price).toBe(0)
  })
})

describe('submitModelEdit — 成功只在真实请求成功之后出现', () => {
  it('请求未返回前不产出成功态;resolve 且 success 后才 ok:true', async () => {
    const pending = deferred<ModelEditUpdateResult>()
    const updateBilling = vi.fn(() => pending.promise)
    let settled = false
    const task = submitModelEdit(updateBilling, 'agent-1', FIELDS).then((outcome) => {
      settled = true
      return outcome
    })

    await Promise.resolve()
    expect(updateBilling).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    pending.resolve({ success: true })
    const outcome = await task
    expect(outcome).toEqual({ ok: true })
  })

  it('业务失败(success:false)⇒ ok:false 且带出服务端原因,绝不当成功', async () => {
    const updateBilling = vi.fn(async (): Promise<ModelEditUpdateResult> => ({
      success: false,
      error: '智能体不存在',
    }))

    const outcome = await submitModelEdit(updateBilling, 'agent-1', FIELDS)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.message).toBe('智能体不存在')
  })

  it('传输层抛错 ⇒ ok:false,错误不被吞', async () => {
    const updateBilling = vi.fn(async () => {
      throw new Error('network down')
    })

    const outcome = await submitModelEdit(updateBilling, 'agent-1', FIELDS)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.message).toBe('network down')
  })

  it('缺 agentId ⇒ 不发请求、不假成功', async () => {
    const updateBilling = vi.fn(async (): Promise<ModelEditUpdateResult> => ({ success: true }))

    const outcome = await submitModelEdit(updateBilling, undefined, FIELDS)

    expect(updateBilling).not.toHaveBeenCalled()
    expect(outcome.ok).toBe(false)
  })

  it('请求载荷与 web 同形(price/isFree)', async () => {
    const updateBilling = vi.fn(async (): Promise<ModelEditUpdateResult> => ({ success: true }))

    await submitModelEdit(updateBilling, 'agent-1', FIELDS)

    expect(updateBilling).toHaveBeenCalledWith('agent-1', { price: 9.9, isFree: false })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
