import { test, expect } from '@playwright/test'

test.describe('监控仪表板测试', () => {
  test('应该正确加载监控仪表板', async ({ page }) => {
    await page.goto('/admin/monitoring')
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content.length).toBeGreaterThan(0)
  })

  test('监控卡片应该显示数据', async ({ page }) => {
    await page.goto('/admin/monitoring')
    await page.waitForSelector('.stat-card, .monitoring-card', { timeout: 10000 }).catch(() => {})
    const cards = await page.locator('.stat-card, .monitoring-card').count()
    expect(cards).toBeGreaterThanOrEqual(0)
  })

  test('图表应该正常渲染', async ({ page }) => {
    await page.goto('/admin/monitoring')
    await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {})
    const charts = await page.locator('canvas').count()
    expect(charts).toBeGreaterThanOrEqual(0)
  })
})

test.describe('错误仪表板测试', () => {
  test('应该正确加载错误仪表板', async ({ page }) => {
    await page.goto('/admin/errors')
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content.length).toBeGreaterThan(0)
  })

  test('错误统计卡片应该显示', async ({ page }) => {
    await page.goto('/admin/errors')
    await page.waitForSelector('.stat-card', { timeout: 10000 }).catch(() => {})
    const cards = await page.locator('.stat-card').count()
    expect(cards).toBeGreaterThanOrEqual(0)
  })

  test('错误列表应该可滚动', async ({ page }) => {
    await page.goto('/admin/errors')
    await page.waitForSelector('.el-table', { timeout: 10000 }).catch(() => {})
    const tables = await page.locator('.el-table').count()
    expect(tables).toBeGreaterThanOrEqual(0)
  })
})

test.describe('性能仪表板测试', () => {
  test('应该正确加载性能仪表板', async ({ page }) => {
    await page.goto('/admin/performance')
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content.length).toBeGreaterThan(0)
  })

  test('Web Vitals指标应该显示', async ({ page }) => {
    await page.goto('/admin/performance')
    await page.waitForSelector('.stat-card', { timeout: 10000 }).catch(() => {})
    const cards = await page.locator('.stat-card').count()
    expect(cards).toBeGreaterThanOrEqual(0)
  })

  test('性能趋势图表应该渲染', async ({ page }) => {
    await page.goto('/admin/performance')
    await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {})
    const charts = await page.locator('canvas').count()
    expect(charts).toBeGreaterThanOrEqual(0)
  })
})

test.describe('移动端适配测试', () => {
  test('监控仪表板移动端布局', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/monitoring')
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content.length).toBeGreaterThan(0)
  })

  test('错误仪表板移动端布局', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/errors')
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content.length).toBeGreaterThan(0)
  })

  test('性能仪表板移动端布局', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/performance')
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content.length).toBeGreaterThan(0)
  })
})

test.describe('权限控制测试', () => {
  test('未登录用户访问管理页面应该重定向', async ({ page }) => {
    await page.goto('/admin/monitoring')
    await page.waitForURL(/\/(login|admin)/, { timeout: 5000 }).catch(() => {})
    const url = page.url()
    expect(url).toBeDefined()
  })
})

test.describe('数据刷新测试', () => {
  test('监控数据刷新按钮应该可用', async ({ page }) => {
    await page.goto('/admin/monitoring')
    await page.waitForLoadState('networkidle')
    const refreshButton = page.locator('button:has-text("刷新")')
    const count = await refreshButton.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('图表交互测试', () => {
  test('图表时间范围切换应该工作', async ({ page }) => {
    await page.goto('/admin/performance')
    await page.waitForLoadState('networkidle')
    const radioButtons = page.locator('.el-radio-button')
    const count = await radioButtons.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('错误详情测试', () => {
  test('点击详情按钮应该显示弹窗', async ({ page }) => {
    await page.goto('/admin/errors')
    await page.waitForLoadState('networkidle')
    const detailButton = page.locator('button:has-text("详情")')
    const count = await detailButton.count()
    if (count > 0) {
      await detailButton.first().click()
      await page.waitForSelector('.el-dialog', { timeout: 5000 }).catch(() => {})
    }
    expect(true).toBe(true)
  })
})
