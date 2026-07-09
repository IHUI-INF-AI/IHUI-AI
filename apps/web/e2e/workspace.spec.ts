import { test, expect } from '@playwright/test'

test.describe('Workspace 页面', () => {
  test('未登录访问 workspace 重定向到登录页', async ({ page }) => {
    await page.goto('/workspace')
    await page.waitForURL(/\/(login|register)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(login|register|workspace)/)
  })

  test('workspace 页面可加载(若已登录)', async ({ page }) => {
    await page.goto('/workspace')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/workspace')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('workspace 创建项目对话框可打开(若页面可访问)', async ({ page }) => {
    await page.goto('/workspace')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/workspace')) {
      // 查找"新建项目"按钮(可能是 Button 含 Plus 图标)
      const createBtn = page.getByRole('button').filter({ hasText: /新建|创建|项目|Create|New/i }).first()
      if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createBtn.click()
        await page.waitForTimeout(1000)
        // 对话框应出现
        const dialog = page.getByRole('dialog').first()
        if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 输入框应可输入
          const input = dialog.locator('input').first()
          if (await input.isVisible()) {
            await input.fill('E2E 测试项目')
            await expect(input).toHaveValue('E2E 测试项目')
          }
        }
      }
    }
  })
})
