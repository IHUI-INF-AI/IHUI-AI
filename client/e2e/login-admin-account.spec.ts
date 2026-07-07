/**
 * 账号密码登录可输入 username (2026-07-04 立).
 *
 * 背景: 历史 bug, useLoginLogic.handleAccountLogin L208-211 强制 11 位手机号正则
 * !/^1[3-9]\d{9}$/.test(account), 拦截 admin 等 username, 弹"请输入正确的手机号".
 *
 * 修复:
 *   - 前端 useLoginLogic.ts 删除强制手机号正则 (AccountLoginForm.vue form rules
 *     已接受 username/phone/email 三种格式, submit 时已校验过, handleAccountLogin
 *     重复校验是历史错误)
 *   - 后端 auth_service.login_by_password 扩展: 查 User.phone 找不到时 fallback
 *     查 SysUser.user_name (兼容 admin/admin123 等管理员账号)
 *   - unified-auth.ts admin loginPath 修对: /api/v1/auth/login → /api/v1/login/username
 *     (admin 走 sys_user 表专用接口 app/api/v1/auth/username_login.py:42)
 *
 * 守门:
 *   - pre-commit 脚本 scripts/check-no-phone-only-login.mjs 守 useLoginLogic.ts
 *     不再含强制 11 位手机号正则, 且 unified-auth.ts admin loginPath 必须指向
 *     /api/v1/login/username
 *   - 本 e2e 文件验证浏览器层面 admin/admin123 不会弹"手机号"提示
 *
 * 跑法: 启动 vite dev server (npm run dev, 默认 8888 端口) 后:
 *   npx playwright test e2e/login-admin-account.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

test.describe('账号密码登录支持 username (admin/admin123)', () => {
  test('不应在前端被强制 11 位手机号正则拦截', async ({ page }) => {
    // 拦截后端登录接口, 避免依赖实际后端 admin 账号存在
    // 关注点: 前端不弹"请输入正确的手机号"提示, 实际请求能发出去
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          msg: 'ok',
          data: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            token_type: 'Bearer',
            expires_in: 7200,
            user: { uuid: 'mock-uuid', phone: '', nickname: 'admin', avatar: '', is_vip: 1 },
          },
        }),
      })
    })

    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(800)

    // 找到账号输入框 + 密码输入框
    const usernameInput = page
      .locator('#account-username')
      .or(page.locator('input[name="account-username"]'))
      .first()
    const passwordInput = page
      .locator('#account-password')
      .or(page.locator('input[name="account-password"]'))
      .first()

    await expect(usernameInput).toBeVisible({ timeout: 10000 })
    await expect(passwordInput).toBeVisible({ timeout: 10000 })

    // 输入 admin (5 字符, 不匹配 11 位手机号正则)
    await usernameInput.fill('admin')
    await passwordInput.fill('admin123')
    // 触发 blur 让 form rules 校验
    await passwordInput.blur()
    await page.waitForTimeout(300)

    // 关键断言: 页面不应显示"请输入正确的手机号"提示
    // 也不应显示 form item error 状态 (红色边框 + 错误提示)
    const phoneErrorTexts = await page.evaluate(() => {
      const text = document.body.innerText
      const phoneKeywords = ['请输入正确的手机号', '请输入手机号', '手机号格式']
      return phoneKeywords.filter((k) => text.includes(k))
    })
    expect(
      phoneErrorTexts,
      `不应弹手机号相关提示, 实际: ${JSON.stringify(phoneErrorTexts)}`
    ).toEqual([])

    // form item 不应是 error 状态
    const errorFormItems = await page.locator('.el-form-item.is-error').count()
    expect(errorFormItems, '账号 + 密码 form items 不应是 error 状态').toBe(0)
  })

  test('点击登录按钮应能向后端发起请求, 不被前端拦截', async ({ page }) => {
    // 记录实际请求, 验证 admin/admin123 真的发到了 /api/v1/auth/login
    let requestPayload: Record<string, unknown> | null = null
    let requestMade = false

    await page.route('**/api/v1/auth/login', async (route) => {
      requestMade = true
      try {
        const req = route.request()
        requestPayload = JSON.parse(req.postData() || '{}')
      } catch {
        // 忽略解析错误
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          msg: 'ok',
          data: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            token_type: 'Bearer',
            expires_in: 7200,
            user: { uuid: 'mock-uuid', phone: '', nickname: 'admin', avatar: '', is_vip: 1 },
          },
        }),
      })
    })

    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(800)

    const usernameInput = page
      .locator('#account-username')
      .or(page.locator('input[name="account-username"]'))
      .first()
    const passwordInput = page
      .locator('#account-password')
      .or(page.locator('input[name="account-password"]'))
      .first()

    await usernameInput.fill('admin')
    await passwordInput.fill('admin123')

    // 点击登录按钮 (提交按钮或回车)
    const loginButton = page
      .locator('button[type="primary"]')
      .filter({ hasText: /登录|login/i })
      .first()
    if (await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginButton.click()
    } else {
      // 备选: 按回车提交
      await passwordInput.press('Enter')
    }

    await page.waitForTimeout(1500)

    // 关键断言: 请求应能发出去
    expect(
      requestMade,
      'admin/admin123 提交后, 应能实际发起 /api/v1/auth/login 请求 (不被前端拦截)'
    ).toBe(true)
    if (requestPayload) {
      // 验证请求体里包含 admin/admin123 (而不是被前端清掉)
      expect(
        requestPayload.phone || requestPayload.username,
        '请求体应包含账号'
      ).toBe('admin')
      expect(requestPayload.password, '请求体应包含密码').toBe('admin123')
    }
  })
})
