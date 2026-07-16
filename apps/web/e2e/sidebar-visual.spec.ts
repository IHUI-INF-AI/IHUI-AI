import { test, expect } from '@playwright/test'

/**
 * Sidebar 视觉守门测试。
 *
 * 防止以下回归(2026-07-16 修复的 4 类问题):
 *   - logo 紫色渐变铺满 header(旧 logo.svg 渐变溢出)
 *   - collapse 按钮超出侧边栏右边界
 *   - resize 手柄与 border 出现两条线(对齐偏移)
 *   - resize 手柄 hover 时出现蓝色 3px 粗线(应为 1px 低对比细线)
 *   - resize 手柄 focus 时出现浅蓝背景块
 *   - bailogo.svg 深色模式 logo 消失(currentColor 不继承)
 *
 * 这些都是视觉细节,容易在后续改动中被无意回退。用 boundingBox + computed style
 * 做像素级断言,防止回归。
 */
test.describe('Sidebar 视觉守门', () => {
  test.beforeEach(async ({ page }) => {
    // 强制侧边栏展开,避免 localStorage 残留收起态导致 resize 手柄未渲染
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-collapsed', 'false')
    })
    await page.goto('/')
    // 等侧边栏渲染完成
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 15000 })
  })

  test('logo 是 IHUI-AI 文字版(非紫色渐变旧 logo)', async ({ page }) => {
    // ThemeLogo 渲染两个 img:浅色 dark:hidden + 深色 hidden dark:block
    const logoImgs = page.locator('aside img[alt="IHUI AI"]')
    const count = await logoImgs.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // 检查 src 指向新 logo 文件 + 带 cache-busting 版本号
    const firstSrc = await logoImgs.first().getAttribute('src')
    expect(firstSrc).toMatch(/\/images\/(logo|bailogo)\.svg\?v=/)

    // 拉取 SVG 内容,确认是文字版(含 <text>IHUI-AI</text>),不是旧渐变(<linearGradient>)
    const src = await logoImgs.first().evaluate((img) => img.src)
    const resp = await page.request.get(src)
    const svg = await resp.text()
    expect(svg).toContain('IHUI-AI')
    expect(svg).toContain('<text')
    expect(svg).not.toMatch(/linearGradient|a78bfa|8b5cf6|6366f1/)
  })

  test('logo 浅色模式显式黑色 / 深色模式显式白色(非 currentColor)', async ({ page }) => {
    const logoImgs = page.locator('aside img[alt="IHUI AI"]')
    const count = await logoImgs.count()

    for (let i = 0; i < count; i++) {
      const src = await logoImgs.nth(i).evaluate((img) => img.src)
      const resp = await page.request.get(src)
      const svg = await resp.text()
      // 两个 SVG 都必须显式色(fill="#0a0a0a" 或 fill="#ffffff"),不能是 currentColor
      expect(svg).toMatch(/fill="#(0a0a0a|ffffff)"/)
      expect(svg).not.toMatch(/fill="currentColor"/)
    }
  })

  test('collapse 按钮不超出 aside 右边界', async ({ page }) => {
    const aside = page.locator('aside').first()
    const asideBox = await aside.boundingBox()
    expect(asideBox).not.toBeNull()

    // 找 collapse 按钮(带 PanelLeftClose/PanelLeftOpen 图标的 ghost button)
    // 用 aria-label 更稳:i18n key 是 nav:collapse/expand
    const collapseBtn = page
      .locator('aside button[aria-label]')
      .filter({
        has: page.locator('svg.lucide-panel-left-close, svg.lucide-panel-left-open'),
      })
      .first()

    // 如果侧边栏是收起态,按钮可能是 open 图标;展开态是 close 图标
    const btnVisible = await collapseBtn.isVisible().catch(() => false)
    if (!btnVisible) {
      // 移动端可能隐藏,跳过
      test.skip(true, 'collapse 按钮不可见(可能移动端视图)')
      return
    }

    const btnBox = await collapseBtn.boundingBox()
    expect(btnBox).not.toBeNull()

    // 按钮右边缘必须 ≤ aside 右边缘(允许 1px 误差,因 border)
    const asideRight = asideBox!.x + asideBox!.width
    const btnRight = btnBox!.x + btnBox!.width
    expect(btnRight).toBeLessThanOrEqual(asideRight + 1)

    // 按钮右边缘到 aside 右边缘至少有 15px 间隙(pr-5 = 20px padding,减去按钮自身宽度后应有余量)
    const gap = asideRight - btnRight
    expect(gap).toBeGreaterThanOrEqual(15)
  })

  test('resize 手柄存在且默认无背景色(透明)', async ({ page }) => {
    const handle = page.locator('aside [role="slider"]').first()
    await expect(handle).toBeVisible()

    // 默认状态:内层 1px 细线背景透明
    const innerLine = handle.locator('div').first()
    const bg = await innerLine.evaluate((el) => getComputedStyle(el).backgroundColor)
    // 透明 = rgba(0, 0, 0, 0) 或 rgb(0 0 0 / 0)
    expect(bg).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|rgba?\(0\s+0\s+0\s+\/\s*0\)/)

    // 确认没有 bg-primary(蓝色 #3b82f6 / rgb(59, 130, 246))
    expect(bg).not.toMatch(/59,\s*130,\s*246|59\s+130\s+246/)
  })

  test('resize 手柄 hover 时显示低对比细线(非蓝色粗线)', async ({ page }) => {
    const handle = page.locator('aside [role="slider"]').first()
    const innerLine = handle.locator('div').first()

    // hover 手柄
    await handle.hover()

    // 等 CSS 过渡完成(transition-colors duration-200)
    await page.waitForTimeout(300)

    const bg = await innerLine.evaluate((el) => getComputedStyle(el).backgroundColor)
    // hover 态应该是 bg-border(低对比灰色),不是 bg-primary(蓝色)
    // border token 浅色 #e9e9e9 = rgb(233, 233, 233),暗色 #2e2e2e = rgb(46, 46, 46)
    // 排除蓝色 rgb(59, 130, 246)
    expect(bg).not.toMatch(/59,\s*130,\s*246|59\s+130\s+246/)

    // 应该是某种灰色(非透明,非蓝色)
    expect(bg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|rgba?\(0\s+0\s+0\s+\/\s*0\)/)
  })

  test('resize 手柄 focus 时不出现浅蓝背景块', async ({ page }) => {
    const handle = page.locator('aside [role="slider"]').first()

    // 键盘 Tab 聚焦手柄
    await handle.focus()

    // 等 focus-visible 样式应用
    await page.waitForTimeout(100)

    // 检查手柄容器自身的 background-color(不是内层细线)
    const bg = await handle.evaluate((el) => getComputedStyle(el).backgroundColor)
    // 不应该有 bg-primary/10(蓝色 10% 透明 = rgba(59, 130, 246, 0.1))
    expect(bg).not.toMatch(/59,\s*130,\s*246|59\s+130\s+246/)
  })

  test('resize 手柄与 aside border 右边缘对齐(无两条线)', async ({ page }) => {
    const aside = page.locator('aside').first()
    const handle = page.locator('aside [role="slider"]').first()
    const innerLine = handle.locator('div').first()

    const asideBox = await aside.boundingBox()
    const lineBox = await innerLine.boundingBox()

    expect(asideBox).not.toBeNull()
    expect(lineBox).not.toBeNull()

    // 内层细线右边缘应与 aside 右边缘对齐(允许 2px 误差,因 right-[-1px] 叠在 border 上)
    const asideRight = asideBox!.x + asideBox!.width
    const lineRight = lineBox!.x + lineBox!.width
    expect(Math.abs(asideRight - lineRight)).toBeLessThanOrEqual(2)

    // 内层细线宽度应是 1px(w-px),不是 3px(旧的 hover:w-[3px])
    expect(lineBox!.width).toBeLessThanOrEqual(2)
  })
})
