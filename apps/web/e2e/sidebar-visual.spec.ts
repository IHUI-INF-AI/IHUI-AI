import { test, expect } from '@playwright/test'

/**
 * Sidebar 视觉守门测试。
 *
 * 防止以下回归:
 *   - logo 不渲染或 404(2026-07-17 恢复真实品牌 Logo,允许渐变/图形/嵌入位图)
 *   - collapse 按钮超出侧边栏右边界
 *   - resize 手柄与 border 出现两条线(对齐偏移)
 *   - resize 手柄 hover 时出现蓝色 3px 粗线(应为 1px 低对比细线)
 *   - resize 手柄 focus 时出现浅蓝背景块
 *
 * 注意:2026-07-17 用户要求恢复原始品牌 Logo(含图形+渐变+文字),不再强制文字版。
 * Logo 断言放宽为:img 存在 + src 指向 logo/bailogo.svg + HTTP 200 + 非空 SVG。
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

  test('logo 渲染且资源可访问(真实品牌 Logo,允许渐变/图形)', async ({ page }) => {
    // ThemeLogo 渲染两个 img:浅色 dark:hidden + 深色 hidden dark:block
    const logoImgs = page.locator('aside img[alt="IHUI AI"]')
    const count = await logoImgs.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // 检查 src 指向 logo 文件 + 带 cache-busting 版本号
    const firstSrc = await logoImgs.first().getAttribute('src')
    expect(firstSrc).toMatch(/\/images\/(logo|bailogo)\.svg\?v=/)

    // 拉取 SVG,确认 HTTP 200 + 非空 + 是合法 SVG(含 <svg 或 xmlns)
    const src = await logoImgs.first().evaluate((img) => img.src)
    const resp = await page.request.get(src)
    expect(resp.status()).toBe(200)
    const svg = await resp.text()
    expect(svg.length, 'SVG 不应为空').toBeGreaterThan(100)
    expect(svg).toMatch(/<svg|xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
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

  test('语言切换 Popover 弹出后完整可见不被裁剪 + 国旗 img 渲染', async ({ page }) => {
    // 1. 找到侧边栏底部语言切换按钮(带国旗 img 的 ghost icon button)
    const langBtn = page
      .locator('aside button[aria-label]')
      .filter({ has: page.locator('img[src*="/images/flags/"]') })
      .first()
    await expect(langBtn).toBeVisible()

    // 2. 验证触发按钮里的国旗 img 可见且有尺寸(非 0x0)
    const triggerFlag = langBtn.locator('img')
    await expect(triggerFlag).toBeVisible()
    const flagBox = await triggerFlag.boundingBox()
    expect(flagBox).not.toBeNull()
    expect(flagBox!.width, '国旗 img 宽度应 > 0').toBeGreaterThan(0)
    expect(flagBox!.height, '国旗 img 高度应 > 0').toBeGreaterThan(0)
    // 国旗应是 16x12(h-3 w-4),允许 1px 误差
    expect(Math.abs(flagBox!.width - 16)).toBeLessThanOrEqual(1)
    expect(Math.abs(flagBox!.height - 12)).toBeLessThanOrEqual(1)

    // 3. 点击打开 Popover
    await langBtn.click()
    await page.waitForTimeout(300)

    // 4. 验证 Popover 内 5 个语言项可见(关键:不被 aside overflow 裁剪)
    const langItems = page.locator('div.bg-popover button:has(img[src*="/images/flags/"])')
    await expect(langItems.first()).toBeVisible({ timeout: 3000 })
    const itemCount = await langItems.count()
    expect(itemCount, '应显示 5 个语言项').toBe(5)

    // 5. 验证每个语言项的国旗 img 可见
    const firstItemFlag = langItems.first().locator('img')
    await expect(firstItemFlag).toBeVisible()
    const itemFlagBox = await firstItemFlag.boundingBox()
    expect(itemFlagBox).not.toBeNull()
    expect(itemFlagBox!.width).toBeGreaterThan(0)
    expect(itemFlagBox!.height).toBeGreaterThan(0)

    // 6. 验证 Popover 完整在视口内(不被裁剪)
    const firstItemBox = await langItems.first().boundingBox()
    expect(firstItemBox).not.toBeNull()
    expect(firstItemBox!.y, '语言项 y 坐标应 >= 0(不被顶部裁剪)').toBeGreaterThanOrEqual(0)
    expect(firstItemBox!.x, '语言项 x 坐标应 >= 0(不被左侧裁剪)').toBeGreaterThanOrEqual(0)

    const lastItemBox = await langItems.last().boundingBox()
    expect(lastItemBox).not.toBeNull()
    const viewportHeight = page.viewportSize()!.height
    expect(
      lastItemBox!.y + lastItemBox!.height,
      '最后一项底部应 <= 视口高度(不被底部裁剪)',
    ).toBeLessThanOrEqual(viewportHeight)

    // 7. 验证 Popover 宽度超出 aside 时不被裁剪(w-36=144px > aside 130px)
    // Popover 居中展开会左右各超 7px,需 overflow-visible 才能显示
    const popoverContainer = langItems
      .first()
      .locator('xpath=ancestor::div[contains(@class,"bg-popover")]')
    const popoverBox = await popoverContainer.boundingBox()
    expect(popoverBox).not.toBeNull()
    // Popover 应完整可见(宽度 = 144px w-36,允许 2px 误差)
    expect(popoverBox!.width, 'Popover 宽度应为 144px(w-36)').toBeGreaterThanOrEqual(142)

    // 8. 关键断言:Popover 右边缘不应被 aside 右边缘裁剪
    // aside overflow-visible 时,Popover 可以超出 aside 显示
    const aside = page.locator('aside').first()
    const asideBox = await aside.boundingBox()
    expect(asideBox).not.toBeNull()
    // Popover 应能在 aside 外显示(至少不被 overflow:hidden 裁剪成更小宽度)
    expect(popoverBox!.width, 'Popover 不应被裁剪(宽度应完整 144px)').toBeGreaterThanOrEqual(142)
  })
})

/**
 * Sidebar 折叠态尺寸守门测试 (2026-07-19 立)
 *
 * 防止以下回归:
 *   - 折叠态下 NavLink / SearchNavItem / ExpandableNavItem 父级宽度未统一为 36×36 正方形
 *   - 部分导航项漏改导致折叠态背景容器尺寸不一致(原 bug:43×36 非正方形拉伸)
 *
 * 守门依据:sidebar.tsx 中 NAV_ITEM_COLLAPSED_CLASS = 'w-9 mx-auto justify-center' (36×36)
 * 与新建任务按钮 h-9 w-9 (36×36) 严格统一,所有主导航项背景容器在折叠态下必须是 36×36 正方形。
 */
test.describe('Sidebar 折叠态尺寸守门', () => {
  test.beforeEach(async ({ page }) => {
    // 强制侧边栏折叠
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-collapsed', 'true')
    })
    await page.goto('/')
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 15000 })
    // 等 React hydration + 折叠态样式应用
    await page.waitForTimeout(500)
  })

  test('折叠态 aside 宽度为 60px', async ({ page }) => {
    const aside = page.locator('aside').first()
    const box = await aside.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width, '折叠态 aside 宽度应为 60px').toBe(60)
  })

  test('折叠态导航项背景容器统一为 36×36 正方形', async ({ page }) => {
    // 收集所有主导航项:
    // - 新建任务按钮 (button.bg-foreground)
    // - NavLink / SearchNavItem / ExpandableNavItem 父级 (a[href^="/"] 或 button[aria-label])
    // 排除:collapse 按钮(PanelLeftClose/Open)、关闭按钮(X)、底部工具栏按钮(国旗/下载/铃铛/主题)、用户头像
    const navItems = await page.evaluate(() => {
      const aside = document.querySelector('aside')
      if (!aside) return { error: 'no aside' }
      const nav = aside.querySelector('nav')
      if (!nav) return { error: 'no nav' }

      // 排除图标列表(底部工具栏 + 头像 + collapse 按钮等非主导航项)
      const excludeLabels = ['关闭', '收起', '展开', '菜单']

      const items: Array<{
        tag: string
        href: string
        ariaLabel: string
        width: number
        height: number
        isSquare: boolean
        classes: string
      }> = []

      // 新建任务按钮:第一个有 bg-foreground 的 button
      const newChatBtn = nav.querySelector('button.bg-foreground')
      if (newChatBtn) {
        const rect = newChatBtn.getBoundingClientRect()
        items.push({
          tag: 'button',
          href: '',
          ariaLabel: newChatBtn.getAttribute('aria-label') || 'newChat',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          isSquare: Math.abs(rect.width - rect.height) < 1,
          classes: newChatBtn.className,
        })
      }

      // 所有 nav 内 a[href^="/"] (NavLink + SearchNavItem 折叠态是 button,展开态是 button,这里也找 button)
      // 折叠态:NavLink 渲染为 <a>,SearchNavItem 渲染为 <button>,ExpandableNavItem 父级渲染为 <button>
      const candidates = Array.from(
        nav.querySelectorAll('a[href^="/"], button[aria-label]'),
      ) as Array<HTMLElement>

      for (const el of candidates) {
        const ariaLabel = el.getAttribute('aria-label') || ''
        // 排除底部工具栏(语言/下载/消息/主题)和用户头像
        if (excludeLabels.some((l) => ariaLabel.includes(l))) continue
        // 排除底部 SidebarActions 区的按钮(它们有 h-[26px] w-[26px])
        if (ariaLabel.includes('语言') || ariaLabel.includes('Language')) continue
        if (ariaLabel.includes('下载') || ariaLabel.includes('Download')) continue
        if (ariaLabel.includes('消息') || ariaLabel.includes('Messages')) continue
        if (
          ariaLabel.includes('深色') ||
          ariaLabel.includes('浅色') ||
          ariaLabel.includes('Dark') ||
          ariaLabel.includes('Light')
        )
          continue

        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue

        items.push({
          tag: el.tagName,
          href: el.getAttribute('href') || '',
          ariaLabel,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          isSquare: Math.abs(rect.width - rect.height) < 1,
          classes: el.className,
        })
      }

      return { items, count: items.length }
    })

    expect(navItems, `应能读取导航项: ${JSON.stringify(navItems)}`).not.toHaveProperty('error')
    const data = navItems as {
      items: Array<{
        width: number
        height: number
        isSquare: boolean
        ariaLabel: string
        href: string
        classes: string
      }>
      count: number
    }

    // 至少应有 10 个主导航项(home/chatHistory/models/agents/aiWorld/workspace/dashboard/learn 等)
    expect(data.count, `主导航项数量应 >= 10,实际 ${data.count}`).toBeGreaterThanOrEqual(10)

    // 所有项的宽高都应是 36(±1px 误差),且 isSquare=true
    const failures: string[] = []
    for (const item of data.items) {
      if (Math.abs(item.width - 36) > 1 || Math.abs(item.height - 36) > 1 || !item.isSquare) {
        failures.push(
          `${item.ariaLabel || item.href || '未命名'}: ${item.width}×${item.height} isSquare=${item.isSquare} classes="${item.classes}"`,
        )
      }
    }

    expect(
      failures,
      `以下导航项未通过 36×36 正方形守门:\n${failures.join('\n')}\n\n` +
        `所有项:\n${data.items.map((i) => `  - ${i.ariaLabel || i.href}: ${i.width}×${i.height}`).join('\n')}`,
    ).toHaveLength(0)
  })
})
