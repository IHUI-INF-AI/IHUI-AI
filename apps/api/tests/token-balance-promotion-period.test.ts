// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * checkPromotionPeriod 的促销窗口必须按 Asia/Shanghai 公历日,不读服务器本地日。
 *
 * 根因:旧实现 `new Date().getDate()` 跟宿主时区走。服务器在 UTC 时,
 * 上海 1 日 00:00–08:00(UTC 前一日 16:00–24:00)被读成上月月末,促销漏开;
 * 上海 8 日 00:00–08:00 仍被读成 7 日,促销多放 8 小时。
 *
 * 夹具钉绝对时刻(带 Z)。断言不依赖本机 TZ。另外把本地 getDate/getMonth/getFullYear
 * 钉成错误值:实现若退回本地 getter,这两条会翻红;bizDayKey 只走 UTC 分量,不受影响。
 * 全程零 IO。db / 鉴权模块 mock 掉,避免 import 插件时连库(§5)。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  userMargins: {
    userId: 'user_id',
    tokenQuantity: 'token_quantity',
    updatedAt: 'updated_at',
  },
  users: { id: 'id', isVip: 'is_vip' },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/response.js', () => ({
  success: (data: unknown) => ({ code: 0, message: 'ok', data }),
}))

import { checkPromotionPeriod } from '../src/plugins/token-balance-service.js'

describe('checkPromotionPeriod:促销窗口按 Asia/Shanghai 公历 1–7 日', () => {
  it('上海 1 日 00:00(UTC 前一日 16:00)算促销;UTC 本地日是上月月末', () => {
    expect(checkPromotionPeriod(new Date('2026-01-31T16:00:00.000Z'))).toBe(true)
    expect(checkPromotionPeriod(new Date('2025-12-31T16:00:00.000Z'))).toBe(true)
  })

  it('上海 7 日 23:59:59 仍算促销,8 日 00:00 整点起不算', () => {
    expect(checkPromotionPeriod(new Date('2026-02-07T15:59:59.000Z'))).toBe(true)
    expect(checkPromotionPeriod(new Date('2026-02-07T16:00:00.000Z'))).toBe(false)
  })

  it('上海月末与月中不是促销', () => {
    expect(checkPromotionPeriod(new Date('2026-01-31T15:59:59.000Z'))).toBe(false)
    expect(checkPromotionPeriod(new Date('2026-03-15T04:00:00.000Z'))).toBe(false)
  })

  it('闰年 2 月 29 日 16:00Z = 上海 3 月 1 日,进入促销', () => {
    expect(checkPromotionPeriod(new Date('2024-02-29T15:59:59.000Z'))).toBe(false)
    expect(checkPromotionPeriod(new Date('2024-02-29T16:00:00.000Z'))).toBe(true)
  })

  it('非法 Date 不猜,视为非促销', () => {
    expect(checkPromotionPeriod(new Date(Number.NaN))).toBe(false)
  })

  it('不读宿主本地日历 getter:钉错 getDate 后上海日界仍然成立', () => {
    const year = vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2015)
    const month = vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(0)
    const day = vi.spyOn(Date.prototype, 'getDate').mockReturnValue(15)
    const hour = vi.spyOn(Date.prototype, 'getHours').mockReturnValue(15)
    try {
      // 本地 getter 若被采用,两枚都会读成「2015-01-15」:前者误开促销,后者误关促销
      expect(checkPromotionPeriod(new Date('2026-02-07T16:00:00.000Z'))).toBe(false)
      expect(checkPromotionPeriod(new Date('2026-01-31T16:00:00.000Z'))).toBe(true)
    } finally {
      year.mockRestore()
      month.mockRestore()
      day.mockRestore()
      hour.mockRestore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
