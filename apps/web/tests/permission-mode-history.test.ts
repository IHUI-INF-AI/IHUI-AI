// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限档历史的统计口径(G-164 读侧归一)。
// 这里盯的是**最安静的那类错**:累计时长算成 0,界面只是"显示 0 秒",
// 没有任何报错。上一版把段间比较归一了、最后一段仍裸比 —— 半截修复比没修更难查。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import {
  PERMISSION_HISTORY_KEY,
  clearHistory,
  getTotalDurationByMode,
} from '@/lib/permission-mode-history'

const MIN = 60_000

/** 直接写 localStorage:被测函数的输入形态是"历史遗留数据",不能靠被测模块自己写出来 */
function seed(entries: Array<{ mode: string; agoMin: number }>): void {
  const now = Date.now()
  const list = entries.map((e, i) => ({
    id: `h${i}`,
    mode: e.mode,
    source: 'popover',
    workspacePath: '/tmp/ihui-hist',
    timestamp: now - e.agoMin * MIN,
  }))
  window.localStorage.setItem(PERMISSION_HISTORY_KEY, JSON.stringify(list))
}

describe('getTotalDurationByMode 的拼写容忍', () => {
  beforeEach(() => {
    clearHistory()
    window.localStorage.clear()
  })

  it('历史里是 kebab(现行落库拼写)→ 正常累计', () => {
    seed([
      { mode: 'accept-edits', agoMin: 30 },
      { mode: 'default', agoMin: 10 },
    ])
    expect(getTotalDurationByMode('accept-edits', 0)).toBeGreaterThanOrEqual(19 * MIN)
  })

  it('历史里是 camel(v1 网关/cli 那侧的规范档拼写)→ 同一档必须累计出同样的时长', () => {
    seed([
      { mode: 'acceptEdits', agoMin: 30 },
      { mode: 'default', agoMin: 10 },
    ])
    expect(getTotalDurationByMode('accept-edits', 0)).toBeGreaterThanOrEqual(19 * MIN)
  })

  it('历史里是 kebab 而参数传 camel → 也要对上(两侧都可能来自不同链路)', () => {
    seed([
      { mode: 'bypass-permissions', agoMin: 40 },
      { mode: 'default', agoMin: 5 },
    ])
    expect(getTotalDurationByMode('bypassPermissions', 0)).toBeGreaterThanOrEqual(30 * MIN)
  })

  it('末段(正在使用的这一档)同样容忍 camel —— 段间归一而末段裸比就是半截修复', () => {
    // 只有一条记录:全部时长都落在"最后一条 → now"这一段上,
    // 末段没归一时这条用例必得 0(段间循环一次都不进)。
    seed([{ mode: 'acceptEdits', agoMin: 12 }])
    expect(getTotalDurationByMode('accept-edits', 0)).toBeGreaterThanOrEqual(11 * MIN)
  })

  it('认不出的档位不得串到别的档位账上(宁可 0,不要虚增)', () => {
    seed([
      { mode: 'yolo-mode', agoMin: 40 },
      { mode: 'default', agoMin: 5 },
    ])
    expect(getTotalDurationByMode('plan', 0)).toBe(0)
    expect(getTotalDurationByMode('accept-edits', 0)).toBe(0)
  })

  it('空历史返回 0(而不是 NaN/异常)', () => {
    expect(getTotalDurationByMode('default', 0)).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
