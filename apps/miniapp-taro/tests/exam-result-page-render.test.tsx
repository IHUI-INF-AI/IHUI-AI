// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考试结果页薄壳形制锁(apps/miniapp-taro/src/pages/exam/result.tsx)。
 *
 * 本页在「单源改造」后只保留:数据(记录详情 + 名次摘要)/ 主题根 / NavBar / 转发面板。
 * 版面、四格统计、全量解析、rank、底部三操作全部由
 * `@ihui/rn-app/features/exam-result/ExamResultScreen` 输出。
 *
 * 钉四件事:
 *  ① 共享屏真被渲染(引了必须挂进树里);
 *  ② props 逐个到达(统计/名次/解析所需字段与三操作回调一个都不能漏);
 *  ③ 端内不再有第二份渲染(统计/回顾/底栏的 JSX 与样式类不得回潮);
 *  ④ 主题根包在壳外层。
 *
 * 阴性对照:删掉 result.tsx 里任一传入 prop(例 `onShare`),②即红 —— 逐字段断言就是为此。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({
  routeParams: {} as Record<string, string>,
  captured: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/exam-result/ExamResultScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.captured = props
    return createElement('div', { 'data-shell': 'exam-result-screen' })
  }
  Stub.displayName = 'ExamResultScreenShellStub'
  return { ExamResultScreen: Stub }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateBack: vi.fn(),
    redirectTo: vi.fn(),
    showShareMenu: vi.fn(),
  }
  return {
    default: Taro,
    ...Taro,
    useRouter: () => ({ params: state.routeParams }),
    useShareAppMessage: vi.fn(),
  }
})

vi.mock('@tarojs/components', () => ({
  View: (props: { children?: ReactNode }) => createElement('div', {}, props.children),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
}))

vi.mock('@/api', () => ({
  getExamResult: vi.fn(() => Promise.resolve(null)),
  get: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ ready: true, allow: true, waitUntilReady: (cb: () => void) => cb() }),
}))

vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

import ExamResult from '../src/pages/exam/result'

const PAGE_SOURCE = readFileSync(resolve('src/pages/exam/result.tsx'), 'utf8')

describe('考试结果页(共享屏薄壳)', () => {
  beforeEach(() => {
    state.routeParams = {
      score: '88',
      totalScore: '100',
      pass: 'true',
      correct: '3',
      wrong: '2',
      unanswered: '1',
      duration: '30',
    }
    state.captured = null
  })

  it('① 共享屏真被渲染,主题根包在壳外层', () => {
    const html = renderToStaticMarkup(createElement(ExamResult))
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/exam-result/ExamResultScreen'")
    expect(html).toContain('data-shell="exam-result-screen"')
    expect(html.indexOf('data-theme-root')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-shell="exam-result-screen"')).toBeGreaterThan(
      html.indexOf('data-theme-root'),
    )
  })

  it('② props 逐个到达:统/名次/解析字段与三操作回调一个不漏', () => {
    renderToStaticMarkup(createElement(ExamResult))
    const props = state.captured
    expect(props).not.toBeNull()
    // 字典型 prop
    expect(typeof props!.t).toBe('function')
    expect(props!.colorScheme).toBe('light')
    expect(props!.loading).toBe(false)
    expect(props!.error).toBe('')
    // 数据面(无 id 的同步兜底分支)
    expect(props!.item).toMatchObject({
      score: 88,
      totalScore: 100,
      passed: true,
      correctCount: 3,
      wrongCount: 2,
      unansweredCount: 1,
      totalCount: 6,
      duration: 30,
    })
    // 三操作 + 基础出口,少一个即红
    for (const key of ['onBack', 'onRetry', 'onRetryExam', 'onViewList', 'onShare', 'onNavigate']) {
      expect(typeof props![key]).toBe('function')
    }
  })

  it('③ 端内不再有第二份渲染:统计/回顾/底栏 JSX 与样式类不得回潮', () => {
    expect(PAGE_SOURCE).not.toMatch(/<Text\b|<ScrollView\b|<Image\b/)
    expect(PAGE_SOURCE).not.toMatch(/exam-result-(hero|badge|stats|stat-|review|footer|btn|card)/)
    expect(PAGE_SOURCE).not.toMatch(/examResult\.(statCorrect|reviewTitle|rank)/)
  })

  it('④ 头注(剥掉水印横幅后)指向共享屏源头', () => {
    const firstContentLine = PAGE_SOURCE.split('\n')
      .map((l) => l.trim())
      .find(
        (l) =>
          l !== '' &&
          !l.startsWith('// ©') &&
          !l.startsWith('// Provenance') &&
          !l.includes('[IHUI-AI-PROVENANCE]'),
      )
    expect(firstContentLine).toContain('packages/app/src/features/exam-result/ExamResultScreen.tsx')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
