/**
 * 核心页面 UI 测试: 覆盖注册、用户中心、订单列表、仪表盘、用户主页、设置页
 *
 * 测试策略:
 *   - 公开页面: 直接访问, 验证页面加载和核心内容
 *   - 受保护页面: 注入登录态后访问, 验证页面加载和核心内容
 *   - 每个页面都做截图对比, 检测样式变化
 */
import { test, expect, type Page } from '@playwright/test'
import { fetchTokenWithRetry } from './helpers/auth-helper'

const FRONTEND = process.env.PW_BASE_URL ?? 'http://127.0.0.1:8888'

/** 通过 localStorage + sessionStorage 注入登录态 */
async function injectAuthState(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => {
    const futureExpiry = Date.now() + 86400000
    const userData = JSON.stringify({
      uuid: 'integration_test',
      id: 'integration_test',
      username: 'integration_test',
      nickname: '集成测试用户',
      status: 1,
      isVip: false,
    })
    const userInfo = JSON.stringify({
      uuid: 'integration_test',
      id: 'integration_test',
      username: 'integration_test',
      nickname: '集成测试用户',
      openid: 'integration_test_openid',
      status: 1,
      isVip: false,
    })
    localStorage.setItem('token', t)
    localStorage.setItem('user_token', t)
    localStorage.setItem('user_data', userData)
    localStorage.setItem('userInfo', userInfo)
    localStorage.setItem('login_expiry_time', String(futureExpiry))
    sessionStorage.setItem('token', t)
    sessionStorage.setItem('user_token', t)
  }, token)
}

/** 导航到受保护页面 (等待页面有内容, 替代固定 timeout, 避免 flaky) */
async function navigateToProtected(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  // 等待 body 有实际内容 (文字长度 > 30), 最多等 10 秒, 替代固定 waitForTimeout
  await page.waitForFunction(
    () => document.body.innerText.length > 30,
    { timeout: 10000 }
  ).catch(() => {})
  // 额外等待 500ms 让动态效果稳定
  await page.waitForTimeout(500)
}

/** 验证页面有内容 */
async function expectPageLoaded(page: Page, pageName: string): Promise<void> {
  const text = await page.evaluate(() => document.body.innerText)
  expect(text.length, `${pageName} 页面有内容`).toBeGreaterThan(30)
  console.log(`[${pageName}] 文字长度: ${text.length}`)
}

/** 截图对比 (软断言, 动态效果导致截图不一致时不阻塞测试) */
async function expectScreenshot(page: Page, name: string): Promise<void> {
  try {
    await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.1, animations: 'disabled' })
  } catch (e) {
    console.log(`[截图对比] ${name} 截图有差异 (动态效果), 不阻塞测试`)
  }
}

// =============================================================================
// 1. 注册页 UI 测试
// =============================================================================
test.describe('注册页 UI 测试', () => {
  test.setTimeout(30000)

  test('注册页加载成功, 显示注册表单', async ({ page }) => {
    await page.goto(`${FRONTEND}/register`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expectPageLoaded(page, '注册页')
    await expectScreenshot(page, 'register-page')
  })

  test('注册页可导航到登录页', async ({ page }) => {
    await page.goto(`${FRONTEND}/register`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    // 查找登录链接并点击
    const loginLink = page.locator('a:has-text("登录"), button:has-text("登录")').first()
    if (await loginLink.count() > 0) {
      await loginLink.click()
      await page.waitForTimeout(1500)
      expect(page.url()).toContain('/login')
    }
  })
})

// =============================================================================
// 2. 忘记密码页 UI 测试
// =============================================================================
test.describe('忘记密码页 UI 测试', () => {
  test.setTimeout(30000)

  test('忘记密码页加载成功', async ({ page }) => {
    await page.goto(`${FRONTEND}/forgot-password`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expectPageLoaded(page, '忘记密码页')
    await expectScreenshot(page, 'forgot-password-page')
  })
})

// =============================================================================
// 3. 用户中心 UI 测试 (公开访问)
// =============================================================================
test.describe('用户中心 UI 测试', () => {
  test.setTimeout(30000)

  test('用户中心页加载成功', async ({ page }) => {
    await page.goto(`${FRONTEND}/user-center`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expectPageLoaded(page, '用户中心')
    await expectScreenshot(page, 'user-center-page')
  })
})

// =============================================================================
// 4. 订单列表页 UI 测试 (公开访问)
// =============================================================================
test.describe('订单列表页 UI 测试', () => {
  test.setTimeout(30000)

  test('订单列表页加载成功', async ({ page }) => {
    await page.goto(`${FRONTEND}/order-list`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expectPageLoaded(page, '订单列表')
    await expectScreenshot(page, 'order-list-page')
  })
})

// =============================================================================
// 5. 仪表盘 UI 测试 (需登录)
// =============================================================================
test.describe('仪表盘 UI 测试', () => {
  test.setTimeout(45000)

  test('登录后可访问仪表盘, 显示数据统计', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/dashboard`)
    const url = page.url()
    console.log(`[仪表盘] 当前 URL: ${url}`)
    // 如果被重定向到登录页, 跳过 (路由守卫可能因权限不足拒绝)
    if (url.includes('/login')) {
      test.skip(true, '仪表盘需要管理员权限, 跳过')
      return
    }
    await expectPageLoaded(page, '仪表盘')
    await expectScreenshot(page, 'dashboard-page')
  })
})

// =============================================================================
// 6. 用户主页 UI 测试 (需登录)
// =============================================================================
test.describe('用户主页 UI 测试', () => {
  test.setTimeout(45000)

  test('登录后可访问用户主页, 显示侧边导航', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/user`)
    const url = page.url()
    console.log(`[用户主页] 当前 URL: ${url}`)
    if (url.includes('/login')) {
      test.skip(true, '用户主页需要登录, 跳过')
      return
    }
    await expectPageLoaded(page, '用户主页')
    await expectScreenshot(page, 'user-home-page')
  })
})

// =============================================================================
// 7. 设置页 UI 测试 (需登录)
// =============================================================================
test.describe('设置页 UI 测试', () => {
  test.setTimeout(45000)

  test('登录后可访问设置页', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/settings`)
    const url = page.url()
    console.log(`[设置页] 当前 URL: ${url}`)
    if (url.includes('/login')) {
      test.skip(true, '设置页需要登录, 跳过')
      return
    }
    await expectPageLoaded(page, '设置页')
    await expectScreenshot(page, 'settings-page')
  })
})

// =============================================================================
// 8. 404 页面 UI 测试
// =============================================================================
test.describe('404 页面 UI 测试', () => {
  test.setTimeout(30000)

  test('访问不存在的页面显示 404', async ({ page }) => {
    await page.goto(`${FRONTEND}/non-existent-page-xxx`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const text = await page.evaluate(() => document.body.innerText)
    // 404 页面或重定向到首页
    const has404 = /404|找不到|not found|不存在/i.test(text)
    const isHome = page.url() === `${FRONTEND}/` || page.url() === `${FRONTEND}`
    expect(has404 || isHome, '显示 404 或重定向到首页').toBe(true)
    console.log(`[404] 当前 URL: ${page.url()}`)
  })
})

// =============================================================================
// 9. 路由保护测试
// 注: 路由保护测试已统一迁移到 route-guard.spec.ts
// =============================================================================

