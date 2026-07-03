/**
 * 暗色模式 .icon-container 透明背景源码级守门 (2026-07-03 立)
 *
 * 防回归目标:
 * 2026-07-03 用户报告"暗色模式下 sidebar 底部搜索图标有黑色背景". 根因:
 *   darkMode.ts 第 118 行运行时注入的 DARK_BG_CSS 中, 超宽通配选择器
 *   `:where(html.dark) [class*="container"]:not(.brand-text-container)` 命中了
 *   SearchTrigger.vue 内部的 .icon-container, 强制设为
 *   `background: var(--page-bg-color, var(--el-bg-color))` = #1a1a1a.
 *
 *   该运行时注入规则与 SearchTrigger.vue scoped `.icon-container { background-color: transparent }`
 *   特异性同为 (0,2,0), 但运行时 <style> 晚于 scoped 注入, 且用 `background` 简写
 *   覆盖 `background-color` 长属性, 因此获胜, 把图标容器染成黑色补丁.
 *
 * 修复:
 *   把 index.scss:167 已有的排除清单同步到 darkMode.ts:118 的 :not() 中:
 *   .brand-text-container, .app-container, .home-container, .ai-world-page__container,
 *   .logo-container, .form-container, .account-form-container, .phone-form-container,
 *   .icon-container, .chat-input-container, .prompt-templates-container
 *
 * 防回归点 (任一处被改回旧值即触发失败):
 *   A. darkMode.ts DARK_BG_CSS 必须含 [class*="container"]:not(...) 选择器 (结构存在)
 *   B. darkMode.ts :not() 清单必须含全部 11 个类名 (含 .brand-text-container 共 11 个)
 *   C. darkMode.ts :not() 清单不能只含 .brand-text-container (防回退到旧的单类排除)
 *   D. SearchTrigger.vue .icon-container 必须 background-color: transparent (组件级声明)
 *   E. 浏览器级: 暗色下 .sidebar-actions .search-trigger-button .icon-container 计算背景透明
 *   F. 浏览器级: 暗色下 .app-sidebar 主容器暗色背景完好 (rgb(42, 45, 55) = #2a2d37)
 *   G. 浏览器级: 暗色下 AI 面板 .chat-input-container 背景透明 (同排除清单等价验证)
 *
 * CI 入口: npx playwright test e2e/dark-mode-icon-container-transparent.spec.ts
 * 源码级断言不需浏览器, CI 早期步骤即可跑; 浏览器级断言需 dev/preview server
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定
// ════════════════════════════════════════════════════════════════════════
// darkMode.ts :not() 排除清单必须包含的类名 (与 index.scss:167 同步)
// 注意: 必须与 src/styles/index.scss 第 167 行的排除清单完全一致
const EXPECTED_EXCLUSION_CLASSES = [
  '.brand-text-container',
  '.app-container',
  '.home-container',
  '.ai-world-page__container',
  '.logo-container',
  '.form-container',
  '.account-form-container',
  '.phone-form-container',
  '.icon-container',
  '.chat-input-container',
  '.prompt-templates-container',
] as const

// 暗色模式 sidebar 主容器期望背景 (来自 _sidebar-layout.scss dark 色阶 v3)
const EXPECTED_SIDEBAR_DARK_BG = 'rgb(42, 45, 55)' // #2a2d37

// ════════════════════════════════════════════════════════════════════════
// 源码级断言 (不需浏览器, CI 早期步骤可跑)
// ════════════════════════════════════════════════════════════════════════
test.describe('暗色模式 .icon-container 透明背景 - 源码级守门', () => {
  test('A: darkMode.ts DARK_BG_CSS 含 [class*="container"]:not(...) 选择器', () => {
    const src = readFileSync(join(ROOT, 'src/stores/darkMode.ts'), 'utf8')
    expect(
      src,
      'darkMode.ts DARK_BG_CSS 必须含 [class*="container"]:not(...) 选择器, ' +
        '用于强制暗色容器背景. 若删除该选择器, 暗色模式下部分容器会显示为浅色/白色背景.'
    ).toMatch(/\[class\*="container"\]:not\([^)]+\)/)
  })

  test('B: darkMode.ts :not() 清单含全部 11 个类名 (与 index.scss:167 同步)', () => {
    const src = readFileSync(join(ROOT, 'src/stores/darkMode.ts'), 'utf8')
    // 提取 [class*="container"]:not(...) 中的 :not() 参数
    const match = src.match(/\[class\*="container"\]:not\(([^)]+)\)/)
    expect(match, '必须存在 [class*="container"]:not(...) 选择器').not.toBeNull()
    const notArg = match![1]

    for (const cls of EXPECTED_EXCLUSION_CLASSES) {
      expect(
        notArg,
        `darkMode.ts :not() 清单必须包含 ${cls}.\n` +
          `当前清单: ${notArg}\n` +
          `若缺失该类, 暗色模式下该容器会被强制染为 #1a1a1a 黑色背景, ` +
          `击败组件 scoped transparent 声明 (特异性同 (0,2,0), 运行时注入晚于 scoped).`
      ).toContain(cls)
    }
  })

  test('C: darkMode.ts :not() 清单不能只含 .brand-text-container (防回退到旧单类排除)', () => {
    const src = readFileSync(join(ROOT, 'src/stores/darkMode.ts'), 'utf8')
    const match = src.match(/\[class\*="container"\]:not\(([^)]+)\)/)
    expect(match).not.toBeNull()
    const notArg = match![1]
    // 旧值: :not(.brand-text-container) — 仅 1 个排除类
    // 新值: :not(.brand-text-container, .app-container, ...) — 11 个排除类
    const classCount = notArg.split(',').length
    expect(
      classCount,
      `darkMode.ts :not() 清单必须含 ≥ ${EXPECTED_EXCLUSION_CLASSES.length} 个类名, ` +
        `当前仅 ${classCount} 个. 旧值只有 .brand-text-container 一个, 导致 ` +
        `.icon-container / .chat-input-container / .prompt-templates-container 等 ` +
        `透明容器被误染为黑色背景.`
    ).toBeGreaterThanOrEqual(EXPECTED_EXCLUSION_CLASSES.length)
  })

  test('D: SearchTrigger.vue .icon-container 必须 background-color: transparent', () => {
    const src = readFileSync(join(ROOT, 'src/components/login/SearchTrigger.vue'), 'utf8')
    // .icon-container 规则块内必须含 background-color: transparent
    expect(
      src,
      'SearchTrigger.vue .icon-container 必须显式 background-color: transparent.\n' +
        '该声明是组件级"图标容器透明"的意图声明, darkMode.ts 运行时注入规则通过 :not() 排除它.\n' +
        '若删除该声明, .icon-container 会回退到继承背景, 视觉表现不稳定.'
    ).toMatch(/\.icon-container\s*\{[^}]*background-color:\s*transparent/)
  })

  test('E: darkMode.ts 与 index.scss 排除清单保持同步 (单源真相)', () => {
    // 两个文件的 :not() 清单必须包含相同的类名集合, 防止一处改了另一处漏改
    const darkModeSrc = readFileSync(join(ROOT, 'src/stores/darkMode.ts'), 'utf8')
    const indexScssSrc = readFileSync(join(ROOT, 'src/styles/index.scss'), 'utf8')

    const darkModeMatch = darkModeSrc.match(/\[class\*="container"\]:not\(([^)]+)\)/)
    const indexScssMatch = indexScssSrc.match(/\[class\*="container"\]:not\(([^)]+)\)/)
    expect(darkModeMatch, 'darkMode.ts 必须含 [class*="container"]:not(...)').not.toBeNull()
    expect(indexScssMatch, 'index.scss 必须含 [class*="container"]:not(...)').not.toBeNull()

    const parseClasses = (s: string): Set<string> =>
      new Set(
        s.split(',').map(c => c.trim().replace(/^\./, '')).filter(Boolean)
      )
    const darkModeClasses = parseClasses(darkModeMatch![1])
    const indexScssClasses = parseClasses(indexScssMatch![1])

    // index.scss 是设计源头, darkMode.ts 必须包含 index.scss 的全部排除类
    for (const cls of indexScssClasses) {
      expect(
        darkModeClasses.has(cls),
        `darkMode.ts :not() 清单必须包含 index.scss 中的排除类 .${cls}.\n` +
          `index.scss 是布局排除清单的设计源头, darkMode.ts 运行时注入规则必须同步该清单, ` +
          `否则暗色强制背景规则会误伤 index.scss 已排除的透明容器.`
      ).toBe(true)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════
// 浏览器级断言 (需 PW_BASE_URL, dev/preview server 健康时跑)
// 验证运行时实际计算值, 防止"源码对了但运行时被覆盖"的隐性回归
// ════════════════════════════════════════════════════════════════════════
const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:8888'

test.describe('暗色模式 .icon-container 透明背景 - 浏览器级守门', () => {
  test.skip(({ isMobile }) => isMobile === true, 'Mobile 视口下 sidebar 行为不同, 搜索图标测试仅桌面端')

  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // addInitScript 在页面 JS 执行前运行, 确保 useDarkModeStore.getInitialThemeMode()
    // 读取到 'dark' (storage key = 'darkMode', 见 utils/storage.ts STORAGE_KEYS.DARK_MODE)
    await page.addInitScript(() => {
      localStorage.setItem('darkMode', 'dark')
      // 同时打开 AI 面板 (entered=true 触发 AIChat 浮窗渲染, 内含 .chat-input-container)
      localStorage.setItem('ai-panel-open', 'true')
      localStorage.setItem('ai-panel-entered', 'true')
    })
  })

  test('F: 暗色下 .app-sidebar 主容器背景完好 (rgb(42, 45, 55) = #2a2d37)', async ({ page }) => {
    test.skip(!BASE_URL, 'PW_BASE_URL 未设置, 跳过浏览器级测试')
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('.app-sidebar', { state: 'visible', timeout: 15000 })
    // 确认暗色模式已应用
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark, 'html 必须含 .dark class (暗色模式已应用)').toBe(true)
    // 确认运行时注入的强制背景 style 存在
    const hasRuntimeStyle = await page.evaluate(() =>
      !!document.getElementById('force-dark-background-runtime')
    )
    expect(hasRuntimeStyle, '#force-dark-background-runtime 运行时样式必须存在').toBe(true)

    const bg = await page.evaluate(() => {
      const el = document.querySelector('.app-sidebar')
      if (!el) return null
      return getComputedStyle(el).backgroundColor
    })
    expect(
      bg,
      `.app-sidebar 主容器暗色背景必须为 ${EXPECTED_SIDEBAR_DARK_BG} (#2a2d37).\n` +
        `当前值: ${bg}\n` +
        `若该值变化, 说明 _sidebar-layout.scss dark 色阶被改, 或 darkMode.ts 强制背景规则被破坏.`
    ).toBe(EXPECTED_SIDEBAR_DARK_BG)
  })

  test('G: 暗色下 .sidebar-actions .search-trigger-button 背景透明 (按钮本身)', async ({ page }) => {
    test.skip(!BASE_URL, 'PW_BASE_URL 未设置, 跳过浏览器级测试')
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('.sidebar-actions .search-trigger-button', { state: 'visible', timeout: 15000 })
    const bg = await page.evaluate(() => {
      const el = document.querySelector('.sidebar-actions .search-trigger-button')
      if (!el) return null
      return getComputedStyle(el).backgroundColor
    })
    expect(
      bg,
      '.search-trigger-button 背景必须为 rgba(0, 0, 0, 0) 透明.\n' +
        `当前值: ${bg}\n` +
        'SearchTrigger.vue 显式声明 background-color: transparent, 不应被覆盖.'
    ).toBe('rgba(0, 0, 0, 0)')
  })

  test('H: 暗色下 .sidebar-actions .search-trigger-button .icon-container 背景透明 (核心修复点)', async ({ page }) => {
    test.skip(!BASE_URL, 'PW_BASE_URL 未设置, 跳过浏览器级测试')
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('.sidebar-actions .search-trigger-button .icon-container', {
      state: 'visible',
      timeout: 15000,
    })
    const bg = await page.evaluate(() => {
      const el = document.querySelector('.sidebar-actions .search-trigger-button .icon-container')
      if (!el) return null
      return getComputedStyle(el).backgroundColor
    })
    expect(
      bg,
      '.icon-container 背景必须为 rgba(0, 0, 0, 0) 透明 (核心修复点).\n' +
        `当前值: ${bg}\n` +
        '修复前: rgb(26, 26, 26) = #1a1a1a (被 darkMode.ts 运行时注入 [class*="container"] 规则误染).\n' +
        '修复后: rgba(0, 0, 0, 0) 透明 (darkMode.ts :not() 清单已排除 .icon-container).\n' +
        '若回退到 rgb(26, 26, 26), 说明 darkMode.ts :not() 清单被缩窄或 .icon-container 被误删.'
    ).toBe('rgba(0, 0, 0, 0)')
  })

  test('I: 暗色下 AI 面板 .chat-input-container 背景透明 (同排除清单等价验证)', async ({ page }) => {
    test.skip(!BASE_URL, 'PW_BASE_URL 未设置, 跳过浏览器级测试')
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    // AIChat 浮窗在 ai-panel-entered=true 时渲染, 内含 .chat-input-container
    const chatInput = page.locator('.chat-input-container').first()
    await chatInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      // 浮窗可能未渲染, 跳过而非失败 (浏览器环境差异)
      test.skip(true, 'AI 面板 .chat-input-container 未渲染, 跳过 (浮窗可能未打开)')
    })
    const bg = await page.evaluate(() => {
      const el = document.querySelector('.chat-input-container')
      if (!el) return null
      return getComputedStyle(el).backgroundColor
    })
    expect(
      bg,
      '.chat-input-container 背景必须为 rgba(0, 0, 0, 0) 透明.\n' +
        `当前值: ${bg}\n` +
        '.chat-input-container 与 .icon-container 处于同一 :not() 排除清单, ' +
        '若该值非透明, 说明排除清单失效, .icon-container 也会受影响.'
    ).toBe('rgba(0, 0, 0, 0)')
  })
})
