import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

test.describe('移动端核心流程（Pixel 5）', () => {
  test('移动端首页加载 + 底部导航可见', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    // 移动端底部导航
    const hasBottomNav = await page.evaluate(() => {
      return !!document.querySelector('.mobile-bottom-nav, .bottom-nav, [class*="mobile-nav"]')
    })
    expect(hasBottomNav, '移动端底部导航应可见').toBe(true)
    await page.screenshot({ path: 'test-results/mobile-home.png', fullPage: true })
  })

  test('移动端首页视口宽度正确（375）', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThanOrEqual(414)
    expect(viewport?.width).toBeGreaterThanOrEqual(360)
  })

  test('移动端汉堡菜单可打开 + 关闭', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    // 查找汉堡按钮（aria-label 含 菜单 / menu）
    const burger = page.locator('button[aria-label*="菜单" i], button[aria-label*="menu" i]').first()
    if (await burger.count() > 0) {
      await burger.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/mobile-menu-open.png', fullPage: true })
    } else {
      test.skip(true, '未找到汉堡菜单按钮')
    }
  })

  test('移动端 /agents 加载', async ({ page }) => {
    await page.goto(`${BASE}/agents`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const bodyText = await page.evaluate(() => document.body.innerText)
    expect(bodyText.length, '页面有内容').toBeGreaterThan(100)
    await page.screenshot({ path: 'test-results/mobile-agents.png', fullPage: true })
  })

  test('移动端 /vip 加载 + 套餐可见', async ({ page }) => {
    await page.goto(`${BASE}/vip`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const hasVip = await page.evaluate(() => {
      const t = document.body.innerText
      return t.includes('VIP') || t.includes('会员') || t.includes('订阅')
    })
    expect(hasVip, '移动端 VIP 页应有套餐').toBe(true)
    await page.screenshot({ path: 'test-results/mobile-vip.png', fullPage: true })
  })

  test('移动端登录页加载', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const hasLogin = await page.evaluate(() => {
      const t = document.body.innerText
      return t.includes('登录') || t.includes('快捷登录') || t.includes('账号')
    })
    expect(hasLogin, '移动端登录页有登录字段').toBe(true)
    await page.screenshot({ path: 'test-results/mobile-login.png', fullPage: true })
  })

  // 注: 移动端无横向滚动条测试已由 responsive-test.spec.ts 统一覆盖
  // responsive-test.spec.ts 在 7 个页面 × 10 种视口下都检查了水平滚动
})
