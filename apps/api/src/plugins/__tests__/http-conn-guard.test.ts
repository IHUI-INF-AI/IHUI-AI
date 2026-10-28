// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { __test__ } from '../http-conn-guard.js'

const { tryAcquireSlot, releaseSlot, reset, activeIpCount, MAX_CONN_PER_IP } = __test__

beforeEach(() => {
  reset()
})

describe('tryAcquireSlot', () => {
  it('未达上限时逐个放行', () => {
    expect(tryAcquireSlot('1.1.1.1', 'r1', 2)).toBe(true)
    expect(tryAcquireSlot('1.1.1.1', 'r2', 2)).toBe(true)
  })

  it('达到上限后拒绝,且不把被拒请求记进集合', () => {
    expect(tryAcquireSlot('1.1.1.1', 'r1', 1)).toBe(true)
    expect(tryAcquireSlot('1.1.1.1', 'r2', 1)).toBe(false)
    // 释放 r1 后应当能再放一个:说明被拒的 r2 没有残留占位
    releaseSlot('1.1.1.1', 'r1')
    expect(tryAcquireSlot('1.1.1.1', 'r3', 1)).toBe(true)
  })

  it('并发计数按 IP 隔离', () => {
    expect(tryAcquireSlot('1.1.1.1', 'r1', 1)).toBe(true)
    expect(tryAcquireSlot('2.2.2.2', 'r1', 1)).toBe(true)
  })

  it('默认阈值远高于浏览器正常并发', () => {
    expect(MAX_CONN_PER_IP).toBeGreaterThanOrEqual(20)
  })
})

describe('releaseSlot', () => {
  it('集合空时删键,Map 不随 IP 数无限增长', () => {
    tryAcquireSlot('3.3.3.3', 'r1', 5)
    expect(activeIpCount()).toBe(1)
    releaseSlot('3.3.3.3', 'r1')
    expect(activeIpCount()).toBe(0)
  })

  it('释放未知 IP / 未知请求 id 不抛错', () => {
    expect(() => releaseSlot('4.4.4.4', 'nope')).not.toThrow()
    tryAcquireSlot('4.4.4.5', 'r1', 5)
    expect(() => releaseSlot('4.4.4.5', 'nope')).not.toThrow()
    expect(activeIpCount()).toBe(1)
  })

  it('同一请求重复释放不会把别人的槽一起减掉', () => {
    tryAcquireSlot('5.5.5.5', 'r1', 2)
    tryAcquireSlot('5.5.5.5', 'r2', 2)
    releaseSlot('5.5.5.5', 'r1')
    releaseSlot('5.5.5.5', 'r1')
    expect(tryAcquireSlot('5.5.5.5', 'r3', 2)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
