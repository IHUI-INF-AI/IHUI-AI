// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V3 #63 —— 对话流业务表单帧 `form_request` 的端到端注入验证(2026-09-27 立)。
 *
 * 为什么这张卡需要一份**注入式** e2e:后端两侧对 form_request 今天**零生产点**
 * (`apps/api/src` 与 `apps/ai-service/app` 全量 grep 0 命中),真链路跑不到这一格。
 * 但"没有生产者"不构成"消费侧不验" —— 那正是"造一条永远不响的通道"与"把已存在的
 * 解析通道接好、只等生产点"的分界线。本 spec 用 page.route 把 stream 端点整条换掉、
 * 直接回放一帧 form_request,验证的是前端整条链:
 *   SSE 行 → @ihui/api-client 解析层 → send-message 的 onFormRequest
 *   → business-form store → **真实 MessageList** 消息流内长出的卡片
 *   → 用户批准/拒绝 → form_response 上行 body。
 * 后端补上生产点后,这里回放的帧形状就是线格式的回归样本。
 *
 * 断言口径(与 `src/components/chat/__tests__/form-request-*.test.*` 互补,不重复):
 *  - 卡片挂在**那条 assistant 消息之下**(data-message-id),不是全局浮层;
 *  - 批准/拒绝两个入口成对在场(协议硬约束);
 *  - 批准 → body 带 request_id/values、不带 reject_reason;
 *  - 拒绝 → body 带 reject_reason、**整字段省略 values**(拒绝零副作用)。
 *
 * 运行前提同其它 e2e:web server + 登录态 fixture(`adminPage`)。
 * 本 spec 不触达任何模型:stream 与 form-response 两条端点都被 mock。
 */
import { test, expect } from './fixtures'
import type { Page, Route } from '@playwright/test'

const CONV_ID = 'e2e-form-request-conv'
const ASSISTANT_MSG_ID = 'e2e-form-request-assistant'
const REQUEST_ID = 'frm-e2e-001'
const SESSION_ID = 'sess-e2e-001'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** 一帧 form_request 的 wire 形状(字段与 contract.ts 的 FormRequestFramePayload 同名) */
function formRequestFrame(kind: 'email'): string {
  return `data: ${JSON.stringify({
    type: 'form_request',
    requestId: REQUEST_ID,
    sessionId: SESSION_ID,
    kind,
    fields: [
      { key: 'to', type: 'email', required: true },
      { key: 'subject', type: 'text', required: true },
      { key: 'body', type: 'multiline', required: true },
    ],
    actions: ['approve', 'reject'],
    messageId: ASSISTANT_MSG_ID,
  })}\n\n`
}

/**
 * mock 会话后端(列表/详情/消息)。
 * 详情必须 200 —— ai-side-panel 的 loadHistory 在详情取不到时会把 conversationId
 * 重置为 null(同 e2e/chat-manual-compact.spec.ts 记过的坑),那样卡片永远不会出现。
 */
async function mockConversationBackend(page: Page): Promise<void> {
  const now = new Date().toISOString()
  const conv = {
    id: CONV_ID,
    userId: 'admin',
    title: 'E2E Form Request',
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  }
  const messages = [
    {
      id: ASSISTANT_MSG_ID,
      conversationId: CONV_ID,
      role: 'assistant',
      content: '需要我帮你把这封邮件发出去吗?',
      createdAt: now,
    },
  ]
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
          data: { messages, page: 1, pageSize: 100, total: messages.length },
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

/**
 * 把 stream 端点整条换成一段固定 SSE(末尾带一帧 form_request),
 * 并捕获所有 form-response POST(不发真请求)。
 */
async function mockStreamAndCaptureResponse(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__e2eFormResponses = []
  })
  await page.route(/\/api\/ai\/chat\/stream/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        `data: ${JSON.stringify({ type: 'chunk', content: '需要我帮你把这封邮件发出去吗?' })}\n\n`,
        formRequestFrame('email'),
        `data: ${JSON.stringify({ type: 'done' })}\n\n`,
      ].join(''),
    })
  })
  await page.route(/\/llm\/complete\/stream\/[^/]+\/form-response/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
    await page.evaluate((payload: unknown) => {
      const sink = (window as unknown as Record<string, unknown[]>).__e2eFormResponses
      sink?.push(payload as Record<string, unknown>)
    }, body)
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ code: 0, message: 'ok', data: { ok: true } }),
    })
  })
}

/** 读取捕获到的 form_response body 列表 */
async function capturedResponses(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(
    () =>
      ((window as unknown as Record<string, unknown[]>).__e2eFormResponses ??
        []) as Array<Record<string, unknown>>,
  )
}

async function openConversation(page: Page): Promise<void> {
  await page.goto(`/?conversationId=${CONV_ID}`)
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  // 面板就绪标志:输入框可见(与既有 e2e 同口径,不等具体文案)
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 30_000 })
}

async function sendTurn(page: Page, text: string): Promise<void> {
  const box = page.locator('textarea').first()
  await box.click()
  await box.fill(text)
  await box.press('Enter')
}

function sectionInStream(page: Page) {
  return page.locator(`[data-testid="business-form-section"][data-message-id="${ASSISTANT_MSG_ID}"]`)
}

test.describe('V3 #63 对话流业务表单帧 form_request', () => {
  test('回放一帧 form_request ⇒ 消息流内那条 assistant 消息之下长出表单卡', async ({
    adminPage,
  }) => {
    const page = adminPage
    await mockConversationBackend(page)
    await mockStreamAndCaptureResponse(page)
    await openConversation(page)
    await sendTurn(page, '帮我写封邮件给张三')

    const section = sectionInStream(page)
    await expect(section).toBeVisible({ timeout: 15_000 })
    const card = section.locator('[data-form-kind]')
    await expect(card).toHaveAttribute('data-form-kind', 'email')
    await expect(card).toHaveAttribute('data-form-request-id', REQUEST_ID)
    // 成对动作:两个入口必须同时在场(协议硬约束,缺一条即畸形帧)
    await expect(section.locator('[data-action="approve"]')).toBeVisible()
    await expect(section.locator('[data-action="reject"]')).toBeVisible()
  })

  test('批准 ⇒ form_response 带 request_id 与 values、不带 reject_reason', async ({
    adminPage,
  }) => {
    const page = adminPage
    await mockConversationBackend(page)
    await mockStreamAndCaptureResponse(page)
    await openConversation(page)
    await sendTurn(page, '帮我写封邮件给张三')

    const section = sectionInStream(page)
    await expect(section).toBeVisible({ timeout: 15_000 })
    await section.locator('[data-form-field="to"] input').fill('zhangsan@example.com')
    await section.locator('[data-form-field="subject"] input').fill('合作邀约')
    await section.locator('[data-form-field="body"] textarea').fill('正文内容')
    await section.locator('[data-action="approve"]').click()

    await expect
      .poll(async () => (await capturedResponses(page)).length, { timeout: 10_000 })
      .toBe(1)
    const [body] = await capturedResponses(page)
    expect(body?.request_id).toBe(REQUEST_ID)
    expect(body?.action).toBe('approve')
    expect(body?.values).toMatchObject({ to: 'zhangsan@example.com' })
    expect('reject_reason' in (body ?? {})).toBe(false)
  })

  test('拒绝 ⇒ form_response 带 reject_reason、整字段省略 values(拒绝零副作用)', async ({
    adminPage,
  }) => {
    const page = adminPage
    await mockConversationBackend(page)
    await mockStreamAndCaptureResponse(page)
    await openConversation(page)
    await sendTurn(page, '帮我写封邮件给张三')

    const section = sectionInStream(page)
    await expect(section).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('business-form-reject-reason').fill('先不要发')
    await section.locator('[data-action="reject"]').click()

    await expect
      .poll(async () => (await capturedResponses(page)).length, { timeout: 10_000 })
      .toBe(1)
    const [body] = await capturedResponses(page)
    expect(body?.action).toBe('reject')
    expect(body?.reject_reason).toBe('先不要发')
    // 不是"空对象",是根本没有这个键(空对象会诱导后端建一条空草稿)
    expect('values' in (body ?? {})).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
