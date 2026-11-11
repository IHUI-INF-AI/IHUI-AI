// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RP-23:API Key 配额"天"重置点 = Asia/Shanghai 自然日零点,走 utils/biz-day.ts 唯一出口。
// 镜像 tests/subscription-next-charge-time.test.ts 的形状:Z 夹具 + 三档宿主时区循环,
// 实现若退回宿主本地 setHours(0,0,0,0)+setDate(+1) 即翻红。

import { describe, expect, it, afterAll, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  apiKeyQuotas: {
    apiKeyId: 'api_key_id',
    hourlyUsed: 'hourly_used',
    dailyUsed: 'daily_used',
    hourlyLimit: 'hourly_limit',
    dailyLimit: 'daily_limit',
    resetAt: 'reset_at',
    updatedAt: 'updated_at',
    id: 'id',
  },
}))

import { __test__ } from '../src/utils/api-key-quota.js'

const { nextDayReset } = __test__

const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const
const ORIGINAL_TZ = process.env.TZ

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

describe('api-key-quota nextDayReset 按 Asia/Shanghai 日界', () => {
  it('前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件全部断言都是恒绿的)', () => {
    const probe = new Date('2026-11-10T20:00:00.000Z')
    process.env.TZ = 'UTC'
    const inUtc = probe.getHours()
    process.env.TZ = 'Asia/Shanghai'
    const inShanghai = probe.getHours()
    expect({ inUtc, inShanghai }).toEqual({ inUtc: 20, inShanghai: 4 })
  })

  it('上海 00:00–08:00 窗口(UTC 仍是前一天):重置点钉在上海零点,不是宿主零点', () => {
    // 2026-11-10 20:00 UTC = 上海 11-11 04:00 → 下一个上海零点 = 11-12 00:00 = 11-11 16:00 UTC。
    // 宿主 UTC 的旧实现给 11-11 00:00 UTC(上海 08:00),宿主纽约的旧实现给 11-11 05:00 UTC。
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      expect({ zone, next: nextDayReset(new Date('2026-11-10T20:00:00.000Z')).toISOString() }).toEqual({
        zone,
        next: '2026-11-11T16:00:00.000Z',
      })
    }
  })

  it('上海日内任意时刻(含 23:59:59.999 与零点整)都落在同一个下一个零点', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      // 上海 11-11 23:59:59.999 → 上海 11-12 零点 = 11-11 16:00 UTC
      expect(nextDayReset(new Date('2026-11-11T15:59:59.999Z')).toISOString()).toBe(
        '2026-11-11T16:00:00.000Z',
      )
      // 恰在上海 11-12 零点(11-11 16:00 UTC)→ 换日,给再下一个零点(上海 11-13 零点)
      expect(nextDayReset(new Date('2026-11-11T16:00:00.000Z')).toISOString()).toBe(
        '2026-11-12T16:00:00.000Z',
      )
    }
  })

  it('跨美国夏令时开始(2026-03-08)重置点仍是整天对齐的上海零点,毫秒归零', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      const next = nextDayReset(new Date('2026-03-07T20:30:45.123Z')) // 上海 03-08 04:30:45.123
      expect(next.toISOString()).toBe('2026-03-08T16:00:00.000Z') // 上海 03-09 零点
      expect(next.getMilliseconds()).toBe(0)
    }
  })

  it('缺省基准取当前时刻:冻结时钟后三档宿主时区结果逐字相同', () => {
    vi.setSystemTime(new Date('2026-11-10T20:00:00.000Z')) // 上海 11-11 04:00
    try {
      for (const zone of HOST_ZONES) {
        process.env.TZ = zone
        expect({ zone, next: nextDayReset().toISOString() }).toEqual({
          zone,
          next: '2026-11-11T16:00:00.000Z',
        })
      }
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
