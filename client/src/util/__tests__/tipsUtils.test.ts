// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as tipsUtils from '../tipsUtils'

describe('tipsUtils', () => {
  it('导出 success, error, info, warning, confirm 函数', () => {
    expect(typeof tipsUtils.success).toBe('function')
    expect(typeof tipsUtils.error).toBe('function')
    expect(typeof tipsUtils.info).toBe('function')
    expect(typeof tipsUtils.warning).toBe('function')
    expect(typeof tipsUtils.confirm).toBe('function')
  })

  it('success 调用不报错', () => {
    expect(() => tipsUtils.success('操作成功')).not.toThrow()
  })

  it('error 调用不报错', () => {
    expect(() => tipsUtils.error('操作失败')).not.toThrow()
  })

  it('info 调用不报错', () => {
    expect(() => tipsUtils.info('提示信息')).not.toThrow()
  })

  it('warning 调用不报错', () => {
    expect(() => tipsUtils.warning('警告信息')).not.toThrow()
  })

  it('confirm 返回 Promise (2 参数模式)', () => {
    const p = tipsUtils.confirm('确定删除吗？', '提示')
    expect(p).toBeInstanceOf(Promise)
    // 清理：点击确定按钮以解决 Promise，避免未处理的挂起
    const okBtn = findButton('确定')
    okBtn?.click()
  })

  it('confirm 3 参数模式 (带回调) 点击确定后触发 callback', async () => {
    const cb = vi.fn()
    const p = tipsUtils.confirm('确定删除吗？', '提示', cb)
    expect(p).toBeInstanceOf(Promise)

    const okBtn = findButton('确定')
    okBtn?.click()

    await p
    // 等待微任务执行 callback
    await new Promise(r => setTimeout(r, 0))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('confirm 2 参数模式点击取消会 reject', async () => {
    const p = tipsUtils.confirm('确定删除吗？', '提示')
    const cancelBtn = findButton('取消')
    cancelBtn?.click()
    await expect(p).rejects.toThrow('cancel')
  })
})

function findButton(text: string): HTMLButtonElement | undefined {
  const buttons = document.body.querySelectorAll('button')
  return Array.from(buttons).find(b => b.textContent?.trim() === text)
}
