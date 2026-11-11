// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-37: 用户卡会员到期时间用 `getCurrentLocale()`,不再冻在 zh-CN。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { UserInfo } from '@ihui/types'

const LOCALES = ['en', 'zh-CN', 'ko'] as const
type AppLocale = (typeof LOCALES)[number]

const ISO = '2026-03-05T16:09:00.000Z'
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}

const localeBox = vi.hoisted(() => ({ value: 'en' as AppLocale }))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: localeBox.value }),
  getCurrentLocale: () => localeBox.value,
}))

import UserInfoCard from '../src/components/UserInfoCard'

function executable(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function fmt(locale: AppLocale, iso: string): string {
  return new Intl.DateTimeFormat(locale, DATE_OPTS).format(new Date(iso))
}

function user(vipExpireAt: string): UserInfo {
  return {
    uuid: 'u-1',
    username: '测试用户',
    isVip: 1,
    vipLevel: 'VIP1',
    vipExpireAt,
  }
}

function openExpire(iso: string) {
  const view = render(createElement(UserInfoCard, { userInfo: user(iso) }))
  fireEvent.click(screen.getByRole('button', { name: 'VIP1' }))
  return view
}

describe('DBG-37 会员到期时间跟随当前 locale', () => {
  beforeEach(() => {
    localeBox.value = 'en'
  })

  it('可执行源码用 getCurrentLocale,不再写死 zh-CN', () => {
    const src = executable(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../src/components/UserInfoCard.tsx'),
        'utf8',
      ),
    )
    const start = src.indexOf('function formatDateTime')
    const end = src.indexOf('export interface UserInfoCardProps')
    const fn = src.slice(start, end)
    expect(fn).toContain('new Intl.DateTimeFormat(getCurrentLocale()')
    expect(fn).not.toMatch(/['"]zh-CN['"]/)
  })

  it('en 与 zh-CN 的到期时间串不同,后面的断言才有牙', () => {
    expect(fmt('en', ISO)).not.toBe(fmt('zh-CN', ISO))
  })

  it.each(LOCALES)('%s 弹窗到期时间按该语言格式化', (locale) => {
    localeBox.value = locale
    openExpire(ISO)
    expect(screen.getByText(`到期时间:${fmt(locale, ISO)}`)).toBeTruthy()
  })

  it('语言从 en 切到 ko 后到期时间跟着换', () => {
    localeBox.value = 'en'
    const view = openExpire(ISO)
    expect(screen.getByText(`到期时间:${fmt('en', ISO)}`)).toBeTruthy()
    localeBox.value = 'ko'
    view.rerender(createElement(UserInfoCard, { userInfo: user(ISO) }))
    expect(screen.getByText(`到期时间:${fmt('ko', ISO)}`)).toBeTruthy()
    expect(screen.queryByText(`到期时间:${fmt('en', ISO)}`)).toBeNull()
  })

  it('解析失败时回退原字符串,不显示 Invalid Date', () => {
    openExpire('not-a-date')
    expect(screen.getByText('到期时间:not-a-date')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
