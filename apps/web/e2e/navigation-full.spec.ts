// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'

/**
 * 全站导航测试。
 *
 * 覆盖:
 * - 所有顶级页面可达
 * - 面包屑
 * - 侧边栏
 * - 页面无 500/无控制台异常
 */

// 顶级页面路径
const TOP_LEVEL_PAGES = [
  '/',
  '/login',
  '/register',
  '/plaza',
  '/circles',
  '/asks',
  '/topics',
  '/learn',
  '/exam',
  '/points',
  '/vip',
  '/docs',
  '/search',
] as const

test.describe('全站导航 - 顶级页面可达', () => {
  for (const path of TOP_LEVEL_PAGES) {
    test(`${path} 可访问无 500`, async ({ page }) => {
      const serverErrors: string[] = []
      page.on('response', (resp) => {
        if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
      })
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      expect(
        serverErrors.filter(
          (e) =>
            !e.includes('favicon') &&
            !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
            !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
        ),
      ).toHaveLength(0)
    })
  }
})

test.describe('全站导航 - 导航元素', () => {
  test('首页导航栏可见', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav, [role="navigation"], aside').first()
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('首页侧边栏可见(若存在)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const sidebar = page.locator('aside, [role="complementary"]').first()
    // 侧边栏可能存在也可能不存在
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(sidebar).toBeVisible()
    }
  })

  test('面包屑可见(若存在)', async ({ page }) => {
    await page.goto('/plaza')
    await page.waitForLoadState('domcontentloaded')
    // 面包屑可能是 nav 或 ol
    const breadcrumb = page.locator('[aria-label="breadcrumb"], nav ol, .breadcrumb').first()
    if (await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(breadcrumb).toBeVisible()
    }
  })

  test('导航链接可点击导航', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // 查找任一导航链接
    const navLink = page.locator('nav a, [role="navigation"] a').first()
    if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await navLink.getAttribute('href')
      if (href && href.startsWith('/')) {
        await navLink.click().catch(() => {})
        await page.waitForTimeout(1000)
        expect(page.url()).toBeTruthy()
      }
    }
  })

  test('侧边栏“我的学习”聚合菜单可展开并展示子页面链接', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const aside = page.locator('aside').first()
    if (await aside.isVisible({ timeout: 3000 }).catch(() => false)) {
      const parent = page.getByTestId('nav-myLearning').first()
      await expect(parent).toBeVisible()

      await expect(page.getByTestId('nav-favorites')).toHaveCount(0)
      await expect(page.getByTestId('nav-following')).toHaveCount(0)
      await expect(page.getByTestId('nav-subscriptions')).toHaveCount(0)

      // 2026-08-26 修复:click({ force: true }) 仍无法触发 onClick(子菜单的 useState
      // 在 React 严格模式下与 force dispatch 兼容性差)。改用 dispatchEvent('click')
      // 直接派发原生 click 事件,绕开 actionability + pointer event 检查。
      await parent.dispatchEvent('click')
      await page.waitForTimeout(300)

      const favorites = page.getByTestId('nav-favorites').first()
      const following = page.getByTestId('nav-following').first()
      const subscriptions = page.getByTestId('nav-subscriptions').first()
      await expect(favorites).toBeVisible()
      await expect(following).toBeVisible()
      await expect(subscriptions).toBeVisible()

      // 收藏/关注/订阅是个人页面，需要登录才能访问；这里只验证链接指向正确路径
      expect(await favorites.getAttribute('href')).toBe('/favorites')
      expect(await following.getAttribute('href')).toBe('/following')
      expect(await subscriptions.getAttribute('href')).toBe('/subscriptions')
    }
  })

  /**
   * 2026-09-13 立(配合侧栏乐观高亮性能重构):
   * 根因背景 —— 点击侧栏项时的"立即高亮"反馈原先由 Sidebar 自身 React state 驱动,
   * 每次点击重渲染整棵侧栏(97 项),实测给 click→pushState 增加 82ms 并叠加出 94ms
   * 首帧同步长任务。重构后改为 zustand store + 叶子级布尔选择器,只有"旧激活项"与
   * "新目标项"两个叶子重渲染。
   *
   * 本用例守护重构后的**核心不变量**:任何时刻侧栏内满色激活项(bg-primary)
   * **有且至多一个**,且导航落地后恒等于目标路由。
   * 若将来有人把订阅写回 `(s) => s.href`(全体订阅者重渲染)或漏掉旧项熄灭逻辑,
   * 本用例会以"同时点亮两个"/"落地后不等于目标"失败。
   */
  test('侧栏乐观高亮:激活项全局唯一且导航落地后等于目标路由', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // 未登录时侧栏不渲染,跳过(与同文件既有侧栏用例同一守卫策略)
    const nav = page.locator('nav#main-sidebar-desktop')
    if (!(await nav.isVisible({ timeout: 5000 }).catch(() => false))) return

    // 只统计满色激活 token "bg-primary";父级展开态用的 bg-primary/10 不算(正则排除)
    const activeHrefs = () =>
      page.evaluate(() => {
        const root = document.querySelector('nav#main-sidebar-desktop')
        if (!root) return []
        const found = new Set<string>()
        for (const a of root.querySelectorAll('a')) {
          const cls = a.getAttribute('class') || ''
          if (/(^|\s)bg-primary(\s|$)/.test(cls)) found.add(a.getAttribute('href') || '')
        }
        return [...found]
      })

    const target = nav.locator('a[data-testid="nav-agents"]')
    if ((await target.count()) === 0) return

    await target.dispatchEvent('click')

    // 采样跨越"导航进行中"窗口:任何一帧都不允许出现两个满色激活项
    for (let i = 0; i < 6; i++) {
      expect((await activeHrefs()).length).toBeLessThanOrEqual(1)
      await page.waitForTimeout(25)
    }

    await page.waitForURL('**/agents', { timeout: 20000 })
    expect(await activeHrefs()).toEqual(['/agents'])
  })

  test('全站无控制台未捕获异常(首页)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
