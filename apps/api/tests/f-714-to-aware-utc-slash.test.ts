// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-714 回归锁(2026-11-13)。
 *
 * 病灶:`toAwareUtc('2024/01/01')` / `'2024/01/01 00:00:00'` 这类斜杠/空格分隔的无时区串,
 * V8 按宿主本地时区解析成功即提前 return,UTC 兜底分支不可达 ⇒ 与"无时区按 UTC"契约相反。
 *
 * 本文件锁:
 *   ① 无时区形态(斜杠/短横线、带/不带时分秒)统一等于 UTC 墙钟,且在 TZ=Asia/Shanghai / UTC 下一致;
 *   ② 带显式 Z / 偏移的仍按原义,不受宿主 TZ 影响;
 *   ③ 前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件断言恒绿)。
 */

import { afterAll, describe, expect, it } from 'vitest'
import { toAwareUtc } from '../src/utils/timezone-utils'

const HOST_ZONES = ['Asia/Shanghai', 'UTC'] as const
const ORIGINAL_TZ = process.env.TZ

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

/** 无时区输入 → 期望的 UTC 墙钟 epoch。 */
const NAIVE_CASES = [
  ['2024/01/01', Date.UTC(2024, 0, 1)],
  ['2024/01/01 00:00:00', Date.UTC(2024, 0, 1)],
  ['2024/01/01 12:34:56', Date.UTC(2024, 0, 1, 12, 34, 56)],
  ['2024-01-01', Date.UTC(2024, 0, 1)],
  ['2024-01-01T00:00:00', Date.UTC(2024, 0, 1)],
  ['2024-01-01 00:00:00', Date.UTC(2024, 0, 1)],
] as const

/** 带显式时区/偏移输入 → 期望的 epoch(与宿主 TZ 无关)。 */
const AWARE_CASES = [
  ['2024-01-01T00:00:00Z', Date.UTC(2024, 0, 1)],
  ['2024-01-01T00:00:00+08:00', Date.UTC(2023, 11, 31, 16)],
  ['2024/01/01 00:00:00+08:00', Date.UTC(2023, 11, 31, 16)],
] as const

describe('F-714 toAwareUtc 无时区串统一按 UTC 墙钟解析', () => {
  it('前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件断言恒绿)', () => {
    const probe = new Date('2024-01-01T00:00:00Z')
    process.env.TZ = 'UTC'
    const utcHour = probe.getHours()
    process.env.TZ = 'Asia/Shanghai'
    const shanghaiHour = probe.getHours()
    expect({ utcHour, shanghaiHour }).toEqual({ utcHour: 0, shanghaiHour: 8 })
  })

  it('无时区形态在 Asia/Shanghai 与 UTC 下都等于 UTC 墙钟', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      for (const [input, expected] of NAIVE_CASES) {
        expect({ zone, input, epoch: toAwareUtc(input).getTime() }).toEqual({
          zone,
          input,
          epoch: expected,
        })
      }
    }
  })

  it('带显式 Z / 偏移的按原义解析,不随宿主 TZ 变化', () => {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      for (const [input, expected] of AWARE_CASES) {
        expect({ zone, input, epoch: toAwareUtc(input).getTime() }).toEqual({
          zone,
          input,
          epoch: expected,
        })
      }
    }
  })
})
