// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 消息流活动区设计系统 e2e 守门(2026-09-21 立)
//
// 起因:用户反馈"流式对话框内的内容、样式跟 Qoder / Trae / Codex 差太多,不一致"。
// 根因是各过程区段(工具卡/计划步骤/终端/子代理/思考)各写各的字号、圆角、配色,并且
// 行内只有功能名没有对象。现已统一到底层基元,本 spec 是防回潮闸:
//   1. 活动行字号/行高必须全一致(唯一 12px / 24px),任何再手写 text-[9px] 档位都会红;
//   2. 界面禁止出现英文工具码名(read_file 等),必须显示本地化功能名 + 对象 + 结果度量;
//   3. 过程信息收在 StreamGroup 里(可展开,组头带步数与用时)。
// 用 SSE mock,不依赖真实模型,CI 可重复。
import { test, expect, type Page } from './fixtures'

const CONVERSATION_ID = `e2e-stream-${Date.now()}`

const CONV = {
  id: CONVERSATION_ID,
  userId: 'admin',
  title: 'E2E Stream Design System',
  model: 'test-model',
  systemPrompt: null,
  metadata: null,
  lastMessageAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// streamChat 直连 API 端口并带 credentials,跨域必须回具体 origin(不能通配 *);OPTIONS 需 204。
// 按请求 Origin 回显,便于同一份 spec 既跑已起的 8801,也跑另起的 dev 端口。
function corsHeadersFor(req: { headers: () => Record<string, string> }): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers().origin || 'http://localhost:8801',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Accept, Last-Event-ID, X-Requested-With, x-device-fingerprint',
  }
}

function sse(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

async function mockConversation(page: Page): Promise<void> {
  await page.route('**/api/chat/conversations**', async (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeadersFor(req) })
      return
    }
    const json = (data: unknown) => ({
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeadersFor(req) },
      body: JSON.stringify({ code: 0, message: 'ok', data }),
    })
    if (req.method() === 'POST' && !url.includes('/messages')) {
      await route.fulfill(json({ conversation: CONV }))
      return
    }
    if (req.method() === 'GET' && /\/conversations\?/.test(url)) {
      await route.fulfill(json({ conversations: [CONV], page: 1, pageSize: 20, total: 1 }))
      return
    }
    if (/\/conversations\/[^/?]+\/messages/.test(url)) {
      await route.fulfill(
        json(
          req.method() === 'GET'
            ? { messages: [], page: 1, pageSize: 50, total: 0, hasMore: false, nextCursor: null }
            : { message: { id: 'persisted-1' } },
        ),
      )
      return
    }
    if (req.method() === 'GET' && /\/conversations\/[^/?]+$/.test(url)) {
      await route.fulfill(json({ conversation: CONV }))
      return
    }
    await route.fulfill(json({ conversation: CONV }))
  })
}

async function mockStream(
  page: Page,
  events: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  const body = sse([
    ...events,
    { type: 'chunk', content: '已读取并完成汇总。' },
    { type: 'done', content: '已读取并完成汇总。' },
  ])
  await page.route('**/ai/chat/stream', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeadersFor(req) })
      return
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeadersFor(req),
      },
      body,
    })
  })
}

test.describe('消息流活动区设计系统', () => {
  test.beforeEach(async ({ adminPage: page }) => {
    await mockConversation(page)
    await mockStream(page, [
      {
        type: 'tool-call-start',
        toolCallId: 'call-read-1',
        toolName: 'read_file',
        args: { path: 'apps/web/package.json' },
      },
      {
        type: 'tool-result',
        toolCallId: 'call-read-1',
        toolName: 'read_file',
        args: { path: 'apps/web/package.json' },
        result: { content: '{\n  "name": "@ihui/web",\n  "version": "1.0.0"\n}\n' },
      },
      {
        type: 'tool-call-start',
        toolCallId: 'call-search-1',
        toolName: 'web_search',
        args: { query: 'next 16 release notes' },
      },
      {
        type: 'tool-result',
        toolCallId: 'call-search-1',
        toolName: 'web_search',
        args: { query: 'next 16 release notes' },
        result: { results: [{ title: 'a' }, { title: 'b' }] },
      },
      {
        type: 'plan_updated',
        plan: [
          { id: 'p1', step: '读取 web 依赖清单', status: 'completed' },
          { id: 'p2', step: '核对 React 版本', status: 'in_progress' },
        ],
      },
    ])
    await page.goto('/chat')
    await expect(page).toHaveURL(/\/chat/, { timeout: 20000 })
    const textarea = page.locator('[data-testid="ai-side-panel-aside"] textarea').first()
    await expect(textarea).toBeVisible({ timeout: 20000 })
    await textarea.fill('E2E:检查消息流活动行样式一致性')
    await page.keyboard.press('Enter')
    await expect(page.getByText('已读取并完成汇总。').first()).toBeVisible({ timeout: 30000 })
  })

  test('工具行显示双时态活动措辞 + 对象 + 结果度量,不出现英文工具码名', async ({
    adminPage: page,
  }) => {
    const readRow = page.locator('[data-testid="tool-call-row-call-read-1"]')
    await expect(readRow).toBeVisible()
    const rowText = (await readRow.textContent()) ?? ''
    // mock 已下发 tool-result ⇒ 必须是完成时(D98/D102);此前这里只有中性功能名,
    // 状态全靠图标承载,对"看着界面读"的用户等于没有状态
    expect(rowText).toContain('已读取文件')
    expect(rowText).not.toContain('正在读取文件')
    expect(rowText).not.toContain('read_file')

    // 对象(文件路径)在 subject 槽,等宽字体
    const subject = readRow.locator('[data-stream-subject="true"]')
    await expect(subject).toBeVisible()
    expect(await subject.textContent()).toContain('apps/web/package.json')
    expect(await subject.evaluate((el) => getComputedStyle(el).fontFamily.toLowerCase())).toContain(
      'mono',
    )

    // 结果度量:4 行内容 → "4 行"(末尾换行不额外计一行)
    const metric = readRow.locator('[data-testid="stream-metric"]')
    await expect(metric).toBeVisible()
    expect(await metric.textContent()).toBe('4 行')

    // 检索工具行给命中数
    const searchRow = page.locator('[data-testid="tool-call-row-call-search-1"]')
    expect(((await searchRow.textContent()) ?? '').includes('已搜索网页')).toBe(true)
    expect(await searchRow.locator('[data-testid="stream-metric"]').textContent()).toBe('2 个结果')
  })

  test('全部活动行共用一档字号与行高(12px / 24px),不允许逐处自配', async ({ adminPage: page }) => {
    const group = page.locator('[data-stream-group]').first()
    await expect(group).toBeVisible()
    const trigger = group.locator('[data-stream-group-trigger="true"]')
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click()
    }
    // 只看消息流内的活动行:输入区任务状态条等不归本闸管,避免跨区段误判
    const rows = page.locator('[data-message-id] [data-stream-status]')
    await expect(rows.first()).toBeVisible()
    const metrics = await rows.evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el)
        return {
          testId: el.getAttribute('data-testid') ?? '',
          fontSize: cs.fontSize,
          height: cs.height,
          status: el.getAttribute('data-stream-status'),
        }
      }),
    )
    expect(metrics.length).toBeGreaterThanOrEqual(2)
    // 失败时点名哪一行漂了 —— 不点名会让下一次偶发红变成无从下手的哑谜
    expect(metrics.filter((m) => m.fontSize !== '12px' || m.height !== '24px')).toEqual([])
    // 组头与行同一档
    const headStyle = await trigger.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { fontSize: cs.fontSize, height: cs.height }
    })
    expect(headStyle).toEqual({ fontSize: '12px', height: '24px' })
  })

  test('过程组头带步数与用时摘要,展开后区段内容并入同一行模板', async ({ adminPage: page }) => {
    const group = page.locator('[data-stream-group]').first()
    const trigger = group.locator('[data-stream-group-trigger="true"]')
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click()
    }
    const headText = (await trigger.textContent()) ?? ''
    expect(headText).toMatch(/\d+ 个步骤/)
    // 展开后工具行挂在同一个组里(计划步骤行的渲染契约由单测 plan-steps-card.test.tsx 覆盖,
    // 消息级 planSteps 依赖后端回发带 messageId 的 plan_updated,e2e mock 不伪造该身份)
    await expect(group.locator('[data-stream-status]').first()).toBeVisible()
    expect(await group.locator('[data-stream-status]').count()).toBeGreaterThanOrEqual(2)
  })

  test('消息流内不得残留英文工具码名与错误码直显', async ({ adminPage: page }) => {
    const aside = page.locator('[data-testid="ai-side-panel-aside"]')
    const text = (await aside.innerText()) ?? ''
    expect(text).not.toMatch(
      /\b(read_file|write_file|edit_file|file_search|web_search|run_command)\b/,
    )
    expect(text).not.toMatch(/\b(http_4xx|http_5xx|timeout|connection|cancelled)\b/)
    expect(text).not.toMatch(/\b\d+ tools\b/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
