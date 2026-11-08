// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤墙钟时区契约(F-263,2026-11-08)。
 *
 * 根因:`hmOfLocalDate` 曾用 `getHours()/getMinutes()` 读**服务器本地**墙钟,
 * 而业务时区恒为 Asia/Shanghai。服务器跑在 UTC 时,上海 09:xx 的签到被读成 01:xx,
 * `judgeStatus` 判不出迟到(09:00–09:59 整段失效),08:xx 也可能被误判。
 *
 * 夹具钉的是**业务口径**而不是宿主环境:断言全用带 `Z` 的绝对时刻 + 上海墙钟期望值,
 * 因此无论 `TZ=UTC` 还是 `TZ=Asia/Shanghai`,结果必须一致。
 * 旧实现(`getHours/getMinutes`)在 `TZ=UTC` 下必翻红 —— 这正是本文件的存在理由。
 *
 * 全程零 IO、不连库(§5 测试隔离铁律);判据本身从生产模块直接 import,不在测试里复制。
 */
import { describe, expect, it } from 'vitest'

import { hmOfLocalDate, judgeStatus } from '../src/services/edu-attendance-rule.js'

describe('hmOfLocalDate:墙钟恒为 Asia/Shanghai,与宿主 TZ 无关', () => {
  it('上海 09:10(UTC 01:10)⇒ 09:10;旧实现跑在 UTC 下是 01:10', () => {
    expect(hmOfLocalDate(new Date('2026-01-05T01:10:00.000Z'))).toBe('09:10')
  })

  it('跨日:UTC 16:30 = 上海次日 00:30 ⇒ 00:30', () => {
    expect(hmOfLocalDate(new Date('2026-01-05T16:30:00.000Z'))).toBe('00:30')
  })

  it('非法 Date / 非 Date 入参 ⇒ null(不猜)', () => {
    expect(hmOfLocalDate(new Date(Number.NaN))).toBeNull()
    expect(hmOfLocalDate(null)).toBeNull()
    expect(hmOfLocalDate(undefined)).toBeNull()
  })
})

describe('judgeStatus:迟到判定按上海墙钟,不受宿主 TZ 影响', () => {
  it('上海 09:10 签到、lateAfter 09:00 ⇒ late(旧实现 UTC 下是 present)', () => {
    const result = judgeStatus({
      lateAfter: '09:00',
      checkInTime: new Date('2026-01-05T01:10:00.000Z'),
    })
    expect(result).toBe('late')
  })

  it('上海 08:00 签到、lateAfter 09:00 ⇒ present(不被宿主 TZ 拖成迟到)', () => {
    expect(
      judgeStatus({ lateAfter: '09:00', checkInTime: new Date('2026-01-05T00:00:00.000Z') }),
    ).toBe('present')
  })
})
