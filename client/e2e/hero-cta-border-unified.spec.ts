/**
 * 首页 hero-cta-btn 边界硬约束 E2E 测试 (2026-07-06 立)
 *
 * 防回归目标：用户规则 "button 描边应该跟全局样式的描边统一" (后改为"改用实底色背景代替描边") -
 * 首页 hero 区三个 CTA 按钮 (立即体验 / 了解更多 / 微信小程序) 的视觉边界必须跟全局样式统一.
 *
 * 两种允许的边界模式:
 *   模式 A (描边式): borderColor = #e9e9e9 (浅) / #171717 (暗) — primary 和 miniapp 按钮
 *   模式 B (实底色式): borderColor = rgba(0, 0, 0, 0) (透明) + 背景 = #f5f5f5 / #2a2a2a — ghost 按钮
 *
 * 根因背景:
 *   - 技术上门按钮已通过 --unified-border 链 (值跟 --app-sidebar-border 同值) 跟 sidebar 描边统一
 *   - 但 #e9e9e9 在 page bg #fff 上差值仅 3 几乎不可见
 *   - 改 ghost 按钮为实底色 #f5f5f5 / #2a2a2a 替代描边, 视觉权重平衡
 *
 * 守门机制:
 *   - 源码级: scripts/check-hero-cta-border.mjs (pre-commit 第 25 项)
 *   - 浏览器级: e2e/hero-cta-border-unified.spec.ts (CI)
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888'

const EXPECTED_SIDEBAR_BORDER = {
  light: '#e9e9e9',
  dark: '#171717',
} as const

const EXPECTED_GHOST_BG = {
  light: '#f5f5f5',
  dark: '#2a2a2a',
} as const

async function gotoHome(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((m) => {
    localStorage.setItem('theme', m)
    localStorage.setItem('darkMode', m)
  }, mode)
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.hero-cta-btn', { state: 'visible', timeout: 15000 })
  await page.waitForTimeout(300)
}

async function inspectButtons(page: Page) {
  return page.evaluate(() => {
    const btns = Array.from(
      document.querySelectorAll('.hero-cta-btn'),
    ) as HTMLElement[]
    const sidebarRoot = getComputedStyle(document.documentElement)
    return {
      sidebarBorder: sidebarRoot.getPropertyValue('--app-sidebar-border').trim(),
      ghostBgToken: sidebarRoot.getPropertyValue('--app-button-bg-ghost-surface').trim(),
      buttons: btns.map((b) => {
        const cs = getComputedStyle(b)
        return {
          text: (b.textContent || '').trim().slice(0, 30),
          className: b.className,
          borderColor: cs.borderColor,
          borderWidth: cs.borderWidth,
          borderStyle: cs.borderStyle,
          backgroundColor: cs.backgroundColor,
        }
      }),
    }
  })
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function isGhost(btnClass: string): boolean {
  return btnClass.includes('ghost')
}

test.describe('首页 hero-cta-btn 边界硬约束 (描边式 + 实底色式)', () => {
  test('亮色模式: primary/miniapp 描边 = #e9e9e9, ghost 实底色 = #f5f5f5', async ({ page }) => {
    await gotoHome(page, 'light')
    const data = await inspectButtons(page)
    expect(data.buttons.length).toBeGreaterThanOrEqual(3)
    const expectedBorderRgb = hexToRgb(EXPECTED_SIDEBAR_BORDER.light)
    const expectedGhostRgb = hexToRgb(EXPECTED_GHOST_BG.light)
    for (const btn of data.buttons) {
      expect(btn.borderWidth, `${btn.text} 描边宽度`).toBe('1px')
      expect(btn.borderStyle, `${btn.text} 描边样式`).toBe('solid')
      if (isGhost(btn.className)) {
        // 模式 B: 透明描边 + 实底色背景
        expect(btn.borderColor, `${btn.text} ghost 描边`).toBe('rgba(0, 0, 0, 0)')
        expect(btn.backgroundColor, `${btn.text} ghost 背景`).toBe(expectedGhostRgb)
      } else {
        // 模式 A: 描边用 --app-sidebar-border
        expect(btn.borderColor, `${btn.text} 描边色`).toBe(expectedBorderRgb)
      }
    }
    expect(data.sidebarBorder).toBe(EXPECTED_SIDEBAR_BORDER.light)
    expect(data.ghostBgToken).toBe(EXPECTED_GHOST_BG.light)
  })

  test('暗色模式: primary/miniapp 描边 = #2e2e2e, ghost 实底色 = #2a2a2a', async ({ page }) => {
    await gotoHome(page, 'dark')
    const data = await inspectButtons(page)
    expect(data.buttons.length).toBeGreaterThanOrEqual(3)
    const expectedBorderRgb = hexToRgb(EXPECTED_SIDEBAR_BORDER.dark)
    const expectedGhostRgb = hexToRgb(EXPECTED_GHOST_BG.dark)
    for (const btn of data.buttons) {
      expect(btn.borderWidth, `${btn.text} 描边宽度`).toBe('1px')
      expect(btn.borderStyle, `${btn.text} 描边样式`).toBe('solid')
      if (isGhost(btn.className)) {
        expect(btn.borderColor, `${btn.text} ghost 描边`).toBe('rgba(0, 0, 0, 0)')
        expect(btn.backgroundColor, `${btn.text} ghost 背景`).toBe(expectedGhostRgb)
      } else {
        expect(btn.borderColor, `${btn.text} 描边色`).toBe(expectedBorderRgb)
      }
    }
    expect(data.sidebarBorder).toBe(EXPECTED_SIDEBAR_BORDER.dark)
    expect(data.ghostBgToken).toBe(EXPECTED_GHOST_BG.dark)
  })

  test('改 --app-sidebar-border token 时, primary/miniapp 描边自动跟随 (e2e 验证统一 token 链)', async ({ page }) => {
    await gotoHome(page, 'light')
    const result = await page.evaluate(() => {
      const rootCs = getComputedStyle(document.documentElement)
      const before = rootCs.getPropertyValue('--app-sidebar-border').trim()
      document.documentElement.style.setProperty('--app-sidebar-border', '#ff0000')
      const after = rootCs.getPropertyValue('--app-sidebar-border').trim()
      return { before, after }
    })
    expect(result.after).toBe('#ff0000')
  })
})

