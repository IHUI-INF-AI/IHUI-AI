// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { Locator, Route } from '@playwright/test'
import { test, expect, type Page } from './fixtures'

/**
 * 矩阵 A #19:附件(图/文件 Chip + 超长粘贴压缩)E2E。
 *
 * 覆盖 3 个 case(登录态 adminPage,参考 ai-tool-loop.spec.ts 的守卫写法):
 * 1. 超长纯文本(>4000 字符)粘贴 → 转为文本引用 chip,textarea 不被塞入全文
 * 2. 带文本 chip 发送 → 请求 body 的 content 含全文(fenced code block,
 *    修复此前 text 类型只发 label 前 30 字符的断链)
 * 3. file input 添加 1x1 png → chip 展示上传态(Loader2 转圈)→ 上传完成后发送
 *    → 请求 content 含 ![x.png](/api/files/f-1)(serverUrl 替代 blob: objectURL)
 *
 * mock 说明:
 * - /api/files/upload/form 按任务契约返回 { success: true, data: { file } } 裸包装
 *   (无 code 字段时 fetchApi 把整个响应体作为 data 返回,use-message-references
 *   兼容读取 data.data.file);真实后端为 success() 助手的 code=0 标准包装,两者均兼容
 * - 会话创建/加载 + SSE 端点 mock 参考本目录 plan/terminal 用例的最小依赖集
 */

const LONG_TEXT_MARKER = 'MATRIX-A19-LONGPASTE'
const LONG_TEXT = `${LONG_TEXT_MARKER} ${'哈'.repeat(5000)}`
/** 1x1 png(标准 base64,仅用于 setInputFiles 触发前端链路,上传被 mock 拦截) */
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

type ChatBody = Record<string, unknown> | null

/** mock 会话创建/加载 + SSE 流 + 上传端点(登录态访问 /chat 发消息的最小依赖集) */
async function setupChatMocks(
  page: Page,
  opts: { uploadDelayMs?: number; onChatBody?: (body: ChatBody) => void } = {},
): Promise<void> {
  const e2eConversationId = 'e2e-conv-attachment'
  const conversationRouteMatcher = (url: URL) =>
    url.pathname === '/api/chat/conversations' ||
    url.pathname.startsWith('/api/chat/conversations/')
  await page.route(conversationRouteMatcher, async (route) => {
    const method = route.request().method()
    const pathname = new URL(route.request().url()).pathname
    const accept = (data: unknown) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 0, message: 'ok', data }),
      })

    if (method === 'POST' && pathname === '/api/chat/conversations') {
      await accept({ conversation: { id: e2eConversationId } })
      return
    }
    if (method === 'GET' && /^\/api\/chat\/conversations\/[^/]+\/messages$/.test(pathname)) {
      await accept({ messages: [], nextCursor: null, hasMore: false })
      return
    }
    if (method === 'GET' && /^\/api\/chat\/conversations\/[^/]+$/.test(pathname)) {
      await accept({ conversation: { id: e2eConversationId, title: null, metadata: null } })
      return
    }
    await route.continue()
  })

  // SSE 流端点:捕获请求 body(内含最终 content)后返回最小 chunk+done,
  // 同时覆盖 /api/ai/chat/stream 与 /api/llm/complete/stream(与 ai-tool-loop 一致)
  const sseHandler = async (route: Route) => {
    try {
      opts.onChatBody?.(route.request().postDataJSON() as ChatBody)
    } catch {
      opts.onChatBody?.(null)
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: 'event: chunk\ndata: {"content":"已完成"}\n\nevent: done\ndata: {"content":"已完成"}\n\n',
    })
  }
  await page.route('**/api/ai/chat/stream', sseHandler)
  await page.route('**/api/llm/complete/stream', sseHandler)

  // 上传端点 mock:按任务契约返回 201 + { success, data.file },path 透传为公开 URL
  await page.route('**/api/files/upload/form', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    if (opts.uploadDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, opts.uploadDelayMs))
    }
    await route.fulfill({
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: {
          file: {
            id: 'f-1',
            name: 'x.png',
            size: 1,
            mimeType: 'image/png',
            path: '/api/files/f-1',
          },
        },
      }),
    })
  })
}

/** 访问 /chat 并等待输入框挂载(Next.js dev 冷编译可能数秒,参考 plan/terminal 用例);不可达返回 false */
async function gotoChat(page: Page): Promise<Locator | null> {
  await page.goto('/chat')
  await page.waitForLoadState('domcontentloaded')
  if (!page.url().includes('/chat')) return null
  const textarea = page.locator('textarea').first()
  try {
    await textarea.waitFor({ state: 'visible', timeout: 20000 })
  } catch {
    return null
  }
  return textarea
}

/** 在 textarea 上派发真实 ClipboardEvent paste。
 * 注意:Playwright 的 keyboard.insertText 只派发 input 事件(insertText 输入语义),
 * 不触发 paste 事件链路,故用 ClipboardEvent 走 useMessageSend.handlePaste 真实 handler。 */
async function pasteText(textarea: Locator, text: string): Promise<void> {
  await textarea.evaluate((el, value) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', value)
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, text)
}

test.describe('矩阵 A #19 附件 chip 与超长粘贴', () => {
  test('超长纯文本粘贴转为文本 chip,textarea 不被塞入全文', async ({ adminPage }) => {
    await setupChatMocks(adminPage)
    const textarea = await gotoChat(adminPage)
    if (!textarea) return

    await textarea.fill('')
    await pasteText(textarea, LONG_TEXT)

    // 断言 1:文本 chip 出现(引用面板中展示截断 label)
    const chip = adminPage.locator('li', { hasText: LONG_TEXT_MARKER }).first()
    await expect(chip).toBeVisible({ timeout: 10000 })
    // 断言 2:textarea 未被塞入全文(preventDefault 失效时全文会直达输入框)
    const value = await textarea.inputValue()
    expect(value.length).toBeLessThan(100)
    expect(value).not.toContain(LONG_TEXT_MARKER)
  })

  test('带文本 chip 发送 → 请求 body 的 content 含全文(fenced code block)', async ({
    adminPage,
  }) => {
    let chatBody: ChatBody = null
    await setupChatMocks(adminPage, { onChatBody: (body) => (chatBody = body) })
    const textarea = await gotoChat(adminPage)
    if (!textarea) return

    await textarea.fill('')
    await pasteText(textarea, LONG_TEXT)
    // 输入框保留正常文本与 chip 一并发送
    await textarea.fill(`请分析 ${LONG_TEXT_MARKER}`)
    await textarea.press('Enter')

    // 断言 1:聊天请求已发出(SSE 端点被 mock 捕获)
    await expect.poll(() => chatBody, { timeout: 20000 }).not.toBeNull()
    const raw = JSON.stringify(chatBody)
    // 断言 2:content 含 fenced code block 包裹的全文(而非截断的 30 字符 label)
    expect(raw).toContain('```')
    expect(raw).toContain(LONG_TEXT_MARKER)
    expect(raw).toContain('哈'.repeat(500))
  })

  test('图片附件上传态 chip → 上传完成后发送,content 含 ![x.png](serverUrl)', async ({
    adminPage,
  }) => {
    let chatBody: ChatBody = null
    await setupChatMocks(adminPage, {
      // 上传 mock 加延迟,让 uploading 态可被稳定断言
      uploadDelayMs: 800,
      onChatBody: (body) => (chatBody = body),
    })
    const textarea = await gotoChat(adminPage)
    if (!textarea) return

    const fileInput = adminPage.locator('input[type="file"][multiple]').first()
    await fileInput.setInputFiles({
      name: 'x.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_1X1_BASE64, 'base64'),
    })

    // 断言 1:图片 chip 出现且处于上传态(Loader2 转圈)
    const chip = adminPage.locator('li', { hasText: 'x.png' }).first()
    await expect(chip).toBeVisible({ timeout: 10000 })
    await expect(chip.locator('.animate-spin').first()).toBeVisible()

    // 断言 2:上传响应返回并回写 ready 后转圈消失
    await adminPage.waitForResponse(
      (r) => r.url().includes('/api/files/upload/form') && r.request().method() === 'POST',
    )
    await expect(chip.locator('.animate-spin')).toHaveCount(0, { timeout: 10000 })

    // 发送 → content 用服务端 URL 替代 blob: objectURL(blob: 断链修复)
    await textarea.fill('看看这张图')
    await textarea.press('Enter')

    await expect.poll(() => chatBody, { timeout: 20000 }).not.toBeNull()
    const raw = JSON.stringify(chatBody)
    expect(raw).toContain('![x.png](/api/files/f-1)')
    expect(raw).not.toContain('blob:')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
