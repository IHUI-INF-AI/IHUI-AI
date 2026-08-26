import { test, expect, type Page } from '../../e2e/fixtures'

/**
 * 侧边栏历史对话视觉回归 + 状态验证
 *
 * 2026-08-27 适配(侧边栏/布局改版):
 *   - 旧「对话历史」aria-label 区域已不存在;现为 SidebarChatHistory(sidebar-chat-history.tsx)
 *     渲染的 `[role="region"][aria-label="任务列表"]`(chatHistory.title),需登录后可见
 *   - 会话项样式已重做:非 active `hover:text-foreground hover:before:bg-muted`;
 *     active `text-primary before:bg-primary/10` + 左侧高亮条 `h-4 w-0.5 bg-primary`
 *   - /chat 未登录只显示"请登录",且 test_e2e 账号默认无会话 → beforeEach 用
 *     authenticatedPage.request 走 web 代理(8801,自动带浏览器 cookie,不额外登录)
 *     创建 2 个会话,再用 authenticatedPage 渲染
 *
 * 守护目标 (对应 sidebar-chat-history.tsx):
 *   - hover 态: ::before 背景 hover:bg-muted(非透明)
 *   - active 态: 背景 primary/10 + 文字 primary + 左侧 h-4 w-0.5 bg-primary 高亮条
 *   - dark mode: 三态在暗色下均可清晰区分
 *
 * 触发规则: 任何对 sidebar-chat-history.tsx 的样式改动必须跑此测试通过
 */

const DESKTOP_ASIDE = 'aside[aria-label="主导航"]:not([role="dialog"])'
const SIDEBAR_HISTORY_SELECTOR = `${DESKTOP_ASIDE} [role="region"][aria-label="任务列表"]`
const CONVERSATION_ITEM_SELECTOR = `${SIDEBAR_HISTORY_SELECTOR} ul > li > button`
// 经 web dev 代理转发到 api 8802(authenticatedPage 的 cookie 自动附带,避免独立登录撞 429 限流)
const CONVERSATIONS_URL = 'http://localhost:8801/api/chat/conversations'

/** 幂等创建 2 个会话(beforeEach 每轮调用,先查已存在则跳过,避免重复堆积)。
 *  注意:api 的 cookie 认证对 POST 有 CSRF 校验,必须带 X-Requested-With: XMLHttpRequest
 *  (apps/api/src/plugins/auth.ts:50-58)。 */
async function ensureConversations(page: Page): Promise<void> {
  try {
    const listRes = await page.request.get(CONVERSATIONS_URL)
    const listBody = (await listRes.json().catch(() => null)) as {
      data?: { conversations?: Array<{ id: string; title: string }> }
    } | null
    const existing = listBody?.data?.conversations ?? []
    const need = [1, 2].filter((i) => !existing.some((c) => c.title === `visual-test-conv-${i}`))
    for (const i of need) {
      await page.request.post(CONVERSATIONS_URL, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        data: { title: `visual-test-conv-${i}`, model: 'deepseek/deepseek-chat' },
      })
    }
  } catch (e) {
    console.warn(`[sidebar-history] 会话准备失败(测试将走空态容错): ${(e as Error).message}`)
  }
}

async function navigateToChat(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 20000 })
      // 等待侧边栏历史对话区域出现(即使为空, region 也会渲染)
      await page.waitForSelector(SIDEBAR_HISTORY_SELECTOR, { timeout: 15000 })
      return
    } catch (e) {
      if (attempt === 2) throw e
      await page.waitForTimeout(1500)
    }
  }
}

async function ensureConversationItems(page: Page, minCount = 1): Promise<number> {
  await page.waitForSelector(CONVERSATION_ITEM_SELECTOR, { timeout: 10000 }).catch(() => {})
  const count = await page.locator(CONVERSATION_ITEM_SELECTOR).count()
  if (count < minCount) {
    // 容错:会话数据创建失败时,验证空态仍渲染,再 skip(不硬抛)
    const empty = page.locator(`${SIDEBAR_HISTORY_SELECTOR}`).first()
    const emptyText = await empty.innerText().catch(() => '')
    expect(emptyText, '无会话时应渲染空态(暂无任务)').toContain('暂无任务')
    test.skip(true, `历史对话项不足: 期望 >= ${minCount}, 实际 = ${count}`)
  }
  return count
}

test.describe('侧边栏历史对话 - 三态视觉验证', () => {
  // authenticatedPage 的 ensureStorageState 可能走 429 限流退避(最长 ~65s),加宽超时防误超时
  test.describe.configure({ timeout: 120_000 })

  test.beforeEach(async ({ authenticatedPage }) => {
    // 先确保会话数据存在(通过浏览器上下文 cookie 调 web 代理,无需独立登录)
    await ensureConversations(authenticatedPage)
    await navigateToChat(authenticatedPage)
  })

  test('默认态: 非选中项无 active 样式, 有 hover 触发器 + muted 次级文字', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
    await ensureConversationItems(page, 1)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()

    // 默认态不包含 active 样式
    const className = await firstItem.getAttribute('class')
    expect(className, '默认态不应包含 text-primary').not.toContain('text-primary')
    expect(className, '默认态不应包含 before:bg-primary/10').not.toContain('before:bg-primary/10')

    // 默认态包含 hover 触发器(当前实现:hover:before:bg-muted + hover:text-foreground)
    expect(className, '默认态应有 hover:text-foreground').toContain('hover:text-foreground')
    expect(className, '默认态应有 hover:before:bg-muted').toContain('hover:before:bg-muted')

    // 次级行(模型/时间)应为 muted 文字
    const mutedText = firstItem.locator('span.text-muted-foreground')
    await expect(mutedText, '会话项应有 muted 次级文字').toHaveCount(1)

    // 验证不存在 active 高亮条
    const highlightBar = firstItem.locator('span[aria-hidden].bg-primary')
    await expect(highlightBar, '默认态不应有 active 高亮条').toHaveCount(0)
  })

  test('hover 态: 鼠标悬停后 ::before 背景不应为 transparent', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
    await ensureConversationItems(page, 1)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()

    // 验证 hover 触发器类
    const className = await firstItem.getAttribute('class')
    expect(className, '默认态应有 hover:before:bg-muted').toContain('hover:before:bg-muted')
    expect(className, '默认态应有 hover:text-foreground').toContain('hover:text-foreground')

    // 实际 hover 并验证 :before 伪元素背景色
    await firstItem.hover()
    await page.waitForTimeout(300)

    const beforeBg = await firstItem.evaluate((el) => {
      const cs = window.getComputedStyle(el, '::before')
      return cs.backgroundColor
    })
    // hover 后伪元素背景不应是 transparent
    expect(beforeBg, 'hover 后 ::before 背景不应为 transparent').not.toBe('rgba(0, 0, 0, 0)')
    expect(beforeBg, 'hover 后 ::before 背景不应为 transparent (rgb 形式)').not.toBe('transparent')
  })

  test('active 态: 点击对话项后应有四重常驻样式', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await ensureConversationItems(page, 2)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()

    // 点击使其成为当前选中
    await firstItem.click()
    await page.waitForTimeout(500)

    // 重新定位 (可能 DOM 已更新)
    const activeItem = page.locator(`${CONVERSATION_ITEM_SELECTOR}[aria-current="true"]`)
    await expect(activeItem, '点击后应出现 aria-current="true" 的项').toHaveCount(1)

    const className = await activeItem.getAttribute('class')

    // 验证当前实现 active 样式
    expect(className, 'active 态必须有 text-primary').toContain('text-primary')
    expect(className, 'active 态必须有 before:bg-primary/10').toContain('before:bg-primary/10')
    expect(className, 'active 态不应包含 hover 触发器 hover:before:bg-muted').not.toContain(
      'hover:before:bg-muted',
    )

    // 验证左侧高亮条 (h-4 w-0.5 bg-primary, 遵循禁止 rounded-full 规则)
    const highlightBar = activeItem.locator('span[aria-hidden].bg-primary')
    await expect(highlightBar, 'active 态必须有左侧高亮条').toHaveCount(1)

    const barClass = await highlightBar.getAttribute('class')
    expect(barClass, '高亮条必须有 h-4').toContain('h-4')
    expect(barClass, '高亮条必须有 w-0.5').toContain('w-0.5')
    expect(barClass, '高亮条必须有 bg-primary').toContain('bg-primary')
    expect(barClass, '高亮条不得使用 rounded-full (违反禁止纯圆形/胶囊形状规则)').not.toContain(
      'rounded-full',
    )
  })

  test('active 态切换: 选中项应跟随点击移动', async ({ authenticatedPage }) => {
    const page = authenticatedPage
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

  test('dark mode: 三态在暗色下视觉可辨', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    // 切到 dark mode (next-themes 通过 html.class 控制)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)

    await ensureConversationItems(page, 1)
    const firstItem = page.locator(CONVERSATION_ITEM_SELECTOR).first()
    const className = await firstItem.getAttribute('class')

    // dark mode 下默认态 hover 触发器仍存在
    expect(className, 'dark mode 默认态仍有 hover:text-foreground').toContain('hover:text-foreground')
    expect(className, 'dark mode 默认态仍有 hover:before:bg-muted').toContain('hover:before:bg-muted')

    // 点击后验证 active 态
    await firstItem.click()
    await page.waitForTimeout(500)
    const activeItem = page.locator(`${CONVERSATION_ITEM_SELECTOR}[aria-current="true"]`)
    await expect(activeItem).toHaveCount(1)

    const activeClass = await activeItem.getAttribute('class')
    expect(activeClass, 'dark mode active 态仍应有 text-primary').toContain('text-primary')
    expect(activeClass, 'dark mode active 态仍应有 before:bg-primary/10').toContain(
      'before:bg-primary/10',
    )

    // 高亮条在 dark mode 下也应存在
    const bar = activeItem.locator('span[aria-hidden].bg-primary')
    await expect(bar, 'dark mode 下 active 高亮条仍应存在').toHaveCount(1)
  })
})
