// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RP-23:payment-recurring 签约下次扣款按 Asia/Shanghai 日历推进,不吃宿主时区/夏令时。
// 镜像 tests/subscription-next-charge-time.test.ts 的形状:Z 夹具钉绝对时刻,
// 三档宿主时区循环 —— 实现若退回宿主本地 setFullYear/setDate/setMonth 即翻红。

// RECON-NOTE@2026-11-11 本件覆盖上海时区行为(日重置/续费),被测功能在主线仍存活;52991b53 旧底稿同步误删本件;本笔同时修复水印载荷(clean→inject)。本行为还原处置留痕。
import { describe, expect, it, afterAll, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

import { __test__ } from '../src/routes/payment-recurring.js'

const { calculateNextChargeTime } = __test__

const DAY_MS = 24 * 60 * 60 * 1000
const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const
const ORIGINAL_TZ = process.env.TZ

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

describe('payment-recurring calculateNextChargeTime 按 Asia/Shanghai 日历推进', () => {
  it('前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件全部断言都是恒绿的)', () => {
    const probe = new Date('2026-11-10T20:00:00.000Z')
    process.env.TZ = 'UTC'
    const inUtc = probe.getHours()
    process.env.TZ = 'Asia/Shanghai'
    const inShanghai = probe.getHours()
    expect({ inUtc, inShanghai }).toEqual({ inUtc: 20, inShanghai: 4 })
  })

  it('月:上海已是次日、UTC 仍是上月末时,按上海月进位而不是宿主月', () => {
    // 2026-05-01 03:00 上海 = 2026-04-30 19:00 UTC。宿主 UTC 的旧 setMonth 会落到 5 月 30/31 日。
    const base = new Date('2026-04-30T19:00:00.000Z')
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      expect({ zone, next: calculateNextChargeTime('month', base).toISOString() }).toEqual({
        zone,
        next: '2026-05-31T19:00:00.000Z', // 2026-06-01 03:00 上海
      })
    }
  })

  it('周:跨美国夏令时开始(2026-03-08)仍是整 7 个 24 小时,上海钟点不漂', () => {
    const base = new Date('2026-03-01T02:30:00.000Z') // 上海 03-01 10:30
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      const next = calculateNextChargeTime('week', base)
      expect({ zone, next: next.toISOString() }).toEqual({
        zone,
        next: '2026-03-08T02:30:00.000Z',
      })
      expect((next.getTime() - base.getTime()) % DAY_MS).toBe(0)
    }
  })

  it('年:闰日 UTC 投影溢出时,上海 3 月 1 日仍落到次年 3 月 1 日', () => {
    // 2024-03-01 02:00 上海 = 2024-02-29 18:00 UTC。宿主 UTC 的旧 setFullYear 会溢到 3 月 2 日(UTC 口径)。
    const base = new Date('2024-02-29T18:00:00.000Z')
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      expect({ zone, next: calculateNextChargeTime('year', base).toISOString() }).toEqual({
        zone,
        next: '2025-02-28T18:00:00.000Z', // 2025-03-01 02:00 上海
      })
    }
  })

  it('空周期与未知周期按月,月末溢出与订阅口径一致', () => {
    const base = new Date('2026-01-30T22:00:00.000Z') // 上海 2026-01-31 06:00
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      const month = calculateNextChargeTime('month', base).toISOString()
      expect({ zone, month }).toEqual({ zone, month: '2026-03-02T22:00:00.000Z' }) // 上海 3 月 3 日 06:00
      expect(calculateNextChargeTime(null, base).toISOString()).toBe(month)
      expect(calculateNextChargeTime(undefined, base).toISOString()).toBe(month)
      expect(calculateNextChargeTime('quarter', base).toISOString()).toBe(month)
    }
  })

  it('缺省基准用当前时刻:冻结时钟后三档宿主时区结果逐字相同', () => {
    // 2026-10-31 19:30 UTC = 上海 11-01 03:30;按月进位 → 上海 12-01 03:30 = 11-30 19:30 UTC
    vi.setSystemTime(new Date('2026-10-31T19:30:00.000Z'))
    try {
      for (const zone of HOST_ZONES) {
        process.env.TZ = zone
        expect({ zone, next: calculateNextChargeTime('month').toISOString() }).toEqual({
          zone,
          next: '2026-11-30T19:30:00.000Z',
        })
      }
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
