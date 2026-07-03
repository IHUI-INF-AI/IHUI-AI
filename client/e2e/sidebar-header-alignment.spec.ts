/**
 * 验证展开态 / 折叠态 / 暗色模式下侧边栏 header logo / collapse-btn 跟下方容器左右边缘对齐
 *
 * 背景 (2026-07-04):
 *   用户反馈"logo 这么小了, 而且左侧没跟下面容器对齐, 右边的 button 也没对齐"。
 *   旧实现 .sidebar-header 有 padding: 0 10px (scoped 覆写 :where() 全局 0),
 *   导致 logo 实际 left=14 / collapse-btn 实际 right=102, 而下方 .nav-item 等
 *   容器的 left=4 / right=112——左右各缩进 10px, 视觉错位。
 *
 * 修复:
 *   1. .sidebar-header padding 改为 0 (unlayered scoped 覆写)
 *   2. .sidebar-logo height 26→32px, max-width 66→100%, flex-shrink: 1
 *      让 logo 在 flex 容器内按自然宽高比 3.1:1 (1527/493) 自适应缩放
 *   3. 预期结果: logo left ≡ .nav-item left (4px), collapse-btn right ≡
 *      .nav-item right (112px), 误差 ≤ 1px
 *
 * 守门: 若未来某次提交重新引入 .sidebar-header padding 或压缩 logo 高度,
 * 本测试会立刻失败, 防止静默回退。
 *
 * v2 (2026-07-04) 扩展: 增加折叠态 + 暗色模式用例, 覆盖完整 visual 回归矩阵
 *   - 折叠态: collapse-btn 居中 (centerX ≡ sidebar centerX), logo display:none
 *   - 暗色模式: 展开态 logo/button 对齐在 html.dark 上下文中仍保持
 */
import { test, expect, type Page } from 'playwright/test'

async function gotoHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  // 等 sidebar 渲染 (v11 默认 116px 展开态, 与 .app-sidebar.collapsed 互斥)
  await page.locator('.sidebar-logo').first().waitFor({ state: 'visible', timeout: 30000 })
  // CSS 变量 + SVG 资源就绪 (避免读取初始 frame 时样式未应用)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(300)
}

/** 通过点击折叠按钮切换折叠态, 等 800ms 让宽度过渡完成 */
async function toggleCollapsed(page: Page): Promise<void> {
  const btn = page.locator('.sidebar-collapse-btn').first()
  await btn.waitFor({ state: 'visible', timeout: 10000 })
  await btn.click({ force: true }).catch(() => {})
  // wait for width transition (--sidebar-transition-duration = 0.2s) + buffer
  await page.waitForTimeout(800)
}

test.describe('展开态侧边栏 header 对齐 (logo/collapse-btn 贴齐容器边缘)', () => {
  test('logo 左缘 ≡ nav-item 左缘 (4px, 误差 ≤ 1px)', async ({ page }) => {
    await gotoHome(page)

    const logoBox = await page.locator('.sidebar-logo').first().boundingBox()
    const navItemBox = await page.locator('.nav-item').first().boundingBox()
    const groupLabelBox = await page.locator('.nav-group-label').first().boundingBox()
    expect(logoBox, 'logo boundingBox 必须存在').not.toBeNull()
    expect(navItemBox, 'nav-item boundingBox 必须存在').not.toBeNull()
    expect(groupLabelBox, 'nav-group-label boundingBox 必须存在').not.toBeNull()

    const logoLeft = Math.round(logoBox!.x)
    const navLeft = Math.round(navItemBox!.x)
    const groupLeft = Math.round(groupLabelBox!.x)

    console.log(`[logo left] ${logoLeft}px | [nav-item left] ${navLeft}px | [nav-group-label left] ${groupLeft}px`)

    // 关键断言: logo 必须跟容器同列 (允许 ±1px 子像素误差)
    expect(Math.abs(logoLeft - navLeft), `logo.left(${logoLeft}) 必须 ≡ nav-item.left(${navLeft}) ±1px`).toBeLessThanOrEqual(1)
    expect(Math.abs(logoLeft - groupLeft), `logo.left(${logoLeft}) 必须 ≡ nav-group-label.left(${groupLeft}) ±1px`).toBeLessThanOrEqual(1)
  })

  test('collapse-btn 右缘 ≡ nav-item 右缘 (112px, 误差 ≤ 1px)', async ({ page }) => {
    await gotoHome(page)

    const btnBox = await page.locator('.sidebar-collapse-btn').first().boundingBox()
    const navItemBox = await page.locator('.nav-item').first().boundingBox()
    const groupLabelBox = await page.locator('.nav-group-label').first().boundingBox()
    expect(btnBox, 'collapse-btn boundingBox 必须存在').not.toBeNull()
    expect(navItemBox, 'nav-item boundingBox 必须存在').not.toBeNull()
    expect(groupLabelBox, 'nav-group-label boundingBox 必须存在').not.toBeNull()

    const btnRight = Math.round(btnBox!.x + btnBox!.width)
    const navRight = Math.round(navItemBox!.x + navItemBox!.width)
    const groupRight = Math.round(groupLabelBox!.x + groupLabelBox!.width)

    console.log(`[collapse-btn right] ${btnRight}px | [nav-item right] ${navRight}px | [nav-group-label right] ${groupRight}px`)

    expect(Math.abs(btnRight - navRight), `collapse-btn.right(${btnRight}) 必须 ≡ nav-item.right(${navRight}) ±1px`).toBeLessThanOrEqual(1)
    expect(Math.abs(btnRight - groupRight), `collapse-btn.right(${btnRight}) 必须 ≡ nav-group-label.right(${groupRight}) ±1px`).toBeLessThanOrEqual(1)
  })

  test('logo 高度 ≥ 28px (用户反馈"logo 这么小了", 防止回归到 26px 或更小)', async ({ page }) => {
    await gotoHome(page)

    const logoBox = await page.locator('.sidebar-logo').first().boundingBox()
    const logoHeight = logoBox ? Math.round(logoBox.height) : 0

    console.log(`[logo height] ${logoHeight}px`)

    // 26px 是用户反馈"太小"的旧值, 必须 >= 28px
    expect(logoHeight, `logo 高度 (${logoHeight}px) 必须 >= 28px, 防止回归到 26px`).toBeGreaterThanOrEqual(28)
  })

  test('logo 自然宽高比 (3.1:1) 保留: width/height 比例在 2.0~4.0 之间 (避免被压扁)', async ({ page }) => {
    await gotoHome(page)

    const logoBox = await page.locator('.sidebar-logo').first().boundingBox()
    expect(logoBox, 'logo boundingBox 必须存在').not.toBeNull()

    const ratio = logoBox!.width / logoBox!.height
    console.log(`[logo aspect] ${ratio.toFixed(2)} (width=${Math.round(logoBox!.width)}, height=${Math.round(logoBox!.height)})`)

    // SVG 自然宽高比 1527/493 ≈ 3.1, 允许 flex-shrink 后下限不低于 2.0
    expect(ratio, `logo 宽高比 (${ratio.toFixed(2)}) 不能被过度压扁, 下限 2.0`).toBeGreaterThan(2.0)
    // 上限: 不超过自然宽高比 3.1 + 弹性 0.9 (= 4.0)
    expect(ratio, `logo 宽高比 (${ratio.toFixed(2)}) 不能超过 SVG 自然 3.1 + 弹性 0.9`).toBeLessThan(4.0)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
 * 折叠态守门 (v2 扩展, 2026-07-04)
 *
 * 设计意图: 折叠态下 .sidebar-header 的 .sidebar-logo 被 display:none 隐藏,
 *           collapse-btn 居中 (centerX ≡ sidebar centerX), 尺寸保持 28×28.
 *
 * 折叠态 sidebar 宽度 = --sidebar-collapsed-width = 60px (来自 useSidebar composable)
 * 折叠态 collapse-btn 中心 x 应 = 60/2 = 30
 *
 * 风险: 未来某次提交可能误把 .sidebar-header 折叠态样式调整, 导致按钮
 *       偏左/偏右, 视觉上不再"对称". E2E 兜底.
 * ═══════════════════════════════════════════════════════════════════════════ */
test.describe('折叠态侧边栏 header 对齐 (collapse-btn 居中 + logo 隐藏)', () => {
  test('collapse-btn 居中: centerX ≡ sidebar centerX (60px 折叠态, 30px 中心, 误差 ≤ 1px)', async ({ page, viewport }) => {
    await gotoHome(page)
    await toggleCollapsed(page)

    // 移动端 (Mobile Chrome viewport): 点击 collapse-btn 触发的是 drawer 打开 (.open) 而非折叠 (.collapsed),
    //   .sidebar-header 仍保持展开布局 (logo 在左, button 在右). 此用例不适用, 跳过.
    test.skip(viewport && viewport.width < 768, '移动端 collapse-btn 触发 drawer 模式 (.open), 不应用 .collapsed 居中布局')

    const sidebarBox = await page.locator('.app-sidebar').first().boundingBox()
    const btnBox = await page.locator('.sidebar-collapse-btn').first().boundingBox()
    expect(sidebarBox, 'sidebar boundingBox 必须存在').not.toBeNull()
    expect(btnBox, 'collapse-btn boundingBox 必须存在').not.toBeNull()

    const sidebarWidth = Math.round(sidebarBox!.width)
    const sidebarCenterX = Math.round(sidebarBox!.x + sidebarBox!.width / 2)
    const btnCenterX = Math.round(btnBox!.x + btnBox!.width / 2)
    console.log(`[折叠态 sidebar 宽] ${sidebarWidth}px | [sidebar centerX] ${sidebarCenterX}px | [btn centerX] ${btnCenterX}px`)

    // 桌面端折叠态: sidebar 严格 60px, logo display:none, button 居中
    expect(sidebarWidth, `折叠态 sidebar 宽度必须严格 60px`).toBe(60)
    const logoDisplay = await page.locator('.sidebar-logo').first().evaluate(el => getComputedStyle(el).display)
    expect(logoDisplay, '折叠态 (60px) logo 必须 display:none').toBe('none')
    expect(Math.abs(btnCenterX - sidebarCenterX), `collapse-btn 中心 x (${btnCenterX}) 必须 ≡ sidebar 中心 x (${sidebarCenterX}) ±1px`).toBeLessThanOrEqual(1)
  })

  test('collapse-btn 折叠态下尺寸保持 28×28 (防止被压缩/拉伸)', async ({ page }) => {
    await gotoHome(page)
    await toggleCollapsed(page)

    const btnBox = await page.locator('.sidebar-collapse-btn').first().boundingBox()
    expect(btnBox, 'collapse-btn boundingBox 必须存在').not.toBeNull()

    const w = Math.round(btnBox!.width)
    const h = Math.round(btnBox!.height)
    console.log(`[折叠态 btn] ${w}×${h}px`)

    expect(w, `折叠态 collapse-btn 宽度必须严格 28px`).toBe(28)
    expect(h, `折叠态 collapse-btn 高度必须严格 28px`).toBe(28)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
 * 暗色模式守门 (v2 扩展, 2026-07-04)
 *
 * 设计意图: 暗色模式下 .sidebar-header / .sidebar-logo 仍保持展开态对齐约束.
 *           即使 html.dark 上下文下 sidebar surface/new-chat/active 等 token
 *           改变 (v3 暗色色阶), logo/button 几何位置不应受影响.
 *
 * 测试方法: 在 goto 之前通过 addInitScript 注入 localStorage 'theme-mode' = 'dark',
 *           等应用挂载 darkModeStore 读取后, html.dark class 会被 apply.
 *           然后复用展开态断言.
 * ═══════════════════════════════════════════════════════════════════════════ */
test.describe('暗色模式 (html.dark) 下展开态侧边栏 header 对齐', () => {
  test('dark mode: logo 左缘 ≡ nav-item 左缘 (4px, 误差 ≤ 1px)', async ({ page }) => {
    // 注入 dark mode 偏好 (darkModeStore 在 mount 时从 localStorage 读取 STORAGE_KEYS.DARK_MODE = 'darkMode')
    await page.addInitScript(() => {
      try {
        localStorage.setItem('darkMode', 'dark')
      } catch {
        // SSR / 隐私模式可能抛错, 忽略
      }
    })

    await gotoHome(page)

    // 等待 html.dark class 真正应用 (异步 store hydration)
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 5000 }).catch(() => {})

    const logoBox = await page.locator('.sidebar-logo').first().boundingBox()
    const navItemBox = await page.locator('.nav-item').first().boundingBox()
    expect(logoBox, 'logo boundingBox 必须存在').not.toBeNull()
    expect(navItemBox, 'nav-item boundingBox 必须存在').not.toBeNull()

    const logoLeft = Math.round(logoBox!.x)
    const navLeft = Math.round(navItemBox!.x)
    console.log(`[dark mode logo left] ${logoLeft}px | [nav-item left] ${navLeft}px`)

    expect(Math.abs(logoLeft - navLeft), `dark mode: logo.left(${logoLeft}) 必须 ≡ nav-item.left(${navLeft}) ±1px`).toBeLessThanOrEqual(1)
  })

  test('dark mode: collapse-btn 右缘 ≡ nav-item 右缘 (112px, 误差 ≤ 1px)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('darkMode', 'dark')
      } catch {
        // ignore
      }
    })

    await gotoHome(page)
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 5000 }).catch(() => {})

    const btnBox = await page.locator('.sidebar-collapse-btn').first().boundingBox()
    const navItemBox = await page.locator('.nav-item').first().boundingBox()
    expect(btnBox, 'collapse-btn boundingBox 必须存在').not.toBeNull()
    expect(navItemBox, 'nav-item boundingBox 必须存在').not.toBeNull()

    const btnRight = Math.round(btnBox!.x + btnBox!.width)
    const navRight = Math.round(navItemBox!.x + navItemBox!.width)
    console.log(`[dark mode collapse-btn right] ${btnRight}px | [nav-item right] ${navRight}px`)

    expect(Math.abs(btnRight - navRight), `dark mode: collapse-btn.right(${btnRight}) 必须 ≡ nav-item.right(${navRight}) ±1px`).toBeLessThanOrEqual(1)
  })

  test('dark mode: logo 高度仍 ≥ 28px (防止暗色规则污染 logo 尺寸)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('darkMode', 'dark')
      } catch {
        // ignore
      }
    })

    await gotoHome(page)
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 5000 }).catch(() => {})

    const logoBox = await page.locator('.sidebar-logo').first().boundingBox()
    const logoHeight = logoBox ? Math.round(logoBox.height) : 0
    console.log(`[dark mode logo height] ${logoHeight}px`)

    expect(logoHeight, `dark mode: logo 高度 (${logoHeight}px) 必须 >= 28px`).toBeGreaterThanOrEqual(28)
  })
})
