/**
 * 并行测试隔离工具
 * 统一管理主题相关测试的 beforeEach 清理逻辑,避免 localStorage/data-theme 互相污染
 *
 * 用法:
 *   import { isolateThemeState } from './helpers/test-isolation'
 *   test.beforeEach(isolateThemeState)
 *
 *   // 或需要导航后清理的场景:
 *   import { isolateThemeStateAfterNav } from './helpers/test-isolation'
 *   test.beforeEach(async ({ page }) => {
 *     await isolateThemeStateAfterNav(page)
 *   })
 */

import type { Page } from '@playwright/test'

const THEME_KEYS = ['theme', 'theme-preset'] as const

/**
 * 在页面加载前注入清理脚本(addInitScript 模式)
 * 适用于:不需要导航到具体页面,仅在测试开始时清理 localStorage
 * 注意:此方式无法清理 document.documentElement 上的属性(页面尚未加载)
 */
export async function isolateThemeState({ page }: { page: Page }) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('theme')
      localStorage.removeItem('theme-preset')
    } catch (_e) { /* noop */ }
  })
}

/**
 * 导航到首页后清理主题状态(evaluate 模式)
 * 适用于:需要同时清理 localStorage 和 document.documentElement 属性的场景
 * 注意:会导航到 '/',测试主体如需其他页面需自行再次导航
 */
export async function isolateThemeStateAfterNav(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    for (const key of ['theme', 'theme-preset']) {
      try { localStorage.removeItem(key) } catch (_e) { /* noop */ }
    }
  })
}

/**
 * 仅清理主题状态(不导航,假设页面已加载)
 * 适用于:测试主体已自行导航,仅需补充清理的场景
 */
export async function clearThemeState(page: Page) {
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    for (const key of ['theme', 'theme-preset']) {
      try { localStorage.removeItem(key) } catch (_e) { /* noop */ }
    }
  })
}

export { THEME_KEYS }
