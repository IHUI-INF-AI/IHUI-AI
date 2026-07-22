import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

/**
 * AI 登录框 4 状态自验 — 实际渲染 + 截图 + 读 DOM 数值
 *
 * 改动:Logo 容器无背景、welcome 图替代"欢迎回来"文字、输入框渐变描边动画、隐私复选框样式恢复
 * 4 状态:default / hover / active(勾选) / dark mode
 */
const SHOT_DIR = 'tmp/login-dialog-verify-shots'

const DIALOG = '[role="dialog"]'
const CHECKBOX = 'label.group span[role="checkbox"]'

async function ensureShotDir() {
  const abs = path.resolve(process.cwd(), SHOT_DIR)
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true })
  return abs
}

async function gotoAuthorize(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(
        'http://localhost:8801/oauth/authorize?client_id=test&redirect_uri=http://localhost:8801/&state=xyz',
        { waitUntil: 'domcontentloaded', timeout: 15000 },
      )
      // 清 theme 残留,确保从 light 开始
      await page.evaluate(() => {
        try {
          localStorage.removeItem('theme')
        } catch {}
      })
      await page.waitForSelector(DIALOG, { state: 'visible', timeout: 8000 })
      await page.waitForTimeout(500)
      return
    } catch (e) {
      if (attempt === 2) throw e
      await page.waitForTimeout(1500)
    }
  }
}

test.describe('AI 登录框 4 状态自验', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await ensureShotDir()
  })

  test('state 1: 默认态 (light mode) — 截图 + DOM 数值', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

    await gotoAuthorize(page)

    // 截图 (仅 dialog)
    const dialog = page.locator(DIALOG).first()
    await dialog.screenshot({ path: path.join(SHOT_DIR, '01_default_light.png') })
    await page.screenshot({
      path: path.join(SHOT_DIR, '01_default_light_full.png'),
      fullPage: false,
    })

    // 读 DOM 数值
    const data = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      if (!d) return { error: 'no dialog' }
      const logo = d.querySelector('img[alt="IHUI AI"]') as HTMLImageElement | null
      const welcomeLight = d.querySelector('img.welcome-img') as HTMLImageElement | null
      const welcomeDark = d.querySelector('img.welcome-img-dark') as HTMLImageElement | null
      const gradients = d.querySelectorAll('.input-gradient-wrap')
      const cb = d.querySelector('label.group span[role="checkbox"]') as HTMLElement | null
      const isDark = document.documentElement.classList.contains('dark')
      return {
        theme: isDark ? 'dark' : 'light',
        logo: {
          exists: !!logo,
          src: logo?.getAttribute('src') ?? null,
          parentBg: logo?.parentElement
            ? getComputedStyle(logo.parentElement).backgroundColor
            : null,
          parentClass: logo?.parentElement?.className ?? null,
          rect: logo?.getBoundingClientRect()?.toJSON?.() ?? null,
        },
        welcome: {
          light: welcomeLight
            ? {
                display: getComputedStyle(welcomeLight).display,
                opacity: getComputedStyle(welcomeLight).opacity,
                width: welcomeLight.getBoundingClientRect().width,
              }
            : null,
          dark: welcomeDark
            ? {
                display: getComputedStyle(welcomeDark).display,
                opacity: getComputedStyle(welcomeDark).opacity,
                width: welcomeDark.getBoundingClientRect().width,
              }
            : null,
        },
        gradientCount: gradients.length,
        firstInputClass: gradients[0]?.querySelector('input')?.className ?? null,
        firstWrapPadding: gradients[0] ? getComputedStyle(gradients[0]).padding : null,
        firstWrapRadius: gradients[0] ? getComputedStyle(gradients[0]).borderRadius : null,
        firstBeforeOpacity: gradients[0]
          ? getComputedStyle(gradients[0], '::before').opacity
          : null,
        // 描边实测(2026-07-19 登录框描边样式回归落地的硬性证据)
        // 守门:防止 `.input-gradient-wrap` 默认态无 border,或 hsl(var(--color-input)) 嵌套形式被浏览器静默丢弃
        wrapBorders: Array.from(gradients).map((g) => {
          const cs = getComputedStyle(g as HTMLElement)
          return {
            borderTopWidth: cs.borderTopWidth,
            borderTopStyle: cs.borderTopStyle,
            borderTopColor: cs.borderTopColor,
          }
        }),
        checkbox: cb
          ? {
              exists: true,
              ariaChecked: cb.getAttribute('aria-checked'),
              classes: cb.className,
              width: cb.getBoundingClientRect().width,
              height: cb.getBoundingClientRect().height,
              border: getComputedStyle(cb).border,
              hasCheckIcon: !!cb.querySelector('svg'),
            }
          : { exists: false },
        hasWelcomeTextVisible: (() => {
          // 找页面上 sr-only 外的 "欢迎回来" h2
          const h2s = Array.from(document.querySelectorAll('h2'))
          return h2s
            .filter((h) => !h.classList.contains('sr-only'))
            .some((h) => (h.textContent ?? '').includes('欢迎回来'))
        })(),
        hasLoginSubtitleVisible: (() => {
          // DialogDescription 是 p 元素
          const ps = Array.from(document.querySelectorAll('p'))
          return ps
            .filter((p) => !p.classList.contains('sr-only'))
            .some((p) => (p.textContent ?? '').includes('登录您的账号'))
        })(),
      }
    })

    console.warn('\n[state 1: default light]', JSON.stringify(data, null, 2))
    console.warn('[state 1: console errors]', errors)

    // 断言
    expect(data.gradientCount, 'input-gradient-wrap 数量应 ≥ 1').toBeGreaterThanOrEqual(1)
    expect(data.checkbox?.exists, '复选框应存在').toBe(true)
    expect(data.hasWelcomeTextVisible, '不应有视觉可见的"欢迎回来"h2').toBe(false)
    expect(data.hasLoginSubtitleVisible, '不应有视觉可见的"登录您的账号"文字').toBe(false)
    // 描边硬性证据(2026-07-19 登录框描边样式回归守门)
    // 默认态必须呈现 1px solid 浅灰(#e5e5e5 = rgb(229, 229, 229))
    expect(data.wrapBorders!.length, '每个 .input-gradient-wrap 必须有 border 数值').toBe(
      data.gradientCount,
    )
    data.wrapBorders!.forEach((b, i) => {
      expect(b.borderTopWidth, `wrap[${i}] border-width 应为 1px`).toBe('1px')
      expect(b.borderTopStyle, `wrap[${i}] border-style 应为 solid`).toBe('solid')
      expect(
        b.borderTopColor,
        `wrap[${i}] border-color 应为 #e5e5e5 light 浅灰 (防止 CSS 颜色 token 嵌套被 Tailwind v4 序列化后静默丢弃)`,
      ).toBe('rgb(229, 229, 229)')
    })
    expect(data.firstBeforeOpacity, '默认态 ::before 渐变描边应隐藏 (opacity 0)').toBe('0')
  })

  test('state 2: hover 态 (light mode) — 输入框渐变描边', async ({ page }) => {
    await gotoAuthorize(page)

    // hover 第一个输入框
    const phoneInput = page.locator('input[name="phone"]').first()
    await phoneInput.scrollIntoViewIfNeeded()
    await phoneInput.hover()
    await page.waitForTimeout(800) // 等渐变动画

    const dialog = page.locator(DIALOG).first()
    await dialog.screenshot({ path: path.join(SHOT_DIR, '02_hover_light.png') })

    const data = await page.evaluate(() => {
      const wrap = document.querySelector('.input-gradient-wrap') as HTMLElement | null
      if (!wrap) return { error: 'no wrap' }
      const before = getComputedStyle(wrap, '::before')
      const wrapCs = getComputedStyle(wrap)
      return {
        opacity: before.opacity,
        animationName: before.animationName,
        animationPlayState: before.animationPlayState,
        animationDuration: before.animationDuration,
        background: before.background.substring(0, 120),
        content: before.content,
        // 描边实测:hover 态默认 border 仍保留(渐变 ::before 是叠加层,不是替换)
        borderTopWidth: wrapCs.borderTopWidth,
        borderTopStyle: wrapCs.borderTopStyle,
        borderTopColor: wrapCs.borderTopColor,
      }
    })
    console.warn('\n[state 2: hover light]', JSON.stringify(data, null, 2))
    expect(data.opacity, 'hover 态 ::before opacity 应为 1').toBe('1')
    expect(data.animationPlayState, 'hover 态动画应 running').toBe('running')
    // 描边保持(hover 时 ::before 渐变叠加,但底层 border 不变)
    expect(data.borderTopWidth, 'hover 态 border-width 应仍为 1px').toBe('1px')
    expect(data.borderTopStyle, 'hover 态 border-style 应仍为 solid').toBe('solid')
    expect(
      data.borderTopColor,
      'hover 态 border-color 应仍为 rgb(229, 229, 229) (底层 1px 描边不因 hover 消失)',
    ).toBe('rgb(229, 229, 229)')
  })

  test('state 3: active/勾选态 — 隐私复选框', async ({ page }) => {
    await gotoAuthorize(page)

    // 勾选复选框
    const cb = page.locator(CHECKBOX).first()
    await cb.scrollIntoViewIfNeeded()
    await cb.click()
    await page.waitForTimeout(400)

    const dialog = page.locator(DIALOG).first()
    await dialog.screenshot({ path: path.join(SHOT_DIR, '03_agreed_light.png') })

    const data = await page.evaluate(() => {
      const cb = document.querySelector('label.group span[role="checkbox"]') as HTMLElement | null
      if (!cb) return { error: 'no cb' }
      const wraps = document.querySelectorAll('.input-gradient-wrap')
      return {
        ariaChecked: cb.getAttribute('aria-checked'),
        classes: cb.className,
        bg: getComputedStyle(cb).backgroundColor,
        borderColor: getComputedStyle(cb).borderColor,
        hasCheckIcon: !!cb.querySelector('svg'),
        checkIconStrokeWidth: (() => {
          const svg = cb.querySelector('svg')
          if (!svg) return null
          return svg.getAttribute('stroke-width')
        })(),
        // 登录按钮启用态
        loginBtn: (() => {
          const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null
          return btn ? { disabled: btn.disabled, text: btn.textContent?.trim() } : null
        })(),
        // 描边实测:勾选复选框后,输入框描边应保持(勾选是隐私复选框,不是输入框)
        gradientCount: wraps.length,
        wrapBorders: Array.from(wraps).map((g) => {
          const cs = getComputedStyle(g as HTMLElement)
          return {
            borderTopWidth: cs.borderTopWidth,
            borderTopStyle: cs.borderTopStyle,
            borderTopColor: cs.borderTopColor,
          }
        }),
      }
    })
    console.warn('\n[state 3: agreed light]', JSON.stringify(data, null, 2))
    expect(data.ariaChecked, '勾选后 aria-checked 应为 true').toBe('true')
    expect(data.hasCheckIcon, '勾选后应渲染 Check 图标').toBe(true)
    // 描边硬性证据(active 守门):勾选复选框后,输入框描边应保持
    expect(data.gradientCount, 'active 态 .input-gradient-wrap 数量应 ≥ 1').toBeGreaterThanOrEqual(
      1,
    )
    data.wrapBorders!.forEach((b, i) => {
      expect(b.borderTopWidth, `active wrap[${i}] border-width 应为 1px`).toBe('1px')
      expect(b.borderTopStyle, `active wrap[${i}] border-style 应为 solid`).toBe('solid')
      expect(
        b.borderTopColor,
        `active wrap[${i}] border-color 应仍为 rgb(229, 229, 229) (勾选复选框不影响输入框描边)`,
      ).toBe('rgb(229, 229, 229)')
    })
  })

  test('state 4: dark mode 态 — 主题切换 + welcome 图切换', async ({ page }) => {
    await gotoAuthorize(page)

    // 切 dark: 直接修改 html class + 触发 next-themes 同步
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    })
    // 也点 header 的深色模式按钮以触发 next-themes 状态更新
    const darkBtn = page.locator('button:has-text("深色模式")').first()
    if (await darkBtn.isVisible().catch(() => false)) {
      await darkBtn.click().catch(() => {})
    }
    await page.waitForTimeout(800)

    const dialog = page.locator(DIALOG).first()
    await dialog.screenshot({ path: path.join(SHOT_DIR, '04_dark_mode.png') })
    await page.screenshot({ path: path.join(SHOT_DIR, '04_dark_mode_full.png'), fullPage: false })

    const data = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      const welcomeLight = d?.querySelector('img.welcome-img') as HTMLImageElement | null
      const welcomeDark = d?.querySelector('img.welcome-img-dark') as HTMLImageElement | null
      const wraps = d?.querySelectorAll('.input-gradient-wrap') ?? []
      const wrap = wraps[0] as HTMLElement | undefined
      const isDark = document.documentElement.classList.contains('dark')
      return {
        isDark,
        welcome: {
          light: welcomeLight
            ? {
                display: getComputedStyle(welcomeLight).display,
                opacity: getComputedStyle(welcomeLight).opacity,
              }
            : null,
          dark: welcomeDark
            ? {
                display: getComputedStyle(welcomeDark).display,
                opacity: getComputedStyle(welcomeDark).opacity,
              }
            : null,
        },
        gradientBeforeOpacity: wrap ? getComputedStyle(wrap, '::before').opacity : null,
        // 描边实测:dark mode 描边色必须与 light 区分(用 --color-input 在 dark theme 下的值 = #383838 = rgb(56, 56, 56))
        gradientCount: wraps.length,
        wrapBorders: Array.from(wraps).map((g) => {
          const cs = getComputedStyle(g as HTMLElement)
          return {
            borderTopWidth: cs.borderTopWidth,
            borderTopStyle: cs.borderTopStyle,
            borderTopColor: cs.borderTopColor,
          }
        }),
      }
    })
    console.warn('\n[state 4: dark mode]', JSON.stringify(data, null, 2))
    expect(data.isDark, 'html.dark 应存在').toBe(true)
    // 描边硬性证据(dark mode 守门)
    expect(
      data.gradientCount,
      'dark mode 下 .input-gradient-wrap 数量应 ≥ 1',
    ).toBeGreaterThanOrEqual(1)
    data.wrapBorders!.forEach((b, i) => {
      expect(b.borderTopWidth, `dark wrap[${i}] border-width 应为 1px`).toBe('1px')
      expect(b.borderTopStyle, `dark wrap[${i}] border-style 应为 solid`).toBe('solid')
      expect(
        b.borderTopColor,
        `dark wrap[${i}] border-color 应为 #383838 dark 深灰 (守门: dark mode 描边色必须与 light 区分)`,
      ).toBe('rgb(56, 56, 56)')
    })
  })
})
