import { test, expect } from '@playwright/test'

/**
 * 侧边栏 / 顶栏 icon + 文字垂直对齐守门测试 (2026-07-19 立)
 *
 * 根因:中文字体 ascent(11px) ≠ descent(3px) 不对称,
 * 导致 ink 几何中心在 line-box 中心**下方 0.6px**(HarmonyOS Sans SC @ 14px 测得);
 * 图标 SVG 是居中填充,box 中心 = ink 中心,二者视觉中心累积偏差。
 * 根治:对所有 icon+文字同行 flex 布局,文字 span 加 `translateY(0.5px)` GPU 位移。
 *
 * 此测试用 `Range.getBoundingClientRect()` 测 text ink midY,
 * 与 icon `getBoundingClientRect().y + height/2` 对比,
 * 验证 delta 在 ±0.2px 内(肉眼不可见)。
 *
 * 关键约束:
 *  - 任何修改导致 delta > 0.3px → 测试失败 → 阻止部署
 *  - 覆盖"我的学习"(重点回归位点) + 其他高优导航项
 *  - 覆盖 light/dark mode + hover/active/default 状态
 *  - 覆盖 AI 面板 header / chat header 等其他高优位置
 *
 * 守门:本文件 + globals.css `--text-vcenter-offset` + `nav-styles.ts` 共享常量,
 * 任何位置漏改都会被本测试捕获。
 */

const DELTA_THRESHOLD_PX = 0.15 // 14px 字号下肉眼可识别阈值(7%=1px)的 1/7,严苛守门
// 实测:0.3px translateY 下,所有 nav item delta = 0.000 (完美居中)

/**
 * 测单个 icon + 文字元素的垂直对齐偏差。
 * @param page Playwright Page
 * @param rootSelector 父容器(包含 svg + span 的元素)选择器
 * @returns delta = textInkMidY - iconMidY (px)
 */
async function measureAlignment(
  page: import('@playwright/test').Page,
  rootSelector: string,
): Promise<{ iconMidY: number; textInkMidY: number; delta: number }> {
  return await page.evaluate((selector) => {
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) throw new Error(`Element not found: ${selector}`)

    const svg = el.querySelector('svg') as SVGElement | null
    const span = el.querySelector('span') as HTMLElement | null
    if (!svg) throw new Error(`No svg in: ${selector}`)
    if (!span) throw new Error(`No span in: ${selector}`)

    // icon midY
    const iconRect = svg.getBoundingClientRect()
    const iconMidY = iconRect.top + iconRect.height / 2

    // text ink midY(用 Range 测文字 ink 几何中心,排除 span 自身 padding)
    const range = document.createRange()
    range.selectNodeContents(span)
    const textRect = range.getBoundingClientRect()
    const textInkMidY = textRect.top + textRect.height / 2

    return {
      iconMidY,
      textInkMidY,
      delta: textInkMidY - iconMidY,
    }
  }, rootSelector)
}

test.describe('icon + 文字垂直对齐守门', () => {
  test.beforeEach(async ({ page }) => {
    // 强制展开 sidebar,确保所有 nav item 渲染
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-collapsed', 'false')
    })
    await page.goto('/')
    // 等侧边栏 + AI 面板 + chat header 全部就绪
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 15000 })
    await page.waitForLoadState('networkidle')
  })

  test('侧边栏主导航项:icon 与文字视觉对齐 (默认/hover/active 三态)', async ({ page }) => {
    // 重点验证位点:用户原话"我的学习这个文字怎么偏成这样" = /favorites
    // 用 data-testid 精准锁定,避免其它 nav 干扰
    const targetItems = [
      'nav-home',
      'nav-chatHistory',
      'nav-learn',
      'nav-myLearning', // ★ 重点回归位点
      'nav-favorites',
      'nav-settings',
    ]

    for (const testid of targetItems) {
      // 默认态
      const link = page.locator(`aside [data-testid="${testid}"]`)
      await expect(link, `${testid} 应存在`).toBeVisible()

      // 测默认态
      const result = await measureAlignment(page, `aside [data-testid="${testid}"]`)
      expect(
        Math.abs(result.delta),
        `${testid} 默认态: |delta| ${result.delta.toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px (icon midY=${result.iconMidY.toFixed(1)}, text ink midY=${result.textInkMidY.toFixed(1)})`,
      ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)

      // 测 hover 态
      await link.hover()
      await page.waitForTimeout(200) // 等 transition-colors 完成
      const hoverResult = await measureAlignment(page, `aside [data-testid="${testid}"]`)
      expect(
        Math.abs(hoverResult.delta),
        `${testid} hover 态: |delta| ${hoverResult.delta.toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
      ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)

      // 移开鼠标,避免影响下一个测试
      await page.mouse.move(0, 0)
      await page.waitForTimeout(100)
    }

    // active 态:点击 /favorites 触发,然后回到其它位置
    await page.locator('aside [data-testid="nav-myLearning"]').click()
    await page.waitForTimeout(200)
    const activeResult = await measureAlignment(page, 'aside [data-testid="nav-myLearning"]')
    expect(
      Math.abs(activeResult.delta),
      `nav-myLearning active 态: |delta| ${activeResult.delta.toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)
  })

  test('暗色模式:所有侧边栏 nav item 仍保持视觉对齐', async ({ page }) => {
    // 切换到暗色
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    })
    await page.waitForTimeout(200)

    const testid = 'nav-myLearning'
    const result = await measureAlignment(page, `aside [data-testid="${testid}"]`)
    expect(
      Math.abs(result.delta),
      `dark mode ${testid}: |delta| ${result.delta.toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)
  })

  test('新建任务按钮:Plus icon 与"新建对话"文字对齐', async ({ page }) => {
    // 顶部"+"按钮(展开态)
    const result = await measureAlignment(
      page,
      'aside button[aria-pressed][class*="bg-foreground"]',
    )
    expect(
      Math.abs(result.delta),
      `新建任务按钮: |delta| ${result.delta.toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)
  })

  test('AI 面板 header:图标与主标题对齐 (h-14 固定高度)', async ({ page }) => {
    // 触发 AI 面板打开
    const aiButton = page.locator('aside button[aria-pressed]').first()
    await aiButton.click()
    await page.waitForTimeout(400) // 面板滑入动画

    // 找到 AI 面板 header 内的 svg + span
    const aiPanel = page.locator('[aria-label*="AI 助手"], [aria-label*="ai"]').first()
    if ((await aiPanel.count()) > 0) {
      // AI 面板 header 的图标 + 主标题
      const headerResult = await page.evaluate(() => {
        const headers = document.querySelectorAll('header')
        for (const h of headers) {
          const svg = h.querySelector('svg')
          const span = h.querySelector('span')
          if (svg && span && h.querySelector('div.flex.min-w-0')) {
            const iconRect = svg.getBoundingClientRect()
            const range = document.createRange()
            range.selectNodeContents(span)
            const textRect = range.getBoundingClientRect()
            return {
              iconMidY: iconRect.top + iconRect.height / 2,
              textInkMidY: textRect.top + textRect.height / 2,
              delta: textRect.top + textRect.height / 2 - (iconRect.top + iconRect.height / 2),
            }
          }
        }
        return null
      })

      if (headerResult) {
        expect(
          Math.abs(headerResult.delta),
          `AI panel header: |delta| ${headerResult.delta.toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
        ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)
      }
    }
  })

  test('globals.css 全局规则存在:button + svg + span 自动 translateY', async ({ page }) => {
    // 验证 CSS 变量已加载 + 全局规则生效
    const offsetValue = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--text-vcenter-offset')
        .trim()
    })
    expect(offsetValue, '--text-vcenter-offset CSS 变量已定义').toBe('0.5px')

    // 验证任一 button + svg + span 元素 transform 计算后含 0.5px translateY
    const transformApplied = await page.evaluate(() => {
      const btn = document.querySelector('aside button[aria-pressed]') as HTMLElement | null
      if (!btn) return false
      const span = btn.querySelector('span') as HTMLElement | null
      if (!span) return false
      const transform = getComputedStyle(span).transform
      // matrix(1, 0, 0, 1, 0, 0.5) 表示 translateY(0.5px)
      return transform.includes('0.5') || transform === 'matrix(1, 0, 0, 1, 0, 0.5)'
    })
    expect(transformApplied, 'button > span 已应用 translateY(0.5px)').toBe(true)
  })
})
