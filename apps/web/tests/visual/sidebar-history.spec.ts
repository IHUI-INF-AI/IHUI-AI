import { test, expect, type Page } from '@playwright/test'

/**
 * 侧边栏历史对话视觉回归 + 状态验证
 *
 * 守护目标 (对应 sidebar-chat-history.tsx):
 *   - hover 态: 背景 accent + 文字 foreground (明显高亮)
 *   - active 态: 背景 primary/15 + 文字 primary 加粗 + 左侧 h-5 w-1 rounded-sm bg-primary 高亮条
 *   - dark mode: 三态在暗色下均可清晰区分
 *
 * 触发规则: 任何对 sidebar-chat-history.tsx 的样式改动必须跑此测试通过
 */

const SIDEBAR_HISTORY_SELECTOR = '[aria-label="对话历史"], [role="region"][aria-label*="对话历史"]'
const CONVERSATION_ITEM_SELECTOR = `${SIDEBAR_HISTORY_SELECTOR} ul > li > button:first-of-type`

async function navigateToChat(page: Page) {
  await page.goto('/chat', { waitUntil: 'domcontentloaded' })
  // 等待侧边栏历史对话区域出现 (即使为空, region 也会渲染)
  await page.waitForSelector(SIDEBAR_HISTORY_SELECTOR, { timeout: 15000 })
}

async function ensureConversationItems(page: Page, minCount = 1): Promise<number> {
  await page.waitForSelector(CONVERSATION_ITEM_SELECTOR, { timeout: 10000 })
  const count = await page.locator(CONVERSATION_ITEM_SELECTOR).count()
  if (count < minCount) {
    throw new Error(`历史对话项不足: 期望 >= ${minCount}, 实际 = ${count}`)
  }
  return count
}

test.describe('侧边栏历史对话 - 三态视觉验证', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToChat(page)
  })

  test('默认态: 非选中项应有 muted-foreground 文字色, 无背景', async ({ page }) => {
    await ensureConversationItems(page, 1)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()

    // 验证默认态 class 包含 text-muted-foreground
    const className = await firstItem.getAttribute('class')
    expect(className, '默认态必须包含 text-muted-foreground').toContain('text-muted-foreground')

    // 验证默认态不包含 active 样式
    expect(className, '默认态不应包含 text-primary').not.toContain('text-primary')
    expect(className, '默认态不应包含 before:bg-primary').not.toMatch(/before:bg-primary\/\d+/)

    // 验证不存在 active 高亮条
    const highlightBar = firstItem.locator('span[aria-hidden].bg-primary')
    await expect(highlightBar, '默认态不应有 active 高亮条').toHaveCount(0)
  })

  test('hover 态: 鼠标悬停后应触发 hover 类 (background accent + text foreground)', async ({
    page,
  }) => {
    await ensureConversationItems(page, 1)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()

    // 验证 class 包含 hover 触发器
    const className = await firstItem.getAttribute('class')
    expect(className, 'hover 态必须有 before:hover:bg-accent').toContain('before:hover:bg-accent')
    expect(className, 'hover 态必须有 hover:text-foreground').toContain('hover:text-foreground')

    // 实际 hover 并验证 :before 伪元素 background-color 计算
    await firstItem.hover()
    await page.waitForTimeout(300)

    // 读伪元素样式 (getComputedStyle)
    const beforeBg = await firstItem.evaluate((el) => {
      const cs = window.getComputedStyle(el, '::before')
      return cs.backgroundColor
    })
    // hover 后伪元素背景不应是 transparent
    expect(beforeBg, 'hover 后 ::before 背景不应为 transparent').not.toBe('rgba(0, 0, 0, 0)')
    expect(beforeBg, 'hover 后 ::before 背景不应为 transparent (rgb 形式)').not.toBe('transparent')
  })

  test('active 态: 点击对话项后应有四重常驻样式', async ({ page }) => {
    await ensureConversationItems(page, 2)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()

    // 点击使其成为当前选中
    await firstItem.click()
    await page.waitForTimeout(500)

    // 重新定位 (可能 DOM 已更新)
    const activeItem = page.locator(`${CONVERSATION_ITEM_SELECTOR}[aria-current="true"]`)
    await expect(activeItem, '点击后应出现 aria-current="true" 的项').toHaveCount(1)

    const className = await activeItem.getAttribute('class')

    // 验证四重常驻样式
    expect(className, 'active 态必须有 text-primary').toContain('text-primary')
    expect(className, 'active 态必须有 font-medium').toContain('font-medium')
    expect(className, 'active 态必须有 before:bg-primary/15').toContain('before:bg-primary/15')
    expect(className, 'active 态不应包含 hover 类').not.toContain('before:hover:bg-accent')

    // 验证左侧高亮条 (h-5 w-1 rounded-sm bg-primary, 遵循禁止 rounded-full 规则)
    const highlightBar = activeItem.locator('span[aria-hidden].bg-primary')
    await expect(highlightBar, 'active 态必须有左侧高亮条').toHaveCount(1)

    const barClass = await highlightBar.getAttribute('class')
    expect(barClass, '高亮条必须有 h-5').toContain('h-5')
    expect(barClass, '高亮条必须有 w-1').toContain('w-1')
    expect(barClass, '高亮条必须有 rounded-sm').toContain('rounded-sm')
    expect(barClass, '高亮条必须有 bg-primary').toContain('bg-primary')
    expect(barClass, '高亮条不得使用 rounded-full (违反禁止纯圆形/胶囊形状规则)').not.toContain(
      'rounded-full',
    )
  })

  test('active 态切换: 选中项应跟随点击移动', async ({ page }) => {
    await ensureConversationItems(page, 2)
    const items = page.locator(CONVERSATION_ITEM_SELECTOR)
    const firstItem = items.nth(0)
    const secondItem = items.nth(1)

    // 点击第一项
    await firstItem.click()
    await page.waitForTimeout(500)
    let activeItems = page.locator(`${CONVERSATION_ITEM_SELECTOR}[aria-current="true"]`)
    await expect(activeItems).toHaveCount(1)
    await expect(firstItem).toHaveAttribute('aria-current', 'true')

    // 点击第二项
    await secondItem.click()
    await page.waitForTimeout(500)
    activeItems = page.locator(`${CONVERSATION_ITEM_SELECTOR}[aria-current="true"]`)
    await expect(activeItems, '切换后仍应只有 1 个 active 项').toHaveCount(1)
  })

  test('dark mode: 三态在暗色下视觉可辨', async ({ page }) => {
    // 切到 dark mode (next-themes 通过 html.class 或 data-theme 控制)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)

    await ensureConversationItems(page, 1)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()
    const className = await firstItem.getAttribute('class')

    // dark mode 下默认态 class 仍应包含 text-muted-foreground
    expect(className, 'dark mode 默认态仍应有 text-muted-foreground').toContain(
      'text-muted-foreground',
    )

    // 验证 hover 触发器仍存在
    expect(className, 'dark mode hover 触发器仍应有 before:hover:bg-accent').toContain(
      'before:hover:bg-accent',
    )

    // 点击后验证 active 态
    await firstItem.click()
    await page.waitForTimeout(500)
    const activeItem = page.locator(`${CONVERSATION_ITEM_SELECTOR}[aria-current="true"]`)
    await expect(activeItem).toHaveCount(1)

    const activeClass = await activeItem.getAttribute('class')
    expect(activeClass, 'dark mode active 态仍应有 text-primary').toContain('text-primary')
    expect(activeClass, 'dark mode active 态仍应有 before:bg-primary/15').toContain(
      'before:bg-primary/15',
    )

    // 高亮条在 dark mode 下也应存在
    const bar = activeItem.locator('span[aria-hidden].bg-primary')
    await expect(bar, 'dark mode 下 active 高亮条仍应存在').toHaveCount(1)
  })
})
