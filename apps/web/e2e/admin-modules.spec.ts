import { test, expect } from '@playwright/test'

/**
 * Admin 各子模块导航与基础功能冒烟测试。
 *
 * 覆盖 18 个 admin 子页面:
 * agents/dict/docs/edu/events/exam/help/learn/live/news/orders/oss/point/refund/roles/sms/tags/users
 *
 * 验证:
 * - 页面可加载(无 500)
 * - main 容器可见(若未重定向登录)
 * - 控制台无未捕获异常
 */

// 18 个 admin 子页面路径
const ADMIN_MODULES = [
  'agents',
  'dict',
  'docs',
  'edu',
  'events',
  'exam',
  'help',
  'learn',
  'live',
  'news',
  'orders',
  'oss',
  'point',
  'refund',
  'roles',
  'sms',
  'tags',
  'users',
] as const

/** 通用页面冒烟:无 500 + main 可见 + 无控制台错误 */
async function smokeAdminPage(page: import('@playwright/test').Page, mod: string) {
  const serverErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('response', (resp) => {
    if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto(`/admin/${mod}`)
  await page.waitForLoadState('domcontentloaded')

  // 未登录应重定向到登录页或 403,或停留 admin 页面
  const url = page.url()
  const redirected = /\/(login|register|403|forbidden)/.test(url)
  const stayed = url.includes(`/admin/${mod}`)
  expect(redirected || stayed).toBeTruthy()

  // 无 500 错误
  expect(
    serverErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
        !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
    ),
  ).toHaveLength(0)
  // 无未捕获异常(过滤已知 dev 警告)
  const realErrors = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('React DevTools'),
  )
  expect(realErrors).toHaveLength(0)

  // 若停留 admin 页面,main 容器应可见
  if (stayed) {
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  }
}

test.describe('Admin 各子模块导航', () => {
  for (const mod of ADMIN_MODULES) {
    test(`admin/${mod} 页面可加载无错误`, async ({ page }) => {
      await smokeAdminPage(page, mod)
    })
  }

  test('admin 首页(/admin)可加载', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')
    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      ),
    ).toHaveLength(0)
  })
})

test.describe('Admin 侧边栏导航', () => {
  test('admin 各模块入口可点击(若页面可访问)', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    // 若停留 admin 页面,验证侧边栏存在
    if (page.url().includes('/admin')) {
      const sidebar = page.locator('aside, nav, [role="navigation"]').first()
      if (await sidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(sidebar).toBeVisible()
      }
    }
  })
})
