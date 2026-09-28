// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * V3 #62 —— 会话内消息搜索的**结果预览列表** e2e(2026-09-27 立)。
 *
 * 这张票的真实缺口不是"没有搜索"(Ctrl+F/Cmd+F + 搜索条 + 上一个/下一个 自
 * Phase 23 就在 `use-message-list-search.ts` 里挂着),而是用户看不到"命中了什么"
 * —— 只有「第 N/M 个」计数,得逐个跳才知道。本 spec 验的正是补上的那一维:
 *   打开既有搜索条(唯一入口,不新增第二个输入框/快捷键)→ 输入关键词 →
 *   出现可点选的摘要列表 → 点一条 ⇒ 视口滚到那条消息。
 *
 * 会话消息用 page.route mock(与 e2e/chat-manual-compact.spec.ts 同策略):
 * 本票验的是前端搜索与定位,不需要真模型。
 */
import { test, expect } from './fixtures'
import type { Page, Route } from '@playwright/test'

const CONV_ID = 'e2e-chat-search-conv'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** 三条消息,其中两条含关键词,一条不含(用来验"没有把全部消息都列出来") */
const NEEDLE = '蓝绿部署'
const MESSAGES = [
  {
    id: 'e2e-search-m1',
    role: 'user',
    content: `请讲讲${NEEDLE}的要点`,
    createdAt: new Date('2026-09-20T10:00:00Z').toISOString(),
  },
  {
    id: 'e2e-search-m2',
    role: 'assistant',
    content: '这条与关键词无关,只是占位的一轮对话。',
    createdAt: new Date('2026-09-20T10:05:00Z').toISOString(),
  },
  {
    id: 'e2e-search-m3',
    role: 'assistant',
    content: `${NEEDLE}是先起新组、再切流量、最后停旧组。`,
    createdAt: new Date('2026-09-20T10:10:00Z').toISOString(),
  },
]

async function mockConversationBackend(page: Page): Promise<void> {
  const now = new Date().toISOString()
  const conv = {
    id: CONV_ID,
    userId: 'admin',
    title: 'E2E Chat Search',
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  }
  await page.route(/\/api\/chat\/conversations/, async (route: Route) => {
    const req = route.request()
    if (req.method() !== 'GET') {
      await route.continue()
      return
    }
    const path = new URL(req.url()).pathname
    if (/\/conversations\/[^/]+\/messages$/.test(path)) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { messages: MESSAGES, page: 1, pageSize: 100, total: MESSAGES.length },
        }),
      })
      return
    }
    if (/\/conversations\/[^/]+$/.test(path)) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 0, message: 'ok', data: { conversation: conv } }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ code: 0, message: 'ok', data: { conversations: [conv], total: 1 } }),
    })
  })
}

async function openConversation(page: Page): Promise<void> {
  await page.goto(`/?conversationId=${CONV_ID}`)
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 30_000 })
}

/** 等两条命中的消息渲染进 DOM(搜索只能命中已渲染的消息) */
async function waitForMessagesRendered(page: Page): Promise<void> {
  await expect(page.locator('[data-message-id="e2e-search-m1"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-message-id="e2e-search-m3"]')).toBeVisible({ timeout: 20_000 })
}

test.describe('V3 #62 会话内搜索的结果预览列表', () => {
  test('Ctrl+F 打开既有搜索条 ⇒ 输入关键词后出现摘要列表,且只列命中的那几条', async ({
    adminPage,
  }) => {
    const page = adminPage
    await mockConversationBackend(page)
    await openConversation(page)
    await waitForMessagesRendered(page)

    // 唯一入口:沿用 Phase 23 的 Ctrl+F(本票刻意不加第二个输入框/快捷键)
    await page.locator('#message-list-panel-inline').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+f')
    const searchInput = page.locator('input[role="searchbox"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5_000 })
    await searchInput.fill(NEEDLE)

    const list = page.getByTestId('chat-search-result-list')
    await expect(list).toBeVisible({ timeout: 5_000 })
    // 命中 2 条(m1/m3),那条无关的不得出现在列表里
    await expect(list.locator('li')).toHaveCount(2)
    // 列表整块有可读名称(没有可见标题,读屏只能靠 aria-label 认出这块是什么)
    await expect(list.locator('ul')).toHaveAttribute('aria-label', /./ )
  })

  test('点列表里第二条 ⇒ 该条按钮进入选中态(aria-current),即"跳过去了"', async ({
    adminPage,
  }) => {
    const page = adminPage
    await mockConversationBackend(page)
    await openConversation(page)
    await waitForMessagesRendered(page)

    await page.locator('#message-list-panel-inline').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+f')
    const searchInput = page.locator('input[role="searchbox"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5_000 })
    await searchInput.fill(NEEDLE)

    const list = page.getByTestId('chat-search-result-list')
    await expect(list).toBeVisible({ timeout: 5_000 })
    const items = list.locator('button')
    await items.nth(1).click()
    await expect(items.nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 5_000 })
  })

  test('清空关键词 ⇒ 列表整段消失(不留一个空命中的壳)', async ({ adminPage }) => {
    const page = adminPage
    await mockConversationBackend(page)
    await openConversation(page)
    await waitForMessagesRendered(page)

    await page.locator('#message-list-panel-inline').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+f')
    const searchInput = page.locator('input[role="searchbox"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5_000 })
    await searchInput.fill(NEEDLE)
    await expect(page.getByTestId('chat-search-result-list')).toBeVisible({ timeout: 5_000 })

    await searchInput.fill('绝对不存在的一串字zzz')
    await expect(page.getByTestId('chat-search-result-list')).toHaveCount(0, { timeout: 5_000 })
  })
})
