// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, beforeEach } from 'vitest'
import { parsePositiveInt } from '../src/utils/positive-int.js'
import { normalizeSmsPhone } from '../src/utils/phone.js'
import {
  acquireOnce,
  refundWindows,
  tryConsumeWindows,
  __test__ as counter,
} from '../src/utils/window-counter.js'

/**
 * 2026-10-26 审计整改的回归夹具。
 * 三组缺陷都属于「配置/参数写错时,系统不应该悄悄换一种行为」:
 *  - 上限非法 ⇒ 静默取消上限(旧实现);
 *  - 群发上限非法 ⇒ LIMIT NaN / LIMIT 0(旧实现);
 *  - 频控先扣后发 ⇒ 发失败也锁人(旧实现)。
 */

describe('parsePositiveInt — 非法值必须回落默认值,不能把上限关掉', () => {
  it('未设置 ⇒ 默认值', () => {
    expect(parsePositiveInt(undefined, 100, 'X')).toBe(100)
  })

  it('空串/空格 ⇒ 默认值(不是 0)', () => {
    expect(parsePositiveInt('', 100, 'X')).toBe(100)
    expect(parsePositiveInt('   ', 100, 'X')).toBe(100)
  })

  it('非数字/小数/0/负数 ⇒ 默认值', () => {
    expect(parsePositiveInt('abc', 200, 'X')).toBe(200)
    expect(parsePositiveInt('1.5', 200, 'X')).toBe(200)
    expect(parsePositiveInt('0', 200, 'X')).toBe(200)
    expect(parsePositiveInt('-5', 200, 'X')).toBe(200)
  })

  it('合法值原样返回,越界按边界夹取', () => {
    expect(parsePositiveInt('300', 200, 'X', { max: 500 })).toBe(300)
    expect(parsePositiveInt('5000', 200, 'X', { max: 500 })).toBe(500)
  })
})

describe('normalizeSmsPhone — 口径统一', () => {
  it('11 位大陆号直接通过', () => {
    expect(normalizeSmsPhone('13800138000')).toBe('13800138000')
  })

  it('+86 / 0086 / 86 前缀都归一', () => {
    expect(normalizeSmsPhone('+8613800138000')).toBe('13800138000')
    expect(normalizeSmsPhone('008613800138000')).toBe('13800138000')
    expect(normalizeSmsPhone('8613800138000')).toBe('13800138000')
  })

  it('空格与连字符不影响', () => {
    expect(normalizeSmsPhone('138-0013-8000')).toBe('13800138000')
    expect(normalizeSmsPhone(' 138 0013 8000 ')).toBe('13800138000')
  })

  it('非法号码返回 null(12 开头、长度不对、含字母)', () => {
    expect(normalizeSmsPhone('12800138000')).toBeNull()
    expect(normalizeSmsPhone('1380013800')).toBeNull()
    expect(normalizeSmsPhone('13800138000a')).toBeNull()
  })
})

describe('window-counter — 退还与幂等占位', () => {
  beforeEach(async () => {
    await counter.reset(['test:refund:', 'test:once:'])
  })

  it('退还后同一窗口可以立刻再用一次(发失败不该锁人)', async () => {
    const specs = [{ key: 'test:refund:phone', windowMs: 60_000, max: 1 }]
    expect(await tryConsumeWindows(specs)).toBe(0)
    expect(await tryConsumeWindows(specs)).toBe(1)
    await refundWindows(specs)
    expect(await tryConsumeWindows(specs)).toBe(0)
  })

  it('退还不会把计数减成负数', async () => {
    const specs = [{ key: 'test:refund:empty', windowMs: 60_000, max: 1 }]
    await refundWindows(specs)
    await refundWindows(specs)
    expect(await tryConsumeWindows(specs)).toBe(0)
  })

  it('acquireOnce:NX 首次成功,第二次拒绝并带回首个值', async () => {
    expect((await acquireOnce('test:once:req', 'run-a', 60_000)).acquired).toBe(true)
    const second = await acquireOnce('test:once:req', 'run-b', 60_000)
    expect(second.acquired).toBe(false)
    expect(second.existing).toBe('run-a')
  })

  it('acquireOnce:不同键互不影响', async () => {
    expect((await acquireOnce('test:once:a', 'run-a', 60_000)).acquired).toBe(true)
    expect((await acquireOnce('test:once:b', 'run-b', 60_000)).acquired).toBe(true)
  })
})
