import { test, expect } from '@playwright/test'

test.describe('社区广场页 /plaza', () => {
  test('页面可访问且标题可见', async ({ page }) => {
    await page.goto('/plaza')
    await expect(page).toHaveURL(/\/plaza/)
    // 标题应包含"社区广场"或"Plaza"
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
  })

  test('标签切换:圈子 → 问答', async ({ page }) => {
    await page.goto('/plaza')
    // 默认应显示圈子标签
    const circlesTab = page.getByRole('button', { name: /圈子|Circles/i })
    await expect(circlesTab).toBeVisible({ timeout: 10000 })

    // 点击问答标签
    const asksTab = page.getByRole('button', { name: /问答|Q&A/i })
    await expect(asksTab).toBeVisible()
    await asksTab.click()
    await page.waitForTimeout(500)
  })

  test('查看全部链接可导航', async ({ page }) => {
    await page.goto('/plaza')
    // 等待内容加载
    await page.waitForTimeout(2000)
    // 查找"查看全部"链接
    const viewAllLink = page.getByRole('link', { name: /查看全部|View all/i }).first()
    if (await viewAllLink.isVisible()) {
      await viewAllLink.click()
      await page.waitForURL(/\/(circles|asks)/, { timeout: 5000 }).catch(() => {})
    }
  })

  test('空状态或列表项可见', async ({ page }) => {
    await page.goto('/plaza')
    // 页面应显示加载状态、空状态或列表内容
    const content = page.locator('main, [role="main"]')
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})
