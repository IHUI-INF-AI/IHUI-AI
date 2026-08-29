import { test, expect, type Page } from '@playwright/test'

/**
 * 侧边栏明暗主题切换 E2E 回归守门(2026-08-29 立)
 *
 * 背景 bug:默认主题 system 时,旧实现用 next-themes 的原始值 theme(='system')判断明暗,
 * OS 暗色下首点 setTheme('dark')(=当前外观,无视觉变化),需点两下才切到 light。
 * 修复:切换逻辑以 DOM 真实状态(<html>.dark class)为事实源,一次点击切到对立面。
 *
 * 本 spec 模拟 OS 明暗(browser.newContext({ colorScheme })),验证「一次点击即切换」。
 * 注意:colorScheme 必须在 newContext 时传入(test.use 在 test 体内不生效);
 * 未登录即可测(侧边栏 SidebarActions 对未登录用户也渲染)。
 *
 * aria-label 来源:packages/i18n/messages/web/zh-CN.json themeToggle.lightMode="浅色" /
 * darkMode="深色" — 当前为暗色时按钮显示"浅色"(点击后切到浅色的语义)。
 */
const THEME_BTN = 'button[aria-label="浅色"], button[aria-label="深色"]'

async function createPage(
  browser: import('@playwright/test').Browser,
  opts: { colorScheme: 'dark' | 'light'; presetTheme?: string | null },
): Promise<Page> {
  const context = await browser.newContext({ colorScheme: opts.colorScheme })
  const page = await context.newPage()
  await page.addInitScript((t) => {
    if (t === undefined || t === null) localStorage.removeItem('theme')
    else localStorage.setItem('theme', t)
  }, opts.presetTheme ?? null)
  await page.goto('/')
  // 等 hydration 完成:主题按钮出现且 aria-label 脱离 SSR 占位态
  await expect(page.locator(THEME_BTN).first()).toBeVisible({ timeout: 30000 })
  await page.waitForTimeout(800)
  return page
}

test.describe('侧边栏主题切换(一次点击即生效)', () => {
  test('OS 暗色 + system 默认:点一下即从暗切亮 [报修场景]', async ({ browser }) => {
    const page = await createPage(browser, { colorScheme: 'dark' })

    // 前置:system 解析为暗色
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    // 暗色下按钮语义为"切到浅色"
    await expect(page.locator(THEME_BTN).first()).toHaveAttribute('aria-label', '浅色')

    // 一次点击 → 立即变亮(DOM class + 持久化 + 图标语义三重断言)
    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
    await expect(page.locator(THEME_BTN).first()).toHaveAttribute('aria-label', '深色')
    await page.context().close()
  })

  test('OS 暗色 + 存储为 dark:点一下即从暗切亮', async ({ browser }) => {
    const page = await createPage(browser, { colorScheme: 'dark', presetTheme: 'dark' })

    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
    await page.context().close()
  })

  test('OS 暗色 + 存储为 system:点一下即从暗切亮', async ({ browser }) => {
    const page = await createPage(browser, { colorScheme: 'dark', presetTheme: 'system' })

    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
    await page.context().close()
  })

  test('OS 亮色:点一下即从亮切暗(对称回归)', async ({ browser }) => {
    const page = await createPage(browser, { colorScheme: 'light' })

    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/)
    await expect(page.locator(THEME_BTN).first()).toHaveAttribute('aria-label', '深色')

    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
    await page.context().close()
  })

  test('连续切换往返:亮→暗→亮 状态不漂移', async ({ browser }) => {
    const page = await createPage(browser, { colorScheme: 'dark' })

    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    // 第 1 次:暗 → 亮
    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    // 第 2 次:亮 → 暗
    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    // 第 3 次:暗 → 亮
    await page.locator(THEME_BTN).first().click()
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/, { timeout: 5000 })
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
    await page.context().close()
  })
})
