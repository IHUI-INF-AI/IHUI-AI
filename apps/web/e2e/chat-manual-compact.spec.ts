// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

import { test, expect, type Page } from './fixtures'

/**
 * 手动压缩上下文按钮 E2E 防回归(2026-09-02 立)。
 *
 * 被测功能:
 *  - AI 对话输入工具栏右侧簇(ContextUsageRing 左侧)的"压缩上下文"按钮
 *    (apps/web/src/components/chat/message-input.tsx,Scissors 剪刀图标,
 *    data-testid="compact-context-button",aria-label 随 loading 态切换)。
 *
 * 行为契约(message-input.tsx handleCompact):
 *  - 点击 → POST /api/chat/compact,body { conversationId };请求中按钮 loading 禁用;
 *  - compressed=true → toast.success "上下文已压缩: {before} → {after} tokens(节省 {saved})"
 *    + 重新拉取会话消息(GET /conversations/{id}/messages);
 *  - reason=too_few_messages → toast.info "对话消息太少,无需压缩";
 *  - reason=incompressible → toast.info "当前上下文已无可压缩空间";
 *  - 404/其他错误 → toast.error "压缩失败"(fetchApi 错误归一化,不 throw)。
 *
 * 测试策略(标准 E2E UI 逻辑测试做法):
 *  - 用 page.route 拦截 POST /api/chat/compact 返回不同响应,不依赖真实 AI/后端,
 *    真实链路已由人工浏览器验证过;
 *  - 会话 ID 通过 chat store 的 zustand persist(localStorage key 'ihui-chat',
 *    version 5,partialize 含 conversationId)注入,让按钮从 disabled 变 enabled,
 *    避免走真实"发送消息创建会话 + SSE 流"长链路;
 *  - 会话详情/消息 GET 一并 mock(详情 404 会被 ai-side-panel loadHistory
 *    重置 conversationId 为 null;消息 GET 覆盖压缩成功分支的 getMessages)。
 *
 * 断言文案来源: packages/i18n/messages/web/zh-CN.json → chat.compaction 区块。
 */

const COMPACT_CONV_ID = 'e2e-compact-conv-1'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

// zh-CN 文案(packages/i18n/messages/web/zh-CN.json → chat.compaction)
const TEXT_COMPACT_SUCCESS = '上下文已压缩' // compactSuccess: "上下文已压缩: {before} → {after} tokens(节省 {saved})"
const TEXT_TOO_FEW = '无需压缩' // compactTooFew: "对话消息太少,无需压缩"
const TEXT_INCOMPRESSIBLE = '当前上下文已无可压缩空间' // compactIncompressible
const TEXT_FAILED = '压缩失败' // compactFailed

/** 压缩按钮定位(data-testid,与 aria-label 解耦:loading 时 aria-label 会变) */
function compactButton(page: Page) {
  return page.getByTestId('compact-context-button')
}

/** 按文案过滤的 sonner toast */
function toastByText(page: Page, text: string) {
  return page.locator('[data-sonner-toast]').filter({ hasText: text })
}

/**
 * mock 会话后端 GET 链路(conversations 列表 / 详情 / messages)。
 * 关键:详情 GET /conversations/{id} 必须返回会话对象 —— ai-side-panel 的
 * loadHistory effect 在详情 404/空时会 setConversationId(null)(ai-side-panel.tsx
 * else/catch 分支),把注入的会话 ID 清掉导致按钮回到 disabled。
 * messages GET 覆盖:面板加载 + 压缩成功分支压缩后的 getMessages。
 */
async function mockConversationBackend(page: Page): Promise<void> {
  const conv = {
    id: COMPACT_CONV_ID,
    userId: 'admin',
    title: 'E2E Manual Compact Test',
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await page.route(/\/api\/chat\/conversations/, async (route) => {
    const req = route.request()
    if (req.method() !== 'GET') {
      await route.continue()
      return
    }
    const path = new URL(req.url()).pathname
    // GET /api/chat/conversations/{id}/messages → 空消息列表
    if (/\/conversations\/[^/]+\/messages$/.test(path)) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            messages: [],
            page: 1,
            pageSize: 100,
            total: 0,
            hasMore: false,
            nextCursor: null,
          },
        }),
      })
      return
    }
    // GET /api/chat/conversations/{id} → 会话详情(loadHistory 验证会话存在)
    if (/\/conversations\/[^/]+$/.test(path)) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 0, message: 'ok', data: { conversation: conv } }),
      })
      return
    }
    // GET /api/chat/conversations(列表)→ 空列表
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { conversations: [], page: 1, pageSize: 20, total: 0 },
      }),
    })
  })
}

/** mock POST /api/chat/compact(可注入响应延迟,观察按钮 loading 中间态) */
interface CompactMockResponse {
  status: number
  data: Record<string, unknown>
  delayMs?: number
}

async function mockCompact(page: Page, res: CompactMockResponse): Promise<void> {
  await page.route(/\/api\/chat\/compact(\?|$)/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    if (res.delayMs) await new Promise((r) => setTimeout(r, res.delayMs))
    await route.fulfill({
      status: res.status,
      headers: JSON_HEADERS,
      body: JSON.stringify({ code: 0, message: 'ok', data: res.data }),
    })
  })
}

/** 进入 /chat 并等待压缩按钮渲染(adminPage 已登录,不会被重定向) */
async function gotoChat(page: Page): Promise<void> {
  await page.goto('/chat')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 })
  await expect(compactButton(page)).toBeVisible({ timeout: 20_000 })
}

/**
 * 注入会话 ID 后进入 /chat,使压缩按钮 enabled。
 * chat store 持久化(stores/chat.ts):localStorage key 'ihui-chat',version 5,
 * partialize 含 conversationId —— zustand persist rehydrate 时 shallow merge,
 * 其余字段走初始默认值。
 */
async function gotoChatWithConversation(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, cid }) => {
      localStorage.setItem(key, JSON.stringify({ state: { conversationId: cid }, version: 5 }))
    },
    { key: 'ihui-chat', cid: COMPACT_CONV_ID },
  )
  await gotoChat(page)
  await expect(compactButton(page)).toBeEnabled({ timeout: 20_000 })
}

test.describe('手动压缩上下文按钮', () => {
  // ── a. 初始态:无会话 → 按钮 disabled ──────────────────────────────────
  // adminPage 的 storageState(fixtures.ts)只注入 token/user/ihui-auth 三个
  // localStorage 键,不含 'ihui-chat' → conversationId 初始为 null → disabled
  // (disabled={compacting || isStreaming || !conversationId})。
  test('无会话时压缩按钮 disabled', async ({ adminPage: page }) => {
    await gotoChat(page)
    await expect(compactButton(page)).toBeDisabled()
    // 可访问性:按钮带非空 aria-label(压缩上下文)
    const ariaLabel = await compactButton(page).getAttribute('aria-label')
    expect(ariaLabel, '压缩按钮必须有 aria-label').toBeTruthy()
    expect(ariaLabel?.length ?? 0).toBeGreaterThan(0)
  })

  // ── b. too_few_messages → info toast + loading 中间态 + 恢复 ──────────
  test('too_few_messages → info toast + 按钮 loading 后恢复', async ({ adminPage: page }) => {
    await mockConversationBackend(page)
    // 600ms 响应延迟:保证点击后有足够的 loading 观察窗口
    await mockCompact(page, {
      status: 200,
      delayMs: 600,
      data: {
        compressed: false,
        reason: 'too_few_messages',
        originalTokens: 120,
        compressedTokens: 0,
        removedCount: 0,
      },
    })
    await gotoChatWithConversation(page)

    await compactButton(page).click()

    // 请求中:按钮禁用 + Loader2 旋转图标(SVG.animate-spin)
    await expect(compactButton(page)).toBeDisabled()
    await expect(compactButton(page).locator('svg.animate-spin')).toBeVisible()

    // info toast 文案(too_few_messages 分支)
    await expect(toastByText(page, TEXT_TOO_FEW)).toBeVisible({ timeout: 5000 })

    // 响应结束后按钮恢复可点
    await expect(compactButton(page)).toBeEnabled({ timeout: 5000 })
  })

  // ── c. compressed=true → success toast 含压缩前后 token 数 ────────────
  test('compressed=true → success toast 含"上下文已压缩" + token 数', async ({
    adminPage: page,
  }) => {
    await mockConversationBackend(page)
    await mockCompact(page, {
      status: 200,
      data: {
        compressed: true,
        originalTokens: 5000,
        compressedTokens: 3000,
        removedCount: 5,
        trigger: 'manual',
      },
    })
    await gotoChatWithConversation(page)

    await compactButton(page).click()

    // success toast 文案(ICU 插值): "上下文已压缩: 5000 → 3000 tokens(节省 2000)"
    // 注意:next-intl 对 number 参数默认走 Intl.NumberFormat(zh-CN 千分位
    // 5000 → "5,000"),用正则同时兼容有/无千分位;先等可见再同步读文本,
    // 避免 sonner 4s 自动关闭后轮询断言读到 0 元素。
    const toast = toastByText(page, TEXT_COMPACT_SUCCESS)
    await expect(toast).toBeVisible({ timeout: 5000 })
    const toastText = (await toast.textContent()) ?? ''
    expect(toastText).toContain(TEXT_COMPACT_SUCCESS)
    expect(toastText).toMatch(/5[,.]?000/)
    expect(toastText).toMatch(/3[,.]?000/)

    // 按钮恢复
    await expect(compactButton(page)).toBeEnabled({ timeout: 5000 })
  })

  // ── d. 404 → 错误 toast ────────────────────────────────────────────────
  test('404 → 错误 toast"压缩失败" + 按钮恢复', async ({ adminPage: page }) => {
    await mockConversationBackend(page)
    // fetchApi 对非 2xx 归一化为 { success:false, error } → handleCompact 走
    // toast.error(compactFailed) 分支(或 catch 兜底,文案一致)
    await mockCompact(page, {
      status: 404,
      data: { code: 404, message: 'conversation not found' },
    })
    await gotoChatWithConversation(page)

    await compactButton(page).click()

    await expect(toastByText(page, TEXT_FAILED)).toBeVisible({ timeout: 5000 })
    await expect(compactButton(page)).toBeEnabled({ timeout: 5000 })
  })

  // ── e. incompressible → info toast ─────────────────────────────────────
  test('incompressible → info toast"无可压缩空间" + 按钮恢复', async ({ adminPage: page }) => {
    await mockConversationBackend(page)
    await mockCompact(page, {
      status: 200,
      data: {
        compressed: false,
        reason: 'incompressible',
        originalTokens: 8000,
        compressedTokens: 8000,
        removedCount: 0,
      },
    })
    await gotoChatWithConversation(page)

    await compactButton(page).click()

    await expect(toastByText(page, TEXT_INCOMPRESSIBLE)).toBeVisible({ timeout: 5000 })
    await expect(compactButton(page)).toBeEnabled({ timeout: 5000 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
