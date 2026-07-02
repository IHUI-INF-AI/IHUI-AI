/**
 * 登录图标回归测试 (2026-07-02)
 *
 * 防护目标: 9 个登录文件已统一使用 login-icons.ts 的 markRaw 组件
 *          (PhoneIcon / KeyRoundIcon / MailIcon / DocumentCheckedIcon 等)。
 *          禁止回退到 lucide-fallback / @element-plus/icons-vue / 内联 SVG。
 *
 * 验证策略（3 轨）:
 *   1) 源码级: 验证 9 个文件均导入 login-icons 且无 lucide-fallback / icons-vue 残留
 *   2) 渲染级: 验证图标组件的 SVG 渲染参数严格符合规范
 *              (24×24 viewBox, stroke-width=2, currentColor, round 端点)
 *   3) 视觉级 (可选, 需 dev server): 验证图标实际尺寸 / stroke 在浏览器生效
 *
 * CI 入口: npx playwright test e2e/login-icons.spec.ts
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// 注: SVG 渲染参数验证 (viewBox / stroke-width / currentColor / round) 已下沉到
//     src/components/login/icons/__tests__/login-icons.spec.ts (Vitest + @vue/test-utils)。
//     Playwright 文件只覆盖:
//       1) 源码级: import 检查 (无 lucide-fallback / icons-vue 残留)
//       2) 视觉级: 真实浏览器中验证计算样式 + 交互动效

// ════════════════════════════════════════════════════════════════════════
// 1) 源码级: 9 个登录文件无 lucide-fallback / @element-plus/icons-vue 残留
// ════════════════════════════════════════════════════════════════════════

const CLEANED_FILES = [
  'src/components/login/UniversalLogin.vue',
  'src/components/login/forms/PhoneLoginForm.vue',
  'src/components/login/forms/RegisterForm.vue',
  'src/components/login/forms/PasswordReset.vue',
  'src/components/login/forms/AccountForm.vue',
  'src/components/login/components/CaptchaInput.vue',
  'src/components/login/PasswordToggleIcon.vue',
  'src/components/login/PhoneBindingDialog.vue',
  'src/components/login/forms/PhoneForm.vue',
  'src/components/auth/PasswordReset.vue',
  'src/components/user/LoginPopup.vue',
] as const

test.describe('登录图标回归 (2026-07-02): 源码级', () => {
  for (const rel of CLEANED_FILES) {
    test(`${rel} 不应再 import lucide-fallback`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(
        src,
        `${rel} 不应再 import '@/lib/lucide-fallback' 或 'lucide-fallback'。` +
          `\n所有图标必须改用 '@/components/login/icons/login-icons'。`
      ).not.toMatch(/from\s+['"]@?[^'"]*lucide-fallback['"]/)
    })

    test(`${rel} 不应再 import @element-plus/icons-vue`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(
        src,
        `${rel} 不应再 import '@element-plus/icons-vue'。` +
          `\n所有图标必须改用 '@/components/login/icons/login-icons'。`
      ).not.toMatch(/from\s+['"]@element-plus\/icons-vue['"]/)
    })
  }

  // 模板内禁止 <el-icon><Xxx /></el-icon> 模式 (即 <el-icon> 包裹单标签)
  test('登录文件夹内不应再使用 <el-icon><Xxx /></el-icon> 模式', () => {
    // 检查 <el-icon> 与 </el-icon> 之间的简单子组件模式
    const elIconWrapRegex = /<el-icon\b[^>]*>\s*<[A-Z][A-Za-z]+\s*\/>\s*<\/el-icon>/g
    let offenders: string[] = []
    for (const rel of CLEANED_FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      const m = src.match(elIconWrapRegex)
      if (m) offenders.push(`${rel}: ${m.length} 处`)
    }
    expect(offenders, `发现 <el-icon> 包裹模式, 应改用 <component :is="XxxIcon" />:`).toEqual([])
  })
  // 模板内禁止内联 FontAwesome SVG (viewBox 非 0 0 24 24)
  // 防止批量替换遗漏: 旧代码用 viewBox 576x512 / 640x512 实心眼图标
  test('登录文件内不应有内联 FontAwesome SVG (viewBox 非 0 0 24 24)', () => {
    const inlineSvgRegex = /<svg\b[^>]*\bviewBox="([^"]+)"[^>]*>/g
    let offenders: string[] = []
    for (const rel of CLEANED_FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      let m: RegExpExecArray | null
      while ((m = inlineSvgRegex.exec(src)) !== null) {
        const vb = m[1]
        if (vb !== '0 0 24 24') {
          offenders.push(rel + ': viewBox=' + vb + ' (应改用 login-icons 组件)')
        }
      }
    }
    expect(offenders, '发现内联 SVG viewBox 非 0 0 24 24, 应改用 login-icons 组件').toEqual([])
  })

})

// ════════════════════════════════════════════════════════════════════════
// 2) 视觉级 (可选, 仅在 dev server 可达时执行)
//    源码级 import 检查见上方 describe '登录图标回归 (2026-07-02): 源码级'
//    SVG 渲染参数验证见 vitest 文件: src/components/login/icons/__tests__/login-icons.spec.ts
// ════════════════════════════════════════════════════════════════════════

test.describe('登录图标回归: 浏览器视觉 (PW_BASE_URL 设置时启用)', () => {
  test.skip(!process.env.PW_BASE_URL, '需要 PW_BASE_URL (dev server) 才执行')

  test('登录页 .input-icon svg stroke-width 属性必须为 "2"', async ({ page }) => {
    await page.goto(`${process.env.PW_BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // /login 是占位页, 实际登录交互在 LoginDialog 弹窗内
    // 弹窗由 useLoginDialog().open('login') 在 onMounted 触发
    // 等弹窗 mount 完成
    const dialog = page.locator('.el-dialog').filter({ has: page.locator('#account-username') })
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // el-input 把 id 放在内部 <input> 上, 用 svg.input-icon 兜底 (账号表单只有 User + Lock 两个)
    // 注意: .input-icon 类在 <svg> 根元素上 (component :is 渲染), 不是父元素
    const strokeWidths = await page.locator('.el-dialog svg.input-icon').evaluateAll(
      (els) => els.map((e) => e.getAttribute('stroke-width'))
    )
    expect(strokeWidths.length, `账号登录 tab 应有 2 个 .input-icon (User + Lock)`).toBeGreaterThanOrEqual(2)
    // svg 属性 stroke-width="2" 不带 px
    for (const sw of strokeWidths) {
      expect(sw, `.input-icon svg stroke-width 应为 "2"`).toBe('2')
    }
  })

  test('密码显隐切换的 svg viewBox 必须为 0 0 24 24', async ({ page }) => {
    await page.goto(`${process.env.PW_BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    const dialog = page.locator('.el-dialog').filter({ has: page.locator('#account-password') })
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // 实际类名是 .eye / .eye-slash (在 .password-eye-container label 内)
    const viewBoxes = await page.locator('.el-dialog .password-eye-container svg').evaluateAll(
      (els) => els.map((e) => e.getAttribute('viewBox'))
    )
    expect(viewBoxes.length, '密码眼睛 svg 应存在').toBeGreaterThanOrEqual(1)
    for (const vb of viewBoxes) {
      expect(vb, `密码眼睛 svg viewBox`).toBe('0 0 24 24')
    }
  })
})
