// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { ASSET_UNKNOWN, buildAssetCards } from '../asset-summary'

describe('buildAssetCards', () => {
  it('整块缺失时六张卡仍在,且都标 unknown 而不是 0', () => {
    const cards = buildAssetCards({})
    expect(cards).toHaveLength(6)
    expect(cards.map((c) => c.id)).toEqual([
      'accounts',
      'publish',
      'artifacts',
      'knowledge',
      'memory',
      'earnings',
    ])
    expect(cards.every((c) => c.value === ASSET_UNKNOWN)).toBe(true)
    expect(cards.every((c) => c.tone === 'unknown')).toBe(true)
  })

  it('账号为真实 0 时给出接入动作,不和「接口挂了」混为一谈', () => {
    const cards = buildAssetCards({ accounts: { total: 0, active: 0 } })
    const card = cards.find((c) => c.id === 'accounts')!
    expect(card.value).toBe('0')
    expect(card.tone).toBe('empty')
    expect(card.hint).toContain('还没接账号')
  })

  it('账号有量时主数字是总数,次行给出可用数', () => {
    const card = buildAssetCards({ accounts: { total: 3, active: 2 } }).find(
      (c) => c.id === 'accounts',
    )!
    expect(card.value).toBe('3')
    expect(card.hint).toContain('可用 2')
    expect(card.tone).toBe('ok')
  })

  it('发布主数字是在途(排期+执行),草稿和失败只进次行', () => {
    const card = buildAssetCards({
      publish: { draft: 1, scheduled: 2, running: 3, failed: 4 },
    }).find((c) => c.id === 'publish')!
    expect(card.value).toBe('5')
    expect(card.hint).toContain('草稿 1')
    expect(card.hint).toContain('失败 4')
    expect(card.tone).toBe('ok')
  })

  it('大数带千分位,便于一眼读量级', () => {
    const card = buildAssetCards({ artifacts: 1200 }).find((c) => c.id === 'artifacts')!
    expect(card.value).toBe('1,200')
  })

  it('收益显示两位小数,冻结额进次行', () => {
    const card = buildAssetCards({ earnings: { balance: 12.5, frozen: 3 } }).find(
      (c) => c.id === 'earnings',
    )!
    expect(card.value).toBe('¥12.50')
    expect(card.hint).toContain('冻结 ¥3.00')
  })

  it('余额为 0 时是 empty 而不是 unknown', () => {
    const card = buildAssetCards({ earnings: { balance: 0, frozen: 0 } }).find(
      (c) => c.id === 'earnings',
    )!
    expect(card.value).toBe('¥0.00')
    expect(card.tone).toBe('empty')
  })
})
