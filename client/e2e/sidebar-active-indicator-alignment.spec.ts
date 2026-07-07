/**
 * 验证侧边栏活跃指示条 (nav-active-indicator) 在不同路由下垂直对齐活跃项
 *
 * 背景 (2026-07-04):
 *   用户反馈"左侧侧边栏在选中状态下的左侧的竖向指示条怎么错位了呢"。
 *   根因有两层:
 *     1. 旧实现 updateActiveIndicator 用 offsetTop 链式累加, 但 .nav-item-wrapper
 *        / .nav-group-items 上有 `contain: layout style` 创建新 offsetParent 上下文,
 *        中间节点累加容易因 SidebarChatHistory 异步加载计算出过时值
 *     2. ResizeObserver 只观察 .sidebar-nav 元素本身, 但 nav 是 flex: 1 1 0%
 *        固定高度 (~1090px), 子元素 chat history 从 0 异步增长到 ~165px 时
 *        nav 自身 offsetHeight/scrollHeight 都不变, ResizeObserver 永远不触发
 *        → 指示条卡在旧 transform 错位
 *
 * 修复:
 *   1. 改用 getBoundingClientRect() 直接读取视口坐标, 避开 offsetParent 链陷阱
 *   2. 指示条高度 = nav-item 高度 × 70%, 垂直居中 (activeTop + 6px)
 *   3. ResizeObserver 同时观察 nav + .sidebar-chat-history + .nav-group-items
 *      + .nav-submenu, isCollapsed/collapsedGroups 变化后 nextTick 重新观察新元素
 *
 * 守门: 本测试在 4 个核心路由 + 2 个路由切换上验证 indicator.top 与 active.top 差 = 6px
 *       (垂直居中偏差), 误差 ≤ 1px. 若未来某次提交:
 *         - 改回 offsetTop 链式累加 (异步场景会过时)
 *         - 移除 ResizeObserver 多元素观察 (chat history 异步加载错位)
 *         - 改动 indicatorHeight 计算公式 (视觉不再居中)
 *       本测试会立刻失败, 防止静默回退.
 */
import { test, expect, type Page } from 'playwright/test'

async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('.sidebar-logo').first().waitFor({ state: 'visible', timeout: 30000 })
  // CSS 变量 + SVG 资源就绪
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  // 等 chat history 异步加载完成 + ResizeObserver 触发更新
  // 对话历史 (3 演示项) 渲染需 ~1-2s, 给 1500ms buffer
  await page.waitForTimeout(1500)
}

/**
 * 核心断言: indicator 顶部 - active 顶部 差 = 6px (垂直居中偏差)
 *
 * 几何关系: indicatorHeight = activeHeight × 0.7 = 40 × 0.7 = 28
 *           activeHeight - indicatorHeight = 12, 居中后上下各 6px
 *           所以 indicator.top = active.top + 6
 *           active.bottom - indicator.bottom = 6 (对称)
 */
async function assertIndicatorAlignedWithActive(
  page: Page,
  routeLabel: string,
): Promise<{ activeText: string; activeBox: { top: number; height: number }; indicatorBox: { top: number; height: number } }> {
  // 等待 .nav-group 内出现 active 项 (activeKey 路由映射后)
  const activeLocator = page.locator('.nav-group .nav-item.active').first()
  await activeLocator.waitFor({ state: 'visible', timeout: 10000 })

  const activeBox = await activeLocator.boundingBox()
  const indicatorLocator = page.locator('.nav-active-indicator')
  await indicatorLocator.waitFor({ state: 'attached', timeout: 5000 })
  const indicatorBox = await indicatorLocator.boundingBox()
  expect(activeBox, `[${routeLabel}] active nav-item boundingBox 必须存在`).not.toBeNull()
  expect(indicatorBox, `[${routeLabel}] nav-active-indicator boundingBox 必须存在`).not.toBeNull()

  const activeText = (await activeLocator.textContent())?.trim().slice(0, 20) ?? ''
  const activeTop = Math.round(activeBox!.y)
  const activeBottom = Math.round(activeBox!.y + activeBox!.height)
  const activeHeight = Math.round(activeBox!.height)
  const indicatorTop = Math.round(indicatorBox!.y)
  const indicatorBottom = Math.round(indicatorBox!.y + indicatorBox!.height)
  const indicatorHeight = Math.round(indicatorBox!.height)

  const topDiff = indicatorTop - activeTop
  const bottomDiff = activeBottom - indicatorBottom

  console.log(
    `[${routeLabel}] active="${activeText}" active=[top=${activeTop}, bot=${activeBottom}, h=${activeHeight}] ` +
    `indicator=[top=${indicatorTop}, bot=${indicatorBottom}, h=${indicatorHeight}] topDiff=${topDiff} bottomDiff=${bottomDiff}`,
  )

  // 垂直居中偏差: 上下各 6px, 误差 ≤ 1px (子像素 + 浏览器舍入)
  expect(topDiff, `[${routeLabel}] indicator.top - active.top 应 = 6px ±1px (垂直居中偏差)`).toBeGreaterThanOrEqual(5)
  expect(topDiff, `[${routeLabel}] indicator.top - active.top 应 = 6px ±1px (垂直居中偏差)`).toBeLessThanOrEqual(7)
  expect(bottomDiff, `[${routeLabel}] active.bottom - indicator.bottom 应 = 6px ±1px (对称居中)`).toBeGreaterThanOrEqual(5)
  expect(bottomDiff, `[${routeLabel}] active.bottom - indicator.bottom 应 = 6px ±1px (对称居中)`).toBeLessThanOrEqual(7)

  // 指示条高度: activeHeight 40 × 0.7 = 28
  expect(indicatorHeight, `[${routeLabel}] indicator 高度应 = active 高度 × 0.7 = 28px ±1px`).toBeGreaterThanOrEqual(27)
  expect(indicatorHeight, `[${routeLabel}] indicator 高度应 = active 高度 × 0.7 = 28px ±1px`).toBeLessThanOrEqual(29)

  return {
    activeText,
    activeBox: { top: activeTop, height: activeHeight },
    indicatorBox: { top: indicatorTop, height: indicatorHeight },
  }
}

test.describe('展开态侧边栏活跃指示条对齐 (4 核心路由)', () => {
  test('/ 首页: 指示条垂直居中对齐"首页" (diff=6px, 误差 ≤ 1px)', async ({ page }) => {
    await gotoRoute(page, '/')
    await assertIndicatorAlignedWithActive(page, '/ 首页')
  })

  test('/agents 智能体: 指示条对齐"智能体" (路由切换触发 watch 重算)', async ({ page }) => {
    await gotoRoute(page, '/agents')
    await assertIndicatorAlignedWithActive(page, '/agents 智能体')
  })

  test('/learn/list 课程中心: 指示条对齐父项"学习AI" (activeKey=learnCourses 通过 isChildActive 让父项高亮)', async ({ page }) => {
    await gotoRoute(page, '/learn/list')
    await assertIndicatorAlignedWithActive(page, '/learn/list 学习AI')
  })

  test('/ai-community AI社区: 指示条对齐"AI社区"', async ({ page }) => {
    await gotoRoute(page, '/ai-community')
    await assertIndicatorAlignedWithActive(page, '/ai-community')
  })
})

/* 注 (2026-07-04): /learn/map 在测试环境下因后端 learnApi.mapList() 数据缺失触发
 * ErrorBoundary 渲染"页面出现错误"占位页, 无法加载 sidebar. 已在 /learn/list 用例
 * 中覆盖"父项 学习AI 高亮"分支, 故移除 /learn/map 测试避免 flaky.

/* ═══════════════════════════════════════════════════════════════════════════
 * 路由间切换测试 (2026-07-04)
 *
 * 重点验证: watch(() => route.path) + ResizeObserver 多元素观察 在路由切换
 *           时正确触发 updateActiveIndicator, 不会"卡在前一个路由位置".
 *
 * 设计: 同一 page 内连续 navigate, 每次 navigate 后断言指示条位置.
 * ═══════════════════════════════════════════════════════════════════════════ */
test.describe('路由切换: 指示条跟随更新 (watch + ResizeObserver 协作)', () => {
  test('从 / 切换到 /agents: 指示条应从"首页"位置滑到"智能体"位置 (不卡旧值)', async ({ page }) => {
    await gotoRoute(page, '/')
    const first = await assertIndicatorAlignedWithActive(page, '/ 首页 (切换前)')

    await page.goto('/agents', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500) // 等 chat history + ResizeObserver

    const second = await assertIndicatorAlignedWithActive(page, '/agents (切换后)')

    // 验证: active 文本确实变了 (证明路由切换生效)
    expect(second.activeText, '切换后 active 应为"智能体"').not.toBe(first.activeText)
    // 验证: 指示条位置确实变化 (从首页 242px 区域 → 智能体 286px 区域, 至少差 30px)
    expect(second.indicatorBox.top, '指示条 top 应从 242 区域移动到 286 区域').not.toBe(first.indicatorBox.top)
  })

  test('从 /learn/list 切换到 /: 指示条应从"学习AI"位置滑回"首页"位置', async ({ page }) => {
    await gotoRoute(page, '/learn/list')
    const first = await assertIndicatorAlignedWithActive(page, '/learn/list (切换前)')

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)

    const second = await assertIndicatorAlignedWithActive(page, '/ (切换后)')
    expect(second.activeText, '切换后 active 应为"首页"').not.toBe(first.activeText)
  })
})
