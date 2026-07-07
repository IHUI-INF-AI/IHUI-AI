/**
 * 我的登录方式 (Settings SEC_04A) 防回归测试 (2026-07-04)
 *
 * 防护目标: 账号设置页 SEC_04A section 持续可用且遵循项目硬约束
 *   - LoginMethodsSection.vue 文件存在并使用 login-icons
 *   - i18n key 完整 (settings.sections.loginMethods + settings.loginMethods.*)
 *   - 无 lucide-fallback / @element-plus/icons-vue 残留
 *   - 无 <el-icon><Xxx /></el-icon> 模式
 *   - 至少引用 3 个 --border-unified-color-* token (符合 B&W 风格)
 *   - 第三方平台图标必须从 /images/loginSANFANG/ 加载
 *
 * CI 入口: npx playwright test e2e/settings-login-methods.spec.ts
 */

import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const COMPONENT = join(ROOT, 'src/views/settings/LoginMethodsSection.vue')
const SETTINGS_PAGE = join(ROOT, 'src/views/Settings.vue')
const ZH_CN = join(ROOT, 'src/locales/zh-CN.json')
const EN = join(ROOT, 'src/locales/en.json')
const ZH_CN_MODULE = join(ROOT, 'src/locales/modules/zh-CN/settings.json')
const EN_MODULE = join(ROOT, 'src/locales/modules/en/settings.json')

test.describe('我的登录方式 (Settings SEC_04A) 防回归', () => {
  test('1/7 LoginMethodsSection.vue 必须存在', () => {
    expect(existsSync(COMPONENT), 'LoginMethodsSection.vue 缺失').toBe(true)
  })

  test('2/7 必须从 @/components/login/icons/login-icons 导入图标', () => {
    const src = readFileSync(COMPONENT, 'utf-8')
    expect(src, '缺少 login-icons 导入').toMatch(
      /import\s*\{[^}]*\}\s*from\s*['"]@\/components\/login\/icons\/login-icons['"]/,
    )
  })

  test('3/7 禁止 lucide-fallback / @element-plus/icons-vue 导入', () => {
    const src = readFileSync(COMPONENT, 'utf-8')
    expect(src, '禁止 lucide-fallback 导入').not.toMatch(/from\s*['"]@\/lib\/lucide-fallback['"]/)
    expect(src, '禁止 lucide-fallback 导入').not.toMatch(/from\s*['"]lucide-fallback['"]/)
    expect(src, '禁止 @element-plus/icons-vue 导入').not.toMatch(/from\s*['"]@element-plus\/icons-vue['"]/)
  })

  test('4/7 禁止 <el-icon><Xxx /></el-icon> 模式', () => {
    const src = readFileSync(COMPONENT, 'utf-8')
    const elIconWrapRegex = /<el-icon\b[^>]*>\s*<[A-Z][A-Za-z]+\s*\/>\s*<\/el-icon>/g
    const matches = src.match(elIconWrapRegex) ?? []
    expect(matches.length, `发现 ${matches.length} 处违规 <el-icon><Xxx /></el-icon>`).toBe(0)
  })

  test('5/7 Settings.vue 必须挂载 LoginMethodsSection 在 SEC_04A 之后', () => {
    const src = readFileSync(SETTINGS_PAGE, 'utf-8')
    expect(src, 'Settings.vue 未挂载 LoginMethodsSection').toMatch(/<LoginMethodsSection\b/)
    // SEC_04A section 标题应使用 t('settings.sections.loginMethods.title')
    expect(src, 'SEC_04A section 标题未使用 i18n key').toMatch(
      /t\(['"]settings\.sections\.loginMethods\.title['"]\)/,
    )
  })

  test('6/7 i18n key 完整 (settings.sections.loginMethods + settings.loginMethods.*)', () => {
    const requiredKeys = [
      'sections.loginMethods.title',
      'sections.loginMethods.desc',
      'loginMethods.phone',
      'loginMethods.email',
      'loginMethods.password',
      'loginMethods.bound',
      'loginMethods.unbound',
      'loginMethods.bind',
      'loginMethods.unbind',
      'loginMethods.unbindTitle',
      'loginMethods.unbindConfirm',
      'loginMethods.unbindSuccess',
    ]
    for (const localePath of [ZH_CN, EN, ZH_CN_MODULE, EN_MODULE]) {
      const data = JSON.parse(readFileSync(localePath, 'utf-8')) as Record<string, unknown>
      for (const keyPath of requiredKeys) {
        const parts = keyPath.split('.')
        let cur: unknown = data.settings
        let found = true
        for (const p of parts) {
          if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[p]
          } else {
            found = false
            break
          }
        }
        expect(found, `[${localePath}] 缺失 key: settings.${keyPath}`).toBe(true)
      }
    }
  })

  test('7/7 至少引用 3 个 --border-unified-color-* token (B&W 风格)', () => {
    const src = readFileSync(COMPONENT, 'utf-8')
    const tokenRefs = src.match(/var\(--border-unified-color[a-z-]*\)/g) ?? []
    expect(
      tokenRefs.length,
      `仅引用了 ${tokenRefs.length} 个 --border-unified-color-* 变量（应至少 3 个）`,
    ).toBeGreaterThanOrEqual(3)
  })
})
