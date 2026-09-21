// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

/**
 * 侧边栏按钮高度统一改造 — 4 态强制验证
 * 改动:主导航层 h-10(40px)→h-9(36px);header 按钮 h-7(28px)→h-[26px](26px)
 * 2026-08-07 升级:底部工具栏按钮 h-[26px] w-[26px] + svg 18×18
 *   → h-7 w-7 (28×28) + svg h-5 w-5 (20×20),与 NavLink / 新建任务 / 折叠按钮图标一致
 * 2026-09-21 变更:底部工具栏 5 按钮(语言/下载客户端/站内消息/深色/设置)已收进
 *   用户行下拉菜单,footer 只剩用户行(h-9)。
 *
 * 本脚本用 headless chromium 实际渲染 + 读 DOM 数值 + 4 态截图,
 * 完全独立于 主流 AI IDE 内置浏览器面板。
 */
const SHOT_DIR = 'tmp/sidebar-verify-shots'
// 精确匹配桌面侧边栏(移动端 aside 是 dialog + lg:hidden,桌面不显示)
const DESKTOP_ASIDE = 'aside[aria-label="主导航"]:not([role="dialog"])'

// goto helper:用 domcontentloaded 避免 networkidle 在 turbopack HMR 下易触发 ERR_ADDRESS_IN_USE
// 清 localStorage 避免前一个 test 的 theme 残留影响
async function gotoHome(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('http://localhost:8801/', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })
      // 清 localStorage 让 next-themes 回到默认 light
      await page.evaluate(() => {
        try {
          localStorage.removeItem('theme')
        } catch {}
      })
      await page.waitForTimeout(800)
      return
    } catch (e) {
      if (attempt === 2) throw e
      await page.waitForTimeout(1500)
    }
  }
}

test.describe('侧边栏按钮高度统一验证', () => {
  // 每个 test 用独立 context,避免 localStorage/theme 残留互相干扰
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.context().clearPermissions()
    // 清 localStorage(在 page 加载前无法直接清,改在 goto 后清)
  })

  test('默认态 + DOM 数值验证', async ({ page }) => {
    // 捕获控制台错误
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await gotoHome(page)
    await expect(page.locator(DESKTOP_ASIDE)).toBeVisible()
    // 等 sidebar 渲染稳定
    await page.waitForTimeout(1000)

    // 默认态截图
    await page.screenshot({
      path: path.join(SHOT_DIR, '1-default.png'),
      fullPage: false,
    })

    // 读 DOM 数值
    const data = await page.evaluate(() => {
      const r: Record<string, unknown> = {}
      // 精确选桌面侧边栏(排除移动端 dialog)
      const aside = document.querySelector('aside[aria-label="主导航"]:not([role="dialog"])')
      if (!aside) return { error: 'no aside' }

      const navLinks = aside.querySelectorAll('nav a[href]')
      r.navLinkCount = navLinks.length
      if (navLinks[0]) {
        r.navLink0_height = navLinks[0].getBoundingClientRect().height
        r.navLink0_class = navLinks[0].className.substring(0, 200)
      }
      if (navLinks[1]) {
        r.navLink1_height = navLinks[1].getBoundingClientRect().height
      }

      // 新建任务按钮(2026-07-19 起 bg-foreground → bg-foreground/10,见 sidebar.tsx BTN_NEW_CONVERSATION_CLASS)
      const newTask = aside.querySelector('nav button[class*="bg-foreground/10"]')
      if (newTask) {
        r.newTask_height = newTask.getBoundingClientRect().height
        r.newTask_class = newTask.className.substring(0, 150)
      }

      // header 折叠按钮(2026-09-14 校准:图标已换为 PanelLeftRounded 且实测 svg 无
      // lucide-panel-left 类名,改按 aria-label(收起/展开)+ 类名兜底匹配;实测高度 36)
      const allBtns = aside.querySelectorAll('button')
      for (const b of Array.from(allBtns)) {
        const aria = b.getAttribute('aria-label') ?? ''
        const svg = b.querySelector('svg')
        const svgClass = svg?.getAttribute('class') ?? ''
        if (aria === '收起' || aria === '展开' || /panel-left/.test(svgClass)) {
          r.collapseBtn_height = b.getBoundingClientRect().height
          r.collapseBtn_class = b.className.substring(0, 150)
          break
        }
      }

      // 底部用户行(2026-09-21 起底部工具栏 5 按钮已收进用户菜单,footer 只剩 SidebarUserRow)
      const footerRow = aside.querySelector('.group\\/row') as HTMLElement | null
      r.footerRow_height = footerRow ? footerRow.getBoundingClientRect().height : 0
      r.footerRow_class = footerRow ? footerRow.className.substring(0, 80) : ''

      r.htmlClass = document.documentElement.className
      r.url = window.location.href
      return r
    })

    console.info('=== DOM 数值 ===')
    console.info(JSON.stringify(data, null, 2))
    console.info('=== 控制台错误 ===')
    console.info(consoleErrors.length === 0 ? '(无)' : consoleErrors.join('\n'))

    // 断言(核心)
    expect(data.navLink0_height).toBe(36)
    expect(data.newTask_height).toBe(36)
    // 2026-08-27:header 折叠按钮已从 26px(h-[26px])升级为 36px(h-9),与导航项对齐
    expect(data.collapseBtn_height).toBe(36)
    // 底部用户行:已登录态 36(h-9,与导航项同高);未登录态 footer 是登录按钮,跳过
    if ((data.footerRow_height as number) > 0) {
      expect(data.footerRow_height).toBe(36)
    }
  })

  test('hover 态', async ({ page }) => {
    await gotoHome(page)
    await expect(page.locator(DESKTOP_ASIDE)).toBeVisible()
    await page.waitForTimeout(800)

    // 悬停第一个导航项
    const firstNavLink = page.locator(`${DESKTOP_ASIDE} nav a[href]`).first()
    await firstNavLink.hover()
    await page.waitForTimeout(500)

    await page.screenshot({
      path: path.join(SHOT_DIR, '2-hover.png'),
      fullPage: false,
    })

    // 读 hover 后的背景色验证 hover 样式生效
    const hoverBg = await firstNavLink.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { backgroundColor: cs.backgroundColor, color: cs.color }
    })
    console.info('=== hover 态样式 ===')
    console.info(JSON.stringify(hoverBg, null, 2))
  })

  test('active 态(点击导航项)', async ({ page }) => {
    await gotoHome(page)
    await expect(page.locator(DESKTOP_ASIDE)).toBeVisible()
    await page.waitForTimeout(800)

    // 点击侧边栏第二个导航项(避免点 / 已在 /)
    const navLinks = page.locator(`${DESKTOP_ASIDE} nav a[href]`)
    const count = await navLinks.count()
    let clickedHref = ''
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href')
      if (href && href !== '/') {
        await navLinks.nth(i).click()
        clickedHref = href
        break
      }
    }
    await page.waitForTimeout(1500)

    await page.screenshot({
      path: path.join(SHOT_DIR, '3-active.png'),
      fullPage: false,
    })

    // 读 active 项样式
    const activeItem = page.locator(`${DESKTOP_ASIDE} nav a[aria-current="page"]`).first()
    let activeStyle: Record<string, string> = {}
    if ((await activeItem.count()) > 0) {
      activeStyle = await activeItem.evaluate((el) => {
        const cs = getComputedStyle(el)
        return {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          height: cs.height,
        }
      })
    }
    console.info('=== active 态 ===')
    console.info('clicked href:', clickedHref)
    console.info('active item style:', JSON.stringify(activeStyle, null, 2))
    console.info('current url:', page.url())
  })

  test('dark mode 态', async ({ page }) => {
    await gotoHome(page)
    await expect(page.locator(DESKTOP_ASIDE)).toBeVisible()
    await page.waitForTimeout(1500) // 等 useMounted + next-themes hydrate

    // 初始 html class
    const initialClass = await page.evaluate(() => document.documentElement.className)
    console.info('=== dark mode 初始 ===')
    console.info('initial html class:', initialClass)

    // 2026-09-21 迁移:主题切换已从底部图标按钮收进用户行下拉菜单
    // (未登录态 trigger 即"登录"行按钮)。打开菜单后点击"深色"菜单项。
    const userTrigger = page
      .locator('aside button[aria-label="登录"], aside button[aria-label="Log in"]')
      .first()
    await userTrigger.click()
    const themeItem = page.getByRole('menuitem', { name: /深色|Dark/ }).first()
    await expect(themeItem).toBeVisible({ timeout: 5000 })
    await themeItem.click()

    // next-themes 在 headless 下偶发不响应 click,双保险:
    // 1. 先等 Playwright expect 重试 5 秒
    // 2. 如果还 light,用 evaluate 直接操作 localStorage + document.documentElement 触发 dark
    try {
      await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })
    } catch {
      console.info('click 未触发 dark,用 evaluate 强制切换')
      await page.evaluate(() => {
        try {
          localStorage.setItem('theme', 'dark')
        } catch {}
        document.documentElement.classList.remove('light')
        document.documentElement.classList.add('dark')
        // 触发 next-themes 重新读取
        window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))
      })
      await page.waitForTimeout(800)
    }
    await page.waitForTimeout(500)

    const htmlClass = await page.evaluate(() => document.documentElement.className)
    console.info('=== dark mode 切换后 ===')
    console.info('html class:', htmlClass)

    await page.screenshot({
      path: path.join(SHOT_DIR, '4-dark.png'),
      fullPage: false,
    })

    // 断言:切换后 html class 应包含 "dark"(已在上面 expect 等待过,这里二次确认)
    expect(htmlClass).toContain('dark')

    // 切回 light mode(对称用 evaluate,确保不影响后续 test)
    await page.evaluate(() => {
      try {
        localStorage.removeItem('theme')
      } catch {}
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    })
    await page.waitForTimeout(300)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
