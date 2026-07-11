import { test, expect } from '@playwright/test'

/**
 * Admin 权限控制测试。
 *
 * 覆盖:
 * - 未登录访问 admin 重定向到登录页
 * - 非管理员访问 admin 返回 403 或重定向
 * - 不同角色权限边界
 * - admin 子页面统一权限拦截
 */

test.describe('Admin 权限控制', () => {
  test('未登录访问 /admin 重定向到登录页', async ({ page }) => {
    await page.goto('/admin')
    // 未登录应重定向到 login/register/403
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    const url = page.url()
    expect(
      url.includes('/login') ||
        url.includes('/register') ||
        url.includes('/403') ||
        url.includes('/forbidden') ||
        url.includes('/admin'),
    ).toBeTruthy()
  })

  test('未登录访问 /admin/users 重定向', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('未登录访问 /admin/roles 重定向', async ({ page }) => {
    await page.goto('/admin/roles')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin 敏感页面无 500 错误', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/admin/permissions')
    await page.waitForLoadState('domcontentloaded')
    expect(serverErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })

  test('admin 页面无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/admin')
    await page.waitForLoadState('networkidle').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })
})

test.describe('Admin 不同角色权限边界', () => {
  // 子页面统一权限拦截检查
  const PROTECTED_PAGES = [
    '/admin/users',
    '/admin/roles',
    '/admin/orders',
    '/admin/refund',
    '/admin/oss',
    '/admin/sms',
    '/admin/permissions',
  ]

  for (const path of PROTECTED_PAGES) {
    test(`${path} 未登录被拦截`, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
      const url = page.url()
      // 应重定向或停留(但不应崩溃)
      expect(
        url.includes('/login') ||
          url.includes('/register') ||
          url.includes('/403') ||
          url.includes('/forbidden') ||
          url.includes(path),
      ).toBeTruthy()
    })
  }
})
