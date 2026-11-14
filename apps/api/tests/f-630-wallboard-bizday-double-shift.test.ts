// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-630 回归锁(2026-11-13)。
 *
 * 病灶:运营大屏「近 14 日新增用户」趋势 SQL 写成
 * `to_char(users.created_at + interval '8 hours', 'YYYY-MM-DD')`;
 * PG 会话已钉 Asia/Shanghai(config/host-timezone.json),`to_char(timestamptz)` 本身就是上海日,
 * 再 +8h 等于 +16h ⇒ 曲线右移、每天北京时间 16:00 后注册被算到次日柱,与同一屏的
 * 「今日新增」(bizDayStartUtc(0) 上海日界)自相矛盾。
 *
 * 本文件锁:
 *   ① 源码中该 SQL 与相关日界过滤不再出现任何手工 `+ interval '8 hours'` 平移;
 *   ② 趋势日期轴改用显式 AT TIME ZONE 'Asia/Shanghai',与 todayNew 的上海日界同口径;
 *   ③ 14 日窗口边界键与上海零点时刻切分正确(纯函数断言)。
 *
 * 源码断言 + 纯函数断言,不依赖数据库。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bizDayKey, bizDayStartUtc, shiftBizDayKey } from '../src/utils/biz-day.js'

const SRC = readFileSync(
  fileURLToPath(new URL('../src/routes/admin-ops-wallboard.ts', import.meta.url)),
  'utf8',
)

/** 取「近 14 日每日新增用户」这条查询的源码片段(到该查询的 catch 结束)。 */
function userGrowthQueryBlock(): string {
  const start = SRC.lastIndexOf('近 14 日每日新增用户')
  expect(start).toBeGreaterThan(-1)
  const end = SRC.indexOf('.catch(() => null)', start)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

describe('F-630 运营大屏新增用户趋势不得二次 +8h', () => {
  it('新增用户趋势 SQL 已无手工 + interval \'8 hours\'(会话已钉上海,再平移即 +16h)', () => {
    expect(SRC).not.toContain("interval '8 hours'")
    expect(userGrowthQueryBlock()).not.toContain('interval')
  })

  it('日期轴显式 AT TIME ZONE \'Asia/Shanghai\',与 todayNew 的 bizDayStartUtc(0) 同口径', () => {
    const block = userGrowthQueryBlock()
    expect(block).toContain("AT TIME ZONE 'Asia/Shanghai'")
    expect(block).toContain("'YYYY-MM-DD'")
    // 同一查询的过滤下界用 bizDayStartUtc(13);todayNew 用 bizDayStartUtc(0) ⇒ 同一日界函数
    expect(block).toContain('bizDayStartUtc(13)')
    expect(SRC).toContain('${todayStart.toISOString()}::timestamptz')
    // 日期轴逐日补齐走 bizDayKeyAgo(即 bizDayKey(bizDayStartUtc(i))),与 SQL 同一上海日口径
    expect(SRC).toContain('const date = bizDayKeyAgo(i)')
    expect(SRC).toContain('return bizDayKey(bizDayStartUtc(daysAgo))')
  })

  it('14 日窗口边界键正确:首日为 13 天前的上海日,末日为上海今天', () => {
    const keys = Array.from({ length: 14 }, (_, idx) => bizDayKey(bizDayStartUtc(13 - idx)))
    expect(keys[0]).toBe(shiftBizDayKey(bizDayKey(), -13))
    expect(keys[13]).toBe(bizDayKey())
    expect(new Set(keys).size).toBe(14)
    // 与 SQL 过滤下界 bizDayStartUtc(13) 落到的日键一致(趋势不会漏首日)
    expect(bizDayKey(bizDayStartUtc(13))).toBe(keys[0])
  })

  it('上海零点切分:15:59:59Z 仍属前一日,16:00Z 起归入当日(不再右移 8 小时)', () => {
    const beforeMidnight = new Date('2026-11-12T15:59:59.999Z')
    const atMidnight = new Date('2026-11-12T16:00:00.000Z')
    expect(bizDayKey(beforeMidnight)).toBe('2026-11-12')
    expect(bizDayKey(atMidnight)).toBe('2026-11-13')
    // 旧写法 +8h 会得到 11-13 / 11-14 ⇒ 今日柱少算 16:00 后的注册
    expect(bizDayKey(new Date(beforeMidnight.getTime() + 8 * 3600 * 1000))).toBe('2026-11-13')
  })
})
