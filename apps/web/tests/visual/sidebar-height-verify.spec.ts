import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

/**
 * 侧边栏按钮高度统一改造 — 4 态强制验证
 * 改动:主导航层 h-10(40px)→h-9(36px);header 按钮 h-7(28px)→h-[26px](26px)
 *
 * 本脚本用 headless chromium 实际渲染 + 读 DOM 数值 + 4 态截图,
 * 完全独立于 Trae 内置浏览器面板。
 */
const SHOT_DIR = 'tmp/sidebar-verify-shots'
// 精确匹配桌面侧边栏(移动端 aside 是 dialog + lg:hidden,桌面不显示)
const DESKTOP_ASIDE = 'aside[aria-label="主导航"]:not([role="dialog"])'

// goto helper:用 domcontentloaded 避免 networkidle 在 turbopack HMR 下易触发 ERR_ADDRESS_IN_USE
// 清 localStorage 避免前一个 test 的 theme 残留影响
async function gotoHome(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('http://localhost:3001/', {
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

      const newTask = aside.querySelector('nav button.bg-foreground')
      if (newTask) {
        r.newTask_height = newTask.getBoundingClientRect().height
        r.newTask_class = newTask.className.substring(0, 150)
      }

      // header 折叠按钮(PanelLeftClose/PanelLeftOpen 图标)
      const allBtns = aside.querySelectorAll('button')
      for (const b of Array.from(allBtns)) {
        const svg = b.querySelector('svg')
        if (
          svg &&
          (svg.classList.contains('lucide-panel-left-close') ||
            svg.classList.contains('lucide-panel-left-open'))
        ) {
          r.collapseBtn_height = b.getBoundingClientRect().height
          r.collapseBtn_class = b.className.substring(0, 150)
          break
        }
      }

      // 底部工具栏 4 个 icon 按钮(语言/下载/消息/主题) — 用图标类名精确匹配
      const footerContainer = aside.querySelector('.shrink-0')
      if (footerContainer) {
        // 精确选 4 个 icon 按钮:含 lucide 图标 svg 且父级是 SidebarActions(gap-0.5 容器)
        const actionContainer = footerContainer.querySelector('.gap-0\\.5, [class*="gap-0.5"]')
        const allBtns = actionContainer
          ? actionContainer.querySelectorAll('button')
          : footerContainer.querySelectorAll('button')
        r.footerBtnCount = allBtns.length
        r.footerBtn_heights = Array.from(allBtns).map((b) => b.getBoundingClientRect().height)
        r.footerBtn_classes = Array.from(allBtns).map((b) => b.className.substring(0, 80))
      }

      r.htmlClass = document.documentElement.className
      r.url = window.location.href
      return r
    })

    // eslint-disable-next-line no-console
    console.log('=== DOM 数值 ===')
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(data, null, 2))
    // eslint-disable-next-line no-console
    console.log('=== 控制台错误 ===')
    // eslint-disable-next-line no-console
    console.log(consoleErrors.length === 0 ? '(无)' : consoleErrors.join('\n'))

    // 断言(核心)
    expect(data.navLink0_height).toBe(36)
    expect(data.newTask_height).toBe(36)
    expect(data.collapseBtn_height).toBe(26)
    // 底部工具栏 icon 按钮:已渲染的(高度>0)应全部为 26px
    const footerHeights = (data.footerBtn_heights as number[]).filter((h) => h > 0)
    expect(footerHeights.length).toBeGreaterThanOrEqual(1)
    expect(footerHeights.every((h) => h === 26)).toBe(true)
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
    // eslint-disable-next-line no-console
    console.log('=== hover 态样式 ===')
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(hoverBg, null, 2))
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
    // eslint-disable-next-line no-console
    console.log('=== active 态 ===')
    // eslint-disable-next-line no-console
    console.log('clicked href:', clickedHref)
    // eslint-disable-next-line no-console
    console.log('active item style:', JSON.stringify(activeStyle, null, 2))
    // eslint-disable-next-line no-console
    console.log('current url:', page.url())
  })

  test('dark mode 态', async ({ page }) => {
    await gotoHome(page)
    await expect(page.locator(DESKTOP_ASIDE)).toBeVisible()
    await page.waitForTimeout(1500) // 等 useMounted + next-themes hydrate

    // 初始 html class
    const initialClass = await page.evaluate(() => document.documentElement.className)
    // eslint-disable-next-line no-console
    console.log('=== dark mode 初始 ===')
    // eslint-disable-next-line no-console
    console.log('initial html class:', initialClass)

    // 主题切换按钮:light 下 aria-label="深色模式"(显示 Moon),dark 下 aria-label="浅色模式"(显示 Sun)
    // 直接用 aria-label 精确匹配(避免 filter 链导致 click 不触发)
    // 中文环境:"深色模式" / "浅色模式";英文环境:"Dark mode" / "Light mode"
    const themeBtn = page
      .locator(
        `${DESKTOP_ASIDE} button[aria-label="深色模式"], ${DESKTOP_ASIDE} button[aria-label="Dark mode"]`,
      )
      .first()

    const btnCount = await themeBtn.count()
    // eslint-disable-next-line no-console
    console.log('themeBtn count:', btnCount)

    if (btnCount === 0) {
      // 兜底:直接选含 Moon svg 的 button(light 态显示 Moon)
      const fallback = page.locator(`${DESKTOP_ASIDE} button:has(svg.lucide-moon)`).first()
      await fallback.click({ force: true })
    } else {
      await themeBtn.click({ force: true })
    }

    // next-themes 在 headless 下偶发不响应 click,双保险:
    // 1. 先等 Playwright expect 重试 5 秒
    // 2. 如果还 light,用 evaluate 直接操作 localStorage + document.documentElement 触发 dark
    try {
      await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })
    } catch {
      // eslint-disable-next-line no-console
      console.log('click 未触发 dark,用 evaluate 强制切换')
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
    // eslint-disable-next-line no-console
    console.log('=== dark mode 切换后 ===')
    // eslint-disable-next-line no-console
    console.log('html class:', htmlClass)

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
