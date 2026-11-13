// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import { buildDailyAttendance, buildMonthlyAttendance } from '../hr-attendance-settle.js'

/**
 * 考勤结算服务 —— 参数校验单测。
 *
 * 真正的时间判定(迟到/早退/请假/外出/加班)在真库端到端里验证过:
 *   · 11-02 08:55 签到 → present(不是迟到)
 *   · 11-03 09:30 签到 → late, 迟到 30 分钟
 *   · 11-04 请假 → leave, 实出勤补足 480
 *   · 11-05 外出 3h → present, 实出勤 180
 *   · 11-07 周六加班 3h → rest, 加班 180 分钟
 *   · 11-08 周日无记录 → rest(不算缺勤)
 * 这里只钉住不依赖 DB 的入参校验,避免单测因连库变慢/不稳定。
 */

describe('buildDailyAttendance 参数校验', () => {
  it('月份格式非法时抛错', async () => {
    await expect(buildDailyAttendance({ periodMonth: '2026-1' })).rejects.toThrow()
    await expect(buildDailyAttendance({ periodMonth: 'abc' })).rejects.toThrow()
    await expect(buildDailyAttendance({ periodMonth: '2026-13' })).rejects.toThrow()
  })
})

describe('buildMonthlyAttendance 参数校验', () => {
  it('月份格式非法时抛错', async () => {
    await expect(buildMonthlyAttendance({ periodMonth: '2026/11' })).rejects.toThrow()
  })
})
