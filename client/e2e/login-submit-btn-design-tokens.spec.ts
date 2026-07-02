/**
 * 登录/注册 submit 按钮设计令牌应用防回归 (2026-07-02)
 *
 * 背景：`_login-tokens.scss` 定义了登录模块的完整设计令牌（圆角 10px / 高 44px /
 *       蓝色阴影 #2563eb / hover 上移 1px / 暗色版本），但历史上没有任何组件 @use 它。
 *       本 spec 源码级保证：
 *         - UniversalLogin.vue 必须 @use _login-tokens.scss 别名 lt
 *         - .submit-btn 必须引用至少 3 个 lt 变量（防止退化为 Element Plus 默认样式）
 *         - .submit-btn 必须应用 @include lt.login-btn-primary mixin
 *         - html.dark .submit-btn 暗色变体必须存在（覆盖 Element Plus 默认）
 *
 * 该 spec 跑通 = 设计令牌已应用；任一断言失败 = 有人改回了 Element Plus 默认丑样式。
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const UNIVERSAL_LOGIN = join(ROOT, 'src/components/login/UniversalLogin.vue')
const LOGIN_TOKENS = join(ROOT, 'src/components/login/_login-tokens.scss')

test.describe('登录/注册按钮设计令牌应用防回归', () => {
  test('1/5 _login-tokens.scss 设计令牌文件必须存在', () => {
    expect(existsSync(LOGIN_TOKENS), '`_login-tokens.scss` 不存在（登录模块设计令牌源头丢失）').toBe(true)
  })

  test('2/5 UniversalLogin.vue 必须 @use _login-tokens.scss', () => {
    const src = readFileSync(UNIVERSAL_LOGIN, 'utf-8')
    expect(
      src,
      'UniversalLogin.vue 缺少 `@use "./_login-tokens.scss" as lt;`（设计令牌未被消费）',
    ).toMatch(/@use\s+['"]\.\/_login-tokens\.scss['"]\s+as\s+lt/)
  })

  test('3/5 .submit-btn 必须引用至少 3 个 lt 变量（圆角/高度/字号/字重/字间距）', () => {
    const src = readFileSync(UNIVERSAL_LOGIN, 'utf-8')
    const submitBtnBlock = src.match(/\.submit-btn\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    const tokenRefs = submitBtnBlock.match(/lt\.\$login-btn-/g) ?? []
    expect(
      tokenRefs.length,
      `.submit-btn 仅引用了 ${tokenRefs.length} 个 lt.$login-btn-* 变量（应至少 3 个：radius/height/font-size/font-weight/letter-spacing）`,
    ).toBeGreaterThanOrEqual(3)
  })

  test('4/5 .submit-btn 必须应用 @include lt.login-btn-primary mixin', () => {
    const src = readFileSync(UNIVERSAL_LOGIN, 'utf-8')
    const submitBtnBlock = src.match(/\.submit-btn\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(
      submitBtnBlock,
      '.submit-btn 缺少 @include lt.login-btn-primary mixin（蓝色阴影 + 圆角 + 主色背景）',
    ).toMatch(/@include\s+lt\.login-btn-primary/)
    expect(
      submitBtnBlock,
      '.submit-btn 缺少 @include lt.login-btn-primary-hover（hover 上移 + 阴影加深）',
    ).toMatch(/@include\s+lt\.login-btn-primary-hover/)
  })

  test('5/5 html.dark .submit-btn 暗色变体必须存在（覆盖 Element Plus 默认）', () => {
    const src = readFileSync(UNIVERSAL_LOGIN, 'utf-8')
    expect(
      src,
      'UniversalLogin.vue 缺少 `html.dark .universal-login .submit-btn` 暗色样式块（暗色下按钮颜色错误）',
    ).toMatch(/html\.dark\s+\.universal-login[\s\S]*?\.submit-btn\s*\{[\s\S]*?lt\.\$login-dark-primary/)
  })
})
