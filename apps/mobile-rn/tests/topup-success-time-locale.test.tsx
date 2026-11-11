// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-36: 充值成功页的到账时间用 `useI18n().locale`,不再 `toLocaleString('zh-CN')`。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const LOCALES = ['en', 'zh-CN', 'ko'] as const
type AppLocale = (typeof LOCALES)[number]

const localeBox = vi.hoisted(() => ({ value: 'en' as AppLocale }))
const seen = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }))

vi.mock('@ihui/rn-app', () => ({
  TopupSuccessScreen: (props: Record<string, unknown>) => {
    seen.props.push(props)
    return createElement('div', { 'data-testid': 'topup-success' })
  },
}))

vi.mock('../src/components/IntroducePopup', () => ({
  IntroducePopup: () => null,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
  useRoute: () => ({ params: { amount: 12.5, orderId: 'ord-1' } }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: localeBox.value,
  }),
}))

import TopupSuccessScreen from '../src/screens/TopupSuccessScreen'

function executable(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function timeOf(props: Record<string, unknown> | undefined): string {
  return typeof props?.time === 'string' ? props.time : ''
}

function rowTimeOf(props: Record<string, unknown> | undefined): string {
  const rows = props?.rows
  if (!Array.isArray(rows) || rows.length < 3) return ''
  const row: unknown = rows[2]
  if (!row || typeof row !== 'object' || !('value' in row)) return ''
  return typeof row.value === 'string' ? row.value : ''
}

/** `toLocaleString` 含秒,渲染与断言之间允许跨过整秒。 */
function matchesLocale(text: string, locale: AppLocale, around: number): boolean {
  for (let delta = -3000; delta <= 3000; delta += 1000) {
    if (text === new Date(around + delta).toLocaleString(locale)) return true
  }
  return false
}

describe('DBG-36 充值时间跟随当前 locale', () => {
  beforeEach(() => {
    seen.props.length = 0
    localeBox.value = 'en'
  })

  it('可执行源码用 hook 的 locale,不再写死 zh-CN', () => {
    const src = executable(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../src/screens/TopupSuccessScreen.tsx'),
        'utf8',
      ),
    )
    expect(src).toContain('toLocaleString(locale)')
    expect(src).not.toMatch(/toLocaleString\(\s*['"]zh-CN['"]\s*\)/)
  })

  it('en 与 zh-CN 的 toLocaleString 不同,后面的断言才有牙', () => {
    const now = Date.now()
    expect(new Date(now).toLocaleString('en')).not.toBe(new Date(now).toLocaleString('zh-CN'))
  })

  it.each(LOCALES)('%s 的 time 与信息行都按该语言格式化', (locale) => {
    localeBox.value = locale
    const around = Date.now()
    render(createElement(TopupSuccessScreen))
    const props = seen.props[seen.props.length - 1]
    const time = timeOf(props)
    expect(matchesLocale(time, locale, around)).toBe(true)
    expect(rowTimeOf(props)).toBe(time)
    const other: AppLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
    expect(matchesLocale(time, other, around)).toBe(false)
  })

  it('语言从 en 切到 ko 后时间串跟着换', () => {
    localeBox.value = 'en'
    const view = render(createElement(TopupSuccessScreen))
    const enTime = timeOf(seen.props[seen.props.length - 1])
    localeBox.value = 'ko'
    const around = Date.now()
    view.rerender(createElement(TopupSuccessScreen))
    const koTime = timeOf(seen.props[seen.props.length - 1])
    expect(matchesLocale(koTime, 'ko', around)).toBe(true)
    expect(koTime).not.toBe(enTime)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
