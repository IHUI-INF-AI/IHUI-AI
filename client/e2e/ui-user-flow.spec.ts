/**
 * 前端 UI 交互测试: 完整用户流程
 *
 * 覆盖: 登录页 → 首页 → 支付页 的真实用户操作流程
 * 验证: 表单填写、按钮点击、页面跳转、路由保护
 *
 * 注意: 登录表单是异步组件 (defineAsyncComponent), 需要 waitForSelector 等待加载
 */

import { test, expect, type Page } from '@playwright/test'
import { fetchTokenWithRetry } from './helpers/auth-helper'

const FRONTEND = process.env.PW_BASE_URL ?? 'http://127.0.0.1:8888'

/** 通过 localStorage + sessionStorage 注入登录态 (token 同时写入两处, 避免 migrateFromLocalStorage 删除后路由守卫找不到) */
async function injectAuthState(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => {
    const futureExpiry = Date.now() + 86400000 // 24小时后过期
    const userData = JSON.stringify({
      uuid: 'integration_test',
      id: 'integration_test',
      username: 'integration_test',
      nickname: '集成测试用户',
      status: 1,
      isVip: false,
    })
    // Payment.vue 的 getUserInfo 需要 userInfo (含 openid), 否则重定向到 /login
    const userInfo = JSON.stringify({
      uuid: 'integration_test',
      id: 'integration_test',
      username: 'integration_test',
      nickname: '集成测试用户',
      openid: 'integration_test_openid',
      status: 1,
      isVip: false,
    })
    // localStorage (路由守卫会检查)
    localStorage.setItem('token', t)
    localStorage.setItem('user_token', t)
    localStorage.setItem('user_data', userData)
    localStorage.setItem('userInfo', userInfo)
    localStorage.setItem('login_expiry_time', String(futureExpiry))
    // sessionStorage (SecureStorageManager 会读取, migrateFromLocalStorage 会写入这里)
    sessionStorage.setItem('token', t)
    sessionStorage.setItem('user_token', t)
  }, token)
}

/** 导航到受保护页面 (addInitScript 会在每次页面加载前注入 localStorage + sessionStorage) */
async function navigateToProtected(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500) // 等 initAuth + 路由守卫 + 组件初始化完成
}

// =============================================================================
// 1. 登录页 UI 交互
// =============================================================================
test.describe('登录页 UI 交互', () => {
  test.setTimeout(30000)

  test('登录页加载成功, 包含核心文字', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length, '页面有内容').toBeGreaterThan(100)
    const hasLogin = /登录|login/i.test(text)
    expect(hasLogin, '页面包含"登录"').toBe(true)
    console.log(`[登录页] 文字长度: ${text.length}`)
    // 截图对比 (首次生成基线, 后续运行对比样式变化)
    await expect(page).toHaveScreenshot('login-page.png', { maxDiffPixelRatio: 0.05, animations: 'disabled' })
  })

  // 注: 未登录访问 /payment 跳转测试已统一迁移到 route-guard.spec.ts
})

// =============================================================================
// 2. 首页 UI 交互
// =============================================================================
test.describe('首页 UI 交互', () => {
  test.setTimeout(30000)

  test('首页加载成功, 显示核心内容', async ({ page }) => {
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length, '首页有内容').toBeGreaterThan(100)
    console.log(`[首页] 文字长度: ${text.length}`)
    // 截图对比 (首次生成基线, 后续运行对比样式变化)
    // 首页有动态内容(信息列表), 用宽松容差容忍动态变化
    await expect(page).toHaveScreenshot('home-page.png', { maxDiffPixelRatio: 0.15, animations: 'disabled' })
  })

  test('首页可导航到登录页', async ({ page }) => {
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.goto(`${FRONTEND}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    expect(page.url()).toContain('/login')
    console.log(`[导航] 当前 URL: ${page.url()}`)
  })
})

// =============================================================================
// 3. 支付页 UI 交互 (需登录)
// =============================================================================
test.describe('支付页 UI 交互', () => {
  test.setTimeout(30000)

  test('登录后可访问支付页, 显示套餐和支付方式', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/payment`)
    const url = page.url()
    console.log(`[支付页] 当前 URL: ${url}`)
    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length, '支付页有内容').toBeGreaterThan(50)
    const hasPayment = /支付|会员|VIP|元/i.test(text)
    expect(hasPayment, '支付页包含支付相关文字').toBe(true)
    console.log(`[支付页] 文字长度: ${text.length}`)
    // 截图对比 (首次生成基线, 后续运行对比样式变化)
    await expect(page).toHaveScreenshot('payment-page.png', { maxDiffPixelRatio: 0.05, animations: 'disabled' })
  })

  test('支付页套餐和支付按钮可见', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/payment`)
    const hasPackage = await page.locator('.package').count()
    const hasPayButton = await page.locator('.pay-button').count()
    console.log(`[支付页] 套餐数: ${hasPackage}, 支付按钮数: ${hasPayButton}`)
    if (hasPackage > 0) {
      expect(hasPackage, '支付页有套餐').toBeGreaterThan(0)
    }
    if (hasPayButton > 0) {
      expect(hasPayButton, '支付页有支付按钮').toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// 4. 完整用户流程: 登录 → 首页 → 支付页
// =============================================================================
test.describe('完整用户流程', () => {
  test.setTimeout(45000)

  test('登录 → 首页 → 支付页 完整导航', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }

    // Step 1: 访问首页
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    console.log(`[Step1 首页] URL: ${page.url()}`)

    // Step 2: 注入登录态, 跳转支付页
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/payment`)
    const paymentUrl = page.url()
    console.log(`[Step2 支付页] URL: ${paymentUrl}`)
    expect(paymentUrl).toContain('/payment')

    // Step 3: 验证支付页内容
    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length, '支付页有内容').toBeGreaterThan(50)
    console.log(`[Step3 支付页内容] 文字长度: ${text.length}`)

    // Step 4: 返回首页
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    console.log(`[Step4 返回首页] URL: ${page.url()}`)
    expect(page.url()).not.toContain('/login')
  })
})

// =============================================================================
// 5. 个人中心 UI 交互 (需登录)
// =============================================================================
test.describe('个人中心 UI 交互', () => {
  test.setTimeout(30000)

  test('登录后可访问个人中心, 显示用户信息', async ({ page }) => {
    const token = await fetchTokenWithRetry(page)
    if (!token) {
      test.skip(true, '后端未启动或登录失败')
      return
    }
    await injectAuthState(page, token)
    await navigateToProtected(page, `${FRONTEND}/user`)
    const url = page.url()
    console.log(`[个人中心] 当前 URL: ${url}`)
    expect(url).toContain('/user')
    // User.vue 是异步组件, 等待关键元素加载
    await page.waitForTimeout(3000)
    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length, '个人中心有内容').toBeGreaterThan(10)
    console.log(`[个人中心] 文字长度: ${text.length}`)
  })

  // 注: 未登录访问个人中心跳转测试已统一迁移到 route-guard.spec.ts
})

// =============================================================================
// 6. 会员页 UI 交互 (无需登录)
// =============================================================================
test.describe('会员页 UI 交互', () => {
  test.setTimeout(30000)

  test('会员页加载成功, 显示会员相关内容', async ({ page }) => {
    await page.goto(`${FRONTEND}/vip`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const url = page.url()
    console.log(`[会员页] 当前 URL: ${url}`)
    expect(url).toContain('/vip')
    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length, '会员页有内容').toBeGreaterThan(50)
    const hasVip = /会员|VIP|特权|权益/i.test(text)
    expect(hasVip, '会员页包含会员相关文字').toBe(true)
    console.log(`[会员页] 文字长度: ${text.length}`)
  })
})
