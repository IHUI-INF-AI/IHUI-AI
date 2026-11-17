// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 下一次价档切换判据(2026-11-17)。
 *
 * 这几例的价值在于**与计费侧同一语义**:切换点是用 `matchPeakRule` 逐分钟采样判出来的,
 * 不是按窗口起止猜的。最容易错的一条是"跨天窗口不延续到次日早间"——N6 专门钉它。
 * 基准时刻 2026-11-17 12:00(UTC+8,周二)。
 */
import { describe, expect, it } from 'vitest'
import {
  resolveNextPeakSwitch,
  type PeakWindowSource,
} from '../src/services/relay-model-peak-declaration.js'

const AT_NOON = new Date('2026-11-17T12:00:00+08:00')

function w(
  ruleName: string,
  startMinute: number,
  endMinute: number,
  multiplier: number,
  daysOfWeek: number[] = [],
  modelId: string | null = null,
): PeakWindowSource {
  return { ruleName, modelId, daysOfWeek, startMinute, endMinute, multiplier }
}

describe('下一次价档切换', () => {
  it('N1 当日晚间折扣 ⇒ 今天 20:00 进入,1 → 0.5', () => {
    const next = resolveNextPeakSwitch([w('night', 20 * 60, 22 * 60, 0.5)], 'gpt-4o', AT_NOON)
    expect(next).toEqual({
      at: '2026-11-17T12:00:00.000Z', // = 20:00 UTC+8
      multiplier: 0.5,
      rule_name: 'night',
      from_multiplier: 1,
    })
  })

  it('N2 跨天窗口未到时 ⇒ 今天 23:00 进入,1 → 0.2', () => {
    const next = resolveNextPeakSwitch([w('deep', 23 * 60, 7 * 60, 0.2)], 'gpt-4o', AT_NOON)
    expect(next?.at).toBe('2026-11-17T15:00:00.000Z') // = 23:00 UTC+8
    expect(next?.from_multiplier).toBe(1)
    expect(next?.multiplier).toBe(0.2)
  })

  it('N3 跨天窗口内 ⇒ 次日 07:00 退出,0.2 → 1', () => {
    const at = new Date('2026-11-17T23:30:00+08:00')
    const next = resolveNextPeakSwitch([w('deep', 23 * 60, 7 * 60, 0.2)], 'gpt-4o', at)
    expect(next?.at).toBe('2026-11-17T23:00:00.000Z') // = 次日 07:00 UTC+8
    expect(next?.from_multiplier).toBe(0.2)
    expect(next?.multiplier).toBe(1)
    expect(next?.rule_name).toBeNull()
  })

  it('N4 星期限定的跨天窗口不延续到次日早间(00:00 即切换,与计费同语义)', () => {
    // daysOfWeek=[2] = 周二;周二 23:30 命中,周三 00:00 星期已变 ⇒ 退出
    const at = new Date('2026-11-17T23:30:00+08:00')
    const next = resolveNextPeakSwitch([w('tue-only', 23 * 60, 7 * 60, 0.2, [2])], 'gpt-4o', at)
    expect(next?.at).toBe('2026-11-17T16:00:00.000Z') // = 次日 00:00 UTC+8
    expect(next?.from_multiplier).toBe(0.2)
    expect(next?.multiplier).toBe(1)
  })

  it('N5 全天窗口(start === end)⇒ 无未来切换,返回 null', () => {
    expect(resolveNextPeakSwitch([w('flat', 0, 0, 0.3)], 'gpt-4o', AT_NOON)).toBeNull()
  })

  it('N6 无窗口 ⇒ null', () => {
    expect(resolveNextPeakSwitch([], 'gpt-4o', AT_NOON)).toBeNull()
  })

  it('N7 重叠规则取首个命中(priority 顺序),不是取最低价', () => {
    const windows = [
      w('a', 20 * 60, 22 * 60, 0.5), // 20:00-22:00
      w('b', 21 * 60, 23 * 60, 0.8), // 21:00-23:00
    ]
    const next = resolveNextPeakSwitch(windows, 'gpt-4o', AT_NOON)
    // 20:00 进入 a(0.5);21:00 b 也命中但 a 在前 ⇒ 不翻转;22:00 a 退出 ⇒ 0.8
    expect(next?.at).toBe('2026-11-17T12:00:00.000Z')
    expect(next?.multiplier).toBe(0.5)
    expect(next?.rule_name).toBe('a')
    // 22:00 那次切换是"同一天更晚"的下一跳,不在本次返回值里
  })

  it('N8 at 恰在边界 ⇒ 取严格晚于它的那一次(当天 22:00 退出)', () => {
    const at = new Date('2026-11-17T20:00:00+08:00')
    const next = resolveNextPeakSwitch([w('night', 20 * 60, 22 * 60, 0.5)], 'gpt-4o', at)
    expect(next?.at).toBe('2026-11-17T14:00:00.000Z') // = 当天 22:00 UTC+8
    expect(next?.from_multiplier).toBe(0.5)
    expect(next?.multiplier).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
