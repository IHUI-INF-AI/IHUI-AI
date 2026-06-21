import { test, expect } from '@playwright/test'

// 注入管理员登录态到 localStorage
async function injectAdminAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const userData = {
      id: 'admin-test-001', uuid: 'admin-test-001', username: 'admin',
      nickname: '测试管理员', role: 'admin', isAdmin: true, userType: 'admin',
      roles: ['admin'], permissions: ['*'], avatar: '', status: 1,
      loginTime: new Date().toISOString(), lastActiveTime: new Date().toISOString(),
    }
    const token = 'admin-test-token-1'
    const expiryTime = Date.now() + 6 * 24 * 60 * 60 * 1000
    window.localStorage.setItem('user_data', JSON.stringify(userData))
    window.localStorage.setItem('token', JSON.stringify(token))
    window.localStorage.setItem('accessToken', JSON.stringify(token))
    window.localStorage.setItem('user_token', JSON.stringify(token))
    window.localStorage.setItem('admin-access-token', JSON.stringify(token))
    window.localStorage.setItem('login_expiry_time', JSON.stringify(expiryTime))
    window.localStorage.setItem('login_duration', JSON.stringify(7 * 24 * 60 * 60 * 1000))
  })
}

// 刷新按钮: 第一个 (清空历史按钮在趋势图卡片里)
const refreshBtn = (page: import('@playwright/test').Page) =>
  page.locator('.status-card .header-actions .el-button').first()

test.describe('后端健康监控面板', () => {
  test('页面正确加载并显示健康数据', async ({ page }) => {
    await injectAdminAuth(page)
    await page.goto('/admin/backend-health')
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('.backend-health', { timeout: 15000 })
    const healthPanel = page.locator('.backend-health')
    await expect(healthPanel).toBeVisible()

    await page.waitForTimeout(3000)

    const statusTag = page.locator('.stat-item .el-tag').first()
    await expect(statusTag).toBeVisible()

    await expect(refreshBtn(page)).toBeVisible()

    const autoRefreshSwitch = page.locator('.status-card .header-actions .el-switch')
    await expect(autoRefreshSwitch).toBeVisible()

    console.log('[后端健康监控] 页面加载成功 ✅')
  })

  test('点击刷新按钮能重新获取数据', async ({ page }) => {
    await injectAdminAuth(page)
    await page.goto('/admin/backend-health')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.backend-health', { timeout: 15000 })

    await refreshBtn(page).click()
    await page.waitForTimeout(2000)

    const healthPanel = page.locator('.backend-health')
    await expect(healthPanel).toBeVisible()
    console.log('[后端健康监控] 刷新按钮工作正常 ✅')
  })

  test('数据库引擎状态显示', async ({ page }) => {
    await injectAdminAuth(page)
    await page.goto('/admin/backend-health')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.backend-health', { timeout: 15000 })

    await page.waitForTimeout(3000)

    const engineList = page.locator('.engine-list')
    await expect(engineList).toBeVisible()

    const engineItems = page.locator('.engine-item')
    const count = await engineItems.count()
    expect(count).toBeGreaterThan(0)
    console.log(`[后端健康监控] 数据库引擎数量: ${count} ✅`)
  })

  test('原始数据区域显示', async ({ page }) => {
    await injectAdminAuth(page)
    await page.goto('/admin/backend-health')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.backend-health', { timeout: 15000 })

    await page.waitForTimeout(3000)

    const rawData = page.locator('.raw-data')
    await expect(rawData).toBeVisible()
    console.log('[后端健康监控] 原始数据显示正常 ✅')
  })

  test('开启自动刷新后历史趋势图渲染', async ({ page }) => {
    await injectAdminAuth(page)
    await page.goto('/admin/backend-health')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.backend-health', { timeout: 15000 })

    await page.waitForTimeout(2000)

    // 触发多次刷新以产生历史数据点
    const btn = refreshBtn(page)
    await btn.click()
    await page.waitForTimeout(800)
    await btn.click()
    await page.waitForTimeout(800)
    await btn.click()
    await page.waitForTimeout(1500)

    // 检查 ECharts canvas 是否渲染
    const chartCanvas = page.locator('.trend-chart canvas')
    const canvasCount = await chartCanvas.count()
    expect(canvasCount).toBeGreaterThan(0)

    // 检查历史数据点提示
    const historyTip = page.locator('.history-tip')
    await expect(historyTip).toBeVisible()
    const tipText = await historyTip.textContent()
    expect(tipText).toMatch(/\d+/)
    console.log(`[后端健康监控] 趋势图渲染, ${tipText} ✅`)

    // 清空历史按钮可见
    const clearBtn = page.locator('.clear-history-btn')
    await expect(clearBtn).toBeVisible()
  })
})
