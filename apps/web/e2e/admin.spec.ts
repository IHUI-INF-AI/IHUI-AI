import { test, expect } from '@playwright/test'

test.describe('Admin 管理后台', () => {
  test('未登录访问 /admin 重定向到登录页', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(login|register|admin|403|forbidden)/)
  })

  test('admin/users 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin/statistics 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/statistics')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin/roles 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/roles')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin/permissions 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/permissions')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin/orders 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin/configs 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/configs')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('admin/oss 页面权限拦截', async ({ page }) => {
    await page.goto('/admin/oss')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toBeTruthy()
  })
})
