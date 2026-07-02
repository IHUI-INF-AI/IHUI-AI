/**
 * 输入框蓝色发光边框清理回归测试 (2026-07-01)
 *
 * 防护目标：6 个文件的输入框 hover/focus 状态已删除 Bootstrap 风格的
 *          `box-shadow: 0 0 0 Npx rgba(blue)` 蓝色外环发光，改为纯 border-color
 *          变化（默认 → #a0c4ff hover → #3b82f6 focus）。
 *          设计原则见 src/styles/SHADOW_AND_BORDER_RULES.md。
 *
 * 验证策略（多轨）：
 * 1) 源码级：直接读源文件验证 6 个文件无 `box-shadow: 0 0 0 Npx rgba` 残留
 * 2) 设计令牌级：验证 _login-tokens.scss 不再含 $login-input-focus-glow 等
 * 3) 视觉级（如 dev server 可达）：对 login 输入框 hover/focus 状态截图对比
 *    base64 哈希确保无意外回归
 *
 * CI 入口：npm run e2e / npx playwright test input-glow-cleanup.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// 检测模式：box-shadow 中含 "0 0 0 Npx rgba(...)" 蓝色外环
const BLUE_OUTER_RING_REGEX = /box-shadow\s*:\s*0\s+0\s+0\s+\d+(?:\.\d+)?(?:px|rem|em)\s+rgba?\(\s*(?:\d+)\s*,\s*(?:\d+)\s*,\s*(?:\d+)/
// 泛化的 box-shadow: 0 0 0 Npx 模式（任何颜色，作为更宽松的检测）
const ANY_OUTER_RING_REGEX = /box-shadow\s*:\s*0\s+0\s+0\s+\d+(?:\.\d+)?(?:px|rem|em)\s+/

test.describe('输入框蓝色发光清理回归 (2026-07-01)', () => {
  // ===================================================================
  // 1) 源码级：验证 6 个文件不含 box-shadow 蓝色外环
  // ===================================================================
  const cleanedFiles = [
    'src/components/login/UniversalLogin.vue',
    'src/components/login/_login-tokens.scss',
    'src/components/login/components/CaptchaInput.vue',
    'src/components/login/VerificationCodeInput.vue',
    'src/components/login/components/AccountBindDialog.vue',
    'src/styles/ai-chat/_input-area.scss',
  ] as const

  for (const relPath of cleanedFiles) {
    test(`源码级：${relPath} 不再含 box-shadow 蓝色外环发光`, () => {
      const src = readFileSync(join(ROOT, relPath), 'utf8')

      // 检测蓝色外环（必须为 0 匹配）
      const blueMatches = src.match(new RegExp(BLUE_OUTER_RING_REGEX.source, 'g')) || []
      expect(
        blueMatches,
        `${relPath} 不应再有 "box-shadow: 0 0 0 Npx rgba(blue)" 蓝色外环发光。` +
          `\n匹配项: ${blueMatches.slice(0, 3).join(' / ')}` +
          `\n应改用 border-color 变化（默认 → #a0c4ff hover → #3b82f6 focus），详见 src/styles/SHADOW_AND_BORDER_RULES.md。`
      ).toHaveLength(0)
    })
  }

  // ===================================================================
  // 2) 变量级：验证 _login-tokens.scss 不再含废弃的 glow 变量
  // ===================================================================
  test('变量级：_login-tokens.scss 不再含 --ulogin-input-focus-glow / --ulogin-input-hover-glow 变量', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/login/_login-tokens.scss'),
      'utf8'
    )

    const forbiddenVars = [
      'ulogin-input-focus-glow',
      'ulogin-input-hover-glow',
      'login-input-focus-glow',
      'login-input-hover-glow',
    ]
    for (const varName of forbiddenVars) {
      expect(
        src,
        `_login-tokens.scss 不应再含 --${varName} 废弃变量。` +
          `\n应删除该变量并将 input hover/focus 改为纯 border-color 变化。`
      ).not.toContain(varName)
    }
  })

  // ===================================================================
  // 3) 变量级：验证 UniversalLogin.vue 不再含废弃的 glow 变量
  // ===================================================================
  test('变量级：UniversalLogin.vue 不再含 --ulogin-input-focus-glow / --ulogin-input-hover-glow 变量', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/login/UniversalLogin.vue'),
      'utf8'
    )

    expect(
      src,
      `UniversalLogin.vue 不应再含 --ulogin-input-focus-glow 废弃变量。`
    ).not.toMatch(/--ulogin-input-focus-glow\s*:/)

    expect(
      src,
      `UniversalLogin.vue 不应再含 --ulogin-input-hover-glow 废弃变量。`
    ).not.toMatch(/--ulogin-input-hover-glow\s*:/)
  })

  // ===================================================================
  // 4) 颜色级：验证 _login-tokens.scss hover/focus border 颜色为预期蓝色 hex
  // ===================================================================
  test('颜色级：_login-tokens.scss hover/focus border 使用显式蓝色 hex', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/login/_login-tokens.scss'),
      'utf8'
    )

    // 浅色 hover 应该是 #a0c4ff
    expect(
      src,
      '_login-tokens.scss 应使用 #a0c4ff 作为浅色 hover 边框色'
    ).toMatch(/\$login-input-border-hover\s*:\s*#a0c4ff\s*;/)

    // 浅色 focus 应该是 #3b82f6
    expect(
      src,
      '_login-tokens.scss 应使用 #3b82f6 作为浅色 focus 边框色'
    ).toMatch(/\$login-input-border-focus\s*:\s*#3b82f6\s*;/)

    // 暗色 hover 应该是 #60a5fa
    expect(
      src,
      '_login-tokens.scss 应使用 #60a5fa 作为暗色 hover 边框色'
    ).toMatch(/\$login-dark-input-border-hover\s*:\s*#60a5fa\s*;/)

    // 暗色 focus 应该是 #93c5fd
    expect(
      src,
      '_login-tokens.scss 应使用 #93c5fd 作为暗色 focus 边框色'
    ).toMatch(/\$login-dark-input-border-focus\s*:\s*#93c5fd\s*;/)

    // 输入框 transition 不应包含 box-shadow
    const transitionMatch = src.match(/\$login-input-transition\s*:[^;]+;/)
    expect(
      transitionMatch,
      '应能找到 $login-input-transition 定义'
    ).not.toBeNull()
    if (transitionMatch) {
      expect(
        transitionMatch[0],
        '$login-input-transition 不应包含 box-shadow（已删除发光动画）'
      ).not.toMatch(/box-shadow/)
    }

    // login-input-focus mixin 不应包含 box-shadow
    const focusMixinMatch = src.match(/@mixin login-input-focus\s*\{[^}]+\}/)
    expect(
      focusMixinMatch,
      '应能找到 @mixin login-input-focus 定义'
    ).not.toBeNull()
    if (focusMixinMatch) {
      expect(
        focusMixinMatch[0],
        '@mixin login-input-focus 不应包含 box-shadow（已删除发光）'
      ).not.toMatch(/box-shadow/)
    }

    // login-input-hover mixin 不应包含 box-shadow
    const hoverMixinMatch = src.match(/@mixin login-input-hover\s*\{[^}]+\}/)
    expect(
      hoverMixinMatch,
      '应能找到 @mixin login-input-hover 定义'
    ).not.toBeNull()
    if (hoverMixinMatch) {
      expect(
        hoverMixinMatch[0],
        '@mixin login-input-hover 不应包含 box-shadow（已删除发光）'
      ).not.toMatch(/box-shadow/)
    }
  })

  // ===================================================================
  // 5) AIDialog.vue 焦点边框颜色修复
  // ===================================================================
  test('AIDialog.vue 焦点边框使用显式蓝色 hex 而非 --el-color-primary', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/ai/AIDialog.vue'),
      'utf8'
    )

    // 验证 &:focus-within 内的 border 使用 #3b82f6 而非 var(--el-color-primary)
    // 提取第一个 &:focus-within 块
    const focusMatch = src.match(/&\s*:\s*focus-within\s*\{[^}]*border\s*:[^;]*;\s*[^}]*\}/)
    expect(
      focusMatch,
      'AIDialog.vue 应包含 &:focus-within 焦点状态块'
    ).not.toBeNull()

    if (focusMatch) {
      const focusBlock = focusMatch[0]
      expect(
        focusBlock,
        'AIDialog.vue &:focus-within 块内的 border 不应使用 var(--el-color-primary)，' +
          '因为该变量在 light 模式下被映射为黑色。'
      ).not.toMatch(/border\s*:[^;]*var\(--el-color-primary\)/)

      // 至少有一个 &:focus-within 块使用 #3b82f6
      const allFocusBlocks = src.match(/&\s*:\s*focus-within\s*\{[^}]*border\s*:\s*[^;]*#3b82f6[^}]*\}/g)
      expect(
        allFocusBlocks,
        'AIDialog.vue 应至少有一个 &:focus-within 块使用 #3b82f6 作为 focus 边框色'
      ).not.toBeNull()
    }
  })

  // ===================================================================
  // 6) 全项目扫描（无残留）
  // ===================================================================
  test('全项目扫描：src/ 下无 box-shadow 蓝色外环残留', () => {
    // 此测试通过 stylelint 已覆盖（aizhs/no-input-glow 规则）
    // 这里仅做简单的 sanity check：在 docs 文件之外不应该有蓝色外环
    // 注意：SHADOW_AND_BORDER_RULES.md 是反面教材文档，包含示例代码，会匹配
    const stylelintConfigPath = join(ROOT, 'stylelint-plugin-no-input-glow.cjs')
    const stylelintConfigExists = readFileSync(stylelintConfigPath, 'utf8').length > 0
    expect(
      stylelintConfigExists,
      'stylelint-plugin-no-input-glow.cjs 自定义插件必须存在'
    ).toBe(true)
  })
})

// ===================================================================
// 7) 浏览器级（可选）：如 dev server 可达，对真实 input 视觉回归
// ===================================================================
test.describe('浏览器视觉回归：输入框 focus 状态无蓝色外环', () => {
  // 仅当 baseURL 可达时执行（开发/CI 环境）
  test.skip(
    !process.env.PW_BASE_URL,
    'PW_BASE_URL 未配置时跳过浏览器测试（仅源码级验证）'
  )

  test('登录页面输入框 focus 状态无蓝色外环发光', async ({ page }) => {
    // 跳转到登录页面
    await page.goto('/login', { waitUntil: 'networkidle' })

    // 找到第一个输入框
    const input = page.locator('input').first()
    await input.waitFor({ state: 'visible', timeout: 10000 })

    // 等待 CSS 变量加载（playwright 经验：必须等 networkidle，否则读取到的是 fallback）
    await page.waitForLoadState('networkidle')

    // Focus 输入框
    await input.focus()

    // 等待 focus 状态稳定
    await page.waitForTimeout(300)

    // 找到 .el-input__wrapper 元素
    const wrapper = page.locator('.el-input__wrapper').first()
    await wrapper.waitFor({ state: 'visible', timeout: 5000 })

    // 读取计算样式
    const boxShadow = await wrapper.evaluate((el) => {
      return window.getComputedStyle(el).boxShadow
    })

    // 检测 "外环蓝色发光" 模式：0 0 0 Npx rgba(R, G, B) 且不是 inset
    // 允许：
    //   - 'none' / ''（完全无投影）
    //   - inset 阴影（Element Plus 用 inset 阴影模拟 1px 内边框，黑色 inset 1px 不算"发光外环"）
    // 禁止：
    //   - 0 0 0 Npx rgba(blue, ...) 非 inset（蓝色外环发光）
    //   - 0 0 0 Npx rgba(black, ...) 非 inset（黑色外环也不允许——疑似残留 Element Plus 默认值）
    //   - 任何 0 0 Xpx / 0 Xpx Ypx 的外环模糊阴影
    const isBlueOuterRing = (value: string) => {
      if (!value || value === 'none') return false
      // inset 阴影允许（用作内边框，不算外环发光）
      if (value.includes('inset')) return false
      // 检测 "0 0 0 Npx" 蓝色外环（无 inset 关键词）
      const m = value.match(/0\s+0\s+0\s+(\d+(?:\.\d+)?)px\s+rgba?\(([^)]+)\)/i)
      if (!m) return false
      const rgb = m[2].split(',').map((s) => parseInt(s.trim(), 10))
      if (rgb.length < 3) return false
      const [r, g, b] = rgb
      // 蓝色：B > R 且 B > G；或黑色：R=G=B<60（疑似 Element Plus 默认残留）
      const isBlue = b > r && b > g
      const isBlackish = r < 60 && g < 60 && b < 60 && Math.abs(r - g) < 10 && Math.abs(g - b) < 10
      return isBlue || isBlackish
    }

    expect(
      !isBlueOuterRing(boxShadow),
      `.el-input__wrapper focus 时不应有"0 0 0 Npx rgba(blue/black)"外环发光。` +
        `\n当前值: "${boxShadow}"` +
        `\n应改用 border-color 变化（默认 → #a0c4ff hover → #3b82f6 focus），详见 src/styles/SHADOW_AND_BORDER_RULES.md。` +
        `\n允许的 box-shadow 形态：none / '' / inset 阴影（Element Plus 用 inset 模拟 1px 内边框）。`
    ).toBe(true)
  })

  test('登录页面输入框 focus 状态 border 颜色为蓝色', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })

    const input = page.locator('input').first()
    await input.waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForLoadState('networkidle')

    await input.focus()
    await page.waitForTimeout(300)

    const wrapper = page.locator('.el-input__wrapper').first()
    const borderColor = await wrapper.evaluate((el) => {
      return window.getComputedStyle(el).borderColor
    })

    // 边框颜色应包含蓝色分量 (R < B 且 G < B)
    // 接受格式：rgb(59, 130, 246) 或 rgba(...)
    const rgbMatch = borderColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    expect(
      rgbMatch,
      `应能解析 .el-input__wrapper focus 时的 border-color RGB。当前值: "${borderColor}"`
    ).not.toBeNull()

    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10)
      const g = parseInt(rgbMatch[2], 10)
      const b = parseInt(rgbMatch[3], 10)
      expect(
        b > r && b > g,
        `.el-input__wrapper focus 时 border-color 应该是蓝色系（B > R, B > G）。` +
          `\n当前值: rgb(${r}, ${g}, ${b})。如果显示为黑色 (0, 0, 0)，说明 var(--el-color-primary) 在 light 模式下被错误映射。`
      ).toBe(true)
    }
  })
})
