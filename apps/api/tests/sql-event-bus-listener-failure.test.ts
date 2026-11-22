// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

import { sqlEventBus } from '../src/db/sql-event-bus'

/**
 * SQL 事件总线的"监听器失败必须可闻"回归(2026-09-28 立,第九轮 ZCode 对照逼出)。
 *
 * 旧写法是空 `catch {}`:吞异常本身是对的(订阅方挂掉不该打断 DB 查询),但它同时把
 * "订阅方整条失效"也吞掉了 —— pino sink、慢查询告警、统计计数任一个抛错,表现都是
 * "一切正常而那个人再也收不到事件"。这与本仓 §5e「失败必须响」以及守门 70/76/81 记过的
 * 「判据失效的表现永远是安静」是同一条禁令。
 *
 * 两例成对:抛错时必须既不中断 emit、又让其余监听器照常收到、并把是哪一位喊出来;
 * 没人抛错时**不得**产生任何 warn(否则这条改动本身会变成日志噪声源)。
 */
describe('sqlEventBus.emit — 监听器失败的处理', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('某监听器抛错:emit 不抛、其余监听器照常收到、warn 点名第几位与原因', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const received: string[] = []
    const offBad = sqlEventBus.on(() => {
      throw new Error('sink 挂了')
    })
    const offGood = sqlEventBus.on((e) => {
      received.push(e.query)
    })

    try {
      expect(() => sqlEventBus.emit({ query: 'SELECT 1', durationMs: 3 })).not.toThrow()
    } finally {
      offBad()
      offGood()
    }

    // 吞异常的行为不变:好监听器必须仍然收到事件
    expect(received).toEqual(['SELECT 1'])
    expect(warn).toHaveBeenCalledTimes(1)
    const msg = String(warn.mock.calls[0]?.[0] ?? '')
    expect(msg).toContain('监听器 #0')
    expect(msg).toContain('sink 挂了')
    expect(msg).toContain('SELECT 1')
  })

  it('反向对照:无人抛错时不得发出任何 warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const off = sqlEventBus.on(() => {})
    try {
      sqlEventBus.emit({ query: 'SELECT 2' })
    } finally {
      off()
    }
    expect(warn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
