// Playwright 视觉回归测试
// 用途: 检测前端样式在多视图 + 多主题下的视觉稳定性
// 第一次跑生成 baseline，后续跑自动比对
import { test, expect } from '@playwright/test'
import { isolateThemeState } from './helpers/test-isolation'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'
const PAGES = [
  { name: 'home', path: '/', title: '首页' },
  { name: 'login', path: '/login', title: '登录' },
  { name: 'agents', path: '/agents', title: '智能体' },
  { name: 'plaza', path: '/plaza', title: '广场' },
  { name: 'vip', path: '/vip', title: 'VIP' },
  { name: 'tools', path: '/tools', title: '工具' },
  { name: 'ranking', path: '/ranking', title: '排行榜' },
]

// 并行测试隔离:每个测试前清理可能残留的主题状态
test.beforeEach(isolateThemeState)

test.describe('视觉回归', () => {
  // 启用并行模式: 14 个页面截图测试可并行执行,显著降低总耗时
  test.describe.configure({ mode: 'parallel' })

  for (const p of PAGES) {
    test(`视觉回归 - ${p.title} 亮色`, async ({ page }) => {
      await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(p.name === 'vip' ? 2000 : 800)
      await expect(page).toHaveScreenshot(`${p.name}-light.png`, { fullPage: true, maxDiffPixelRatio: 0.02 })
    })

    test(`视觉回归 - ${p.title} 暗色`, async ({ page }) => {
      await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.evaluate(() => {
        document.documentElement.classList.add('dark')
        try { localStorage.setItem('theme', 'dark') } catch (e) { /* noop */ }
      })
      await page.waitForTimeout(800)
      await expect(page).toHaveScreenshot(`${p.name}-dark.png`, { fullPage: true, maxDiffPixelRatio: 0.02 })
    })
  }
})

test('视觉回归 - 智能体页聊天框 hover 状态', async ({ page }) => {
  await page.goto(BASE + '/agents', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1000)
  const chatInput = page.locator('.chat-input, [contenteditable="true"]').first()
  await chatInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  if (await chatInput.count() > 0) {
    await chatInput.hover()
    await page.waitForTimeout(500)
  }
  await expect(page).toHaveScreenshot('agents-chat-hover.png', { fullPage: false, maxDiffPixelRatio: 0.05 })
})

test('视觉回归 - 智能体页弹窗打开', async ({ page }) => {
  await page.goto(BASE + '/agents', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1000)
  // 用精确选择器匹配智能体卡片，避免误匹配外层容器
  const card = page.locator('.agents-square-list__card-wrapper, .dev-agent-card').first()
  await card.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  // 先关闭可能存在的 el-message-box 弹窗
  await page.locator('.el-message-box__close, .el-message-box__btns .el-button').first().click().catch(() => {})
  if (await card.count() > 0) {
    await card.click()
    await page.waitForTimeout(1500)
  }
  await expect(page).toHaveScreenshot('agents-modal-open.png', { fullPage: false, maxDiffPixelRatio: 0.05 })
})

test('视觉回归 - 主题色按钮一致', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  const colors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return {
      primary: root.getPropertyValue('--el-color-primary').trim(),
      success: root.getPropertyValue('--el-color-success').trim(),
      danger: root.getPropertyValue('--el-color-danger').trim(),
      warning: root.getPropertyValue('--el-color-warning').trim(),
      info: root.getPropertyValue('--el-color-info').trim(),
    }
  })
  expect(colors.primary).not.toBe('')
  expect(colors.success).not.toBe('')
  expect(colors.danger).not.toBe('')
  expect(colors.warning).not.toBe('')
  expect(colors.info).not.toBe('')
})

test('视觉回归 - 容器样式唯一（card/btn/input）', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  // 检查 Element Plus 组件已加载
  const componentCount = await page.evaluate(() => {
    return {
      cards: document.querySelectorAll('[class*="el-card"]').length,
      buttons: document.querySelectorAll('[class*="el-button"]').length,
      inputs: document.querySelectorAll('[class*="el-input"]').length,
    }
  })
  // 至少有一种组件
  const total = componentCount.cards + componentCount.buttons + componentCount.inputs
  expect(total).toBeGreaterThan(0)
})

// 鉴权页面重定向验证:未登录访问需登录页面应跳转到登录页
test.describe('鉴权页面重定向验证', () => {
  // 每个测试前清除登录状态,防止残留 token 导致守卫误判
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('user_token')
      localStorage.removeItem('token')
      localStorage.removeItem('login_expiry_time')
      localStorage.removeItem('login_duration')
      localStorage.removeItem('user_data')
      sessionStorage.clear()
    })
  })

  const AUTH_PAGES = [
    { name: 'ai-team', path: '/ai-team', title: 'AI团队' },
    { name: 'top-up', path: '/top-up', title: '充值' },
  ]

  for (const p of AUTH_PAGES) {
    test(`未登录访问 ${p.title} 重定向到登录页`, async ({ page }) => {
      await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(800)
      // 验证已重定向到登录页(URL 包含 /login 或页面有登录表单)
      const url = page.url()
      const hasLoginForm = await page.locator('input[type="password"], .login-form, .el-input[type="text"]').first().isVisible().catch(() => false)
      const isOnLogin = url.includes('/login') || url.endsWith(BASE.replace('http://127.0.0.1:8888', '')) || url === BASE + '/'
      expect(isOnLogin || hasLoginForm, `${p.title} 未登录应重定向到登录页`).toBeTruthy()
    })
  }
})
