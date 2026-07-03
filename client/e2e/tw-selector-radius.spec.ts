/**
 * AI 对话输入框「+选择」按钮圆角守门 (2026-07-03 立)
 *
 * 防回归目标:
 * 2026-07-03 用户反馈"AI 对话输入框左上角的选择按钮容器圆角太大了 跟项目不统一",
 * 同时立硬约束"本项目不允许使用彻底的圆角/胶囊形". 本批次修复:
 *   1. _input-area.scss .tw-selector-pill 圆角 14px → var(--app-button-radius) (8px)
 *   2. AIChat.vue scoped 覆盖块 .tw-selector-pill 圆角 14px → var(--app-button-radius)
 *   3. _global-tokens.scss 移除违规 token --app-button-radius-pill: 14px
 *   4. 同步清理 _open-platform.scss (31 处 14/16/20/999/9999px) 和
 *      AiWorldBannerDetail.vue / WrongBookSummary.vue (4 处 999/9999px)
 *
 * 防回归点 (任一处被改回旧值即触发失败):
 *   A. _input-area.scss .tw-selector-pill 不能含 border-radius: 14px
 *   B. AIChat.vue scoped 块 .tw-selector-pill 不能含 border-radius: 14px
 *   C. _global-tokens.scss 不能再定义 --app-button-radius-pill: 14px
 *   D. _input-area.scss .tw-selector-pill 必须显式 border-radius: var(--app-button-radius)
 *   E. AIChat.vue scoped 块 .tw-selector-pill 必须显式 border-radius: var(--app-button-radius)
 *   F. 浏览器实际渲染: .tw-selector-pill computed border-radius 必须 = 8px (浅色/暗色均验证)
 *   G. _global-tokens.scss --app-button-radius 必须解析为 8px (token 体系单一来源)
 *
 * CI 入口: npm run e2e / npx playwright test tw-selector-radius.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (改圆角规范时同步改这里)
// ════════════════════════════════════════════════════════════════════════
const EXPECTED_RADIUS_TOKEN = 'var(--app-button-radius)'
const EXPECTED_RADIUS_PX = 8 // --global-border-radius = 8px, --app-button-radius 引用它
const FORBIDDEN_RADIUS_PX = 14 // 旧值, 胶囊形, 已废弃

// ════════════════════════════════════════════════════════════════════════
// 源码级守门 (不启动浏览器, 快)
// ════════════════════════════════════════════════════════════════════════

test.describe('AI 对话输入框选择按钮圆角源码守门', () => {
  test.describe.configure({ mode: 'parallel' })

  // ── A. _input-area.scss .tw-selector-pill 不能含 14px ──
  test('A: _input-area.scss .tw-selector-pill 不能含 border-radius: 14px (胶囊形旧值)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/ai-chat/_input-area.scss'), 'utf8')
    // 提取 .tw-selector-pill { ... } 块 (非贪婪, 直到下一个闭合大括号)
    const blockMatch = src.match(/\.tw-selector-pill\s*\{[^}]*\}/)
    expect(blockMatch, '_input-area.scss 必须含 .tw-selector-pill 块').not.toBeNull()
    const block = blockMatch![0]
    expect(
      block,
      `.tw-selector-pill 块不能含 border-radius: ${FORBIDDEN_RADIUS_PX}px (胶囊形旧值).\n` +
        `2026-07-03 用户立硬约束"禁止彻底圆角/胶囊形", 14px 已废弃.\n` +
        `修复: 改用 ${EXPECTED_RADIUS_TOKEN} (= 8px, 项目统一规范).`
    ).not.toMatch(new RegExp(`border-radius:\\s*${FORBIDDEN_RADIUS_PX}px`, 'i'))
  })

  // ── B. AIChat.vue scoped 块 .tw-selector-pill 不能含 14px ──
  test('B: AIChat.vue scoped 块 .tw-selector-pill 不能含 border-radius: 14px', () => {
    const src = readFileSync(join(ROOT, 'src/components/ai/AIChat.vue'), 'utf8')
    // 提取 :deep(.el-button.el-button--small.tw-selector-pill) { ... } 块
    // 块内可能含嵌套选择器, 用 [\s\S] 匹配 (非贪婪到下一个同等缩进的 })
    const blockMatch = src.match(
      /:deep\(\.el-button\.el-button--small\.tw-selector-pill\)\s*\{([\s\S]*?)\n\s*\}/
    )
    expect(blockMatch, 'AIChat.vue 必须含 :deep(.el-button.el-button--small.tw-selector-pill) 覆盖块').not.toBeNull()
    const block = blockMatch![0]
    expect(
      block,
      `AIChat.vue scoped 覆盖块不能含 border-radius: ${FORBIDDEN_RADIUS_PX}px.\n` +
        `该块特异性 (0,5,0) 高于 _input-area.scss, 若圆角回退到 14px 会覆盖全局修复.`
    ).not.toMatch(new RegExp(`border-radius:\\s*${FORBIDDEN_RADIUS_PX}px`, 'i'))
  })

  // ── C. _global-tokens.scss 不能再定义 --app-button-radius-pill: 14px ──
  test('C: _global-tokens.scss 不能定义 --app-button-radius-pill (违规 token, 已移除)', () => {
    const raw = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
    // 先剥离注释 (/* ... */ 跨行块注释 + // 单行注释), 避免误判注释中的字符串
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')   // 剥离块注释
      .replace(/(^|\s)\/\/[^\n]*/g, '$1')  // 剥离行注释
    // 实际定义形式: --app-button-radius-pill: 14px; (有冒号+值+分号)
    const defMatch = src.match(/--app-button-radius-pill\s*:\s*[^;]+;/)
    expect(
      defMatch,
      `_global-tokens.scss 不能再定义 --app-button-radius-pill.\n` +
        `该 token 是胶囊形违规源头 (旧值 14px), 已于 2026-07-03 移除.\n` +
        `若需保留说明注释, 用 /* ... */ 形式, 不要写成变量定义.\n` +
        `实际找到的定义: ${defMatch?.[0] ?? '(无)'}`
    ).toBeNull()
  })

  // ── D. _input-area.scss .tw-selector-pill 必须显式 var(--app-button-radius) ──
  test('D: _input-area.scss .tw-selector-pill 必须含 border-radius: var(--app-button-radius)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/ai-chat/_input-area.scss'), 'utf8')
    const blockMatch = src.match(/\.tw-selector-pill\s*\{[^}]*\}/)
    expect(blockMatch, '_input-area.scss 必须含 .tw-selector-pill 块').not.toBeNull()
    const block = blockMatch![0]
    expect(
      block,
      `.tw-selector-pill 必须显式 border-radius: ${EXPECTED_RADIUS_TOKEN}.\n` +
        `项目硬约束: 所有按钮圆角走 --app-button-radius token (= --global-border-radius = 8px).`
    ).toMatch(new RegExp(`border-radius:\\s*${EXPECTED_RADIUS_TOKEN.replace(/[()]/g, '\\$&')}`, 'i'))
  })

  // ── E. AIChat.vue scoped 块 .tw-selector-pill 必须显式 var(--app-button-radius) ──
  test('E: AIChat.vue scoped 块 .tw-selector-pill 必须含 border-radius: var(--app-button-radius)', () => {
    const src = readFileSync(join(ROOT, 'src/components/ai/AIChat.vue'), 'utf8')
    const blockMatch = src.match(
      /:deep\(\.el-button\.el-button--small\.tw-selector-pill\)\s*\{([\s\S]*?)\n\s*\}/
    )
    expect(blockMatch, 'AIChat.vue 必须含 :deep(.el-button.el-button--small.tw-selector-pill) 覆盖块').not.toBeNull()
    const block = blockMatch![0]
    expect(
      block,
      `AIChat.vue scoped 覆盖块必须显式 border-radius: ${EXPECTED_RADIUS_TOKEN}.\n` +
        `该块特异性高于全局, 若不显式声明, 会回退到 14px 胶囊形.`
    ).toMatch(new RegExp(`border-radius:\\s*${EXPECTED_RADIUS_TOKEN.replace(/[()]/g, '\\$&')}`, 'i'))
  })

  // ── G. _global-tokens.scss --app-button-radius 必须解析为 --global-border-radius ──
  test('G: _global-tokens.scss --app-button-radius 必须为 var(--global-border-radius)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
    expect(
      src,
      `--app-button-radius 必须解析为 var(--global-border-radius) (token 体系单一来源).\n` +
        `项目硬约束: 全站圆角走 --global-border-radius (= 8px) 唯一标准.`
    ).toMatch(/--app-button-radius\s*:\s*var\(--global-border-radius\)/i)
  })

  // ── G2. $global-border-radius SCSS 变量必须为 8px ──
  test('G2: _global-tokens.scss $global-border-radius 必须为 8px', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
    expect(
      src,
      `$global-border-radius SCSS 变量必须为 8px (项目唯一圆角标准).`
    ).toMatch(/\$global-border-radius\s*:\s*8px\s*;/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 浏览器渲染守门 (启动 dev server, 验证 computed style)
// 注: 这一组测试需要 dev server (8888), 若未启动则整组跳过 (beforeAll 探测)
// ════════════════════════════════════════════════════════════════════════

test.describe('AI 对话输入框选择按钮圆角渲染守门', () => {
  test.describe.configure({ mode: 'serial' })

  let devServerAvailable = false

  test.beforeAll(async ({ request }) => {
    // 探测 dev server (8888) 是否可用, 不可用则整组跳过
    try {
      const resp = await request.get('/', { timeout: 3000, failOnStatusCode: false })
      devServerAvailable = resp.ok() || resp.status() < 500
    } catch {
      devServerAvailable = false
    }
  })

  test.beforeEach(async () => {
    // 若 dev server 不可用, 跳过本组所有测试
    test.skip(!devServerAvailable, 'dev server (8888) 未启动, 跳过渲染守门 (源码守门已覆盖)')
  })

  // ── F. 浏览器实际渲染: .tw-selector-pill computed border-radius = 8px ──
  test('F1: 浅色模式 .tw-selector-pill computed border-radius = 8px', async ({ page }) => {
    // 进入 AI 对话页面 (路由可能不同, 这里用通用方式: 先访问首页, 再触发 AI 对话)
    await page.goto('/', { waitUntil: 'networkidle' })

    // 等待 .tw-selector-pill 出现 (最长 5s, 若页面无此元素说明路由不对)
    const pill = page.locator('.tw-selector-pill').first()
    await expect(pill).toBeVisible({ timeout: 5000 }).catch(() => {
      // 若首页看不到, 尝试 /ai 路由
      return page.goto('/ai', { waitUntil: 'networkidle' })
    })

    // 等 networkidle 确保 CSS 已加载 (项目硬约束: 读 CSS 变量必须 networkidle)
    await page.waitForLoadState('networkidle')

    const radius = await pill.evaluate((el) => {
      const cs = window.getComputedStyle(el)
      return cs.borderRadius
    })

    // 浏览器返回 "8px" 或类似 "8px" 的标准化值
    expect(
      radius,
      `.tw-selector-pill computed border-radius 必须为 ${EXPECTED_RADIUS_PX}px (浅色模式).\n` +
        `实际值: ${radius}.\n` +
        `可能原因: (1) .tw-selector-pill 仍用 14px 胶囊形; ` +
        `(2) scoped 覆盖块回退; (3) --app-button-radius token 解析错误.`
    ).toBe(`${EXPECTED_RADIUS_PX}px`)
  })

  // ── F2. 暗色模式同样验证 ──
  test('F2: 暗色模式 .tw-selector-pill computed border-radius = 8px', async ({ page }) => {
    // 切换暗色模式: html 加 .dark class
    await page.addInitScript(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme-mode', 'dark')
    })

    await page.goto('/', { waitUntil: 'networkidle' })
    const pill = page.locator('.tw-selector-pill').first()
    await expect(pill).toBeVisible({ timeout: 5000 }).catch(() => {
      return page.goto('/ai', { waitUntil: 'networkidle' })
    })
    await page.waitForLoadState('networkidle')

    const radius = await pill.evaluate((el) => {
      return window.getComputedStyle(el).borderRadius
    })

    expect(
      radius,
      `.tw-selector-pill computed border-radius 必须为 ${EXPECTED_RADIUS_PX}px (暗色模式).\n` +
        `暗色模式不应改变圆角值, 实际值: ${radius}.`
    ).toBe(`${EXPECTED_RADIUS_PX}px`)
  })
})
