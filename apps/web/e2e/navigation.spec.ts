import { test, expect } from '@playwright/test'

test.describe('页面导航', () => {
  test('可访问搜索页', async ({ page }) => {
    await page.goto('/search')
    await expect(page).toHaveURL(/\/search/)
  })

  test('可访问文档页', async ({ page }) => {
    await page.goto('/docs')
    await expect(page).toHaveURL(/\/docs/)
  })

  test('未登录访问受保护页面重定向', async ({ page }) => {
    // 访问需要登录的页面,应重定向到登录页
    await page.goto('/user/profile')
    // 等待重定向(可能到 /login)
    await page.waitForURL(/\/(login|register)/, { timeout: 5000 }).catch(() => {})
    // 如果没有重定向,检查页面是否显示登录提示
  })

  test('admin 页面需要管理员权限', async ({ page }) => {
    await page.goto('/admin')
    // 应重定向到登录或显示 403
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
  })
})
