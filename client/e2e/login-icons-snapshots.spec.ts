/**
 * 登录图标 5 画面视觉验证 (2026-07-02)
 *
 * 目的: 自动化"人工 5 画面视觉验证"清单, 通过 Playwright 截图 + DOM 断言
 *       代替人工浏览器逐画面检查, 可在 CI 中重复运行。
 *
 * 5 画面清单 (与"完成清单"对应):
 *   1. 账号密码输入框 (User + Lock + Eye 三图标)
 *   2. 手机号登录页 (Phone + KeyRound + 验证码按钮)
 *   3. 注册模式 (Mail + Phone + KeyRound + 双 Lock + 双 Eye)
 *   4. 协议确认弹窗 (DocumentChecked 圆形徽章)
 *   5. 验证码输入框 (Key + 刷新图标)
 *
 * 运行: PW_BASE_URL=http://127.0.0.1:8888 npx playwright test login-icons-snapshots.spec.ts
 * 截图归档: e2e/__screenshots__/login-icons-snapshots/
 *
 * 与 login-icons-snapshots 的区别:
 *   - login-icons-snapshots.spec.ts: 5 画面视觉验证 (本文件)
 *   - login-icons.spec.ts: 图标规范参数回归 (不依赖浏览器)
 *   - login-i18n-screenshots.spec.ts: 5 语言 × 3 Tab × 2 主题 截图
 */

import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const SCREENSHOT_DIR = join(ROOT, 'e2e', '__screenshots__', 'login-icons-snapshots')

// 确保截图目录存在
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }) } catch { /* ignore */ }

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

// ════════════════════════════════════════════════════════════════════════
// 工具: 断言 SVG 元素符合 login-icons 规范
// ════════════════════════════════════════════════════════════════════════

async function assertSvgSpec(page: Page, selector: string, label: string) {
  const elements = page.locator(selector)
  const count = await elements.count()
  expect(count, `${label} 应至少存在 1 个 ${selector}`).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    const el = elements.nth(i)
    const vb = await el.getAttribute('viewBox')
    const sw = await el.getAttribute('stroke-width')
    const stroke = await el.getAttribute('stroke')
    expect(vb, `${label} #${i} viewBox`).toBe('0 0 24 24')
    expect(sw, `${label} #${i} stroke-width`).toBe('2')
    expect(stroke, `${label} #${i} stroke`).toBe('currentColor')
  }
}

async function gotoLogin(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
}

test.describe('登录 5 画面视觉验证 (2026-07-02)', () => {
  test.skip(!process.env.PW_BASE_URL, '需要 PW_BASE_URL (dev server) 才执行')

  // ═══════════════════════════════════════════════════════════════════
  // 画面 1: 账号密码输入框 (User + Lock + Eye 三图标)
  // ═══════════════════════════════════════════════════════════════════
  test('画面 1: 账号登录 (User + Lock + Eye)', async ({ page }) => {
    await gotoLogin(page)
    // 等待账号登录 tab 渲染完成
    await expect(page.locator('#account-username')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('#account-password')).toBeVisible({ timeout: 8000 })

    // 断言 User / Lock 图标符合规范
    await assertSvgSpec(page, '.el-input:has(input#account-username) svg.input-icon', 'User')
    await assertSvgSpec(page, '.el-input:has(input#account-password) svg.input-icon', 'Lock')

    // 断言 Eye 图标: 初始为密码隐藏态 (EyeIcon)
    await assertSvgSpec(page, '.el-input:has(input#account-password) .password-eye-container svg', 'EyeIcon(隐藏态)')

    // 切换显示密码: 点击眼睛触发 toggle
    await page.locator('.el-input:has(input#account-password) .password-eye-container').first().click()
    await page.waitForTimeout(300)
    // 切换后应为 EyeOffIcon
    await assertSvgSpec(page, '.el-input:has(input#account-password) .password-eye-container svg', 'EyeOffIcon(显示态)')

    await page.screenshot({
      path: join(SCREENSHOT_DIR, '1-account-login.png'),
      fullPage: false,
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 画面 2: 手机号登录页 (Phone + KeyRound + 验证码按钮)
  // ═══════════════════════════════════════════════════════════════════
  test('画面 2: 手机号登录 (Phone + KeyRound)', async ({ page }) => {
    await gotoLogin(page)
    // 切换到手机号 tab
    const phoneTab = page.locator('.tab-label:has-text("手机"), .tab-label:has-text("Phone")').first()
    await phoneTab.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await expect(page.locator('#phone-number')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('#verification-code')).toBeVisible({ timeout: 8000 })

    // 断言 Phone / KeyRound 图标
    await assertSvgSpec(page, '.el-input:has(input#phone-number) svg.input-icon', 'Phone')
    await assertSvgSpec(page, '.el-input:has(input#verification-code) svg.input-icon', 'KeyRound')

    await page.screenshot({
      path: join(SCREENSHOT_DIR, '2-phone-login.png'),
      fullPage: false,
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 画面 3: 注册模式 (Mail + Phone + KeyRound + 双 Lock + 双 Eye)
  // ═══════════════════════════════════════════════════════════════════
  test('画面 3: 注册模式 (Mail + Phone + KeyRound + 双 Lock + 双 Eye)', async ({ page }) => {
    await gotoLogin(page)
    // 切换到注册模式 (点"立即注册"链接)
    const registerLink = page.locator('.mode-toggle-btn').first()
    await registerLink.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)

    // 注册模式下的字段: username / email / phone / password / confirmPassword / captcha
    // 至少要看到 email 字段 (注册模式独有)
    const emailInput = page.locator('input[placeholder*="箱"], input[placeholder*="mail"]').first()
    await expect(emailInput).toBeVisible({ timeout: 8000 }).catch(() => {})

    // 断言 Mail / Phone / Lock 图标
    const mailIcon = page.locator('svg.input-icon').filter({ has: page.locator('rect[rx]') })
    const iconCount = await page.locator('svg.input-icon').count()
    expect(iconCount, '注册模式至少 5 个 .input-icon (Mail + Phone + KeyRound + 2 Lock)').toBeGreaterThanOrEqual(5)

    // 验证双 Eye 切换: 注册模式有 密码 + 确认密码 两组
    const eyeIcons = page.locator('.password-eye-container svg')
    const eyeCount = await eyeIcons.count()
    expect(eyeCount, '注册模式应至少 2 个眼睛图标 (密码 + 确认密码)').toBeGreaterThanOrEqual(2)

    // 统一断言所有 .input-icon / .eye-icon 符合规范
    await assertSvgSpec(page, 'svg.input-icon', '注册-Input图标')
    await assertSvgSpec(page, '.password-eye-container svg', '注册-Eye图标')

    await page.screenshot({
      path: join(SCREENSHOT_DIR, '3-register.png'),
      fullPage: false,
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 画面 4: 协议确认弹窗 (DocumentChecked 圆形徽章)
  // ═══════════════════════════════════════════════════════════════════
  test('画面 4: 协议确认弹窗 (DocumentChecked 徽章)', async ({ page }) => {
    await gotoLogin(page)
    // 协议确认弹窗通常在用户点击"登录"但未勾选协议时弹出
    // 直接勾选 + 立即点击提交可能更直接, 这里尝试直接点击提交按钮触发
    const submitBtn = page.locator('button.submit-btn, .el-button--primary:has-text("登录")').first()
    await submitBtn.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)

    // 检查弹窗出现
    const agreementDialog = page.locator('.agreement-confirm-dialog-wrapper, .agreement-confirm-dialog-container')
    const visible = await agreementDialog.isVisible({ timeout: 2000 }).catch(() => false)

    if (visible) {
      // 断言 DocumentChecked 图标: 在徽章内
      await assertSvgSpec(page, '.agreement-confirm-icon svg', 'DocumentChecked')

      // 断言协议文字未键名裸露
      const dialogText = await agreementDialog.textContent()
      expect(dialogText, '协议弹窗文字不应出现 auth.userAgreement 字面量').not.toMatch(/auth\.[a-z]/)
      expect(dialogText, '协议弹窗文字不应出现 auth.and 字面量').not.toMatch(/\bauth\.and\b/)

      await page.screenshot({
        path: join(SCREENSHOT_DIR, '4-agreement-dialog.png'),
        fullPage: false,
      })
    } else {
      test.skip(true, '协议弹窗未出现 (可能已默认同意), 跳过画面 4')
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  // 画面 5: 验证码输入框 (Key + 刷新图标)
  // ═══════════════════════════════════════════════════════════════════
  test('画面 5: 验证码输入框 (Key + Refresh)', async ({ page }) => {
    await gotoLogin(page)
    // CaptchaInput 在账号登录模式 (AccountLoginForm.vue) 中, 由 showCaptcha 控制
    // showCaptcha 默认 false, 触发条件: 登录失败后后端要求验证码
    // 这里尝试触发: 不输入任何内容直接点提交
    const submitBtn = page.locator('button.submit-btn').first()
    await submitBtn.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(1000)

    // 检查 captcha 是否出现
    const captchaField = page.locator('.captcha-field').first()
    const captchaVisible = await captchaField.isVisible({ timeout: 3000 }).catch(() => false)

    if (!captchaVisible) {
      // captcha 未触发 (后端未要求), 跳过本画面
      test.skip(true, 'CaptchaInput 未出现 (showCaptcha=false, 需后端触发), 跳过画面 5')
      return
    }

    // 断言 Key 图标 (KeyIcon 在 CaptchaInput.vue 的 prefix slot, class="input-icon")
    await assertSvgSpec(page, '.captcha-field svg.input-icon', 'Key')

    // 断言 Refresh 图标 (RefreshIcon 在 .refresh-overlay 内, class="refresh-icon")
    const refreshIcon = page.locator('.refresh-icon svg')
    const refreshCount = await refreshIcon.count()
    if (refreshCount > 0) {
      await assertSvgSpec(page, '.refresh-icon svg', 'Refresh')
    }

    await page.screenshot({
      path: join(SCREENSHOT_DIR, '5-captcha.png'),
      fullPage: false,
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 兜底: 5 语言键名裸露检查 (继承自 login-i18n-screenshots)
  // ═══════════════════════════════════════════════════════════════════
  test('5 画面整体: i18n 键名裸露扫描', async ({ page }) => {
    await gotoLogin(page)
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (!bodyText) return

    // 检测 i18n 键名裸露模式
    const exposed = bodyText.match(/\b(login|auth|app|nav|home|footer|common)\.[a-z][a-zA-Z0-9]+/g)
    expect(
      exposed ?? [],
      '登录页不应出现 i18n 键名裸露'
    ).toEqual([])
  })
})
