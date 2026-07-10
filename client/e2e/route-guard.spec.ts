/**
 * 路由保护测试（统一入口）
 *
 * 合并来源:
 * - login-flow.spec.ts 的"登录后跳转链路" describe 块（6 个路由保护测试 + 1 个公开页测试）
 * - ui-core-pages.spec.ts 的"路由保护测试" describe 块（2 个测试）
 * - key-flows.spec.ts 的 2 个路由保护测试
 * - ui-user-flow.spec.ts 的 2 个路由保护测试
 * - ai-chat-redirect.spec.ts 的 /chat-history 重定向测试
 *
 * 测试覆盖所有受保护路由:
 * /chat-history, /orders, /settings, /user, /favorites, /dashboard, /payment
 *
 * 公开页验证（不应跳登录）:
 * /agents, /plaza, /vip, /conversation
 */
import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

// 受保护路由: 未登录访问应跳转到 /login 并带 redirect 参数
const PROTECTED_ROUTES = [
  '/chat-history',
  '/orders',
  '/settings',
  '/user',
  '/favorites',
  '/dashboard',
  '/payment',
] as const

// 公开路由: 未登录可直接访问，不应跳转登录
const PUBLIC_ROUTES = ['/agents', '/plaza', '/vip', '/conversation'] as const

test.describe('路由保护: 受保护路由未登录跳转登录页', () => {
  test.setTimeout(30000)

  for (const route of PROTECTED_ROUTES) {
    test(`未登录访问 ${route} 跳 /login`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const url = page.url()
      expect(url).toContain('/login')
      // /chat-history 和 /settings 等带 redirect 参数的路由验证 redirect
      if (['/chat-history', '/orders', '/settings'].includes(route)) {
        expect(url).toContain('redirect=')
      }
      console.log(`[路由保护] ${route} → ${url}`)
    })
  }
})

test.describe('路由保护: 公开页可直接访问', () => {
  test.setTimeout(30000)

  test('公开页可直接访问（/agents /plaza /vip）', async ({ page }) => {
    for (const path of ['/agents', '/plaza', '/vip']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1000)
      const url = page.url()
      expect(url).toContain(path)
      expect(url, `${path} 不应跳登录`).not.toContain('/login')
    }
  })

  test('未登录访问 /conversation 不跳转（公开页）', async ({ page }) => {
    await page.goto(`${BASE}/conversation`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url).toContain('/conversation')
    expect(url).not.toContain('/login')
  })
})

test.describe('路由保护: /dashboard 和 /settings 宽松验证', () => {
  // 这两个路由在某些环境下可能因权限配置不同而表现不同（跳登录或允许访问）
  // 因此使用宽松验证: 只要跳到 login 或目标页都算通过
  test.setTimeout(30000)

  test('未登录访问 /settings 重定向到登录或展示设置页', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForURL(/\/(settings|login)/, { timeout: 10000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(settings|login)/)
  })

  test('未登录访问 /dashboard 重定向到登录或展示仪表盘', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 10000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(dashboard|login)/)
  })
})
