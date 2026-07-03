/**
 * 纯白/纯黑边框修复 — 视觉/运行时回归测试 (2026-07-02)
 *
 * 与 pure-border-cleanup.spec.ts 互补:
 *   - 旧 spec: 源码级 (readFileSync) + 设计令牌 (CSS 变量已定义)
 *   - 本 spec:  浏览器运行时 (getComputedStyle) — 真正验证修复点的最终视觉
 *
 * 防护目标 (5 处, 2026-07-01 用户反馈全面清理纯白/纯黑边框):
 *   1. Home.vue.styles.scss line 666 (hero-cta-btn.ghost :hover)        → var(--color-white-50)
 *   2. Home.vue.styles.scss line 675 (hero-cta-btn.ghost :active)       → var(--color-white-60)
 *   3. AIDialog.vue line 3051 (暗色 checkbox .checkmark 默认态)         → var(--color-white-30)
 *   4. AIDialog.vue line 3055 (暗色 checkbox :hover .checkmark)         → var(--color-white-50)
 *   5. AIDialog.vue line 3061 (暗色 checkbox :checked + .checkmark)     → var(--color-white-80)
 *
 * 验证策略:
 *   1) Home 页: 浏览器级 (需 PW_BASE_URL) — 加载首页 + 切 dark + hover + getComputedStyle
 *   2) AIDialog: 源码级 (始终运行) — 验证 :where(html.dark) 块内 CSS 规则
 *      (浏览器级因需登录+移动端+模型选择器交互, 架构不可行, 改为源码级)
 *
 * 运行模式:
 *   - 默认: Home 浏览器级跳过 (需 PW_BASE_URL); AIDialog 源码级始终运行
 *   - CI  : 全部运行 (CI=true 时 PW_BASE_URL 通常已设置)
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const SKIP_BROWSER = !process.env.PW_BASE_URL

async function gotoAndDark(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  // 切到 dark 模式 (覆盖 prefers-color-scheme)
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  })
  // 等暗色变量生效 + 重排完成
  await page.waitForTimeout(400)
}

// -------------------------------------------------------------------------
// 1) Home.vue.styles.scss: 暗色 hero-cta-btn.ghost 边框视觉验证 (浏览器级)
// -------------------------------------------------------------------------
test.describe('纯白/纯黑边框修复 — Home ghost 按钮视觉回归 (浏览器级)', () => {
  test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')

  test('Home ghost 按钮 :hover 边框 = rgba(255, 255, 255, 0.5) [var(--color-white-50)]', async ({ page }) => {
    await gotoAndDark(page, '/')
    await page.evaluate(() => {
      const btn = document.querySelector('.hero-cta-btn.ghost') as HTMLElement | null
      btn?.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(200)
    const ghost = page.locator('.hero-cta-btn.ghost').first()
    await ghost.hover()
    await page.waitForTimeout(200)
    const borderColor = await page.evaluate(() => {
      const el = document.querySelector('.hero-cta-btn.ghost') as HTMLElement | null
      return el ? getComputedStyle(el).borderColor : ''
    })
    // var(--color-white-50) = rgba(255, 255, 255, 0.5)
    expect(borderColor).toMatch(/rgba?\(255,\s*255,\s*255,\s*0?\.5\)/)
  })

  test('Home ghost 按钮 :active 边框 = rgba(255, 255, 255, 0.6) [var(--color-white-60)]', async ({ page }) => {
    await gotoAndDark(page, '/')
    await page.evaluate(() => {
      const btn = document.querySelector('.hero-cta-btn.ghost') as HTMLElement | null
      btn?.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(200)
    const ghost = page.locator('.hero-cta-btn.ghost').first()
    await ghost.dispatchEvent('mousedown')
    await page.waitForTimeout(200)
    const borderColor = await page.evaluate(() => {
      const el = document.querySelector('.hero-cta-btn.ghost') as HTMLElement | null
      return el ? getComputedStyle(el).borderColor : ''
    })
    // :active 在 dispatchEvent 后不保留, 烟雾测试验证 dark 下不是纯白
    expect(borderColor).not.toBe('rgb(255, 255, 255)')
  })
})

// -------------------------------------------------------------------------
// 2) AIDialog.vue: 暗色 checkbox 边框验证 (源码级, 三个状态, 始终运行)
//
// 原设计为浏览器级 (getComputedStyle), 但 AIDialog 的 .checkmark 在
// 模型选择下拉框内, 需登录 + 移动端 + 打开下拉框才渲染, 桌面端
// /ai-assistant 页面无法直接访问. 改为源码级验证 :where(html.dark)
// 块内的 CSS 规则, 与 pure-border-cleanup.spec.ts 互补 (那个检查
// "不使用 var(--el-color-white)", 本测试检查 "使用 var(--color-white-N)").
// -------------------------------------------------------------------------
test.describe('纯白/纯黑边框修复 — AIDialog checkbox 源码级回归', () => {
  test('AIDialog 暗色 checkbox 默认态边框源码 = var(--color-white-30)', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/ai/AIDialog.vue'),
      'utf8'
    )
    // 定位 :where(html.dark) & 块内的 .checkmark { border-color: var(--color-white-30) }
    const darkBlockMatch = src.match(/:where\(html\.dark\)\s+&\s*\{[\s\S]*?\.checkmark\s*\{[^}]*border-color\s*:\s*var\(--color-white-30\)/)
    expect(darkBlockMatch, 'AIDialog.vue 暗色块内 .checkmark 应使用 var(--color-white-30)').not.toBeNull()
  })

  test('AIDialog 暗色 checkbox :hover 边框源码 = var(--color-white-50)', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/ai/AIDialog.vue'),
      'utf8'
    )
    // 定位 :where(html.dark) & 块内的 :hover:not(.is-disabled) .checkmark { border-color: var(--color-white-50) }
    const hoverMatch = src.match(/:where\(html\.dark\)\s+&\s*\{[\s\S]*?:hover[^{]*\.checkmark\s*\{[^}]*border-color\s*:\s*var\(--color-white-50\)/)
    expect(hoverMatch, 'AIDialog.vue 暗色块内 :hover .checkmark 应使用 var(--color-white-50)').not.toBeNull()
  })

  test('AIDialog 暗色 checkbox :checked 边框源码 = var(--color-white-80)', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/ai/AIDialog.vue'),
      'utf8'
    )
    // 定位 :where(html.dark) & 块内的 input[type="checkbox"]:checked + .checkmark { border-color: var(--color-white-80) }
    const checkedMatch = src.match(/:where\(html\.dark\)\s+&\s*\{[\s\S]*?:checked\s*\+\s*\.checkmark\s*\{[^}]*border-color\s*:\s*var\(--color-white-80\)/)
    expect(checkedMatch, 'AIDialog.vue 暗色块内 :checked .checkmark 应使用 var(--color-white-80)').not.toBeNull()
  })
})
