/**
 * workspace-header / glass-header / skip-link / network-offline-banner /
 * ai-chat-messages / ws-page-title padding 守门 (2026-07-05 立)
 *
 * 防御 Tailwind v4 preflight 的 `*, ::after, ::before, ::backdrop,
 * ::file-selector-button { padding: 0 }` (在 @layer 之外 unlayered, 优先级
 * 最高) 压制 @layer components 内 :where() 包装 (特异性 0) 的 padding 规则,
 * 导致 6 个核心布局 padding 静默回退到 0 (用户报告: "首页贴左边无呼吸感")。
 *
 * 守门分三层:
 *   1. 阶段 1 (per-element): 把 padding 从 :where() 提取到 unlayered 区块
 *      (特异性 0,1,0, 战胜 preflight `*`)
 *   2. 阶段 2.1-2.3 (pre-commit): scripts/check-no-where-padding-in-components.mjs
 *      源码级, 不许后续 SCSS 改回 :where() 包装 + @layer components 写法
 *   3. 阶段 2.4 (本文件 E2E): 浏览器级, 验证 6 个核心元素的 padding 计算值
 *      符合设计预期 (跨 3 视口 × 2 主题 = 6+ 测试), 源码级守门 .skip-link /
 *      .network-offline-banner / .ai-chat-messages unlayered 块存在 (3 测试)
 *
 * 防回归点 (任一处被改回旧值或 padding 偏离锚定值即触发失败):
 *   A. workspace-header padding-left = 8px (desktop) / 8px (tablet) / 8px (mobile)
 *      (浅色 + 暗色 共 6 测试, 浏览器级, 需 preview server)
 *      v2 (2026-07-06): 左 padding 24/20→16 (用户反馈 span 距容器左侧太远), 右 padding 仍 24/20/16
 *      v3 (2026-07-06): 左 padding 16→8 (用户要求再减 8px)
 *   B. glass-header padding-left = 24px (登录页, 浅色 + 暗色 2 测试, 浏览器级)
 *   C. _app-shell.scss .skip-link unlayered block 存在 + padding=6px 10px (源码级)
 *   D. _app-shell.scss .network-offline-banner unlayered block 存在 + padding=12px 20px (源码级)
 *   E. _ai-chat-variables.scss .ai-chat-messages unlayered block 存在 (源码级)
 *   F. ws-page-title padding-left = 4px (浏览器级, 保留原 4px)
 *
 * CI 入口: npm run e2e / npx playwright test workspace-header-padding.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _app-shell.scss / _ai-chat-variables.scss / header.scss 完全一致, 改值需同步)
// ════════════════════════════════════════════════════════════════════════
const WORKSPACE_HEADER_PAD = { desktop: 8, tablet: 8, mobile: 8 } as const
const GLASS_HEADER_PAD_LEFT = 24
const PAGE_TITLE_PAD_LEFT = 12

test.describe('workspace-header padding 守门 (2026-07-05 立, 12 用例)', () => {
  test.describe.configure({ mode: 'parallel' })

  // ═══ A. workspace-header padding 浏览器级 (6 用例) ═══
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, width, expectPad] of [
      ['desktop-1440', 1440, WORKSPACE_HEADER_PAD.desktop],
      ['tablet-1024', 1024, WORKSPACE_HEADER_PAD.tablet],
      ['mobile-375', 375, WORKSPACE_HEADER_PAD.mobile],
    ] as const) {
      test(`A.${name}-${theme}: .workspace-header padding-left = ${expectPad}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        if (theme === 'dark') {
          await page.addInitScript(() => {
            localStorage.setItem('darkMode', 'dark')
            localStorage.setItem('theme', 'dark')
          })
        }
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.workspace-header', { timeout: 8000 })
        const padLeft = await page.evaluate(
          () => getComputedStyle(document.querySelector('.workspace-header')!).paddingLeft,
        )
        expect(padLeft, `期望 ${expectPad}px (实际 ${padLeft})`).toBe(`${expectPad}px`)
      })
    }
  }

  // ═══ B. glass-header padding 浏览器级 (2 用例, 登录页) ═══
  for (const theme of ['light', 'dark'] as const) {
    test(`B.glass-header-login-${theme}: padding-left = ${GLASS_HEADER_PAD_LEFT}px`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      if (theme === 'dark') {
        await page.addInitScript(() => {
          localStorage.setItem('darkMode', 'dark')
          localStorage.setItem('theme', 'dark')
        })
      }
      // 跳到登录页 (若已登录会自动跳到 /, 此时动态注入 .glass-header)
      await page
        .goto('/login', { waitUntil: 'domcontentloaded' })
        .catch(() => page.goto('/register', { waitUntil: 'domcontentloaded' }))
      await new Promise((r) => setTimeout(r, 1500))
      const padLeft = await page.evaluate(() => {
        let el = document.querySelector('.glass-header') as HTMLElement | null
        if (!el) {
          el = document.createElement('div')
          el.className = 'glass-header'
          el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:60px;'
          document.body.appendChild(el)
        }
        return getComputedStyle(el).paddingLeft
      })
      expect(padLeft, `期望 ${GLASS_HEADER_PAD_LEFT}px (实际 ${padLeft})`).toBe(`${GLASS_HEADER_PAD_LEFT}px`)
    })
  }

  // ═══ C. _app-shell.scss .skip-link unlayered block (1 用例, 源码级) ═══
  test('C.skip-link: _app-shell.scss unlayered .skip-link 块存在 + padding=6px 10px', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_app-shell.scss'), 'utf8')
    expect(src).toMatch(/^\.skip-link\s*\{[\s\S]*?padding:\s*6px\s+10px[\s\S]*?\}/m)
    // 反向断言: :where(.skip-link) 块内不应再含 padding (除 0 重置)
    expect(src).not.toMatch(/:where\(\.skip-link\)\s*\{[\s\S]*?padding:\s*(?!0\b)[^0]/)
  })

  // ═══ D. _app-shell.scss .network-offline-banner unlayered block (1 用例, 源码级) ═══
  test('D.network-offline-banner: _app-shell.scss unlayered 块存在 + padding=12px 20px', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_app-shell.scss'), 'utf8')
    expect(src).toMatch(/^\.network-offline-banner\s*\{[\s\S]*?padding:\s*12px\s+20px[\s\S]*?\}/m)
    expect(src).not.toMatch(
      /:where\(\.network-offline-banner\)\s*\{[\s\S]*?padding:\s*(?!0\b)[^0]/,
    )
  })

  // ═══ E. _ai-chat-variables.scss .ai-chat-messages unlayered block (1 用例, 源码级) ═══
  test('E.ai-chat-messages: _ai-chat-variables.scss unlayered 块存在 + padding=var(--ai-chat-spacing-lg)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_ai-chat-variables.scss'), 'utf8')
    expect(src).toMatch(
      /^\.ai-chat-messages\s*\{[\s\S]*?padding:\s*var\(--ai-chat-spacing-lg\)[\s\S]*?\}/m,
    )
    expect(src).not.toMatch(
      /:where\(\.ai-chat-messages\)\s*\{[\s\S]*?padding:\s*(?!0\b)[^0]/,
    )
  })

  // ═══ F. ws-page-title padding 浏览器级 (1 用例) ═══
  test('F.page-title-padding: .ws-page-title padding-left = 4px (保留原 4px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.ws-page-title', { timeout: 8000 })
    const padLeft = await page.evaluate(() => {
      const el = document.querySelector('.ws-page-title') as HTMLElement | null
      return el ? getComputedStyle(el).paddingLeft : '0px'
    })
    expect(padLeft, `期望 ${PAGE_TITLE_PAD_LEFT}px`).toBe(`${PAGE_TITLE_PAD_LEFT}px`)
  })
})
