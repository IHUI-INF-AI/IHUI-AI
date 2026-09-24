// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D38 队列语义完整交互 —— 五动词 e2e(重排 / 撤回 / 编辑 / 打断并执行 / 模式切换)
//
// 台账原文要求(H21/验收口径):五动词必须有 e2e,不接受只跑组件级 vitest。
//  mocking 风格沿用 `stream-design-system.spec.ts`(同一套 page.route SSE mock 与 fixture 约定),
// 不另起测试基建。
//
// 前置构造(不用 page.evaluate 改 store,全部走真实 UI 路径):
//   1. mock 会话 REST + `**/ai/chat/stream` SSE(gate 挂起不返回 ⇒ isStreaming 恒真);
//   2. 流式中发 `/side <问题>` —— use-message-send 的 D28 拦截把它推进
//      sideQueueByConversation(message-input 的 QueueInteractionBar 即渲染该桶);
//   3. 队列条出现且 ≥2 条,即"流式生成中且有排队侧问"。
//
// 许可门真环境口径(D69,宿主 message-input 写死 runtimeSupportsInterjection=false):
//   · 流式中 reorder 被拒(denied.reorder 显式渲染);流结束后队列非空才可重排;
//   · undo/edit 队列非空即允许;
//   · interruptAndRun(canInterject)恒被拒 ⇒ 成功链路(停流+跑队首)真环境不可达,
//     对应用例显式 test.skip 并写明缺失的前置(能力协商生产者),不删不弱化。
//
// 文案断言一律取真实词包(shared zh-CN `ai.pane.queueOps` + web zh-CN
// `ai.pane.inputNotices.queue.denied`),按渲染文本逐字比对 —— 取词回显键名即红。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { test, expect, type Page } from './fixtures'

// ---------------------------------------------------------------------------
// 词包(运行时 mergeMessages(shared, web) 的同源文件,作为文案唯一 oracle)
// ---------------------------------------------------------------------------

interface QueueOpsLocale {
  ariaLabel: string
  reorderAria: string
  undo: string
  edit: string
  editConfirm: string
  editCancel: string
  interruptAndRun: string
  mode: { label: string; steer: string; queue: string }
  degraded: { runtimeNoInterject: string }
}
interface DeniedLocale {
  reorder: string
  undo: string
  interject: string
}

// apps/web/package.json 是 "type": "module" ⇒ spec 以 ESM 装载,无 __dirname,须经 import.meta.url 定位
const MESSAGES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../packages/i18n/messages',
)
const L = (
  JSON.parse(fs.readFileSync(path.join(MESSAGES_ROOT, 'shared/zh-CN.json'), 'utf8')) as {
    ai: { pane: { queueOps: QueueOpsLocale } }
  }
).ai.pane.queueOps
const DENIED = (
  JSON.parse(fs.readFileSync(path.join(MESSAGES_ROOT, 'web/zh-CN.json'), 'utf8')) as {
    ai: { pane: { inputNotices: { queue: { denied: DeniedLocale } } } }
  }
).ai.pane.inputNotices.queue.denied

// ---------------------------------------------------------------------------
// mock 基建(抄 stream-design-system.spec.ts 的约定,不另起一套)
// ---------------------------------------------------------------------------

const CONVERSATION_ID = `e2e-d38-${Date.now()}`

const CONV = {
  id: CONVERSATION_ID,
  userId: 'admin',
  title: 'E2E D38 Queue Interactions',
  model: 'test-model',
  systemPrompt: null,
  metadata: null,
  lastMessageAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const STREAM_ANSWER = 'D38 流式回答完成。'
const SIDE_ANSWER = 'D38 侧问补答完成。'

// streamChat 直连 API 端口并带 credentials,跨域必须回具体 origin(同先例 spec)。
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

/** 流式补答(/side 队列在流结束后被自动消费一条)走 POST /api/best-of-n/run;计数供断言。 */
interface BestOfNCounter {
  calls: number
}
async function mockBestOfN(page: Page, counter: BestOfNCounter): Promise<void> {
  await page.route('**/best-of-n/run', async (route) => {
    counter.calls += 1
    const candidate = {
      candidate_id: 1,
      content: SIDE_ANSWER,
      model: 'test-model',
      ok: true,
      error: '',
      score: null,
      latency_ms: 1,
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          winner: candidate,
          candidates: [candidate],
          nRequested: 1,
          evaluatorModel: '',
          evaluatorFallback: true,
          rationale: '',
          totalCostUsd: 0,
          runId: 'e2e-d38',
        },
      }),
    })
  })
}

/** 可挂起的 SSE mock:gate 释放前请求一直 pending ⇒ isStreaming 恒真。 */
interface HeldStream {
  /** stream POST 已被客户端发出的信号(此时 setStreaming(true) 已执行) */
  requested: Promise<void>
  /** 放行流(返回 chunk+done);幂等,测试收尾必须调用避免悬挂路由 */
  release: () => void
}
async function mockHeldStream(page: Page): Promise<HeldStream> {
  let markRequested: () => void = () => {}
  const requested = new Promise<void>((r) => {
    markRequested = r
  })
  let gateOpen = false
  let openGate: () => void = () => {}
  const gate = new Promise<void>((r) => {
    openGate = r
  })
  await page.route('**/ai/chat/stream', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeadersFor(req) })
      return
    }
    markRequested()
    try {
      await gate
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...corsHeadersFor(req),
        },
        body: sse([
          { type: 'chunk', content: STREAM_ANSWER },
          { type: 'done', content: STREAM_ANSWER },
        ]),
      })
    } catch {
      // 测试结束/页面已关:悬挂路由随 context 关闭,忽略
    }
  })
  return {
    requested,
    release: () => {
      if (gateOpen) return
      gateOpen = true
      openGate()
    },
  }
}

// ---------------------------------------------------------------------------
// UI 操作辅助(全部经真实交互路径推进状态)
// ---------------------------------------------------------------------------

const asideTextarea = (page: Page) => page.locator('[data-testid="ai-side-panel-aside"] textarea')
const bar = (page: Page) => page.locator('[data-queue-ops]')
const queuedItems = (page: Page) => bar(page).locator('[data-queued-item]')

interface QueueSnap {
  id: string
  text: string
}
async function queueSnapshot(page: Page): Promise<QueueSnap[]> {
  return queuedItems(page).evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-queued-item') ?? '',
      text: el.querySelector('[data-queued-text]')?.textContent ?? '',
    })),
  )
}

/** 进入 /chat → 触发被挂起的主消息流 → 流式中发送 n 条 /side 侧问 → 队列条出现 n 项。 */
async function openStreamWithSideQueue(
  page: Page,
  held: HeldStream,
  questions: readonly string[],
): Promise<void> {
  await page.goto('/chat')
  const ta = asideTextarea(page).first()
  await expect(ta).toBeVisible({ timeout: 45_000 })
  await ta.fill('E2E D38:主消息触发流式生成')
  await page.keyboard.press('Enter')
  // stream 请求发出 ⇒ store.setStreaming(true) 已执行(send-message.ts 在 fetch 前设置)
  await held.requested
  for (const q of questions) {
    await ta.fill(`/side ${q}`)
    await page.keyboard.press('Enter')
  }
  await expect(queuedItems(page)).toHaveCount(questions.length, { timeout: 30_000 })
}

test.describe('D38 队列语义五动词(排队侧问交互条)', () => {
  test('重排:流式中 ↑ 被拒且顺序不动;流结束后 ↑↓ 键盘重排逐位生效', async ({ adminPage: page }) => {
    const bestOfN: BestOfNCounter = { calls: 0 }
    await mockConversation(page)
    await mockBestOfN(page, bestOfN)
    const held = await mockHeldStream(page)
    await openStreamWithSideQueue(page, held, ['侧问甲', '侧问乙', '侧问丙'])

    // —— 流式中被拒:denied.reorder 取到译文,↑ 不产生任何顺序变化
    const deniedHint = bar(page).locator('[data-queue-denied="reorder"]')
    await expect(deniedHint).toBeVisible()
    await expect(deniedHint).toHaveText(DENIED.reorder)
    const idsStreaming = await queueSnapshot(page)
    expect(idsStreaming.map((i) => i.text)).toEqual(['侧问甲', '侧问乙', '侧问丙'])
    await page
      .locator(`[data-queue-op="reorderHandle"][data-item-id="${idsStreaming[1].id}"]`)
      .press('ArrowUp')
    await expect
      .poll(() => queueSnapshot(page).then((s) => s.map((x) => x.id)))
      .toEqual(idsStreaming.map((x) => x.id))

    // —— 放行流:流结束 effect 自动补答消费队首(侧问甲)⇒ 剩两条且可重排
    held.release()
    await expect(page.getByText(STREAM_ANSWER).first()).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => bestOfN.calls, { timeout: 30_000 }).toBe(1) // 队首"侧问甲"确实被消费
    await expect(queuedItems(page)).toHaveCount(2)
    const before = await queueSnapshot(page)
    expect(before.map((i) => i.text)).toEqual(['侧问乙', '侧问丙'])

    // 第二条 ↑ 一位 ⇒ 逐位 id 序列翻转
    await page
      .locator(`[data-queue-op="reorderHandle"][data-item-id="${before[1].id}"]`)
      .press('ArrowUp')
    await expect
      .poll(() => queueSnapshot(page).then((s) => s.map((x) => x.id)))
      .toEqual([before[1].id, before[0].id])
    // 再 ↓ 回原位
    await page
      .locator(`[data-queue-op="reorderHandle"][data-item-id="${before[1].id}"]`)
      .press('ArrowDown')
    await expect
      .poll(() => queueSnapshot(page).then((s) => s.map((x) => x.id)))
      .toEqual([before[0].id, before[1].id])
    held.release()
  })

  test('撤回:项数 −1 且剩余项 id 序列正确', async ({ adminPage: page }) => {
    const bestOfN: BestOfNCounter = { calls: 0 }
    await mockConversation(page)
    await mockBestOfN(page, bestOfN)
    const held = await mockHeldStream(page)
    await openStreamWithSideQueue(page, held, ['撤回靶标', '保留项'])

    const snap = await queueSnapshot(page)
    // 按钮取词是译文而非裸键
    const undoBtn = page.locator(`[data-queue-op="undo"][data-item-id="${snap[0].id}"]`)
    await expect(undoBtn).toHaveText(L.undo)
    await undoBtn.click()

    await expect(queuedItems(page)).toHaveCount(1)
    const after = await queueSnapshot(page)
    expect(after).toEqual([{ id: snap[1].id, text: '保留项' }])
    held.release()
  })

  test('编辑:改后文本落位同一项;空文本被拒不产生空项', async ({ adminPage: page }) => {
    const bestOfN: BestOfNCounter = { calls: 0 }
    await mockConversation(page)
    await mockBestOfN(page, bestOfN)
    const held = await mockHeldStream(page)
    await openStreamWithSideQueue(page, held, ['原始问题', '另一条'])
    const snap = await queueSnapshot(page)
    const target = page.locator(`[data-queued-item="${snap[0].id}"]`)

    // —— 正常编辑:行内输入带原稿,保存后文本出现在同一 id 上
    await target.locator(`[data-queue-op="edit"][data-item-id="${snap[0].id}"]`).click()
    const input = bar(page).locator('[data-queue-op="editInput"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('原始问题')
    await input.fill('  编辑后的问题  ') // 前后空白应被 trim
    await target.locator('[data-queue-op="editConfirm"]').click()
    await expect(input).toBeHidden()
    await expect(target.locator('[data-queued-text="编辑后的问题"]')).toBeVisible()
    expect((await queueSnapshot(page))[0]).toEqual({ id: snap[0].id, text: '编辑后的问题' })

    // —— 空文本被拒:清空后保存 ⇒ 退出编辑态,项不消失、不产生空项、原文本保留
    await target.locator(`[data-queue-op="edit"][data-item-id="${snap[0].id}"]`).click()
    await expect(input).toBeVisible()
    await input.fill('   ')
    await target.locator('[data-queue-op="editCancel"]').click() // 先验证取消不写回
    await expect(target.locator('[data-queued-text="编辑后的问题"]')).toBeVisible()

    await target.locator(`[data-queue-op="edit"][data-item-id="${snap[0].id}"]`).click()
    await input.fill('   ')
    await target.locator('[data-queue-op="editConfirm"]').click()
    await expect(input).toBeHidden()
    await expect(queuedItems(page)).toHaveCount(2)
    await expect(target.locator('[data-queued-text="编辑后的问题"]')).toBeVisible()
    held.release()
  })

  test('打断并执行:宿主恒不支持插话 ⇒ 显式渲染被拒且点击绝不中止流', async ({
    adminPage: page,
  }) => {
    const bestOfN: BestOfNCounter = { calls: 0 }
    await mockConversation(page)
    await mockBestOfN(page, bestOfN)
    const held = await mockHeldStream(page)
    await openStreamWithSideQueue(page, held, ['队首甲', '队首乙'])

    const interruptBtn = bar(page).locator('[data-queue-op="interruptAndRun"]')
    await expect(interruptBtn).toHaveText(L.interruptAndRun)
    await expect(interruptBtn).toHaveAttribute('aria-disabled', 'true')
    // 被拒动作显式渲染 denied.* 且取到译文(不静默禁用)
    const deniedHint = bar(page).locator('[data-queue-denied="interruptAndRun"]')
    await expect(deniedHint).toHaveText(DENIED.interject)

    // force:组件被拒形态是 aria-disabled="true"(非原生 disabled),Playwright
    // actionability 会拦普通点击;真实用户仍会点它 ⇒ 断言的正是"物理点击无副作用"
    await interruptBtn.click({ force: true })
    // 点击既不消费队列(best-of-n 零调用),也不动项数
    await page.waitForTimeout(1_000)
    expect(bestOfN.calls).toBe(0)
    await expect(queuedItems(page)).toHaveCount(2)
    // 流未被中止:放行后仍完整收到 SSE 回答
    held.release()
    await expect(page.getByText(STREAM_ANSWER).first()).toBeVisible({ timeout: 30_000 })
  })

  test('打断并执行成功链路(停流 + 队首立即发出)—— 真环境不可达,显式跳过', async () => {
    // 台账 H21 期望本动词断言"点完流被中止且队首真的发出"。宿主 message-input 将
    // runtimeSupportsInterjection 写死 false(全仓尚无能力协商生产者,D69/D38 既定口径),
    // canInterject 恒 false ⇒ interruptPlan/handleInterruptAndRun 的成功分支不可从任何 UI 路径
    // 触达(禁止 page.evaluate 伪造 store 状态)。缺:runtimeSupportsInterjection=true 的
    // 协商链路生产者;它落地后本用例应改写为真断言,不得保持 skip。
    test.skip(
      true,
      '宿主 runtimeSupportsInterjection=false 无协商生产者,「打断并执行」真环境唯一可达行为是显式被拒(上一条已断言);成功链路 e2e 待能力协商落地',
    )
  })

  test('模式切换:queue↔steer 控件状态正确,steer 遇不支持插话诚实渲染降级句', async ({
    adminPage: page,
  }) => {
    const bestOfN: BestOfNCounter = { calls: 0 }
    await mockConversation(page)
    await mockBestOfN(page, bestOfN)
    const held = await mockHeldStream(page)
    await openStreamWithSideQueue(page, held, ['模式样本甲', '模式样本乙'])

    const group = page.getByRole('group', { name: L.ariaLabel })
    await expect(group).toBeVisible()
    const steerBtn = bar(page).locator('[data-queue-op="mode"][data-mode="steer"]')
    const queueBtn = bar(page).locator('[data-queue-op="mode"][data-mode="queue"]')
    await expect(steerBtn).toHaveText(L.mode.steer)
    await expect(queueBtn).toHaveText(L.mode.queue)
    await expect(bar(page).locator('[data-queue-mode-label]')).toHaveText(L.mode.label)

    // 默认 queue 偏好:无降级句
    await expect(queueBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(bar(page)).toHaveAttribute('data-queue-ops-mode', 'queue')
    await expect(bar(page).locator('[data-mode-degraded]')).toHaveCount(0)

    // 切 steer:偏好钮点亮,但生效模式仍 queue 且诚实渲染降级句(译文)
    await steerBtn.click()
    await expect(steerBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(queueBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(bar(page)).toHaveAttribute('data-queue-ops-mode', 'queue')
    const degraded = bar(page).locator('[data-mode-degraded="degraded.runtimeNoInterject"]')
    await expect(degraded).toBeVisible()
    await expect(degraded).toHaveText(L.degraded.runtimeNoInterject)

    // 切回 queue:降级句消失
    await queueBtn.click()
    await expect(queueBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(bar(page).locator('[data-mode-degraded]')).toHaveCount(0)
    held.release()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
