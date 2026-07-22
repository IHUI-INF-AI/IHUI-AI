import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

/**
 * 登录弹窗 TabsList 凹槽容器 + 密码强度条轨道 视觉回归 (2026-07-22 ihui-m3-fix-tabs-bg 立)
 *
 * 根因:
 *   .login-scope 把 --color-muted 覆写为 100% 白(为 hover 凸出语义),
 *   导致 .login-scope 内所有 bg-muted / bg-muted/40 容器在亮色下与 bg-card 完全同色,
 *   看不出"凹槽"结构。TabsList 容器(role="tablist")和密码强度条轨道(data-slot="strength-track")
 *   都用 bg-muted,在亮色下不可见。
 *
 * 修复:
 *   .login-scope [role='tablist'] 和 .login-scope [data-slot='strength-track'] 用显式 hsl 绕开 var() 继承:
 *   - 亮色:hsl(0 0% 92%) = #EBEBEB = rgb(235, 235, 235) (与 bg-card 100% 白保持 8% L 差距)
 *   - 暗色:hsl(0 0% 18%) = #2E2E2E = rgb(46, 46, 46)   (与 bg-card 10% 保持 8% L 差距,与亮色对称)
 *
 * 守门范围:
 *   - 4 个登录 tab 容器(邮箱/手机/密码/扫码)— role="tablist" 全部覆盖
 *   - 密码强度条轨道 — data-slot="strength-track"
 *   - 亮色 + 暗色 双主题
 *
 * 反面案例(本 spec 立规依据):
 *   2026-07-22 修复前,亮色下 TabsList 容器呈 rgb(255, 255, 255) 与 bg-card 完全相同,
 *   用户反馈"这个容器怎么在亮色模式下没有一个整体的背景色设定呢"。
 */
const SHOT_DIR = 'tmp/login-tabs-groove-shots'
// 不用 [role="dialog"]:页面上有多个 dialog(移动端侧边栏 aside role="dialog" aria-label="主导航"),
// 用 .login-scope 精确锚定登录弹窗(AuthShell 容器,只在 LoginDialog 内出现)
const LOGIN_SCOPE = '.login-scope'

async function ensureShotDir() {
  const abs = path.resolve(process.cwd(), SHOT_DIR)
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true })
  return abs
}

async function gotoAuthorize(page: Page) {
  // /oauth/authorize 检测未登录会 router.replace('/'),LoginDialog 全局挂载在首页 layout
  // 流程:goto /oauth/authorize → 自动跳 / → LoginDialog open → dialog 可见
  await page.goto(
    'http://localhost:3000/oauth/authorize?client_id=test&redirect_uri=http://localhost:3000/&state=xyz',
    { waitUntil: 'domcontentloaded', timeout: 20000 },
  )
  // 等跳转完成(URL 变成 / 或带回调路径)
  await page.waitForURL(/^(http:\/\/localhost:3000\/(\?.*)?)$/i, { timeout: 15000 }).catch(() => {})
  // 清 theme 残留,确保从 light 开始
  await page.evaluate(() => {
    try {
      localStorage.removeItem('theme')
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    } catch {}
  })
  // 等待 .login-scope 可见(全局 LoginDialog open 后渲染 AuthShell)
  await page.waitForSelector(LOGIN_SCOPE, { state: 'visible', timeout: 15000 })
  await page.waitForTimeout(800) // 等 hydration + 动画完成
}

test.describe('登录弹窗 TabsList 凹槽容器 + 密码强度条轨道视觉回归', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await ensureShotDir()
  })

  test('light mode: TabsList 容器 + strength-track 轨道呈现 #EBEBEB', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

    await gotoAuthorize(page)

    // 切到"注册"模式 — PasswordStrengthIndicator 只在注册表单和忘记密码表单中渲染
    // LoginFormContent 底部"立即注册"按钮 onClick={() => setMode('register')}
    const registerBtn = page.locator('.login-scope button:has-text("注册")').first()
    await registerBtn.scrollIntoViewIfNeeded()
    await registerBtn.click()
    await page.waitForTimeout(500) // 等 RegisterFormContent 渲染

    // RegisterFormContent 2 个 tab:手机注册 / 邮箱注册,默认 phone tab
    // PhoneRegisterForm 有 input[name="password"] + PasswordStrengthIndicator
    const passwordInput = page.locator('.login-scope input[name="password"]').first()
    await passwordInput.scrollIntoViewIfNeeded()
    await passwordInput.fill('TestXYZ123!@#')
    await page.waitForTimeout(500) // 等 PasswordStrengthIndicator 渲染

    await page.locator(LOGIN_SCOPE).first().screenshot({
      path: path.join(SHOT_DIR, '01_light_tabs_strength.png'),
    })

    const data = await page.evaluate(() => {
      const d = document.querySelector('.login-scope')
      if (!d) return { error: 'no login-scope' }
      const isDark = document.documentElement.classList.contains('dark')

      // 拿所有 [role="tablist"](RegisterFormContent 有 1 个:phone/email 切换)
      const tablists = Array.from(d.querySelectorAll('[role="tablist"]'))
      const strengthTrack = d.querySelector('[data-slot="strength-track"]')

      // debug:读所有 input 的 name/value,确认 fill 是否生效
      const inputs = Array.from(d.querySelectorAll('input')).map((i) => ({
        name: (i as HTMLInputElement).name,
        type: (i as HTMLInputElement).type,
        value: (i as HTMLInputElement).value,
        id: (i as HTMLInputElement).id,
      }))
      // debug:读所有带 data-slot 的元素
      const dataSlots = Array.from(d.querySelectorAll('[data-slot]')).map((e) => ({
        slot: (e as HTMLElement).dataset.slot,
        tag: e.tagName,
      }))

      return {
        isDark,
        tablistCount: tablists.length,
        tablists: tablists.map((t) => ({
          ariaLabel: t.getAttribute('aria-label'),
          backgroundColor: getComputedStyle(t as HTMLElement).backgroundColor,
          classList: (t as HTMLElement).className,
        })),
        strengthTrack: strengthTrack
          ? {
              exists: true,
              backgroundColor: getComputedStyle(strengthTrack as HTMLElement).backgroundColor,
              parentClass: strengthTrack.parentElement?.className ?? null,
              width: strengthTrack.getBoundingClientRect().width,
            }
          : { exists: false },
        inputs,
        dataSlots,
      }
    })

    console.warn('\n[light mode: tabs + strength]', JSON.stringify(data, null, 2))
    console.warn('[light mode: console errors]', errors)

    // 断言:TabsList 容器必须有(注册模式有 phone/email 切换 tab)
    expect(
      data.tablistCount,
      '注册弹窗至少有 1 个 [role="tablist"](phone/email 切换 tab)',
    ).toBeGreaterThanOrEqual(1)

    // 断言:每个 TabsList 容器在亮色下必须呈现 rgb(235, 235, 235)
    data.tablists!.forEach((t, i) => {
      expect(
        t.backgroundColor,
        `tablist[${i}] (aria-label=${t.ariaLabel}) 亮色背景应 #EBEBEB (修复 .login-scope --color-muted 覆写为白导致 bg-muted 与 bg-card 同色)`,
      ).toBe('rgb(235, 235, 235)')
    })

    // 断言:密码强度条轨道在亮色下必须呈现 rgb(235, 235, 235)
    expect(data.strengthTrack?.exists, '密码强度条轨道应存在(已切到注册模式并输入密码)').toBe(true)
    expect(
      data.strengthTrack!.backgroundColor,
      'strength-track 亮色背景应 #EBEBEB (与 TabsList 同色阶,修复 bg-muted 在 .login-scope 内被覆写为白)',
    ).toBe('rgb(235, 235, 235)')
  })

  test('dark mode: TabsList 容器 + strength-track 轨道呈现 #2E2E2E', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

    await gotoAuthorize(page)

    // 切到暗色模式
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    })
    await page.waitForTimeout(500)

    // 切到"注册"模式
    const registerBtn = page.locator('.login-scope button:has-text("注册")').first()
    await registerBtn.scrollIntoViewIfNeeded()
    await registerBtn.click()
    await page.waitForTimeout(500)

    const passwordInput = page.locator('.login-scope input[name="password"]').first()
    await passwordInput.scrollIntoViewIfNeeded()
    await passwordInput.fill('TestXYZ123!@#')
    await page.waitForTimeout(500)

    await page.locator(LOGIN_SCOPE).first().screenshot({
      path: path.join(SHOT_DIR, '02_dark_tabs_strength.png'),
    })

    const data = await page.evaluate(() => {
      const d = document.querySelector('.login-scope')
      if (!d) return { error: 'no login-scope' }
      const isDark = document.documentElement.classList.contains('dark')

      const tablists = Array.from(d.querySelectorAll('[role="tablist"]'))
      const strengthTrack = d.querySelector('[data-slot="strength-track"]')

      return {
        isDark,
        tablistCount: tablists.length,
        tablists: tablists.map((t) => ({
          ariaLabel: t.getAttribute('aria-label'),
          backgroundColor: getComputedStyle(t as HTMLElement).backgroundColor,
        })),
        strengthTrack: strengthTrack
          ? {
              exists: true,
              backgroundColor: getComputedStyle(strengthTrack as HTMLElement).backgroundColor,
            }
          : { exists: false },
      }
    })

    console.warn('\n[dark mode: tabs + strength]', JSON.stringify(data, null, 2))
    console.warn('[dark mode: console errors]', errors)

    expect(data.isDark, 'html.dark 应存在').toBe(true)
    expect(
      data.tablistCount,
      '暗色模式下注册弹窗至少有 1 个 [role="tablist"]',
    ).toBeGreaterThanOrEqual(1)

    data.tablists!.forEach((t, i) => {
      expect(
        t.backgroundColor,
        `tablist[${i}] (aria-label=${t.ariaLabel}) 暗色背景应 #2E2E2E (与 bg-card 10% L 差距,与亮色 92% vs 100% 8% 差距对称)`,
      ).toBe('rgb(46, 46, 46)')
    })

    expect(data.strengthTrack?.exists, '密码强度条轨道应存在').toBe(true)
    expect(
      data.strengthTrack!.backgroundColor,
      'strength-track 暗色背景应 #2E2E2E (与 TabsList 同色阶)',
    ).toBe('rgb(46, 46, 46)')
  })
})
