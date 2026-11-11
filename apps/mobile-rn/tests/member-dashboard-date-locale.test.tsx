// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-34: 会员中心有效期与订单日期跟应用当前语言走,不再冻在 zh-CN。
 * `fmtDate` 在组件树外,读的是 i18n 模块镜像 `getCurrentLocale()`。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const LOCALES = ['en', 'zh-CN', 'ko'] as const
type AppLocale = (typeof LOCALES)[number]

const ISO = '2026-03-05T16:09:00.000Z'
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}

const localeBox = vi.hoisted(() => ({ value: 'en' as AppLocale }))
const translators = vi.hoisted(() => ({
  en: (key: string) => key,
  'zh-CN': (key: string) => key,
  ko: (key: string) => key,
}))
const seen = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }))
const api = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  getOrders: vi.fn(),
  getUserStatistics: vi.fn(),
}))

vi.mock('@ihui/rn-app', () => ({
  MemberDashboardScreen: (props: Record<string, unknown>) => {
    seen.props.push(props)
    return createElement('div', { 'data-testid': 'member-dashboard' })
  },
}))

vi.mock('@ihui/shared/utils', () => ({
  formatMoney: (amount: number) => amount.toFixed(2),
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: api.fetchApi,
  getOrders: api.getOrders,
  getUserStatistics: api.getUserStatistics,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: translators[localeBox.value], locale: localeBox.value }),
  getCurrentLocale: () => localeBox.value,
}))

import { MemberDashboardScreen } from '../src/screens/MemberDashboardScreen'

function executable(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function fmt(locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, DATE_OPTS).format(new Date(ISO))
}

function lastProps(): Record<string, unknown> | undefined {
  return seen.props[seen.props.length - 1]
}

function createdAtOf(props: Record<string, unknown> | undefined): string {
  const rows = props?.recentOrders
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const row: unknown = rows[0]
  if (!row || typeof row !== 'object' || !('createdAt' in row)) return ''
  const createdAt = row.createdAt
  return typeof createdAt === 'string' ? createdAt : ''
}

describe('DBG-34 会员日期跟随当前 locale', () => {
  beforeEach(() => {
    seen.props.length = 0
    localeBox.value = 'en'
    api.fetchApi.mockImplementation(async (url: string) => {
      if (url === '/api/members/me') {
        return {
          success: true,
          data: { member: { vipLevel: { levelName: '黄金', endTime: ISO } } },
        }
      }
      if (url === '/api/coupons') return { success: true, data: { total: 1 } }
      return { success: false }
    })
    api.getUserStatistics.mockResolvedValue({ success: true, data: { points: 3 } })
    api.getOrders.mockResolvedValue({
      success: true,
      data: {
        total: 1,
        list: [
          {
            orderNo: 'NO-1',
            targetTitle: '会员',
            payAmount: 99,
            status: 'paid',
            createdAt: ISO,
          },
        ],
      },
    })
  })

  it('可执行源码用 getCurrentLocale,不再写死 zh-CN', () => {
    const src = executable(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../src/screens/MemberDashboardScreen.tsx'),
        'utf8',
      ),
    )
    const start = src.indexOf('const fmtDate')
    const end = src.indexOf('export function MemberDashboardScreen')
    const fn = src.slice(start, end)
    expect(fn).toContain('new Intl.DateTimeFormat(getCurrentLocale()')
    expect(fn).not.toMatch(/['"]zh-CN['"]/)
  })

  it('en 与 zh-CN 的日期串不同,后面的断言才有牙', () => {
    expect(fmt('en')).not.toBe(fmt('zh-CN'))
  })

  it.each(LOCALES)('%s 有效期与订单日期都按该语言格式化', async (locale) => {
    localeBox.value = locale
    render(createElement(MemberDashboardScreen))
    await waitFor(() => {
      const props = lastProps()
      expect(props?.loading).toBe(false)
      expect(props?.expireAtText).toBe(fmt(locale))
      expect(createdAtOf(props)).toBe(fmt(locale))
    })
  })

  it('语言从 en 切到 ko 后重新格式化,不留下英文日期', async () => {
    localeBox.value = 'en'
    const view = render(createElement(MemberDashboardScreen))
    await waitFor(() => expect(lastProps()?.expireAtText).toBe(fmt('en')))
    localeBox.value = 'ko'
    view.rerender(createElement(MemberDashboardScreen))
    await waitFor(() => {
      expect(lastProps()?.expireAtText).toBe(fmt('ko'))
      expect(createdAtOf(lastProps())).toBe(fmt('ko'))
    })
  })

  it('无效到期时间得到 null,不拿 Invalid Date 充数', async () => {
    api.fetchApi.mockImplementation(async (url: string) => {
      if (url === '/api/members/me') {
        return {
          success: true,
          data: { member: { vipLevel: { levelName: '黄金', endTime: 'not-a-date' } } },
        }
      }
      if (url === '/api/coupons') return { success: true, data: { total: 0 } }
      return { success: false }
    })
    render(createElement(MemberDashboardScreen))
    await waitFor(() => {
      expect(lastProps()?.loading).toBe(false)
      expect(lastProps()?.expireAtText).toBeNull()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
