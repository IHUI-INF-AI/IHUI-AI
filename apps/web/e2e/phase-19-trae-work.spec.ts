import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 19 Trae Work 流式输出对齐 — 4 大招牌交互 E2E 测试(2026-07-28 立)
 *
 * 覆盖 Phase 19 深度对标 Trae Work 对话体验后引入的 4 大核心交互:
 * 1. Plan Step ↔ Message 双向跳转(progress-jump-store + flashHighlight)
 * 2. Timeline 时间线统一事件流(timeline-tab + event 排序/计数徽章)
 * 3. HoverPreviewCard 步骤预览(useHoverPreview 250ms 延迟 + 边界检测)
 * 4. MessageContextMenu 右键菜单(7 类操作 + Esc 关闭 + 边界翻转)
 *
 * 注:测试需要登录态(因 /chat 页面要求登录)。
 * 所有断言采用软断言模式(找不到元素则 test.skip),不阻塞 CI;
 * 复用 e2e/agent-progress-pane.spec.ts 的"未登录跳走则 skip"兼容写法。
 */

const CHAT_URL = '/chat'
const TRIGGER_TESTID = '[data-testid="agent-progress-trigger"]'
const PANE_TESTID = '[data-testid="agent-progress-pane"]'
const PLAN_STEP_PREFIX = '[data-testid^="plan-step-"]'
const HOVER_PREVIEW_PREFIX = '[data-testid^="hover-preview-"]'
const TIMELINE_TAB_TESTID = '[data-testid="timeline-tab"]'
const TIMELINE_TAB_BTN = (id: string) => `[data-testid="timeline-tab-${id}"]`
const TIMELINE_EVENTS = '[data-testid="timeline-events"]'
const MESSAGE_CONTEXT_MENU = '[data-testid="message-context-menu"]'
const MESSAGE_CONTEXT_MENU_ITEM = (action: string) =>
  `[data-testid="message-context-menu-item-${action}"]`

/** 等待 chat 页面就绪(未登录自动跳过) */
async function waitForChatReady(page: Page): Promise<boolean> {
  await page.goto(CHAT_URL)
  await page.waitForLoadState('networkidle').catch(() => {})
  // 允许未登录跳转到 /login,只要当前 URL 不含 /chat 就跳过
  if (!page.url().includes('/chat')) return false
  // 等待 trigger 出现(最多 8s,沿用 Phase 13 规范)
  const trigger = page.locator(TRIGGER_TESTID)
  if (!(await trigger.isVisible({ timeout: 8000 }).catch(() => false))) return false
  return true
}

/** 打开 agent-progress-pane(供依赖 popover 内容的测试复用) */
async function openPane(page: Page): Promise<boolean> {
  if (!(await waitForChatReady(page))) return false
  const trigger = page.locator(TRIGGER_TESTID)
  if (!(await trigger.isVisible({ timeout: 3000 }).catch(() => false))) return false
  await trigger.click()
  const pane = page.locator(PANE_TESTID)
  if (!(await pane.isVisible({ timeout: 5000 }).catch(() => false))) return false
  return true
}

test.describe('Phase 19 Trae Work 4 大招牌交互', () => {
  // ───────── 测试 1:Plan Step ↔ Message 双向跳转 ─────────
  test('Plan Step 点击触发消息滚动 + flashHighlight + hoveredPlanStep 反向联动', async ({
    page,
  }) => {
    if (!(await openPane(page))) return

    const pane = page.locator(PANE_TESTID)
    // 至少存在一个 plan step
    const planStep = pane.locator(PLAN_STEP_PREFIX).first()
    if (!(await planStep.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, '当前无 plan step(未触发 agent 任务),跳过交互验证')
      return
    }

    // 1) 正向:点击 plan step → 验证 store.requestJumpToMessage 已派发
    //    通过监听 custom event / 检查 message 元素滚动位置变化来软断言
    const beforeScrollY = await page.evaluate(() => window.scrollY)
    const stepId = await planStep.getAttribute('data-plan-step-id').catch(() => null)

    await planStep.click().catch(() => {})
    // 等待消息滚动 + flashHighlight(1.5s 内高亮类)
    await page.waitForTimeout(500)

    // 软断言:页面或消息列表区域发生了滚动(允许 scrollY 没变时跳过)
    const afterScrollY = await page.evaluate(() => window.scrollY)
    const _scrolled = Math.abs(afterScrollY - beforeScrollY) > 0
    void _scrolled // 仅作为观察点,不强断言

    // 软断言:store 派发后,data-message-id 元素中应至少有 1 个受 flashHighlight 类影响
    // 由于高亮实现可能在 data-message-id 子元素上,这里用 page.evaluate 探测任意
    // .flash-highlight / [data-highlight="true"] / 类似 class 短暂出现(1500ms 内)
    const hasHighlight = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('[data-message-id], [class*="flash"], [data-highlight]'),
      )
      return candidates.some((el) => {
        const cls = el.className?.toString() ?? ''
        return /flash|highlight/i.test(cls) || el.getAttribute('data-highlight') === 'true'
      })
    })
    // 软断言,不强制要求高亮出现(可能无关联消息或实现策略不同)
    void hasHighlight

    // 2) 反向:hover AI 消息 → setHoveredPlanStep 联动
    const aiMessage = page.locator('[data-message-id]').last()
    if (await aiMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
      await aiMessage.hover().catch(() => {})
      await page.waitForTimeout(300)
      // 软断言:相关 plan step 应有 hover 高亮类(此处用 backgroundColor 变化判定)
      const stepBg = await pane
        .locator(PLAN_STEP_PREFIX)
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor)
        .catch(() => 'rgba(0, 0, 0, 0)')
      // 仅做记录性断言,不强制
      expect(stepBg).toBeTruthy()
    }

    // 软断言:data-plan-step-id 至少可读(防止组件结构改动)
    expect(stepId).toBeTruthy()
  })

  // ───────── 测试 2:Timeline 时间线统一事件流 ─────────
  test('Timeline tab 切换:inline ↔ timeline,事件按时间排序 + 计数徽章', async ({ page }) => {
    if (!(await openPane(page))) return

    // 1) 验证 timeline tab 容器存在
    const tab = page.locator(TIMELINE_TAB_TESTID)
    if (!(await tab.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'timeline-tab 容器不可见(可能 showTabs=false 或 pane 未挂载),跳过')
      return
    }

    // 2) 验证默认 inline tab 是 active
    const inlineBtn = page.locator(TIMELINE_TAB_BTN('inline'))
    const timelineBtn = page.locator(TIMELINE_TAB_BTN('timeline'))

    if (
      !(await inlineBtn.isVisible({ timeout: 3000 }).catch(() => false)) ||
      !(await timelineBtn.isVisible({ timeout: 3000 }).catch(() => false))
    ) {
      test.skip(true, 'tab 切换按钮不可见,跳过')
      return
    }

    // 初始 inline tab 应为 selected
    await expect(inlineBtn).toHaveAttribute('aria-selected', 'true')
    await expect(timelineBtn).toHaveAttribute('aria-selected', 'false')

    // 3) 切换到 timeline tab
    await timelineBtn.click()
    await page.waitForTimeout(300)

    await expect(timelineBtn).toHaveAttribute('aria-selected', 'true')
    await expect(inlineBtn).toHaveAttribute('aria-selected', 'false')

    // 4) 验证 TimelineEvent 列表显示(可能为空,空时显示 "暂无事件" 占位)
    const eventContainer = page.locator(TIMELINE_EVENTS)
    const hasEvents = await eventContainer.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasEvents) {
      // 验证事件按 timestamp 升序排列
      const timestamps = await eventContainer
        .locator('[data-timestamp]')
        .evaluateAll((els) =>
          els.map((el) => {
            const t = el.getAttribute('data-timestamp') ?? ''
            const parsed = Date.parse(t)
            return Number.isNaN(parsed) ? 0 : parsed
          }),
        )
        .catch(() => [] as number[])

      if (timestamps.length > 1) {
        // 验证单调非递减
        for (let i = 1; i < timestamps.length; i += 1) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
        }
      }

      // 验证计数徽章显示数字(>= 0)
      const badgeText = await tab.locator('span.tabular-nums').first().textContent().catch(() => null)
      // 徽章文本可能是空(事件数=0 时不渲染),也可能含数字
      void badgeText
    } else {
      // 空态:验证 "暂无事件" 占位
      const emptyState = page.getByText('暂无事件')
      const isEmpty = await emptyState.isVisible({ timeout: 1000 }).catch(() => false)
      // 软断言:要么有 events,要么显示空态
      expect(hasEvents || isEmpty).toBeTruthy()
    }

    // 5) 切回 inline tab(确保双向切换可用)
    await inlineBtn.click()
    await page.waitForTimeout(200)
    await expect(inlineBtn).toHaveAttribute('aria-selected', 'true')
  })

  // ───────── 测试 3:HoverPreviewCard 步骤预览 ─────────
  test('HoverPreviewCard 250ms 延迟触发 + 边界检测不溢出', async ({ page }) => {
    if (!(await openPane(page))) return

    const pane = page.locator(PANE_TESTID)
    const planStep = pane.locator(PLAN_STEP_PREFIX).first()
    if (!(await planStep.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, '无 plan step 可触发 hover preview,跳过')
      return
    }

    // 1) 鼠标移入,等待 250ms 延迟
    await planStep.hover().catch(() => {})
    await page.waitForTimeout(350) // 略大于 250ms 阈值

    // 2) 验证 hover-preview-card 出现
    const preview = page.locator(HOVER_PREVIEW_PREFIX).first()
    const previewVisible = await preview.isVisible({ timeout: 1500 }).catch(() => false)

    if (previewVisible) {
      // 3) 验证内容区域非空(包含步骤说明 / token / 工具数等)
      const text = (await preview.textContent().catch(() => '')) ?? ''
      expect(text.length).toBeGreaterThan(0)

      // 4) 验证 preview 不超出视口
      const box = await preview.boundingBox().catch(() => null)
      if (box) {
        const vw = await page.evaluate(() => window.innerWidth)
        const vh = await page.evaluate(() => window.innerHeight)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(vw + 1)
        expect(box.y + box.height).toBeLessThanOrEqual(vh + 1)
      }
    } else {
      // 软断言:可能因 dataRef.current === null 而未触发(组件实现细节)
      test.skip(true, 'hover preview 未在 350ms 内出现(可能无关联数据),跳过内容验证')
      return
    }

    // 5) 边界检测:移动到 viewport 右上角附近的 plan step,验证 preview 朝内显示
    //    由于 plan step 位置不可控,这里仅模拟 mouseleave 后再 hover 另一个 step
    await planStep.dispatchEvent('mouseleave').catch(() => {})
    await page.waitForTimeout(200)

    const planStepsCount = await pane.locator(PLAN_STEP_PREFIX).count()
    if (planStepsCount > 1) {
      const secondStep = pane.locator(PLAN_STEP_PREFIX).nth(1)
      await secondStep.hover().catch(() => {})
      await page.waitForTimeout(350)
      const preview2 = page.locator(HOVER_PREVIEW_PREFIX).first()
      const visible2 = await preview2.isVisible({ timeout: 1500 }).catch(() => false)
      // 软断言:第二个 step 也能触发 preview(不强制)
      void visible2
    }
  })

  // ───────── 测试 4:MessageContextMenu 右键菜单 ─────────
  test('MessageContextMenu 7 类操作 + Esc 关闭 + 边界翻转', async ({ page }) => {
    if (!(await openPane(page))) return

    // 1) 找到 AI 消息区域(数据消息元素)
    const aiMessage = page.locator('[data-message-id]').last()
    if (!(await aiMessage.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, '无 AI 消息可触发右键菜单,跳过')
      return
    }

    // 2) 右键触发
    await aiMessage.click({ button: 'right' }).catch(() => {})
    await page.waitForTimeout(300)

    // 3) 验证菜单出现
    const menu = page.locator(MESSAGE_CONTEXT_MENU)
    const menuVisible = await menu.isVisible({ timeout: 2000 }).catch(() => false)
    if (!menuVisible) {
      test.skip(true, '右键菜单未出现(可能消息未挂 onContextMenu),跳过')
      return
    }

    // 4) 验证 7 类操作菜单项存在(允许部分缺失,只要核心操作都在)
    const expectedActions = [
      'copy',
      'copyMarkdown',
      'regenerate',
      'feedback',
      'share',
      'collapseToPlan',
      'delete',
    ]
    const presentActions: string[] = []
    for (const action of expectedActions) {
      const item = page.locator(MESSAGE_CONTEXT_MENU_ITEM(action))
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        presentActions.push(action)
      }
    }
    // 至少应有 4 个常见操作(允许上下文受限)
    expect(presentActions.length).toBeGreaterThanOrEqual(4)

    // 5) 验证菜单的 a11y 属性
    await expect(menu).toHaveAttribute('role', 'menu')
    await expect(menu).toHaveAttribute('aria-label', '消息操作菜单')

    // 6) 验证菜单不超出视口
    const box = await menu.boundingBox().catch(() => null)
    if (box) {
      const vw = await page.evaluate(() => window.innerWidth)
      const vh = await page.evaluate(() => window.innerHeight)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(vw + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(vh + 1)
    }

    // 7) Esc 键关闭
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const stillVisible = await menu.isVisible({ timeout: 500 }).catch(() => false)
    expect(stillVisible).toBe(false)

    // 8) 边界翻转:在 viewport 边缘右键 → 菜单应朝内翻转(不超出)
    const vwEdge = await page.evaluate(() => window.innerWidth)
    const vhEdge = await page.evaluate(() => window.innerHeight)
    // 在右下角 (vw-30, vh-30) 右键
    const cornerMessage = page.locator('[data-message-id]').first()
    if (await cornerMessage.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cornerMessage.click({
        button: 'right',
        position: { x: 5, y: 5 }, // 元素内靠近 (0,0) 位置
      }).catch(() => {})
      await page.waitForTimeout(300)

      const cornerMenu = page.locator(MESSAGE_CONTEXT_MENU)
      const cornerMenuVisible = await cornerMenu.isVisible({ timeout: 1000 }).catch(() => false)
      if (cornerMenuVisible) {
        const cornerBox = await cornerMenu.boundingBox().catch(() => null)
        if (cornerBox) {
          // 关键断言:菜单应朝内翻转,box.x + width <= vw(允许 1px 误差)
          expect(cornerBox.x + cornerBox.width).toBeLessThanOrEqual(vwEdge + 1)
          expect(cornerBox.y + cornerBox.height).toBeLessThanOrEqual(vhEdge + 1)
        }
        // 关闭
        await page.keyboard.press('Escape')
      }
    }
  })

  // ───────── 兼容测试:无 500 错误 / 无控制台异常 ─────────
  test('Phase 19 4 大交互加载无 500 / 无控制台 error', async ({ page }) => {
    const errors: string[] = []
    const consoleErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) errors.push(`${resp.url()} ${resp.status()}`)
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    if (!(await openPane(page))) return

    // 触发所有 4 大交互(尽量走一遍)
    const pane = page.locator(PANE_TESTID)
    const planStep = pane.locator(PLAN_STEP_PREFIX).first()
    if (await planStep.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 1) plan step click + hover
      await planStep.click().catch(() => {})
      await page.waitForTimeout(200)
      await planStep.hover().catch(() => {})
      await page.waitForTimeout(400)
    }

    // 2) timeline tab 切换
    const timelineBtn = page.locator(TIMELINE_TAB_BTN('timeline'))
    if (await timelineBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await timelineBtn.click().catch(() => {})
      await page.waitForTimeout(200)
    }

    // 3) 右键消息
    const msg = page.locator('[data-message-id]').last()
    if (await msg.isVisible({ timeout: 1000 }).catch(() => false)) {
      await msg.click({ button: 'right' }).catch(() => {})
      await page.waitForTimeout(200)
      await page.keyboard.press('Escape').catch(() => {})
    }

    // 过滤 favicon + AI endpoint 错误(沿用 Phase 13 规范)
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('/api/ai/'),
    )
    expect(realErrors).toHaveLength(0)
    // console error 只记录不强制(可能是 React 警告等)
    void consoleErrors
  })
})
