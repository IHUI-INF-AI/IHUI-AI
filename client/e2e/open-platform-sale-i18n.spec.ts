import { test, expect } from '@playwright/test'

test.describe('开放平台售卖区 i18n', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/open', { waitUntil: 'load', timeout: 35000 })
    await page.locator('.open-platform-container').waitFor({ state: 'attached', timeout: 30000 })
  })

  test('售卖区不显示未翻译的键名（中文）', async ({ page }) => {
    await page.locator('#sale-license').waitFor({ state: 'visible', timeout: 20000 })

    // 售卖区应存在
    const saleSection = page.locator('#sale-license')
    await expect(saleSection).toBeVisible({ timeout: 10000 })

    // 页面正文不应出现原始键名（若出现说明回退到键名）
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('openPlatform.sale.planFreeCta')
    expect(body).not.toContain('openPlatform.sale.planStandardCta')
    expect(body).not.toContain('openPlatform.sale.whyChooseTitle')
    expect(body).not.toContain('openPlatform.sale.navIntro')
  })

  test('定价区 CTA 按钮显示译文', async ({ page }) => {
    await page.locator('#sale-license').waitFor({ state: 'visible', timeout: 20000 })

    // 免费体验按钮应为「立即体验」或等效译文，不能是键名
    const freeCta = page.locator('#sale-pricing button.sl-plan__cta').first()
    await expect(freeCta).toBeVisible({ timeout: 10000 })
    const text = await freeCta.innerText()
    expect(text).not.toBe('openPlatform.sale.planFreeCta')
    expect(text.length).toBeGreaterThan(1)
  })

  test('定价对比表与功能表不显示 i18n 键名', async ({ page }) => {
    await page.locator('#sale-license').waitFor({ state: 'visible', timeout: 20000 })

    const body = await page.locator('body').innerText()
    // 定价对比表行键不应以键名形式出现
    expect(body).not.toContain('openPlatform.pricingCompare.expAndCredit')
    expect(body).not.toContain('openPlatform.pricingCompare.dashboard')
    // 全功能参照表、功能表单元格键不应出现
    expect(body).not.toContain('openPlatform.featureRef.chatCompletions')
    expect(body).not.toContain('openPlatform.featureTable.dialog')
  })

  test('全功能参照与功能表区块可锚点跳转', async ({ page }) => {
    await page.locator('#feature-ref').waitFor({ state: 'visible', timeout: 20000 })
    await expect(page.locator('#feature-table')).toBeVisible({ timeout: 5000 })
  })

  test('FAQ 与 CTA 区块可锚点跳转', async ({ page }) => {
    await page.locator('#faq').waitFor({ state: 'visible', timeout: 20000 })
    await expect(page.locator('#cta')).toBeVisible({ timeout: 5000 })
  })

  test('售卖区客户案例区块可锚点跳转', async ({ page }) => {
    await page.locator('#sale-license').waitFor({ state: 'visible', timeout: 20000 })
    await page.locator('a[href="#sale-cases"]').click()
    await expect(page.locator('#sale-cases')).toBeInViewport()
  })

  test('能力标签筛选按钮有 aria-pressed 状态', async ({ page }) => {
    await page.locator('.capability-tags-wrap').waitFor({ state: 'visible', timeout: 20000 })

    const allBtn = page.locator('.capability-tags-wrap button').first()
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true')
    const coreBtn = page.locator('.capability-tags-wrap button').nth(1)
    await coreBtn.click()
    await expect(coreBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('售卖区末尾「返回本段导航」存在且点击后滚动到导航', async ({ page }) => {
    await page.locator('#sale-license').waitFor({ state: 'visible', timeout: 20000 })

    const backLink = page.locator('a[href="#sale-nav"].sl-back-nav')
    await backLink.waitFor({ state: 'visible', timeout: 10000 })
    await expect(backLink).not.toContainText('openPlatform.sale.backToNav')

    await backLink.click()
    await expect(page.locator('#sale-nav')).toBeInViewport()
  })

  test('主要 section 在 DOM 中存在且可定位', async ({ page }) => {
    await page.locator('#ihui-arch').waitFor({ state: 'visible', timeout: 20000 })

    const sections = ['ihui-arch', 'pipeline', 'api-matrix', 'dx', 'solutions', 'feature-hub', 'ecosystem']
    for (const id of sections) {
      await expect(page.locator(`#${id}`)).toBeVisible()
    }
  })
})
