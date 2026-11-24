// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// cli 端 ICU 渲染回归(D101 第④步:cli 自写插值已收编为共享 formatIcu)
// 关键判据:界面里不得出现 ICU 语法残迹;缺参时仍走 cli 既有的"字面量保留"策略。

import { describe, expect, it } from 'vitest'

import { setLocale, t } from '../src/i18n/index.js'

describe('cli ICU 渲染走共享端中立解释器', () => {
  it('en 单复数由 CLDR 决定(修掉旧文案的 "1 messages")', () => {
    setLocale('en')
    expect(t('cli.sessionResumed', { id: 's1', count: 1 })).toBe(
      'Resumed recent session: s1 (1 message)',
    )
    expect(t('cli.sessionResumed', { id: 's1', count: 3 })).toBe(
      'Resumed recent session: s1 (3 messages)',
    )
    expect(t('cli.sessionResumed', { id: 's1', count: 0 })).toBe(
      'Resumed recent session: s1 (no messages)',
    )
  })

  it('zh-CN 只有 other 类,=0 走精确匹配分支', () => {
    setLocale('zh-CN')
    expect(t('cli.sessionResumed', { id: 's1', count: 1 })).toBe('恢复最近会话: s1 (1 条历史)')
    expect(t('cli.sessionResumed', { id: 's1', count: 0 })).toBe('恢复最近会话: s1 (无历史)')
  })

  it('ja / ko 各自的分支形态', () => {
    setLocale('ja')
    expect(t('cli.sessionResumed', { id: 's1', count: 12 })).toBe(
      '最近のセッションを復元: s1 (12 件の履歴)',
    )
    expect(t('cli.sessionResumed', { id: 's1', count: 0 })).toBe(
      '最近のセッションを復元: s1 (履歴なし)',
    )
    setLocale('ko')
    expect(t('cli.sessionResumed', { id: 's1', count: 5 })).toBe('최근 세션 복원: s1 (5개 기록)')
    expect(t('cli.sessionResumed', { id: 's1', count: 0 })).toBe('최근 세션 복원: s1 (기록 없음)')
  })

  it('缺参数时不得把 ICU 语法吐到终端', () => {
    setLocale('zh-CN')
    const out = t('cli.sessionResumed', { id: 's1' })
    expect(out).not.toContain('plural')
    expect(out).not.toContain('other {')
    expect(out).toContain('条历史')
  })

  it('既有非 ICU 键行为不变(含缺参保留字面量的 cli 策略)', () => {
    setLocale('zh-CN')
    expect(t('common.notFound', { target: 'a.ts' })).toBe('未找到 a.ts')
    expect(t('cli.errorFileNotFound', {})).toContain('{path}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
