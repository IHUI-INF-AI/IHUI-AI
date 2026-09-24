// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// budget 额度交代的跨端装配规则(D106/D107)。这里锁的是**规则本身**,不是任何一端的措辞:
// 三条规则各配一枚反向用例 —— 它们在 web 端的历史实现里都是被违反过的那三种。
import { describe, expect, it } from 'vitest'

import { BUDGET_DETAIL_SEPARATOR, formatBudgetNote, type BudgetNoteKeys } from '../budget-note'

// 取词函数桩:回显 "键名(参数)"，这样"漏了某个参数"会变成界面上看得见的 undefined 而不是静默空串
const t = (key: string, params?: Record<string, string | number>): string => {
  const args = params
    ? Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    : ''
  return args ? `${key}[${args}]` : key
}

const KEYS: BudgetNoteKeys = {
  note: 'note',
  warningTitle: 'warnTitle',
  criticalTitle: 'critTitle',
  usedTokens: 'usedTokens',
  resetTomorrow: 'resetTomorrow',
  tier: 'tier',
}

describe('formatBudgetNote', () => {
  it('规则① 载荷给全时六槽位都取到,且各段用中点连接', () => {
    const line = formatBudgetNote(
      {
        level: 'warning',
        percent: 85.3,
        usedTokens: 85300,
        limitTokens: 100000,
        tier: '个人版',
        resetAt: '2026-09-25T16:00:00.000Z',
      },
      t,
      KEYS,
    )
    expect(line).toBe(
      `note[title=warnTitle,detail=usedTokens[used=85K,limit=100K]${BUDGET_DETAIL_SEPARATOR}85.3%${BUDGET_DETAIL_SEPARATOR}resetTomorrow${BUDGET_DETAIL_SEPARATOR}tier[tier=个人版]]`,
    )
  })

  it('规则① 缺 resetAt 就不提重置时间(web 端历史写法是无条件播报)', () => {
    const line = formatBudgetNote({ level: 'critical', usedTokens: 1, limitTokens: 2 }, t, KEYS)
    expect(line).not.toContain('resetTomorrow')
    expect(line).toContain('critTitle')
  })

  it('规则① 缺 usedTokens 或缺 limitTokens 都不出 tokens 段(半个数字不如不说)', () => {
    expect(formatBudgetNote({ level: 'warning', usedTokens: 500 }, t, KEYS)).not.toContain(
      'usedTokens',
    )
    expect(formatBudgetNote({ level: 'warning', limitTokens: 500 }, t, KEYS)).not.toContain(
      'usedTokens',
    )
  })

  it('规则② 只有 level 时退化为裸标题,不产出 "标题:" 这种悬空尾巴', () => {
    const line = formatBudgetNote({ level: 'warning' }, t, KEYS)
    expect(line).toBe('warnTitle')
    expect(line).not.toContain('note[')
  })

  it('规则③ 未知档位按 warning 出行(不得静默不出),critical 才升级措辞', () => {
    expect(formatBudgetNote({ level: 'brand_new' as 'warning' }, t, KEYS)).toBe('warnTitle')
    expect(formatBudgetNote({ level: 'critical' }, t, KEYS)).toBe('critTitle')
  })

  it('任何一条产物里都不得出现 undefined / NaN(字段缺省必须被跳过而不是内插)', () => {
    for (const evt of [
      { level: 'warning' as const },
      { level: 'critical' as const, percent: 99 },
      { level: 'warning' as const, tier: 'VIP' },
      { level: 'warning' as const, usedTokens: 1234567, limitTokens: 2000000 },
    ]) {
      const line = formatBudgetNote(evt, t, KEYS)
      expect(line).not.toContain('undefined')
      expect(line).not.toContain('NaN')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
