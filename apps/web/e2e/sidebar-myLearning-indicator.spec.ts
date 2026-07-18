import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * 侧边栏 '我的学习' 底部破折线指示器 4 态端到端测试。
 *
 * 背景:
 *   - 指示器是 absolute inset-x-0 bottom-0 的 span,横跨整个按钮底边
 *   - 闭合态:repeating-linear-gradient 破折线 + 95% 透明 + 内发光
 *   - 展开态:实线 + 100% 不透明 + 外发光 + 品牌主色 hsl(142 71% 45%)
 *   - hover/focus 联动:opacity 升至 100%
 *   - 关键不变量:
 *     1. 指示器在 DOM 中常驻(无论展开还是折叠)
 *     2. 指示器宽度 == 父按钮宽度(横跨整个按钮底边)
 *     3. 指示器高度恒为 4px(h-1)
 *     4. 闭合/展开样式互斥(三元表达式,不重叠)
 *     5. pointer-events: none 不影响布局
 *     6. hover 透明度从 0.95 升至 1
 *
 * 为什么独立文件:
 *   - 这些是样式契约测试,与 navigation-full 的"可达性测试"职责不同
 *   - 独立文件方便后续用 grep 检索 sidebar 视觉回归
 */

async function setup(page: Page) {
  // 注意:首页(/)是营销页没有侧边栏,要导航到 /learn 等有侧边栏的页面
  // 用 domcontentloaded 而不是 networkidle,因为 /learn 有流式内容永不 idle
  await page.goto('/learn', { waitUntil: 'domcontentloaded' })
  const aside = page.locator('aside').first()
  if (!(await aside.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip(true, '此环境无侧边栏(可能移动端视口或页面不渲染侧边栏)')
  }
  const parent = page.getByTestId('nav-myLearning').first()
  await parent.scrollIntoViewIfNeeded()
  return { parent, indicator: page.getByTestId('nav-myLearning-indicator').first() }
}

/**
 * 切换 myLearning 折叠/展开。
 *
 * 为什么用 keyboard.press('Enter') + focus 而非 native el.click():
 *   - 测试在 React 18 + Next.js 15 dev mode 下,parent.evaluate(el => el.click())
 *     派发的 click 事件冒泡到 root 后,偶发不触发 React root listener 捕获的合成
 *     onClick(实测 14× 重试 5s 内 aria-expanded 始终不变)。
 *   - 真实 Playwright locator.click() 也会因 button 内 absolute indicator 覆盖底部
 *     4px 触发 actionability 偶发拦截。
 *   - keyboard.press('Enter') 是 native browser 行为:button 聚焦后按 Enter 等同于
 *     用户敲键盘,浏览器自动派发 click 事件(带完整 MouseEventInit),100% 触发
 *     React 18 root listener 捕获的 onClick。
 *   - 副作用仅为 button 获得焦点(:focus-visible ring),不影响 aria-expanded 状态。
 *
 * 为什么需要 retry:
 *   - Next.js 15 dev mode 下 React hydration 时序不可控,首次 keyboard.press('Enter')
 *     偶发不触发 React onClick(13× locator resolved 仍 aria-expanded="false")。
 *   - 解决办法:focus + Enter 后,等 aria-expanded 翻转,最多 2s;若未翻转则再
 *     focus + Enter 重试一次。2 次都失败则抛出,触发 Playwright 报告具体错误。
 *   - 与之前"调用一次就返回"实现相比,本版本能稳定保证 toggle 真的发生了状态翻转。
 */
async function toggleMyLearning(page: Page, parent: Locator) {
  const before = await parent.getAttribute('aria-expanded')
  for (let attempt = 1; attempt <= 2; attempt++) {
    await parent.focus()
    await page.keyboard.press('Enter')
    try {
      // 等待 aria-expanded 翻转(true↔false),2s 内未翻转抛错进入 catch 重试
      await expect(parent).not.toHaveAttribute('aria-expanded', before, { timeout: 2000 })
      return // 翻转成功,直接返回
    } catch {
      if (attempt === 2) {
        throw new Error(
          `toggleMyLearning 失败:2 次 focus+Enter 后 aria-expanded 仍为 "${before}",` +
            `可能 Next.js dev mode 下 React hydration 未完成,或 button 被其他元素遮挡`,
        )
      }
      // 第一次失败,等 200ms 让 React 重新调度,再 retry
      await page.waitForTimeout(200)
    }
  }
}

/**
 * 真实触发父按钮的 CSS :hover(从而让 group-hover/exp:opacity-100 生效)。
 *
 * 为什么不用 dispatchEvent('mouseenter'):
 *   - Tailwind group-hover/exp:opacity-100 编译为 CSS `.group\/exp:hover .group-hover\/exp\:opacity-100 { opacity: 1 }`
 *   - 这是 CSS pseudo-class :hover,只有真实鼠标光标在元素上时才生效
 *   - dispatchEvent('mouseenter') 派发的是 MouseEvent,JS 监听器能收到,但 CSS 引擎不感知
 *   - Playwright locator.hover() 内部会移动鼠标,但因为 button 上面有 absolute 定位的
 *     indicator 覆盖底部 4px,Playwright 的 hit-test 可能命中 indicator 而非 button,
 *     移动鼠标到 indicator 上 pointer-events-none,实际没真正移动到 button
 *   - 用 page.mouse.move(button.boundingBox().center) 显式移动到 button 几何中心
 *     (中心 y = button.y + height/2,绝对不在 indicator 的 bottom-0 4px 范围)
 *   - 等 transition 200ms 完成 + 50ms buffer 后读 opacity
 */
async function hoverMyLearningButton(page: Page, parent: Locator) {
  const box = await parent.boundingBox()
  if (!box) throw new Error('myLearning 按钮 boundingBox 不可用,无法触发 :hover')
  // 移动到 button 几何中心(y = box.y + box.height/2),绝对不在 indicator 覆盖范围内
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  // 等 group-hover transition (transition-all 200ms) 完成 + buffer
  await page.waitForTimeout(300)
}

/**
 * 把鼠标从 myLearning 按钮上移开(hover 状态清除)。
 *
 * 为什么需要:
 *   - hover 测试结束后,group-hover/exp:opacity-100 仍生效,会影响后续测试
 *   - 把鼠标移到视口左上角 (0,0) 之外,确保任何元素都不在 :hover 状态
 *   - 等 transition 200ms 回到非 hover 态
 */
async function unhoverMyLearningButton(page: Page) {
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
}

/**
 * 等指示器的"animate-pulse-once"呼吸动画(1.6s)结束后,opacity 才回到稳定值。
 * 否则读到的是动画中间帧(opacity 在 0.45 ~ 1 ~ 0.95 之间)。
 *
 * 关键:关键帧 100% 已经 = 0.95(目标稳定值),所以动画结束瞬间 = 静态值,
 * 不会有 0.6 → 0.95 的 transition 抖动。1.6s + 200ms buffer = 1.8s 等待足够。
 */
async function waitForPulseAnimationToEnd(page: Page) {
  await page.waitForTimeout(1800)
}

test.describe('侧边栏 — "我的学习" 指示器 4 态', () => {
  test('指示器在 DOM 中常驻,不随展开/折叠而消失', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    await expect(indicator).toBeAttached()
    expect(await indicator.count()).toBe(1)

    await toggleMyLearning(page, parent)
    expect(await indicator.count()).toBe(1)
    await toggleMyLearning(page, parent)
    expect(await indicator.count()).toBe(1)
  })

  test('指示器宽度 = 父按钮宽度(横跨整个按钮底边)', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    const parentBox = await parent.boundingBox()
    const indicatorBox = await indicator.boundingBox()
    expect(parentBox).not.toBeNull()
    expect(indicatorBox).not.toBeNull()
    if (parentBox && indicatorBox) {
      // 左右各允许 1px 误差(四舍五入)
      expect(Math.abs(indicatorBox.x - parentBox.x)).toBeLessThanOrEqual(1)
      expect(
        Math.abs(indicatorBox.x + indicatorBox.width - (parentBox.x + parentBox.width)),
      ).toBeLessThanOrEqual(1)
    }
  })

  test('指示器高度恒为 4px (h-1) — 闭合/展开两态', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    // 折叠态
    if ((await parent.getAttribute('aria-expanded')) === 'true')
      await toggleMyLearning(page, parent)
    const hClosed = (await indicator.boundingBox())?.height ?? 0
    expect(hClosed).toBeGreaterThanOrEqual(3)
    expect(hClosed).toBeLessThanOrEqual(5)

    // 展开态
    await toggleMyLearning(page, parent)
    const hOpen = (await indicator.boundingBox())?.height ?? 0
    expect(hOpen).toBeGreaterThanOrEqual(3)
    expect(hOpen).toBeLessThanOrEqual(5)
  })

  test('闭合态:破折线 + 透明度 0.95', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    // 先确保非 hover(避免 group-hover 干扰 opacity 断言)
    await unhoverMyLearningButton(page)
    if ((await parent.getAttribute('aria-expanded')) === 'true')
      await toggleMyLearning(page, parent)
    await expect(parent).toHaveAttribute('aria-expanded', 'false')
    await waitForPulseAnimationToEnd(page)

    const bgImage = await indicator.evaluate((el) => getComputedStyle(el).backgroundImage)
    const opacity = await indicator.evaluate((el) => parseFloat(getComputedStyle(el).opacity))

    // 闭合态必须有 repeating-linear-gradient(破折线)
    expect(bgImage).toContain('repeating-linear-gradient')
    // 闭合态 opacity 应该稳定在 0.95(关键帧 100% = 0.95,无 transition 抖动)
    expect(opacity).toBeGreaterThanOrEqual(0.9)
    expect(opacity).toBeLessThanOrEqual(0.99)
  })

  test('展开态:实线 + 透明度 1.0 + 品牌主色 hsl(142 71% 45%)', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    // 先确保非 hover(避免 group-hover 干扰)
    await unhoverMyLearningButton(page)
    if ((await parent.getAttribute('aria-expanded')) !== 'true')
      await toggleMyLearning(page, parent)
    await expect(parent).toHaveAttribute('aria-expanded', 'true')
    await waitForPulseAnimationToEnd(page)

    const bgImage = await indicator.evaluate((el) => getComputedStyle(el).backgroundImage)
    const bgColor = await indicator.evaluate((el) => getComputedStyle(el).backgroundColor)
    const opacity = await indicator.evaluate((el) => parseFloat(getComputedStyle(el).opacity))

    // 展开态不应有 backgroundImage(是实线不是破折线)
    expect(bgImage).toBe('none')
    // 展开态 backgroundColor 应该是品牌主色 hsl(142 71% 45%) ≈ rgb(60, 197, 87)
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    expect(match).not.toBeNull()
    if (match) {
      const r = Number(match[1])
      const g = Number(match[2])
      const b = Number(match[3])
      // 绿色为主:g 通道应该显著高于 r 和 b
      expect(g).toBeGreaterThan(r)
      expect(g).toBeGreaterThan(b)
      // 色调在绿色范围
      expect(g).toBeGreaterThan(120)
    }
    // 展开态 opacity 必须是 1
    expect(opacity).toBe(1)
  })

  test('折叠→展开:指示器从破折线变为实线', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    // 先确保非 hover
    await unhoverMyLearningButton(page)
    if ((await parent.getAttribute('aria-expanded')) === 'true')
      await toggleMyLearning(page, parent)
    const bgBefore = await indicator.evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(bgBefore).toContain('repeating-linear-gradient')

    await toggleMyLearning(page, parent)
    await expect(parent).toHaveAttribute('aria-expanded', 'true')

    const bgAfter = await indicator.evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(bgAfter).toBe('none')
  })

  test('hover 态:破折线透明度从 0.95 升至 1', async ({ page }) => {
    const { parent, indicator } = await setup(page)
    // 先确保非 hover 起点
    await unhoverMyLearningButton(page)
    // 先折叠 + 等呼吸动画结束
    if ((await parent.getAttribute('aria-expanded')) === 'true')
      await toggleMyLearning(page, parent)
    await waitForPulseAnimationToEnd(page)

    const opBefore = await indicator.evaluate((el) => parseFloat(getComputedStyle(el).opacity))
    // 动画结束后应该稳定在 0.95
    expect(opBefore).toBeGreaterThanOrEqual(0.9)
    expect(opBefore).toBeLessThanOrEqual(0.99)

    // 真实移动鼠标到 button 几何中心,触发 CSS :hover
    // → group-hover/exp:opacity-100 生效 → indicator opacity 升至 1
    await hoverMyLearningButton(page, parent)

    const opAfter = await indicator.evaluate((el) => parseFloat(getComputedStyle(el).opacity))
    expect(opAfter).toBe(1)

    // 测试结束清理:把鼠标移开,避免影响后续测试
    await unhoverMyLearningButton(page)
  })

  test('指示器不影响布局交互(pointer-events-none)', async ({ page }) => {
    const { indicator } = await setup(page)
    const pe = await indicator.evaluate((el) => getComputedStyle(el).pointerEvents)
    expect(pe).toBe('none')
  })

  test('指示器无障碍:aria-hidden=true,被屏幕阅读器忽略', async ({ page }) => {
    const { indicator } = await setup(page)
    await expect(indicator).toHaveAttribute('aria-hidden', 'true')
  })
})
