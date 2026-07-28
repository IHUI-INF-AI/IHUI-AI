import { setupTest as test, expect } from './fixtures'
import type { Page, Locator } from '@playwright/test'

/**
 * Phase 21 Timeline 实时响应 subagent SSE 事件 — E2E 测试(2026-07-29 立)
 *
 * 验证链路:
 *   ai-service 发 subagent_spawn / subagent_progress / subagent_end SSE 事件
 *   → api-client tryParseSubagent 解析
 *   → use-chat.ts onSubagentSpawn/Progress/End 回调
 *   → subagent-timeline-mapper 映射为 TimelineEvent / Partial<TimelineEvent>
 *   → timeline-store addEvent / updateEvent
 *   → Timeline tab UI 实时显示
 *
 * 策略(方案 A,推荐):用 page.route 拦截 /ai/chat/stream,返回 mock SSE 流,
 * 模拟 subagent 生命周期事件,验证 Timeline UI 实时更新。这是最真实的端到端测试。
 *
 * 约束:
 * - 使用 adminPage fixture(已带 admin storageState,无需手动登录)
 * - 不使用 test.skip / test.fixme
 * - 每个 test self-contained
 * - mock SSE + createConversation,避免依赖真实 AI 后端
 */

const CHAT_URL = '/chat'
const TRIGGER = '[data-testid="agent-progress-trigger"]'
const PANE = '[data-testid="agent-progress-pane"]'
const PANE_TAB_TIMELINE = '[data-testid="pane-tab-timeline"]'
const PANE_TAB_INLINE = '[data-testid="pane-tab-inline"]'
const TIMELINE_EVENT_ROW = '[data-testid="timeline-event-row"]'

/** 构造 SSE 流 body(每条事件 data: JSON\n\n) */
function makeSSE(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/** 当前时间戳(用于 mock SSE 事件,保证相对时间显示"刚刚") */
function nowISO(): string {
  return new Date().toISOString()
}

/** CORS 响应头(streamBaseUrl 直连 API 服务器 localhost:8802,跨域需 preflight)
 *  streamChat 使用 credentials:'include',因此 Access-Control-Allow-Origin 不能用通配 '*',
 *  必须用具体 origin(http://localhost:8801)+ Access-Control-Allow-Credentials: true */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'http://localhost:8801',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Last-Event-ID',
}

/** mock createConversation POST,避免污染数据库 */
async function mockConversation(page: Page): Promise<void> {
  await page.route('**/api/chat/conversations', async (route) => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS })
      return
    }
    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            conversation: {
              id: `e2e-conv-${Date.now()}`,
              userId: 'admin',
              title: 'E2E Timeline Test',
              model: 'test-model',
              systemPrompt: null,
              metadata: null,
              lastMessageAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      })
      return
    }
    await route.continue()
  })
}

/** mock SSE 流(拦截 /ai/chat/stream,返回固定 subagent 事件序列)
 *  streamBaseUrl 直连 API 服务器(localhost:8802),跨域 POST 需 CORS preflight,
 *  因此 OPTIONS 返回 204 + CORS headers,POST 返回 SSE body + CORS headers。 */
async function mockSSE(page: Page, body: string): Promise<void> {
  await page.route('**/ai/chat/stream', async (route) => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS })
      return
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
      body,
    })
  })
}

/** 导航到 /chat,等待 trigger 可见,打开 pane,切到 timeline tab */
async function openTimeline(page: Page): Promise<void> {
  await page.goto(CHAT_URL)
  await page.waitForLoadState('networkidle').catch(() => {})
  // 确保仍在 /chat(已登录态下不会被重定向)
  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })

  const trigger = page.locator(TRIGGER)
  await expect(trigger).toBeVisible({ timeout: 15000 })
  await trigger.click()

  const pane = page.locator(PANE)
  await expect(pane).toBeVisible({ timeout: 5000 })

  const tab = page.locator(PANE_TAB_TIMELINE)
  await expect(tab).toBeVisible({ timeout: 3000 })
  await tab.click()
  await page.waitForTimeout(300)
}

/** 在 textarea 输入消息并发送(Enter) */
async function sendMessage(page: Page, text: string): Promise<void> {
  const textarea = page.locator('textarea').first()
  await expect(textarea).toBeVisible({ timeout: 5000 })
  await textarea.fill(text)
  await page.keyboard.press('Enter')
}

/** 等待 Timeline 出现至少 1 个 subagent 事件行(data-event-type="subagent"),
 *  过滤掉 flattenToTimelineEvents 产生的 reference/plan 事件 */
async function waitForFirstEvent(page: Page, timeout = 12000): Promise<Locator> {
  const event = page.locator(`${TIMELINE_EVENT_ROW}[data-event-type="subagent"]`).first()
  await expect(event).toBeVisible({ timeout })
  return event
}

// ──────────────────────────────────────────────────────────────────────────
// 17 个 test case:覆盖 subagent SSE → Timeline UI 完整链路
// ──────────────────────────────────────────────────────────────────────────

test.describe('Phase 21 Timeline 实时响应 subagent SSE 事件', () => {
  test('1. subagent_spawn → Timeline 出现 subagent 类型事件(status=running)', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-001',
          role: 'code-reviewer',
          task: '审查 auth 模块安全性',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test spawn event')

    const event = await waitForFirstEvent(page)
    await expect(event).toHaveAttribute('data-event-type', 'subagent')
    await expect(event).toHaveAttribute('data-event-status', 'running')
    await expect(event).toHaveAttribute('data-event-id', 'sub-001')
  })

  test('2. subagent_progress(thinking)→ Timeline description 含"思考中"', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-002',
          role: 'researcher',
          task: '调研 SSE 链路',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_progress',
          id: 'sub-002',
          phase: 'thinking',
          iteration: 1,
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test thinking progress')

    const event = await waitForFirstEvent(page)
    const desc = await event.textContent()
    expect(desc).toContain('思考中')
  })

  test('3. subagent_progress(tool_call)→ Timeline description 含"调用工具"', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-003',
          role: 'coder',
          task: '编写工具调用',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_progress',
          id: 'sub-003',
          phase: 'tool_call',
          tool: 'read_file',
          iteration: 1,
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test tool_call progress')

    const event = await waitForFirstEvent(page)
    const desc = await event.textContent()
    expect(desc).toContain('调用工具')
  })

  test('4. subagent_progress(tool_result)→ Timeline description 含"工具返回"', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-004',
          role: 'coder',
          task: '验证工具返回',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_progress',
          id: 'sub-004',
          phase: 'tool_result',
          tool: 'read_file',
          ok: true,
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test tool_result progress')

    const event = await waitForFirstEvent(page)
    const desc = await event.textContent()
    expect(desc).toContain('工具返回')
  })

  test('5. subagent_progress(output_ready)→ Timeline description 含"输出就绪"', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-005',
          role: 'summarizer',
          task: '生成输出',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_progress',
          id: 'sub-005',
          phase: 'output_ready',
          output_preview: '这是最终输出预览文本',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test output_ready progress')

    const event = await waitForFirstEvent(page)
    const desc = await event.textContent()
    expect(desc).toContain('输出就绪')
  })

  test('6. subagent_end(done)→ Timeline status=done', async ({ adminPage: page }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-006',
          role: 'coder',
          task: '完成测试',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_end',
          id: 'sub-006',
          status: 'done',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test end done')

    const event = await waitForFirstEvent(page)
    await expect(event).toHaveAttribute('data-event-status', 'done')
    const desc = await event.textContent()
    expect(desc).toContain('完成')
  })

  test('7. subagent_end(failed)→ Timeline status=failed', async ({ adminPage: page }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-007',
          role: 'coder',
          task: '失败测试',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_end',
          id: 'sub-007',
          status: 'failed',
          failureReason: '工具执行超时',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test end failed')

    const event = await waitForFirstEvent(page)
    await expect(event).toHaveAttribute('data-event-status', 'failed')
    const desc = await event.textContent()
    expect(desc).toContain('失败')
  })

  test('8. 多个 subagent 并行 → Timeline 出现多个 subagent 事件', async ({ adminPage: page }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-008a',
          role: 'coder',
          task: '并行任务 A',
          timestamp: nowISO(),
        },
        {
          type: 'subagent_spawn',
          id: 'sub-008b',
          role: 'reviewer',
          task: '并行任务 B',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test parallel subagents')

    const events = page.locator(`${TIMELINE_EVENT_ROW}[data-event-type="subagent"]`)
    await expect(events).toHaveCount(2, { timeout: 12000 })
  })

  test('9. progress 先于 spawn 到达(网络乱序)→ Timeline 仍不丢失事件', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    // mock SSE 先发 progress 再发 spawn(模拟网络乱序)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_progress',
          id: 'sub-009',
          phase: 'thinking',
          iteration: 1,
          timestamp: nowISO(),
        },
        {
          type: 'subagent_spawn',
          id: 'sub-009',
          role: 'coder',
          task: '乱序测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test out-of-order events')

    // 无论顺序如何,最终 Timeline 应至少有 1 个事件(spawn 后 addEvent 创建)
    const event = await waitForFirstEvent(page)
    await expect(event).toHaveAttribute('data-event-id', 'sub-009')
    await expect(event).toHaveAttribute('data-event-type', 'subagent')
  })

  test('10. subagent 事件 data-jump-target 属性:默认无 jump target(spawn 不含 messageId)', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-010',
          role: 'coder',
          task: 'jump target 测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test jump target')

    const event = await waitForFirstEvent(page)
    // subagent_spawn 不含 messageId/planStepId/toolCallId → data-jump-target 不为 'true'
    const jumpTarget = await event.getAttribute('data-jump-target')
    expect(jumpTarget).toBeNull()
    // button 应 disabled(无 jump target + 无 children → 不可点击)
    const btn = event.locator('button')
    await expect(btn).toBeDisabled()
  })

  test('11. subagent 事件相对时间显示(刚刚 / Ns 前)', async ({ adminPage: page }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-011',
          role: 'coder',
          task: '时间显示测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test relative time')

    const event = await waitForFirstEvent(page)
    const text = await event.textContent()
    // formatRelativeTime 对 10s 内返回"刚刚",60s 内返回"Ns 前"
    expect(text).toMatch(/刚刚|\d+s 前|\d+m 前|\d+h 前|\d+d 前/)
  })

  test('12. subagent 事件状态图标:running → Loader2 带 animate-spin', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-012',
          role: 'coder',
          task: '状态图标测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test status icon')

    const event = await waitForFirstEvent(page)
    // StatusIcon 是事件行内最后一个 svg(running=Loader2,带 animate-spin class)
    const statusSvg = event.locator('svg').last()
    await expect(statusSvg).toBeVisible()
    const cls = (await statusSvg.getAttribute('class')) ?? ''
    expect(cls).toContain('animate-spin')
  })

  test('13. subagent 事件颜色:type=cyan-500(TypeIcon class 含 text-cyan-500)', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-013',
          role: 'coder',
          task: '颜色测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test type color')

    const event = await waitForFirstEvent(page)
    // TypeIcon 是第一个 svg(subagent → Bot,class 含 text-cyan-500)
    const typeSvg = event.locator('svg').first()
    await expect(typeSvg).toBeVisible()
    const cls = (await typeSvg.getAttribute('class')) ?? ''
    expect(cls).toContain('text-cyan-500')
  })

  test('14. Timeline tab 切换后事件保持(inline → timeline 事件不丢失)', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-014',
          role: 'coder',
          task: 'tab 切换测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test tab persistence')

    // 等待事件出现
    await waitForFirstEvent(page)

    // 切到 inline tab
    const inlineTab = page.locator(PANE_TAB_INLINE)
    await inlineTab.click()
    await page.waitForTimeout(300)

    // 切回 timeline tab
    const timelineTab = page.locator(PANE_TAB_TIMELINE)
    await timelineTab.click()
    await page.waitForTimeout(300)

    // 事件仍在(按 ID 精确查找,避免被 reference 事件干扰)
    const event = page.locator(`${TIMELINE_EVENT_ROW}[data-event-id="sub-014"]`)
    await expect(event).toBeVisible({ timeout: 5000 })
  })

  test('15. i18n 切换后 pane tab 文本变化(zh-CN → en)', async ({ adminPage: page }) => {
    await mockConversation(page)
    await openTimeline(page)

    const tab = page.locator(PANE_TAB_TIMELINE)
    await expect(tab).toBeVisible()
    const textBefore = (await tab.textContent()) ?? ''

    // 切换语言到 en(language store 已暴露到 window.__IHUI_LANGUAGE_STORE__)
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __IHUI_LANGUAGE_STORE__?: {
            getState: () => { setLocale: (l: string) => void }
          }
        }
      ).__IHUI_LANGUAGE_STORE__
      store?.getState().setLocale('en')
    })
    await page.waitForTimeout(500)

    const textAfter = (await tab.textContent()) ?? ''
    // zh-CN: "时间线",en: "Timeline" → 文本应变化
    expect(textAfter).not.toBe(textBefore)
    expect(textAfter.toLowerCase()).toContain('timeline')
  })

  test('16. Timeline 事件计数徽章:单事件显示"1"', async ({ adminPage: page }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-016',
          role: 'coder',
          task: '计数测试',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test count badge')

    await waitForFirstEvent(page)
    // 验证 subagent 事件计数=1
    const events = page.locator(`${TIMELINE_EVENT_ROW}[data-event-type="subagent"]`)
    await expect(events).toHaveCount(1, { timeout: 5000 })
  })

  test('17. subagent 事件 title 显示 role(spawn 事件的 role → title)', async ({
    adminPage: page,
  }) => {
    await mockConversation(page)
    await mockSSE(
      page,
      makeSSE([
        {
          type: 'subagent_spawn',
          id: 'sub-017',
          role: 'security-auditor',
          task: '审计安全漏洞',
          timestamp: nowISO(),
        },
      ]),
    )
    await openTimeline(page)
    await sendMessage(page, 'test title role')

    const event = await waitForFirstEvent(page)
    // mapSpawnToTimelineEvent: title = event.role
    const text = await event.textContent()
    expect(text).toContain('security-auditor')
  })
})
