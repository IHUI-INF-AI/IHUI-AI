// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import { sqlEventBus } from '../src/db/sql-event-bus.js'

describe('G-677 归属窗口随请求 settle 关闭', () => {
  it('请求结束后 emit ⇒ 不落该 requestId,且有丢弃计数(不是静默 return)', async () => {
    const seen: Array<string | undefined> = []
    const off = sqlEventBus.on((e) => { seen.push(e.requestId) })
    const warns: string[] = []
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((m: unknown) => { warns.push(String(m)) })
    try {
      await sqlEventBus.run('req-1', async () => {
        sqlEventBus.emit({ query: 'select 1' }) // 请求期内:正常关联
        expect(seen).toEqual(['req-1'])
        expect(sqlEventBus.takeDroppedAfterSettle()).toBe(0)
        sqlEventBus.settleContext('req-1') // 请求结束(onResponse)
        sqlEventBus.emit({ query: 'select 2' }) // 迟到:不得回写该 requestId
        expect(seen).toEqual(['req-1'])
        expect(sqlEventBus.takeDroppedAfterSettle()).toBe(1) // 计数而非静默
        expect(warns.some((w) => w.includes('迟到') && w.includes('req-1'))).toBe(true)
        expect(sqlEventBus.takeDroppedAfterSettle()).toBe(0) // 读后清零
      })
    } finally {
      warnSpy.mockRestore()
      off()
    }
  })

  it('settle 只关自己的窗口:别的 requestId 不受影响', async () => {
    const seen: Array<string | undefined> = []
    const off = sqlEventBus.on((e) => { seen.push(e.requestId) })
    try {
      await sqlEventBus.run('req-A', async () => {
        sqlEventBus.settleContext('req-B') // 不匹配 ⇒ 窗口原样不动
        sqlEventBus.emit({ query: 'select a' })
        expect(seen).toEqual(['req-A'])
        expect(sqlEventBus.takeDroppedAfterSettle()).toBe(0)
      })
    } finally { off() }
  })

  it('无上下文(background job 等)emit 照常、不计数 —— 只有"曾进入且已 settle"才拦', () => {
    const seen: Array<string | undefined> = []
    const off = sqlEventBus.on((e) => { seen.push(e.requestId) })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      sqlEventBus.emit({ query: 'select x' })
      expect(seen).toEqual([undefined])
      expect(sqlEventBus.takeDroppedAfterSettle()).toBe(0)
    } finally { warnSpy.mockRestore(); off() }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
