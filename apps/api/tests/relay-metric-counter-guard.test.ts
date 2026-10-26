// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池计数器封闭集护栏测试(2026-10-26 立)。
 *
 * 立因:断流计数从转发层的进程内 Map 并入 `ihui_relay_stream_interrupt_total` 家族时,
 * 判据是"provider 必须落在 RELAY_PROVIDERS 封闭集内"。任意字符串进标签 = 下一个炸基数面,
 * 而这条护栏没有测试就等于没有(与 ihui_relay_upstream_fallback_total 同型风险)。
 * 只测有现读出口的那一档(回落计数没有 reader,不为测试去启 Fastify 插件)。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordRelayStreamInterrupt,
  snapshotRelayStreamInterrupts,
} from '../src/plugins/business-metrics.js'
import { RELAY_PROVIDERS } from '../src/services/relay-account-format.js'

describe('ihui_relay_stream_interrupt_total 封闭集护栏', () => {
  beforeEach(() => {
    // 计数的清空走指标模块自己的 reset 出口;这里只断"增量",不依赖初始值
    const s = snapshotRelayStreamInterrupts()
    expect(typeof s).toBe('object')
  })

  it('登记过的 provider 才进标签,并累加', () => {
    const before = snapshotRelayStreamInterrupts()['trae'] ?? 0
    recordRelayStreamInterrupt('trae')
    recordRelayStreamInterrupt('trae')
    expect(snapshotRelayStreamInterrupts()['trae']).toBe(before + 2)
  })

  it('集合外的字符串一律丢弃:不新增标签、不污染基数', () => {
    const keysBefore = Object.keys(snapshotRelayStreamInterrupts()).sort()
    recordRelayStreamInterrupt('evil-label-with-userId')
    recordRelayStreamInterrupt('')
    recordRelayStreamInterrupt('MODEL/gpt-4')
    const keysAfter = Object.keys(snapshotRelayStreamInterrupts()).sort()
    expect(keysAfter).toEqual(keysBefore)
    expect(snapshotRelayStreamInterrupts()['evil-label-with-userId']).toBeUndefined()
  })

  it('标签集是 RELAY_PROVIDERS 的子集(单一真相源,不在本文件另写一份 provider 清单)', () => {
    for (const p of RELAY_PROVIDERS) recordRelayStreamInterrupt(p)
    const snap = snapshotRelayStreamInterrupts()
    for (const p of RELAY_PROVIDERS) {
      expect(typeof snap[p]).toBe('number')
    }
    for (const k of Object.keys(snap)) {
      expect(RELAY_PROVIDERS as readonly string[]).toContain(k)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
