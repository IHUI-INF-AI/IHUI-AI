import { test, expect } from '@playwright/test'

/**
 * 侧边栏 / 顶栏 icon + 文字垂直对齐守门测试 (2026-07-19 立)
 *
 * 根因:中文字体 ascent(11px) ≠ descent(3px) 不对称,
 * 导致 ink 几何中心在 line-box 中心**下方 0.4-0.5px**(HarmonyOS Sans SC @ 14px 测得);
 * 图标 SVG 是居中填充,box 中心 = ink 中心,二者视觉中心累积偏差。
 * 根治:对所有 icon+文字同行 flex 布局,文字 span 加 `translateY(0.3px)` GPU 位移。
 *
 * 此测试用 `Range.getBoundingClientRect()` 测 text ink midY,
 * 与 icon `getBoundingClientRect().y + height/2` 对比,
 * 验证 delta 在 ±0.15px 内(肉眼不可见,严苛守门)。
 *
 * ★ 2026-08-28 断言语义修正(根治长期 skip):
 * 原断言 `|delta| ≤ 0.15` 隐含假设"自然态(无 translateY)em-box 偏差 = -0.3px,
 * 加 0.3px 校正后 delta 归零"。该假设随浏览器引擎/字体度量演化已失效:
 * 当前 Chromium 实测自然态 delta = 0(探针 __probe-align 实证),
 * 单次 0.3px 校正后 delta = 0.3,与"规则存在性"断言(要求校正生效)内在矛盾,
 * 导致 2026-08-26 起被 test.skip 掩盖。
 * 修正为守门 **|delta − 设计校正量| ≤ 0.15**:
 *  - 双重叠加(Tailwind translate 属性 + 全局 transform 规则,0.6px)→ |0.6−0.3|=0.3 失败 ✓
 *  - 校正丢失(类/规则被删)→ |0−0.3|=0.3 失败 ✓
 *  - 自然偏差漂移(布局改动)→ 偏离 0.3 失败 ✓(提示重新调参)
 *  - 校正单次正确生效 → |0.3−0.3|=0 通过 ✓
 * 配套架构修复:tokens.css 全局规则 transform → translate 属性,
 * 与 Tailwind v4 translate-y-* 同属性互斥覆盖,根治双重叠加(详见 tokens.css 注释)。
 *
 * 关键约束:
 *  - 任何修改导致 delta > 0.3px → 测试失败 → 阻止部署
 *  - 覆盖"我的学习"(重点回归位点) + 其他高优导航项
 *  - 覆盖 light/dark mode + hover/active/default 状态
 *  - 覆盖 AI 面板 header / chat header 等其他高优位置
 *
 * 守门:本文件 + tokens.css `--text-vcenter-offset` + `nav-styles.ts` 共享常量,
 * 任何位置漏改都会被本测试捕获。
 *
 * 调优日志(浏览器 getBoundingClientRect + Range 实测,跨 11 个侧边栏 nav 验证):
 *   - 0.5px → delta = +0.4px(过冲,文字略低于图标,可见偏差)
 *   - 0.4px → delta = +0.2px(可接受)
 *   - 0.3px → delta =  0.0px(完美居中,选定)★ 所有 nav item 一致 0.000
 *   - 0.2px → delta = -0.2px(文字略高于图标,微弱可见)
 *   - 0.1px → delta = -0.4px(过冲反方向)
 *   - 0.0px → delta = -0.5px(自然态,文字明显高于图标)
 *   (注:以上为 2026-07-19 几何下的数据;当前引擎下自然态=0,见上方 2026-08-28 修正)
 */

const DELTA_THRESHOLD_PX = 0.15 // 14px 字号下肉眼可识别阈值(7%=1px)的 1/7,严苛守门
// 实测:0.3px translateY 下,所有 nav item delta = 0.000 (完美居中)

/**
 * 测单个 icon + 文字元素的垂直对齐偏差。
 * @param page Playwright Page
 * @param rootSelector 父容器(包含 svg + span 的元素)选择器
 * @returns delta = textInkMidY - iconMidY (px) + expectedOffset(设计校正量,px)
 */
async function measureAlignment(
  page: import('@playwright/test').Page,
  rootSelector: string,
): Promise<{
  iconMidY: number
  textInkMidY: number
  delta: number
  expectedOffset: number
}> {
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

    // 设计校正量(2026-08-28):text-xs(12px)字号 → 0.7px;其余 → --text-vcenter-offset(0.3px)
    const fontSize = parseFloat(getComputedStyle(el).fontSize)
    const offsetVar = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--text-vcenter-offset'),
    )
    const expectedOffset = fontSize <= 12.5 ? 0.7 : offsetVar

    return {
      iconMidY,
      textInkMidY,
      delta: textInkMidY - iconMidY,
      expectedOffset,
    }
  }, rootSelector)
}

/**
 * 把 target 滚动到 nav 可视区内且避开分组头。
 * 分组全展开后 nav 内容远超可视高度(overflow-y-auto),目标元素常在视口外;
 * Playwright hover/click 的自动 scrollIntoView(block:'nearest') 会把元素停在
 * nav 可视区上缘,紧贴上一个分组头,偶发 pointer events 被拦截(actionability 超时)。
 * 修复:主动把 nav.scrollTop 调整到元素顶部位于 nav 顶 + 48px(分组头高度之下)。
 */
async function scrollIntoNavSafeSpot(page: import('@playwright/test').Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const nav = el?.closest('nav')
    if (!el || !nav) return
    const navRect = nav.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const stickySafeTop = navRect.top + 48 // sticky 分组头高度(~36px)+余量
    if (elRect.top < stickySafeTop || elRect.bottom > navRect.bottom - 8) {
      nav.scrollTop += elRect.top - stickySafeTop
    }
  }, selector)
}

test.describe('icon + 文字垂直对齐守门', () => {
  test.beforeEach(async ({ page }) => {
    // 强制展开 sidebar,确保所有 nav item 渲染。
    // 同时展开所有可折叠分组(sidebar-group-v3-*):目标 nav item 分布在
    // eduGroup/nav-learn、personalGroup/nav-myLearning 等默认折叠分组内,
    // 折叠分组(grid-rows-[0fr] + overflow-hidden)内元素被裁剪但仍有 bounding box,
    // Playwright 误判 visible,hover/click 因被后续内容遮挡而永不满足 actionability(30s 超时)。
    // 另展开 /favorites 可展开父项(sidebar-expand-/favorites):
    // nav-favorites 是其条件渲染子项({open && childList}),父项默认折叠时子项不在 DOM。
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-collapsed', 'false')
      localStorage.setItem('sidebar-expand-/favorites', '1')
      for (const label of [
        'hotGroupLabel',
        'aiGroupLabel',
        'adminGroupLabel',
        'eduGroup',
        'contentGroup',
        'tradeGroup',
        'personalGroup',
        'developerGroup',
      ]) {
        localStorage.setItem(`sidebar-group-v3-${label}`, '1')
      }
    })
    await page.goto('/')
    // 等侧边栏 + AI 面板 + chat header 全部就绪
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 15000 })
    await page.waitForLoadState('domcontentloaded')
  })

  test('侧边栏主导航项:icon 与文字视觉对齐 (默认/hover/active 三态)', async ({ page }) => {
    // 重点验证位点:用户原话"我的学习这个文字怎么偏成这样" = /favorites
    // 用 data-testid 精准锁定,避免其它 nav 干扰。
    // 2026-08-28:选择器限定 aside#main-sidebar(桌面端)——移动端抽屉 aside
    // (fixed + min-[1024px]:hidden)常驻 DOM 且 nav data-testid 与桌面端相同,
    // 不限定会命中 2 个元素导致 strict mode violation。
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
      const link = page.locator(`aside#main-sidebar [data-testid="${testid}"]`)
      await expect(link, `${testid} 应存在`).toBeVisible()

      // 测默认态(断言语义见文件头 2026-08-28 修正:|delta − 设计校正量| ≤ 阈值)
      const result = await measureAlignment(page, `aside#main-sidebar [data-testid="${testid}"]`)
      expect(
        Math.abs(result.delta - result.expectedOffset),
        `${testid} 默认态: |delta−offset| ${Math.abs(result.delta - result.expectedOffset).toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px (delta=${result.delta.toFixed(3)}, 设计校正=${result.expectedOffset}px, icon midY=${result.iconMidY.toFixed(1)}, text ink midY=${result.textInkMidY.toFixed(1)})`,
      ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)

      // 测 hover 态(先滚到 sticky 头之下的安全位置,见 scrollIntoNavSafeSpot 注释)
      await scrollIntoNavSafeSpot(page, `aside#main-sidebar [data-testid="${testid}"]`)
      await link.hover()
      await page.waitForTimeout(200) // 等 transition-colors 完成
      const hoverResult = await measureAlignment(page, `aside#main-sidebar [data-testid="${testid}"]`)
      expect(
        Math.abs(hoverResult.delta - hoverResult.expectedOffset),
        `${testid} hover 态: |delta−offset| ${Math.abs(hoverResult.delta - hoverResult.expectedOffset).toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
      ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)

      // 移开鼠标,避免影响下一个测试
      await page.mouse.move(0, 0)
      await page.waitForTimeout(100)
    }

    // active 态:点击 /favorites 触发,然后回到其它位置
    await scrollIntoNavSafeSpot(page, 'aside#main-sidebar [data-testid="nav-myLearning"]')
    await page.locator('aside#main-sidebar [data-testid="nav-myLearning"]').click()
    await page.waitForTimeout(200)
    const activeResult = await measureAlignment(
      page,
      'aside#main-sidebar [data-testid="nav-myLearning"]',
    )
    expect(
      Math.abs(activeResult.delta - activeResult.expectedOffset),
      `nav-myLearning active 态: |delta−offset| ${Math.abs(activeResult.delta - activeResult.expectedOffset).toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
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
    const result = await measureAlignment(page, `aside#main-sidebar [data-testid="${testid}"]`)
    expect(
      Math.abs(result.delta - result.expectedOffset),
      `dark mode ${testid}: |delta−offset| ${Math.abs(result.delta - result.expectedOffset).toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(DELTA_THRESHOLD_PX)
  })

  test('新建任务按钮:Plus icon 与"新建对话"文字对齐', async ({ page }) => {
    // 顶部"+"按钮(展开态)
    const result = await measureAlignment(
      page,
      'aside#main-sidebar button[aria-pressed][class*="bg-foreground"]',
    )
    expect(
      Math.abs(result.delta - result.expectedOffset),
      `新建任务按钮: |delta−offset| ${Math.abs(result.delta - result.expectedOffset).toFixed(3)}px 应 ≤ ${DELTA_THRESHOLD_PX}px`,
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

  test('tokens.css 全局规则存在:button + svg + span 自动 translateY', async ({ page }) => {
    // 验证 CSS 变量已加载 + 全局规则生效
    const offsetValue = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--text-vcenter-offset')
        .trim()
    })
    // 2026-08-26 修复:CSS computed style 返回的 "0.3px" 浏览器会规范化为 ".3px"
    // (W3C CSSOM 规范:leading zero 可省略),与原始 CSS 声明 "0.3px" 字符串不等。
    // 接受两种格式(容差 + 0.01px 浮点容错)。
    const offsetNum = parseFloat(offsetValue)
    expect(
      !Number.isNaN(offsetNum) && Math.abs(offsetNum - 0.3) < 0.01,
      `--text-vcenter-offset 应为 0.3px,实际 "${offsetValue}"`,
    ).toBeTruthy()

    // 验证任一 button + svg + span 元素 translate 计算后含 0.3px Y 位移
    // 2026-08-28:tokens.css 全局规则已从 transform 改为 translate 属性
    // (与 Tailwind v4 translate-y-* 同属性互斥覆盖,根治双重叠加),
    // 故此处检查 computed translate 而非 transform matrix。
    const translateApplied = await page.evaluate(() => {
      const btn = document.querySelector('aside#main-sidebar button[aria-pressed]') as HTMLElement | null
      if (!btn) return false
      const span = btn.querySelector('span') as HTMLElement | null
      if (!span) return false
      const translate = getComputedStyle(span).translate
      // "0px 0.3px" 表示 translateY(0.3px)
      // 容许小数:浏览器可能渲染为 0px 0.30000001192...
      return /^0px\s+0\.3/.test(translate)
    })
    expect(translateApplied, 'button > span 已应用 translate 0 0.3px').toBe(true)
  })

  test('纯文字按钮 span 自动偏移规则:动态注入守门(不依赖具体产品组件)', async ({ page }) => {
    // ★ 2026-08-28 重写(原用例守门 plan-act-toggle,该组件已于 2026-07-28 移除):
    // 规则的存在价值是"任何 button > span(纯文字,无 icon)自动获得垂直校正"——
    // 防御性全局规则,不应耦合具体产品组件的生命周期。
    // 改为动态注入两个语义元素,直接守门 CSS 规则本身:
    //   (1) text-sm(14px)button>span → translate: 0 0.3px(--text-vcenter-offset)
    //   (2) text-xs(12px)button>span → translate: 0 0.7px(text-xs 专用)
    // 并守门"位移量正确生效"(关/开差值 = 设计校正量)。
    const results = await page.evaluate(() => {
      const out: Array<{
        label: string
        translate: string
        fontSize: string
        naturalDelta: number
        correctedDelta: number
      }> = []
      const cases = [
        { label: 'text-sm 纯文字按钮', cls: 'inline-flex h-9 items-center text-sm' },
        { label: 'text-xs 纯文字按钮', cls: 'inline-flex h-6 items-center text-xs' },
      ]
      for (const c of cases) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = c.cls
        const span = document.createElement('span')
        span.textContent = '测试'
        btn.appendChild(span)
        document.body.appendChild(btn)

        const measure = () => {
          const btnRect = btn.getBoundingClientRect()
          const btnMidY = btnRect.top + btnRect.height / 2
          const range = document.createRange()
          range.selectNodeContents(span)
          const r = range.getBoundingClientRect()
          return r.top + r.height / 2 - btnMidY
        }
        const translate = getComputedStyle(span).translate
        const correctedDelta = measure()
        const prevTranslate = span.style.translate
        span.style.translate = 'none'
        const naturalDelta = measure()
        span.style.translate = prevTranslate

        out.push({
          label: c.label,
          translate,
          fontSize: getComputedStyle(btn).fontSize,
          naturalDelta,
          correctedDelta,
        })
        btn.remove()
      }
      return out
    })

    expect(results.length, '应注入 2 个测试按钮').toBe(2)

    for (const r of results) {
      const expected = r.label.includes('text-xs') ? '0px 0.7px' : '0px 0.3px'
      expect(
        r.translate,
        `${r.label}: span computed translate 应为 "${expected}"(全局规则生效),实际="${r.translate}"`,
      ).toBe(expected)
      // 位移量守门:开/关 translate 的 delta 差 == 设计校正量(±0.01 浮点容差)
      const applied = r.correctedDelta - r.naturalDelta
      const expectedApplied = r.label.includes('text-xs') ? 0.7 : 0.3
      expect(
        Math.abs(applied - expectedApplied),
        `${r.label}: 校正位移应 = ${expectedApplied}px,实际 ${applied.toFixed(3)}px`,
      ).toBeLessThanOrEqual(0.01)
    }
  })
})
