// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { parseRichAnchors, richAnchorTagSequence, richAnchorsToPlainText } from '@ihui/shared/chat'

/**
 * 票 D04 · 消息串内富文本动作锚点 —— **浏览器级**验收面(AGENTS.md §17:UI 改动必须真机验证)。
 *
 * 票面验收三条逐字对应本文件的三组用例:
 *  ① 「`t.rich` 链路在 web 上真渲染出可点击元素(e2e 断 `role`/`href`,不接受只断字符串非空)」
 *     → 组 1(可点击锚点)+ 组 4(词包 `t.rich` 腿真渲染,且与模型输出腿**同一张渲染表**)
 *  ② 「反例断言"AI 输出的 `<script>`/`<img onerror>` 不被执行"(安全用例)」→ 组 2
 *  ③ 「五语言语序变体用例各 1 条」→ 组 3
 *
 * ── 为什么必须浏览器级、而不是再补一份组件测 ──
 * 既有 `src/components/chat/__tests__/rich-anchor-text.test.tsx` 跑在 jsdom:jsdom 不建布局,
 * 「可点击」在 jsdom 里等价于"有个 `<a>` 标签";而票面点名的失效型恰恰是**渲染链断了但断言还绿**
 * 那一型(锚点串被当成普通文本喂给 MarkdownStream ⇒ MarkdownStream 按既有契约丢弃裸 HTML,
 * 字符串非空、元素为零)。本组用例一律断 `role`/`href`/盒尺寸/`instanceof HTMLAnchorElement`,
 * 并成对断"不该出现的锚点确实没出现"。
 *
 * ── ①的取证面边界(如实登记,不写成"全格已闭") ──
 * 全仓现读 `t.rich` 生产点共两处(`self-media/automation` 的 `note5`、`ai/move-to-worktree-dialog`
 * 的 `subtitle`),两处词包值里的锚点族分别是 `<code>` 与 `<branch>` —— **都不是 link 族**,
 * 所以"词包腿直接产出一枚可点击 `<a>`"这一格在**词包面尚不存在载体**,它归 D04③ 规模化
 * (票面自述"与 D83/D81/D54 同批",属归他人桶)。本文件因此把①拆成两半各自钉死:
 *   - link 族的**可点击性**在浏览器里断到 role/href/target/rel/实际命中盒(组 1);
 *   - link 族与 `t.rich` 腿**共用同一张表**在浏览器里断到 DOM 签名逐字等值(组 4)
 *     ——渲染表由 `RICH_ANCHOR_COMPONENTS` 单点产出,`richAnchorRenderer(tag)` 取的就是它,
 *     故"同表"一经 DOM 签名对上,可点击性即随表到达词包腿,不需要为凑用例改产品文案。
 *
 * ── 判据不复制(§22c / 守门 191)──
 * 期望序列一律 import 共享解析层(`parseRichAnchors` + `richAnchorTagSequence` +
 * `richAnchorsToPlainText`)在 Node 侧算,再与**浏览器 DOM** 比 —— 比对的是"解析序 ⇄ 渲染序"
 * 这一条跨界面,而不是把正则抄一遍进测试。
 *
 * ── 供给面纪律 ──
 * 全链路 route mock,不吃后端(`chat-pane-split-scroll-restore.spec.ts` 的既有先例);
 * 登录态 = localStorage `ihui-auth`(zustand persist 形态)+ 非 httpOnly `auth_token` cookie。
 * `--base-url` 必填:8801/8802 常年是他席 dev 进程,拿别人的服务跑 ⇒ 失败不可归因本席。
 * 起法(本仓唯一正牌出口):
 *   IHUI_DEV_PORT=<本席端口> IHUI_BUILD_DIST=.next-e2e-<短名> node scripts/dev-with-warmup.mjs --no-backend
 *   node scripts/e2e-local-supply.mjs --run --base-url=http://localhost:<本席端口> -- \
 *     e2e/rich-anchor-flow.spec.ts --project=chromium --no-deps
 * 本文件**不写死任何端口字面量**(cookie 的 url 由 `PLAYWRIGHT_BASE_URL` 现算),
 * 免掉 `check-port-registry.mjs` 那格"临时端口也进注册表"的污染。
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * 供给面(基址)当次现取:env 优先(CI 与本席 `e2e-local-supply --base-url` 都写这一键),
 * 其次退回 playwright.config 的 `use.baseURL`。
 * 这道闸**刻意不放模块加载期**:顶层 throw 会让整个 e2e 套件在装载阶段崩成
 * "No tests found / Total: 0 tests in 0 files"(本仓 `e2e/fixtures.ts` 的 `requireEnv` 就是这个形状),
 * 那等于把本席的门槛变成别人的恒红门(§12e)——失效方向只能是"本席这几条用例红",不能是"谁都跑不动"。
 */
function baseOrigin(): string {
  const raw = process.env.PLAYWRIGHT_BASE_URL ?? test.info().project.use.baseURL ?? ''
  if (!raw) {
    throw new Error(
      'D04 e2e 需要显式供给面:请经 `node scripts/e2e-local-supply.mjs --run --base-url=…` 起,' +
        '或先起本席自有端口(见文件头)。拿别席的服务跑 ⇒ 失败不可归因本席。',
    )
  }
  return raw.replace(/\/+$/, '')
}

const CONVERSATION_ID = 'e2e-rich-anchor-conv'
const CONVERSATION_TITLE = 'E2E 富文本锚点取证'

/** 五语言语序变体的唯一资产面 = 仓内词包(不在此重抄文案,漂开即假绿) */
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

interface ProbeSpec {
  readonly locale: (typeof LOCALES)[number]
  readonly flow: string
  readonly expectedOrder: readonly string[]
}

function loadProbe(locale: (typeof LOCALES)[number]): ProbeSpec {
  const file = path.join(ROOT, 'packages', 'i18n', 'messages', 'shared', `${locale}.json`)
  const parsed = JSON.parse(readFileSync(file, 'utf-8')) as {
    richAnchorProbe?: { flow?: unknown }
  }
  const flow = parsed.richAnchorProbe?.flow
  if (typeof flow !== 'string' || flow.length === 0) {
    throw new Error(`missing richAnchorProbe.flow in ${locale}.json`)
  }
  const nodes = parseRichAnchors(flow)
  const order = richAnchorTagSequence(nodes)
  if (order.length < 2) {
    throw new Error(`${locale}.json richAnchorProbe.flow 不产锚点,语序用例无从断言`)
  }
  return { locale, flow, expectedOrder: order }
}

/**
 * 构造历史行。
 * `content` 由用例逐条给定 ⇒ 渲染分支(`hasRichAnchors` 走 RichAnchorText / 否则走 MarkdownStream)
 * 由**生产码自己**判,测试不预判(预判即"把判据复制进测试")。
 */
function historyRows(
  messages: readonly { id: string; role: 'user' | 'assistant'; content: string }[],
) {
  const base = Date.now() - 60 * 60_000
  return messages.map((m, i) => ({
    id: m.id,
    conversationId: CONVERSATION_ID,
    role: m.role,
    content: m.content,
    reasoning: null,
    tokens: 1,
    metadata: null,
    createdAt: new Date(base + i * 1000).toISOString(),
  }))
}

function json(body: unknown) {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 0, message: 'ok', data: body }),
  }
}

function convRow() {
  const now = new Date().toISOString()
  return {
    id: CONVERSATION_ID,
    userId: 'e2e',
    title: CONVERSATION_TITLE,
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

async function mockBackend(page: Page, messages: Parameters<typeof historyRows>[0]): Promise<void> {
  const rows = historyRows(messages)
  // 注册顺序 = 兜底在前、专档在后(Playwright 后注册者优先匹配)
  await page.route('**/api/**', (route) => route.fulfill(json({})))
  // 空壳兜底会让 voice-note 的 `res.data.list.map` 炸成 unhandledRejection(读的是生产码
  // apps/web/src/components/chat/voice-note.tsx:108),/chat 首帧就带这颗雷 ⇒ 专档给形状
  await page.route('**/api/voice-notes**', (route) =>
    route.fulfill(json({ list: [], groups: [], total: 0 })),
  )
  await page.route('**/api/chat/cost-estimate**', (route) =>
    route.fulfill(
      json({ estimatedTokensIn: 0, estimatedTokensOut: 0, estimatedCostUsd: 0, priced: true }),
    ),
  )
  await page.route('**/auth/refresh**', (route) =>
    route.fulfill(
      json({
        accessToken: 'e2e-rich-anchor-access',
        refreshToken: 'e2e-rich-anchor-refresh',
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
    const pathname = new URL(req.url()).pathname
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204 })
      return
    }
    if (/^\/api\/chat\/conversations\/[^/]+\/messages$/.test(pathname)) {
      await route.fulfill(
        json({
          messages: rows,
          page: 1,
          pageSize: 50,
          total: rows.length,
          hasMore: false,
          nextCursor: 'e2e-rich-anchor-cursor',
        }),
      )
      return
    }
    if (/^\/api\/chat\/conversations\/[^/]+$/.test(pathname)) {
      await route.fulfill(json({ conversation: convRow() }))
      return
    }
    if (pathname === '/api/chat/conversations' && req.method() === 'GET') {
      await route.fulfill(json({ conversations: [convRow()], page: 1, pageSize: 20, total: 1 }))
      return
    }
    await route.fulfill(json({ conversation: convRow() }))
  })
}

/** 登录态 + 语言:cookie 的 url 由当次 baseURL 现算,不落端口字面量 */
async function seedSession(page: Page, locale?: string): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'e2e-rich-anchor-access',
      url: baseOrigin(),
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ])
  if (locale) {
    // cookie 决定 SSR 首帧 <html lang>(见 apps/web/src/lib/locale-cookie.ts)
    await page.context().addCookies([
      {
        name: 'locale',
        value: locale,
        url: baseOrigin(),
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ])
  }
  await page.addInitScript(
    ([loc]) => {
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
      if (loc) {
        localStorage.setItem(
          'ihui-language',
          JSON.stringify({ state: { locale: loc, initialized: true }, version: 0 }),
        )
      }
    },
    [locale ?? null],
  )
}

/** 消息泡内 `RichAnchorText` 的落点(见 MessageItem.tsx 的 `message-rich-anchors-${m.id}`) */
function anchorBubble(page: Page, messageId: string): Locator {
  return page.locator(`[data-testid="message-rich-anchors-${messageId}"]`)
}

/**
 * 打开会话并等首条锚点消息真的挂载。
 * 不等"字符串非空"而等"元素在场" —— 票面点名的失效型正是串在而元素零。
 * 侧栏条目必须**先等到可见再点**:水合前它不在 a11y 树里,盲点会静默打空(实测首轮 120s 空等)。
 */
async function openConversation(page: Page, firstMessageId: string): Promise<void> {
  await page.goto(`${baseOrigin()}/chat`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await openSidebarConversation(page)
  await expect(
    page.locator(`[data-message-id="${firstMessageId}"]`).first(),
    '首条消息未挂载 ⇒ 会话没打开,后续断言全部无意义',
  ).toBeVisible({ timeout: 120_000 })
}

async function openSidebarConversation(page: Page): Promise<void> {
  const entry = page.getByRole('button', { name: CONVERSATION_TITLE }).first()
  await expect(entry, '侧栏会话条目没出现 ⇒ mock 的会话列表形状不对').toBeVisible({
    timeout: 90_000,
  })
  await entry.click()
}

test.describe('D04 · 消息串内富文本动作锚点(浏览器级验收)', () => {
  test.setTimeout(300_000)

  test('① link 族锚点渲染成**真可点击**元素:role=link + href + target/rel + 命中盒', async ({
    page,
  }) => {
    const DOC = 'https://aizhs.top/docs'
    const PRICE = 'https://aizhs.top/pricing'
    await seedSession(page)
    await mockBackend(page, [
      { id: 'u1', role: 'user', content: '给我文档入口' },
      {
        id: 'a1',
        role: 'assistant',
        content: `文档在<link>${DOC}</link>，价格见<learnMore>${PRICE}</learnMore>，其余按纯文本。`,
      },
    ])
    await openConversation(page, 'a1')

    const bubble = anchorBubble(page, 'a1')
    await expect(bubble).toBeVisible()
    // 一律作用域到本条消息泡:页面外壳(侧栏/导航)本身就有 20+ 枚 link,裸取必失真
    const links = bubble.getByRole('link')
    // 两枚 link 族标签 ⇒ 两枚真链接(不是"文本里长得像链接")
    await expect(links).toHaveCount(2)
    await expect(links.nth(0)).toHaveAttribute('href', DOC)
    await expect(links.nth(1)).toHaveAttribute('href', PRICE)
    for (const index of [0, 1]) {
      const link = links.nth(index)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      // 真有命中盒才算"可点击":jsdom 里 0×0 盒照样能过
      const box = await link.boundingBox()
      expect(box, '链接没有可命中盒 ⇒ 端上等于不可点击').not.toBeNull()
      expect(box?.width ?? 0).toBeGreaterThan(0)
      expect(box?.height ?? 0).toBeGreaterThan(0)
    }
    // 渲染层证据:必须是 HTMLAnchorElement 且 .href 被浏览器解析成绝对 URL
    const hrefs = await bubble.evaluate((el) =>
      Array.from(el.querySelectorAll('a'))
        .filter((a) => a instanceof HTMLAnchorElement)
        .map((a) => a.getAttribute('href')),
    )
    expect(hrefs).toEqual([DOC, PRICE])
  })

  test('①反例 非安全协议内文不产链接:javascript: 走纯文本,role=link 为零', async ({ page }) => {
    await seedSession(page)
    await mockBackend(page, [
      {
        id: 'a2',
        role: 'assistant',
        content: `别点<link>javascript:alert(1)</link>结束`,
      },
    ])
    await openConversation(page, 'a2')

    const bubble = anchorBubble(page, 'a2')
    await expect(bubble).toBeVisible()
    await expect(bubble.locator('a')).toHaveCount(0)
    await expect(bubble.getByRole('link')).toHaveCount(0)
    // 不产链接 ≠ 丢字:内文逐字留在文本里
    await expect(bubble).toContainText('javascript:alert(1)')
  })

  test('② 安全反例:AI 输出里的 <script>/<img onerror> 不执行(两条渲染腿都断)', async ({ page }) => {
    await seedSession(page)
    await mockBackend(page, [
      {
        id: 'a3',
        role: 'assistant',
        // 含白名单锚点 ⇒ 走 RichAnchorText,非白名单片段按纯文本降级(票面契约)
        content:
          '<action>正在注入</action><script>window.__xssAnchor=1</script>' +
          '<img src=x onerror="window.__xssImg=1">',
      },
      {
        id: 'a4',
        role: 'assistant',
        // 不含白名单锚点 ⇒ 走 MarkdownStream(默认丢弃裸 HTML)——这条腿同样不许执行
        content: '<script>window.__xssMarkdown=1</script><img src=x onerror="window.__xssMd2=1">',
      },
    ])
    await openConversation(page, 'a3')

    // 等一帧让 onerror 有机会点火,再取全局标记
    await page.waitForTimeout(1_200)
    const flags = await page.evaluate(() => ({
      anchor: (window as unknown as Record<string, unknown>).__xssAnchor,
      img: (window as unknown as Record<string, unknown>).__xssImg,
      markdown: (window as unknown as Record<string, unknown>).__xssMarkdown,
      md2: (window as unknown as Record<string, unknown>).__xssMd2,
    }))
    expect(flags, '任一标记被置起 ⇒ 载荷真被执行了').toEqual({
      anchor: undefined,
      img: undefined,
      markdown: undefined,
      md2: undefined,
    })

    // 锚点腿:锚点**确实渲染成了元素**(否则"没执行"只是因为整段没渲染)
    const bubble = anchorBubble(page, 'a3')
    await expect(bubble.locator('span').first()).toBeVisible()
    await expect(bubble.locator('script')).toHaveCount(0)
    await expect(bubble.locator('img')).toHaveCount(0)
    // 降级只去标记、不丢字:载荷原文逐字留在界面上(React 文本节点转义的可见结果)
    await expect(bubble).toContainText('<script>window.__xssAnchor=1</script>')
    await expect(bubble).toContainText('<img src=x onerror="window.__xssImg=1">')
  })

  test('③ 五语言语序变体各 1 条:浏览器 DOM 的锚点顺序 == 该语言词包的解析顺序', async ({
    browser,
  }) => {
    const probes = LOCALES.map(loadProbe)
    // 先当场量一次"这五份资产真的存在两种语序",否则下面的用例是空断言
    const orders = new Set(probes.map((p) => p.expectedOrder.join('>')))
    expect(orders.size, '五语言词包语序全部同形 ⇒ 本用例没有牙').toBeGreaterThan(1)

    const browserOrders = new Set<string>()
    for (const probe of probes) {
      // 每语言一枚全新 context:seedSession 走 addInitScript,同一 page 循环会把上一语言的
      // 初始化脚本叠在后面累积(后注册者赢),五轮就不是五个独立现场了。
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        await seedSession(page, probe.locale)
        await mockBackend(page, [
          { id: `p-${probe.locale}`, role: 'assistant', content: probe.flow },
        ])
        await page.goto(`${baseOrigin()}/chat`, {
          waitUntil: 'domcontentloaded',
          timeout: 180_000,
        })
        await openSidebarConversation(page)

        const bubble = anchorBubble(page, `p-${probe.locale}`)
        await expect(
          bubble,
          `${probe.locale}: 词包值没走锚点腿 ⇒ 该语言的语序无从渲染`,
        ).toBeVisible({ timeout: 120_000 })

        const rendered = await bubble.evaluate((el) =>
          Array.from(el.children)
            .filter((node) => node.nodeType === Node.ELEMENT_NODE)
            .map((node) => (node.textContent ?? '').trim()),
        )
        const anchors = parseRichAnchors(probe.flow).filter((n) => n.kind === 'anchor')
        const labels = anchors.map((node) =>
          node.kind === 'anchor' ? richAnchorsToPlainText(node.children).trim() : '',
        )
        // 反查表要求同语言内标签文案互不相同,否则"由 DOM 文本反推标签序"这一步不成立
        expect(new Set(labels).size, `${probe.locale}: 词包内两枚锚点文案同形,反查会失真`).toBe(
          labels.length,
        )
        const expected = probe.expectedOrder.map((_tag, i) => labels[i] ?? '')
        expect(
          rendered,
          `${probe.locale}: DOM 锚点顺序与词包解析顺序漂开(渲染器把语序洗平了)`,
        ).toEqual(expected)
        expect(rendered[0], `${probe.locale}: 首个锚点文案应与该语言词包一致`).toBe(labels[0])

        const labelToTag = new Map(labels.map((label, i) => [label, probe.expectedOrder[i] ?? '']))
        const reconstructed = rendered.map((text) => labelToTag.get(text) ?? '?').join('>')
        expect(
          reconstructed,
          `${probe.locale}: 浏览器里量到的标签序 ${reconstructed} ≠ 词包解析出的 ${probe.expectedOrder.join('>')}`,
        ).toBe(probe.expectedOrder.join('>'))
        browserOrders.add(reconstructed)
      } finally {
        await context.close()
      }
    }

    // 浏览器面也要量到"确实存在两种语序",否则上面五轮只是同形断言乘了五
    expect(
      browserOrders.size,
      `五语言在浏览器里渲染出 ${browserOrders.size} 种标签序,而词包有 ${orders.size} 种 ⇒ 语序信息在渲染腿丢失`,
    ).toBe(orders.size)
  })

  test('④ 两条腿同一张渲染表:词包 t.rich 腿与模型输出腿的 <code> DOM 签名逐字等值', async ({
    page,
  }) => {
    const TOKEN = 'E2E-CODE-TOKEN'
    await seedSession(page)
    await mockBackend(page, [
      {
        id: 'a5',
        role: 'assistant',
        content: `<action>检查</action>产物<code>${TOKEN}</code>完毕`,
      },
    ])
    await openConversation(page, 'a5')

    const chatCode = anchorBubble(page, 'a5').locator('code')
    await expect(chatCode).toHaveCount(1)
    await expect(chatCode).toHaveText(TOKEN)
    const chatSignature = await chatCode.evaluate((el) => ({
      tag: el.tagName,
      className: el.className,
    }))

    // 词包腿:`{t.rich('note5', { code: richAnchorRenderer('code') })}` 的真实生产点
    await page.goto(`${baseOrigin()}/self-media/automation`, {
      waitUntil: 'domcontentloaded',
      timeout: 180_000,
    })
    const richCodes = page.locator('li code')
    await expect(
      richCodes.first(),
      'note5 的 <code> 锚点没渲染成元素 ⇒ t.rich 腿没接上共享表',
    ).toBeVisible({ timeout: 120_000 })
    const automationSignature = await richCodes.first().evaluate((el) => ({
      tag: el.tagName,
      className: el.className,
    }))

    // 同表判据:标签名 + 类串逐字相同(Tailwind 类串即 CODE_CLASS 的投影)
    expect(automationSignature).toEqual(chatSignature)
    // 词包腿也必须是真元素而不是字面量:串里不该再出现尖括号 code
    await expect(page.locator('li').filter({ hasText: '<code>' })).toHaveCount(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
