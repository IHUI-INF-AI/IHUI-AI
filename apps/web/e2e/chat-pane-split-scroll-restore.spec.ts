// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'

/**
 * G-934 / 票60 · 会话级滚动位置恢复 + 真并行多窗格的实机几何证明(AGENTS.md §17)
 *
 * 为什么要实机:滚动位是**几何量**,jsdom 的 scrollTop 恒为 0(没有布局引擎),
 * 那批 `use-message-list-scroll.session-restore.test.tsx` 用例只能证明判据分支走对了,
 * 证不了"真浏览器里这一次切换把盒子钉回了离开时的那一位"。本 spec 用真实 Chromium
 * 量 `scrollTop` / `boundingBox()`,并在 ②④ 各配一条反证(§0.9:判据必须有牙)。
 *
 * 覆盖两格缺口:
 * ① G-934 —— c5b3f0f65d9c7a6979b476bcce16e67caad34822 把会话级滚动恢复接回生产,
 *    此前零实机证据;
 * ② 票60 —— `grep -l "data-pane" apps/web/e2e/*.spec.ts` 现读 0 命中,拆分窗格此前
 *    完全没有 e2e 覆盖;而落账键是 `buildScrollSessionKey(paneId, conversationId)`
 *    (窗格 + 会话二元),所以"两格挂同一会话"必须各记各的。
 *
 * 全链路 route mock,不依赖后端真实响应(滚动位与真实模型输出无关)。
 * 登录态用 `e2e/sidebar-visual.spec.ts:417-442` 的既有先例:注入 localStorage
 * `ihui-auth`(zustand persist 形态)+ 非 httpOnly `auth_token` cookie,让
 * `use-auth-bootstrap` 走 `getAuthCookie()` 那一支直接确立会话,不需要 /auth/refresh 真回话。
 *
 * 实机取数前的三条前提订正(都读的是生产码,不是假设):
 * 1. `PaneSplitContainer` 只在 `collectPaneLeaves(tree).length > 1` 时才挂载
 *    (`ai-side-panel.tsx:1295,1775-1800`)⇒ 单格态下**没有** `[data-pane-leaf]` 可点,
 *    拆分入口是面板头部的 IconButton(aria-label 取 `ai.pane.multiPane.splitRight`)。
 * 2. 空窗格只渲染占位(`pane-split-container.tsx:366-371`),不渲染消息列表 ⇒
 *    "两个 inline-panel"必须先往第二格落一个会话才存在。
 * 3. 落点 `[data-pane-empty]` 是**内层**div 的钩子,React 的 `onDrop` 挂在这一层
 *    (`:362`),不在 `[data-pane-leaf]` 上;事件只向上冒泡 ⇒ 合成 drop 必须派到内层。
 */

const DRAG_TYPE = 'application/x-ihui-conversation'
/** 拆分入口文案:zh-CN「向右拆分」/ en "Split right"(packages/i18n/messages/shared/*.json) */
const SPLIT_ENTRY_RE = /向右拆分|split right/i
/** 恢复宽限期 RESTORE_GRACE_MS = 1500:量值必须等宽限期过完,否则量到的是修正中的瞬态 */
const GRACE_SETTLE_MS = 1800
/** 判定"确实恢复了"的容差:钉位是绝对量,只允许被随后的真实高度修正挪一点 */
const RESTORE_TOLERANCE_PX = 60

const CONV_A = 'e2e-pane-conv-a'
const CONV_B = 'e2e-pane-conv-b'
const TITLE_A = 'E2E 双窗格滚动取证甲'
const TITLE_B = 'E2E 双窗格滚动取证乙'

interface ConvSpec {
  readonly id: string
  readonly title: string
  /** 交付的历史条数(短会话给 3 条,长会话给 60 条:60 恰好不超过 VIRTUAL_THRESHOLD=60,列表整块渲染) */
  readonly messageCount: number
}

const LONG_A: ConvSpec = { id: CONV_A, title: TITLE_A, messageCount: 60 }
const LONG_B: ConvSpec = { id: CONV_B, title: TITLE_B, messageCount: 60 }
const SHORT_A: ConvSpec = { id: CONV_A, title: TITLE_A, messageCount: 1 }
const SHORT_B: ConvSpec = { id: CONV_B, title: TITLE_B, messageCount: 60 }

function convRow(spec: ConvSpec) {
  const now = new Date().toISOString()
  return {
    id: spec.id,
    userId: 'e2e',
    title: spec.title,
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 构造可滚出真实高度的历史行:每条 12 个空行分段(markdown 段落 ⇒ 各自一个 <p>),
 * 60 条足够把内层撑到上万 px,滚动位才有"某一位"可谈。
 */
function historyRows(spec: ConvSpec) {
  const base = Date.now() - 60 * 60_000
  const paragraphs = spec.messageCount > 10 ? 12 : 0
  return Array.from({ length: spec.messageCount }, (_, i) => ({
    id: `${spec.id}-m-${i}`,
    conversationId: spec.id,
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content:
      paragraphs > 0
        ? Array.from({ length: paragraphs }, (_, k) =>
            `${spec.title} 第${i}段${k} —— 滚动几何取证正文,重复以撑出真实滚动高度。`.repeat(3),
          ).join('\n\n')
        : `${spec.title} 第${i}条(短会话:单行,盒子不溢出)`,
    reasoning: null,
    tokens: 1,
    metadata: null,
    createdAt: new Date(base + i * 1000).toISOString(),
  }))
}

/** 会话 id → 该会话要交付的历史行(mock 按 URL 里的 id 分派,两个会话互不串) */
type ConvTable = ReadonlyMap<string, readonly ReturnType<typeof historyRows>[number][]>

function json(body: unknown): { status: number; headers: Record<string, string>; body: string } {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 0, message: 'ok', data: body }),
  }
}

/**
 * 打全量 mock:auth 面给"会话有效"的确定性答复(不让 401 拦截器把登录弹窗拽出来打断滚动),
 * 会话面按 id 分派 list/detail/messages,其余 /api/** 一律 200 空壳兜底。
 * 注册顺序 = 兜底在前、专档在后(Playwright 后注册者优先匹配)。
 */
async function mockBackend(page: Page, specs: readonly ConvSpec[]): Promise<void> {
  const table: ConvTable = new Map(specs.map((s) => [s.id, historyRows(s)]))
  const rows = (id: string) => table.get(id) ?? []

  await page.route('**/api/**', (route) => route.fulfill(json({})))
  await page.route('**/auth/refresh**', (route) =>
    route.fulfill(
      json({
        accessToken: 'e2e-pane-scroll-access',
        refreshToken: 'e2e-pane-scroll-refresh',
        expiresIn: 3600,
      }),
    ),
  )
  await page.route('**/auth/me**', (route) =>
    route.fulfill(
      json({ user: { id: 'e2e', nickname: 'E2E', roleId: 1, avatar: null, phone: '' } }),
    ),
  )
  await page.route('**/api/chat/conversations**', async (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const pathname = url.pathname
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204 })
      return
    }
    const messagesMatch = pathname.match(/^\/api\/chat\/conversations\/([^/]+)\/messages$/)
    if (messagesMatch) {
      const id = messagesMatch[1] ?? ''
      const list = rows(id)
      await route.fulfill(
        json({
          messages: list,
          page: 1,
          pageSize: 50,
          total: list.length,
          hasMore: false,
          nextCursor: list.length > 0 ? 'e2e-pane-cursor' : null,
        }),
      )
      return
    }
    const detailMatch = pathname.match(/^\/api\/chat\/conversations\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1] ?? ''
      const spec = specs.find((s) => s.id === id)
      if (!spec) {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        return
      }
      await route.fulfill(json({ conversation: convRow(spec) }))
      return
    }
    if (pathname === '/api/chat/conversations' && method === 'GET') {
      await route.fulfill(
        json({
          conversations: specs.map(convRow),
          page: 1,
          pageSize: 20,
          total: specs.length,
        }),
      )
      return
    }
    if (method === 'POST') {
      const first = specs[0]
      await route.fulfill(json({ conversation: first ? convRow(first) : convRow(LONG_A) }))
      return
    }
    await route.fulfill(json({}))
  })
}

/** 已登录态:localStorage 标志位 + 非 httpOnly auth_token cookie(use-auth-bootstrap 可直接恢复) */
async function seedLoggedIn(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'e2e-pane-scroll-access',
      url: 'http://localhost:8801',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ])
  await page.addInitScript(() => {
    localStorage.setItem(
      'ihui-auth',
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: { id: 'e2e', nickname: 'E2E', roleId: 1, avatar: null, phone: '' },
        },
        version: 0,
      }),
    )
    localStorage.setItem('sidebar-collapsed', 'false')
  })
}

/**
 * 消息列表容器。
 * ⚠ 该元素同时带 `id="message-list-panel-inline"`,而这个 id **在多窗格下是重复的**
 * (MessageList.tsx:449-452 无条件写死)⇒ 一律按 `[data-pane-leaf]` 作用域取,绝不裸 id。
 */
function rootList(page: Page): Locator {
  return page.locator('[data-testid="message-list-inline-panel"]').first()
}
function paneList(page: Page, paneId: string): Locator {
  return page.locator(`[data-pane-leaf="${paneId}"] [data-testid="message-list-inline-panel"]`)
}

async function listGeometry(
  list: Locator,
): Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }> {
  return list.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))
}

/** 已装载条数(data-window-total 由 MessageList 容器暴露,用它确认切换后内容已就位) */
async function windowTotal(list: Locator): Promise<number> {
  const raw = await list.getAttribute('data-window-total')
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`data-window-total 取不到(实际值 ${String(raw)})`)
  return n
}

/**
 * 把目标消息滚到列表可视区顶部,返回量到的 scrollTop。
 * 刻意用几何算式(而不是固定像素):固定值会随消息高度漂移而 clamp,量出来的才作数。
 */
async function scrollToMessageTop(page: Page, list: Locator, messageId: string): Promise<number> {
  await list.evaluate((el, id) => {
    const target = el.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
    if (!target) throw new Error(`目标消息未渲染进 DOM:${id}`)
    const box = el.getBoundingClientRect()
    const top = target.getBoundingClientRect().top - box.top + el.scrollTop
    el.scrollTop = top
    return el.scrollTop
  }, messageId)
  // scroll 事件在下一帧派发:observedScrollTopRef / 滚动权(following=false)靠它记账,
  // 落账取的是 max(DOM 现读, observed),不留这一帧就是量了个没人认领的位置。
  await page.waitForTimeout(250)
  return (await listGeometry(list)).scrollTop
}

/** 合成一次真 D22 拖拽落格:自定义 MIME 只有手搓 DataTransfer 才带得动(dragTo 不带) */
async function dropConversationIntoPane(
  page: Page,
  paneId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const dropped = await page.evaluate(
    ({ paneId, payload, dragType }) => {
      // 落点 = 内层空窗格 div(onDrop 挂在它身上,不在 [data-pane-leaf] 上)
      const el = document.querySelector<HTMLElement>(
        `[data-pane-leaf="${paneId}"] [data-pane-empty]`,
      )
      if (!el) return 'no-drop-zone'
      const dt = new DataTransfer()
      dt.setData(dragType, payload)
      dt.dropEffect = 'copy'
      el.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      return 'dispatched'
    },
    { paneId, payload: JSON.stringify({ id: conversationId, title }), dragType: DRAG_TYPE },
  )
  expect(dropped, 'pane-1 必须暴露 [data-pane-empty] 落点').toBe('dispatched')
}

async function openFromSidebar(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: title }).first().click()
}

test.describe('G-934 + 票60 会话级滚动恢复 / 真并行多窗格', () => {
  test.setTimeout(180_000)

  test('① 正向:切走再切回同一会话,滚动位落在离开时的位置', async ({ page }) => {
    await mockBackend(page, [LONG_A, LONG_B])
    await seedLoggedIn(page)
    await page.goto('/chat')
    await openFromSidebar(page, TITLE_A)

    const list = rootList(page)
    await expect(list).toBeVisible({ timeout: 30_000 })
    await expect(list).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })

    const total = await windowTotal(list)
    expect(total, '长会话必须真装载出可滚的高度').toBeGreaterThan(30)
    const before = await listGeometry(list)
    expect(
      before.scrollHeight,
      `列表不溢出(scrollHeight=${before.scrollHeight}, clientHeight=${before.clientHeight})⇒ 滚动位无从谈起`,
    ).toBeGreaterThan(before.clientHeight * 2)

    // 目标 = 40% 处那条:既不在顶也不在底,跟随权会被解除,落账才是"钉位档"
    const targetId = `${CONV_A}-m-${Math.floor(total * 0.4)}`
    const recorded = await scrollToMessageTop(page, list, targetId)
    expect(
      recorded,
      '离开前的滚动位必须是明显非 0 的真实偏移(否则 ①退化成 0==0 假绿)',
    ).toBeGreaterThan(200)

    await openFromSidebar(page, TITLE_B)
    await expect(list).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await openFromSidebar(page, TITLE_A)
    await expect(list).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await page.waitForTimeout(GRACE_SETTLE_MS)

    const restored = (await listGeometry(list)).scrollTop
    expect(
      Math.abs(restored - recorded),
      `恢复落点 ${restored}px 与离开位 ${recorded}px 偏差超过 ±${RESTORE_TOLERANCE_PX}px`,
    ).toBeLessThanOrEqual(RESTORE_TOLERANCE_PX)

    // 几何证明(§17 要的就是这一条):离开时在视区内的那条消息,回来时仍在其视区内
    const listBox = await list.boundingBox()
    const msgBox = await list.locator(`[data-message-id="${targetId}"]`).boundingBox()
    expect(listBox, '列表容器必须有真实几何').not.toBeNull()
    expect(msgBox, '目标消息必须有真实几何').not.toBeNull()
    if (!listBox || !msgBox) throw new Error('boundingBox 取不到 ⇒ 实机几何断言无法成立')
    expect(
      msgBox.y,
      `目标消息 y=${msgBox.y} 应落在列表视区 [${listBox.y}, ${listBox.y + listBox.height}] 内`,
    ).toBeGreaterThanOrEqual(listBox.y - 1)
    expect(msgBox.y).toBeLessThan(listBox.y + listBox.height)
  })

  test('② 反证:短会话不冒充"恢复成功"', async ({ page }) => {
    await mockBackend(page, [SHORT_A, SHORT_B])
    await seedLoggedIn(page)
    await page.goto('/chat')
    await openFromSidebar(page, TITLE_A)

    const list = rootList(page)
    await expect(list).toBeVisible({ timeout: 30_000 })
    // 先等短会话真装进 DOM:否则量到的是空列表(高度 0 ⇒ "不溢出"是白量的)
    await expect(list).toHaveAttribute('data-window-total', String(SHORT_A.messageCount), {
      timeout: 30_000,
    })
    await page.waitForTimeout(GRACE_SETTLE_MS)

    // 甲只有 1 条单行消息 ⇒ 列表根本不溢出 ⇒ scrollTop 在几何上只能是 0:
    // 这一档的"恢复到 0"不是恢复成功,而是没得恢复。断言必须把这一区分钉死。
    const shortGeom = await listGeometry(list)
    expect(
      shortGeom.scrollHeight,
      `短会话应当不溢出(实得 ${shortGeom.scrollHeight} > ${shortGeom.clientHeight})`,
    ).toBeLessThanOrEqual(shortGeom.clientHeight + 1)
    expect(shortGeom.scrollTop, '未溢出列表的 scrollTop 必须恒为 0').toBe(0)

    await openFromSidebar(page, TITLE_B)
    await expect(list).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    const totalB = await windowTotal(list)
    const targetId = `${CONV_B}-m-${Math.floor(totalB * 0.4)}`
    const recordedB = await scrollToMessageTop(page, list, targetId)
    expect(recordedB).toBeGreaterThan(200)

    await openFromSidebar(page, TITLE_A)
    await expect(list).toHaveAttribute('data-window-total', String(SHORT_A.messageCount), {
      timeout: 30_000,
    })
    await page.waitForTimeout(GRACE_SETTLE_MS)
    const backToShort = await listGeometry(list)
    expect(
      backToShort.scrollTop,
      '短会话被长会话的落点冒充(把不存在的偏移钉进一个不溢出的盒子)',
    ).toBe(0)
    // 这一条单独看是同义反复(不溢出的盒子被 clamp 也只能是 0),它的牙在最后一腿上:
    // 同一份判据、同一次切换,长会话那头必须回到一个大数 ⇒ "回到 0"不是判据失灵。

    // 同一把尺子、同一方向再走一次:长会话这一头必须真回到 recordedB
    // ⇒ ②不是一句"永远 0 所以通过"的废话,它与①共用判据却给出两个不同的正确答案
    await openFromSidebar(page, TITLE_B)
    await expect(list).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await page.waitForTimeout(GRACE_SETTLE_MS)
    const restoredB = (await listGeometry(list)).scrollTop
    expect(
      Math.abs(restoredB - recordedB),
      `长会话恢复落点 ${restoredB}px 偏离离开位 ${recordedB}px 超过 ±${RESTORE_TOLERANCE_PX}px`,
    ).toBeLessThanOrEqual(RESTORE_TOLERANCE_PX)
  })

  test('③ 正向:拆分出第二窗格后 leaf count==2,两格各自有独立的消息列表 DOM', async ({ page }) => {
    await mockBackend(page, [LONG_A, LONG_B])
    await seedLoggedIn(page)
    await page.goto('/chat')
    await openFromSidebar(page, TITLE_A)
    const firstList = rootList(page)
    await expect(firstList).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })

    // 单格态下 PaneSplitContainer 未挂载 ⇒ 全页只该有一个拆分入口(它一出现两枚,
    // 说明容器已经挂上,点它就是在窗格里再拆,不是本用例要证的第一步)
    const entry = page.getByRole('button', { name: SPLIT_ENTRY_RE })
    await expect(entry).toHaveCount(1, { timeout: 30_000 })
    await entry.first().click()

    const root = page.locator('[data-pane-split-root]')
    await expect(root).toBeVisible({ timeout: 30_000 })
    await expect(root).toHaveAttribute('data-pane-leaf-count', '2')
    await expect(page.locator('[data-pane-leaf="pane-root"]')).toHaveCount(1)
    await expect(page.locator('[data-pane-leaf="pane-1"]')).toHaveCount(1)
    await expect(page.locator('[data-pane-leaf="pane-root"]')).toHaveAttribute(
      'data-pane-conversation',
      CONV_A,
    )

    const lists = page.locator('[data-testid="message-list-inline-panel"]')
    // 空窗格只给占位,不给第二份列表 DOM(前提订正 2):此刻仍是 1 枚,且落在 pane-root 子树里
    await expect(lists).toHaveCount(1)
    await expect(
      page.locator('[data-pane-leaf="pane-root"] [data-testid="message-list-inline-panel"]'),
    ).toHaveCount(1)
    await expect(page.locator('[data-pane-leaf="pane-1"] [data-pane-empty]')).toHaveCount(1)

    // 让第二格也承载会话(乙),才谈得上"两格各自一份消息列表 DOM"
    await dropConversationIntoPane(page, 'pane-1', CONV_B, TITLE_B)
    const rootPaneList = paneList(page, 'pane-root')
    const pane1List = paneList(page, 'pane-1')
    await expect(rootPaneList).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await expect(pane1List).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await expect(lists).toHaveCount(2)

    // 两枚列表必须分属各自的 data-pane-leaf 子树,且是两个不同的 DOM 节点
    const proof = await lists.evaluateAll((els) => {
      const leaves = els.map(
        (el) => el.closest<HTMLElement>('[data-pane-leaf]')?.getAttribute('data-pane-leaf') ?? null,
      )
      return {
        leaves,
        sameNode: els[0] === els[1],
        // 重复 id 的现场取证:同一份 DOM 里两枚 id="message-list-panel-inline"
        dupIds: document.querySelectorAll('#message-list-panel-inline').length,
      }
    })
    expect(proof.leaves).toEqual(['pane-root', 'pane-1'])
    expect(proof.sameNode, '两格的消息列表必须是两个独立节点,不是同一枚被复用').toBe(false)
    expect(proof.dupIds, '重复 id 实测必须为 2(选择器纪律的立据)').toBe(2)

    // 各自承载各自的会话(两格显示两个不同会话,是票60"真并行"的最小形态)
    await expect(page.locator('[data-pane-leaf="pane-root"]')).toHaveAttribute(
      'data-pane-conversation',
      CONV_A,
    )
    await expect(page.locator('[data-pane-leaf="pane-1"]')).toHaveAttribute(
      'data-pane-conversation',
      CONV_B,
    )
  })

  test('④ 反证(关键):同一会话同时挂在两个窗格,滚动位各记各的', async ({ page }) => {
    await mockBackend(page, [LONG_A, LONG_B])
    await seedLoggedIn(page)
    await page.goto('/chat')
    await openFromSidebar(page, TITLE_A)
    await expect(rootList(page)).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })

    await page.getByRole('button', { name: SPLIT_ENTRY_RE }).first().click()
    await expect(page.locator('[data-pane-split-root]')).toHaveAttribute(
      'data-pane-leaf-count',
      '2',
    )
    await dropConversationIntoPane(page, 'pane-1', CONV_A, TITLE_A)

    const rootPaneList = paneList(page, 'pane-root')
    const pane1List = paneList(page, 'pane-1')
    await expect(rootPaneList).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await expect(pane1List).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    // 两格挂的是同一枚会话
    await expect(page.locator('[data-pane-leaf="pane-root"]')).toHaveAttribute(
      'data-pane-conversation',
      CONV_A,
    )
    await expect(page.locator('[data-pane-leaf="pane-1"]')).toHaveAttribute(
      'data-pane-conversation',
      CONV_A,
    )

    const total = await windowTotal(pane1List)
    // 根格钉在 20% 处,pane-1 钉在 60% 处:同一个会话,两个不同的落点
    const rootTarget = `${CONV_A}-m-${Math.floor(total * 0.2)}`
    const pane1Target = `${CONV_A}-m-${Math.floor(total * 0.6)}`
    const rootRecorded = await scrollToMessageTop(page, rootPaneList, rootTarget)
    const pane1Recorded = await scrollToMessageTop(page, pane1List, pane1Target)

    // 立据 1(几何):同一会话、同一时刻,两格的 scrollTop 必须各是各的数,差得明显
    const geom = await page
      .locator('[data-testid="message-list-inline-panel"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          leaf: el.closest<HTMLElement>('[data-pane-leaf]')?.getAttribute('data-pane-leaf') ?? null,
          scrollTop: el.scrollTop,
        })),
      )
    expect(geom.length).toBe(2)
    const rootNow = geom.find((g) => g.leaf === 'pane-root')?.scrollTop ?? -1
    const pane1Now = geom.find((g) => g.leaf === 'pane-1')?.scrollTop ?? -1
    expect(
      Math.abs(rootNow - rootRecorded),
      'pane-root 的滚动位应等于它自己钉下去的值',
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(pane1Now - pane1Recorded),
      'pane-1 的滚动位应等于它自己钉下去的值',
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(pane1Now - rootNow),
      `两格同一会话却报出同一个滚动位(${rootNow} / ${pane1Now})⇒ 滚动状态被并成了一格`,
    ).toBeGreaterThan(200)

    // 立据 2(账目):根格切走再切回,恢复的是**自己**那一格在甲会话上的落点;
    // 与此同时 pane-1 一格里的同一枚会话不得被这次恢复带着走。
    await openFromSidebar(page, TITLE_B)
    await expect(rootPaneList).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    // pane-1 不受根格切换影响:它自己那份列表仍是甲的 60 条
    await expect(pane1List).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await openFromSidebar(page, TITLE_A)
    await expect(rootPaneList).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
    await page.waitForTimeout(GRACE_SETTLE_MS)

    const rootRestored = (await listGeometry(rootPaneList)).scrollTop
    const pane1After = (await listGeometry(pane1List)).scrollTop
    expect(
      Math.abs(rootRestored - rootRecorded),
      `根格恢复落点 ${rootRestored}px 偏离它自己的离开位 ${rootRecorded}px 超过 ±${RESTORE_TOLERANCE_PX}px`,
    ).toBeLessThanOrEqual(RESTORE_TOLERANCE_PX)
    expect(
      Math.abs(pane1After - pane1Recorded),
      `pane-1 的滚动位被根格的恢复改写了(${pane1Recorded}px → ${pane1After}px)⇒ 两格共用了同一份落账身份`,
    ).toBeLessThanOrEqual(RESTORE_TOLERANCE_PX)

    // 更强的那一版本来要证什么、为什么在浏览器里驱动不出来:见本用例末注与 gap 注记
    test.info().annotations.push({
      type: 'gap',
      description:
        '未能在实机里把 pane-1 自己的会话"切走再切回"(因此 pane-1::会话 这一枚键的恢复腿只有单元证据)。' +
        '结构性原因(现读生产码):窗格承载的会话是写一次的 —— ' +
        'pane-split-container.tsx:362 `onDrop={isEmpty ? handleDrop : undefined}` 只在空窗格上挂落点处理器,' +
        'multi-pane.ts:303 dropConversationToPane 对非空目标直接 return null;' +
        '除 dropConversation 外没有任何 UI/存储动作能改一个已承载会话窗格的 conversationId' +
        '(splitPane 的第 3 参在生产路径里恒传 null,见 pane-split-container.tsx:265/274)。' +
        '⇒ pane-1 一旦承载甲就再也换不走,切回来的那一次布局效应拿不到 prev.key 变化,恢复腿不成立。' +
        '二元键本身由 __tests__/scroll-session-restore-pane-identity.test.tsx:201-220 直接锁死;' +
        '本用例在浏览器里能证到的最强形态是上面两条立据(同一会话在两格各自有独立的滚动几何与独立的落账互不串写)。',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
