/**
 * 主题切换工具
 * 统一管理 dark / high-contrast / 跟随系统 等主题预设
 */

import type { Page } from '@playwright/test'

export type Theme = 'light' | 'dark' | 'hc-light' | 'hc-dark'

const THEME_KEY = 'theme'

export async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((args: { key: string; val: string }) => {
    localStorage.setItem(args.key, args.val)
    document.documentElement.classList.remove('dark', 'high-contrast-light', 'high-contrast-dark')
    if (args.val === 'dark' || args.val === 'hc-dark') document.documentElement.classList.add('dark')
    if (args.val === 'hc-light') document.documentElement.classList.add('high-contrast-light')
    if (args.val === 'hc-dark') document.documentElement.classList.add('high-contrast-dark')
  }, { key: THEME_KEY, val: theme })
}

export async function getTheme(page: Page): Promise<string | null> {
  return page.evaluate((k: string) => localStorage.getItem(k), THEME_KEY)
}

export async function getEffectiveTheme(page: Page): Promise<'light' | 'dark' | 'hc-light' | 'hc-dark' | null> {
  return page.evaluate(() => {
    const html = document.documentElement
    if (html.classList.contains('high-contrast-dark')) return 'hc-dark'
    if (html.classList.contains('high-contrast-light')) return 'hc-light'
    if (html.classList.contains('dark')) return 'dark'
    return 'light'
  })
}

export async function clearTheme(page: Page) {
  await page.evaluate((k: string) => localStorage.removeItem(k), THEME_KEY)
}
