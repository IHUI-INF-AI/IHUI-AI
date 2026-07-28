import { test, expect, type Page } from '@playwright/test'

/**
 * AgreementNoticeDialog 位置回归守门测试 (2026-07-28 立)
 *
 * 背景:
 *   2026-07-28 协议弹窗位置错位 bug — 用户登录时,未勾选协议直接提交,
 *   弹出 AgreementNoticeDialog,但该弹窗渲染在视口**顶部**而非屏幕中央,
 *   实测垂直偏移 deltaY ≈ 406px(在 1440x900 视口下),完全不可见 / 看不见"同意"按钮,
 *   用户无法完成登录。
 *
 * 根因:
 *   - 共享包 `packages/ui-react` 的 LoginForm 容器加了 `.login-form-scope` class
 *   - 全局 CSS 里有规则 `.login-form-scope { position: relative; }`
 *   - 子组件 AgreementNoticeDialog 的 DialogContent 默认 Radix className 含 `fixed`
 *   - 因为 AgreementNoticeDialog 在 DOM 上是 `.login-form-scope` 的后代,
 *     两个 selector 特异性相同(都是 class),CSS 级联源序后到者覆盖前到者,
 *     `.login-form-scope { position: relative }` 把 `position: fixed` 覆盖,
 *     弹窗以 normal flow 排版,从视口顶端开始排(deltaY ≈ 406px = 视口高 - 弹窗高)。
 *
 * 修复:
 *   1. 共享包 AgreementNoticeDialog 的 DialogContent **移除** `.login-form-scope` className
 *      (apps/web/src/components/login/AgreementNoticeDialog.tsx 同步已不再使用该 class)
 *   2. 全局 CSS 改成 `.login-form-scope :not([data-slot='dialog-content'])` 形式,
 *      只覆盖表单元素,不污染 DialogContent(Radix 给 DialogContent 加了 data-slot)
 *
 * 预期:deltaX < 5px && deltaY < 5px(肉眼不可见,严苛守门)
 *
 * 覆盖场景:
 *   - 桌面端 1440x900 视口(回归主要发生场景)
 *   - 移动端 375x667 视口(响应式守门,防 @media (max-width:*) 误伤)
 *
 * 关联文件:
 *   - apps/web/src/components/login/AgreementNoticeDialog.tsx
 *   - packages/ui-react/src/components/login-form/login-form.tsx
 *   - packages/ui-react/src/components/login-form/agreement-notice-dialog.tsx
 *   - apps/web/app/globals.css(.login-form-scope 规则)
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8801'
const DELTA_THRESHOLD_PX = 5 // 5px 阈值 = 屏幕宽度 0.35%@1440,肉眼可识别阈值(1px @1440 = 0.07%)的 5x

interface DialogGeometry {
  rect: { left: number; top: number; width: number; height: number }
  deltaX: number
  deltaY: number
  position: string
  className: string
}

interface DialogMeasurement {
  viewport: { width: number; height: number }
  agreementDialog: DialogGeometry | null
  fixSuccess: boolean
}

/**
 * 触发 AgreementNoticeDialog 流程并读取其几何位置。
 *
 * 流程(参考 .trae-cn/tmp/dialog-fix-verify/verify3.js v3 稳定版):
 *   1. 打开主页 + 等待 dev server 编译完成(networkidle)
 *   2. 拦截 /api/auth/login(避免依赖真实后端)
 *   3. 点 header 登录按钮
 *   4. 等 LoginDialog(data-testid="login-dialog") 出现
 *   5. 切到密码登录 tab(data-testid="login-tab-password")
 *   6. 填测试手机号 + 密码(**不**勾选协议 — 默认未勾选)
 *   7. 点提交 → 协议弹窗打开
 *   8. 读 AgreementNoticeDialog 的 rect + computed style
 *   9. 计算与 viewport 中心的 deltaX / deltaY
 */
async function triggerAndMeasure(page: Page): Promise<DialogMeasurement> {
  // 拦截登录 API(避免依赖真实 OTP/账号后端)
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { accessToken: 'mock', refreshToken: 'mock', userId: 'u1' },
      }),
    })
  })

  // 1. 打开主页
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')

  // 2. 点 header 登录按钮
  const loginBtn = page.getByRole('button', { name: /登录/ }).first()
  await loginBtn.click()

  // 3. 等 LoginDialog 出现
  const loginDialog = page.getByTestId('login-dialog')
  await expect(loginDialog).toBeVisible({ timeout: 5000 })

  // 4. 切到密码登录 tab
  await page.getByTestId('login-tab-password').click()

  // 5. 填表(**不**勾选协议 — defaultAgreed=false,弹窗由 agreementMode='notice-dialog' 触发)
  const accountInput = page.getByTestId('login-account-input')
  const passwordInput = page.getByTestId('login-password-input')
  await expect(accountInput).toBeVisible({ timeout: 5000 })
  await accountInput.fill('13800138000')
  await passwordInput.fill('Test123!')

  // 6. 点提交按钮(用 data-testid 精准锁定,避免点中其他"登录"按钮)
  const submitBtn = page.getByTestId('login-submit')
  await submitBtn.click()

  // 7. 等 AgreementNoticeDialog 出现(role=dialog 但不是 login-dialog)
  //    与 verify3.js 兜底策略一致:取所有 dialog 中 data-testid !== 'login-dialog' 的那一个
  const noticeDialog = page.locator('[role="dialog"]:not([data-testid="login-dialog"])')
  await expect(noticeDialog).toBeVisible({ timeout: 5000 })

  // 8. 测量几何
  return await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
    const agreement = dialogs.find((d) => d.getAttribute('data-testid') !== 'login-dialog')
    if (!agreement) {
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        agreementDialog: null,
        fixSuccess: false,
      }
    }
    const cs = getComputedStyle(agreement)
    const r = agreement.getBoundingClientRect()
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const centerX = r.left + r.width / 2
    const centerY = r.top + r.height / 2
    const deltaX = centerX - viewport.width / 2
    const deltaY = centerY - viewport.height / 2
    return {
      viewport,
      agreementDialog: {
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        deltaX,
        deltaY,
        position: cs.position,
        className: (agreement.className || '').toString().substring(0, 200),
      },
      fixSuccess:
        Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5,
    }
  })
}

test.describe('AgreementNoticeDialog Position Regression (issue: deltaY=406px)', () => {
  test('桌面端视口 (1440x900):协议弹窗居中 |deltaX|<5 && |deltaY|<5', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const measurement = await triggerAndMeasure(page)

    // 1. 协议弹窗必须出现
    expect(measurement.agreementDialog, 'AgreementNoticeDialog 必须出现').not.toBeNull()
    if (!measurement.agreementDialog) return

    const { deltaX, deltaY, position, rect, className } = measurement.agreementDialog

    // 2. 核心守门:水平 + 垂直偏移 < 5px
    expect(
      Math.abs(deltaX),
      `|deltaX| ${deltaX.toFixed(2)}px 应 < ${DELTA_THRESHOLD_PX}px (rect.left=${rect.left.toFixed(1)} viewport.w=${measurement.viewport.width})`,
    ).toBeLessThan(DELTA_THRESHOLD_PX)

    expect(
      Math.abs(deltaY),
      `|deltaY| ${deltaY.toFixed(2)}px 应 < ${DELTA_THRESHOLD_PX}px (修复前实测 ≈ 406px,rect.top=${rect.top.toFixed(1)} viewport.h=${measurement.viewport.height})`,
    ).toBeLessThan(DELTA_THRESHOLD_PX)

    // 3. computed position 必须是 fixed(根治断言 — 防止 .login-form-scope { position: relative } 级联再次污染)
    expect(position, 'computed position 应为 fixed(防御 .login-form-scope 级联覆盖)').toBe('fixed')

    // 4. 关键守门:DialogContent 不能被 .login-form-scope 污染
    expect(
      className.includes('login-form-scope'),
      `AgreementNoticeDialog DialogContent 不应含 .login-form-scope class(防 cascade 覆盖 fixed),实际 className=${className}`,
    ).toBe(false)

    // 5. 截图证据(用于 review / 调试)
    await page.screenshot({
      path: 'apps/web/e2e/screenshots/agreement-dialog-position.png',
      fullPage: false,
    })
  })

  test('移动端视口 (375x667):协议弹窗居中 |deltaX|<5 && |deltaY|<5', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const measurement = await triggerAndMeasure(page)

    expect(measurement.agreementDialog, 'AgreementNoticeDialog 必须出现').not.toBeNull()
    if (!measurement.agreementDialog) return

    const { deltaX, deltaY, position } = measurement.agreementDialog

    expect(
      Math.abs(deltaX),
      `mobile |deltaX| ${deltaX.toFixed(2)}px 应 < ${DELTA_THRESHOLD_PX}px`,
    ).toBeLessThan(DELTA_THRESHOLD_PX)

    expect(
      Math.abs(deltaY),
      `mobile |deltaY| ${deltaY.toFixed(2)}px 应 < ${DELTA_THRESHOLD_PX}px`,
    ).toBeLessThan(DELTA_THRESHOLD_PX)

    expect(position, 'mobile computed position 应为 fixed').toBe('fixed')

    await page.screenshot({
      path: 'apps/web/e2e/screenshots/agreement-dialog-position-mobile.png',
      fullPage: false,
    })
  })
})
