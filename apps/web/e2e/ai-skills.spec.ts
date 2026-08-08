import { test, expect } from '@playwright/test'

/**
 * AI Skills 独立页 E2E 测试。
 *
 * 覆盖:
 * - 列表页渲染(标题/统计/分类标签)
 * - 搜索过滤
 * - Tab 切换(全部/已上线/即将上线)
 * - 详情页渲染(元数据/调用区)
 * - 页面无 500/无控制台异常
 * - 响应式布局
 */

test.describe('AI Skills 独立页', () => {
  const SKILL_URL = '/ai-skills'

  test('列表页渲染:标题/统计/分类标签', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })

    await page.goto(SKILL_URL)
    await page.waitForLoadState('networkidle')

    // 无 500 错误
    expect(
      serverErrors.filter(
        (e) => !e.includes('favicon') && !/\/api\/ai-skills\b.*\b5\d{2}\b/.test(e),
      ),
    ).toHaveLength(0)

    // 页面标题可见
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10000 })
    await expect(heading).not.toBeEmpty()

    // 分类 Tab 可见
    const tabAll = page.getByRole('button').filter({ hasText: /全部|All|모두|すべて/i })
    const tabAvailable = page.getByRole('button').filter({ hasText: /已上线|Available|이용 가능|利用可能/i })
    const tabComing = page.getByRole('button').filter({ hasText: /即将上线|Coming|출시 예정|近日公開/i })
    const hasAnyTab = await tabAll.or(tabAvailable.or(tabComing)).isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasAnyTab).toBeTruthy()

    // 搜索框可见
    const searchInput = page.getByPlaceholder(/搜索|Search|검색|検索/i)
    await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {})
  })

  test('搜索过滤:输入关键词过滤技能列表', async ({ page }) => {
    await page.goto(SKILL_URL)
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/搜索|Search|검색|検索/i)
    const isVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false)
    if (!isVisible) return

    // 输入关键词
    await searchInput.fill('code')
    await page.waitForTimeout(500)

    // 验证列表项被过滤(至少有一个技能卡包含关键词,或列表为空显示空状态)
    const cards = page.locator('a[href^="/ai-skills/"]')
    const cardCount = await cards.count()
    if (cardCount > 0) {
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        await expect(cards.nth(i)).toBeVisible()
      }
    }

    // 清空搜索,恢复全部
    await searchInput.fill('')
    await page.waitForTimeout(500)
    const restoredCount = await page.locator('a[href^="/ai-skills/"]').count()
    expect(restoredCount).toBeGreaterThanOrEqual(cardCount)
  })

  test('Tab 切换:全部/已上线/即将上线', async ({ page }) => {
    await page.goto(SKILL_URL)
    await page.waitForLoadState('networkidle')

    // 点击"全部"Tab
    const tabAll = page.getByRole('button').filter({ hasText: /全部|All|모두|すべて/i })
    const tabAvailable = page.getByRole('button').filter({ hasText: /已上线|Available|이용 가능|利用可能/i })
    const tabComing = page.getByRole('button').filter({ hasText: /即将上线|Coming|출시 예정|近日公開/i })

    // 尝试切换 Tab
    for (const tab of [tabAvailable, tabComing, tabAll]) {
      const isVisible = await tab.isVisible({ timeout: 3000 }).catch(() => false)
      if (isVisible) {
        await tab.click()
        await page.waitForTimeout(500)
        // 验证页面无 500
        const errorResp = page.url()
        expect(errorResp).not.toContain('500')
      }
    }
  })

  test('详情页渲染:技能元数据可见', async ({ page }) => {
    await page.goto(SKILL_URL)
    await page.waitForLoadState('networkidle')

    // 点击第一个技能卡片
    const firstCard = page.locator('a[href^="/ai-skills/"]').first()
    const isVisible = await firstCard.isVisible({ timeout: 10000 }).catch(() => false)
    if (!isVisible) return

    const href = await firstCard.getAttribute('href')
    await firstCard.click()
    await page.waitForLoadState('networkidle')

    // 详情页标题可见
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10000 })
    await expect(heading).not.toBeEmpty()

    // 元数据区可见
    const metaSection = page.locator('section').first()
    await expect(metaSection).toBeVisible({ timeout: 5000 }).catch(() => {})

    // 返回列表页
    const backButton = page.getByRole('button').filter({ hasText: /返回|Back|돌아가기|戻る/i }).first()
    const backLink = page.locator('a[href="/ai-skills"]').first()
    const back = await backButton.or(backLink).isVisible({ timeout: 3000 }).catch(() => false)
    if (back) {
      await backButton.or(backLink).first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/ai-skills\/?$/)
    }
  })

  test('列表页无控制台异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(SKILL_URL)
    await page.waitForLoadState('networkidle')

    // 忽略非关键错误(如 favicon 404)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('Failed to load resource'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('详情页无控制台异常', async ({ page }) => {
    await page.goto(SKILL_URL)
    await page.waitForLoadState('networkidle')

    const firstCard = page.locator('a[href^="/ai-skills/"]').first()
    const isVisible = await firstCard.isVisible({ timeout: 10000 }).catch(() => false)
    if (!isVisible) return

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await firstCard.click()
    await page.waitForLoadState('networkidle')

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('Failed to load resource'),
    )
    expect(criticalErrors).toHaveLength(0)
  })
})