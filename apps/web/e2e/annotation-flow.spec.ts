// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D42 浏览器视觉标注 —— 全链路 e2e(2026-09-24 立,把台账里"全链路 e2e 未跑(另票)"变成已做)
//
// 覆盖链路动词(逐条一条用例):
//   T1 开面板 → tab 进入 cdp 态(数据面 probe → proxy-error → sessions 整链)
//   T2 点选开关注入生效(假远端页 window.__ihuiPickInstalled + #ihui-pick-style 哨兵;关闭摘除)
//   T3 点选远端元素 → 样式面板 7 字段齐备且值来自远端 computedStyle;"批注缺失时禁用提交"态
//   T4 批注「添加到对话」→ 派发 ihui:add-text-reference → 输入区引用 chip 出现 + 批注清空
//   T5 annotationStale:发送前元素签名漂移 → 弱警示条出现,且不阻塞派发(chip 仍入输入区)
//
// 为什么整段 mock(不改判据逻辑,只换"画面/传输"载体):
// - CI(e2e.yml)没有 ai-service:8803,真 CDP 会话背后的 Playwright 引擎在 CI 不可得。
//   数据面(GET/POST /api/browser/*、/api/embed-proxy/raw)一律 page.route 拦截;
//   画面/事件面用 addInitScript 替换 window.WebSocket 为假会话:execute 脚本 eval 到
//   一个**同源 srcdoc iframe**(假远端页)。PICK_INSTALL / PICK_READ / buildRecheckScript
//   三条注入脚本在真 Chromium 的真远端文档上原样执行 —— 断言对象是注入脚本的真实效果
//   (__ihuiPickInstalled、computedStyle 采集、selector+text 签名重查),不是手搓假返回。
// - 进入 cdp 的降级链走产品真实路径:probe canEmbed=false → proxy 模式 → 代理页
//   postMessage ihui-embed-proxy-error → onFailed → createBrowserSession → mode=cdp。
//
// 本仓实测的三类偶发红已规避:不用 boundingBox;不依赖 hover 驻留(全部 click 直达);
// 所有断言 expect 轮询(上限 ≤15s,单用例 timeout 120s,poll 上限 < 用例超时)。
import { test, expect, type Page } from './fixtures'
import type { Route } from '@playwright/test'

const TARGET_URL = 'https://e2e-annotation.test/order'
const SESSION_ID = 'e2e-cdp-annotation-1'
const REMOTE_IFRAME_ID = 'ihui-e2e-fake-remote-page'

/** 假"远端页":CDP 画面真实对象在 CI 不可得,以该同源 iframe 代替,注入脚本在其 window 里 eval */
const REMOTE_PAGE_HTML = [
  '<!doctype html><html><head><meta charset="utf-8"><title>E2E 订单页</title></head>',
  '<body style="margin:0;padding:16px;font-family:sans-serif">',
  '<button id="order-btn" class="pay-confirm" style="color:#e11d48;background-color:#fef2f2;',
  'border:1px solid #e11d48;border-radius:4px;font-size:14px;margin:8px;padding:6px">订单编号 A20260927</button>',
  '</body></html>',
].join('')

/** 代理页替身:文档一加载就报"代理失败",驱动 store 的真实降级链(proxy-error → onFailed → cdp) */
const PROXY_ERROR_HTML = [
  '<!doctype html><html><head><meta charset="utf-8"></head><body>',
  '<script>parent.postMessage({ type: "ihui-embed-proxy-error", message: "e2e: 代理模拟失败" }, "*")</script>',
  '</body></html>',
].join('')

/** 假 WebSocket:仅拦 /api/browser/ws/,其余 URL(Next HMR 等)原样透传真实现 */
const FAKE_WS_INIT_SCRIPT = [
  '(() => {',
  '  const REMOTE_ID = ' + JSON.stringify(REMOTE_IFRAME_ID) + ';',
  '  const REMOTE_HTML = ' + JSON.stringify(REMOTE_PAGE_HTML) + ';',
  '  const WS_MARK = "/api/browser/ws/";',
  '  const NativeWebSocket = window.WebSocket;',
  '  let remoteReady = false;',
  '  const pendingExecutes = [];',
  '  const ensureRemote = () => {',
  '    const found = document.getElementById(REMOTE_ID);',
  '    if (found) return found;',
  '    if (!document.body) return null;',
  '    const frame = document.createElement("iframe");',
  '    frame.id = REMOTE_ID;',
  '    frame.setAttribute("aria-hidden", "true");',
  '    frame.srcdoc = REMOTE_HTML;',
  '    frame.style.cssText = "position:fixed;left:8px;top:64px;width:380px;height:220px;' +
    'background:#ffffff;border:1px solid #444444;z-index:2147483000";',
  '    frame.addEventListener("load", () => {',
  '      remoteReady = true;',
  '      const queued = pendingExecutes.splice(0);',
  '      for (const run of queued) run();',
  '    });',
  '    document.body.appendChild(frame);',
  '    return frame;',
  '  };',
  '  const evalInRemote = (script) => {',
  '    const found = document.getElementById(REMOTE_ID);',
  '    const cw = found instanceof HTMLIFrameElement ? found.contentWindow : null;',
  '    if (!cw) return null;',
  '    try { return cw.eval(script); } catch (err) { return null; }',
  '  };',
  '  function FakeSessionSocket(url) {',
  '    const self = this;',
  '    self.url = url;',
  '    self.readyState = 0;',
  '    self.onopen = null; self.onmessage = null; self.onerror = null; self.onclose = null;',
  '    const listeners = { open: [], message: [], error: [], close: [] };',
  '    self.addEventListener = (t, h) => { if (listeners[t]) listeners[t].push(h); };',
  '    self.removeEventListener = (t, h) => {',
  '      if (listeners[t]) listeners[t] = listeners[t].filter((x) => x !== h);',
  '    };',
  '    const emit = (t, extra) => {',
  '      const ev = new Event(t);',
  '      Object.assign(ev, extra || {});',
  '      const prop = self["on" + t];',
  '      if (typeof prop === "function") prop.call(self, ev);',
  '      for (const h of listeners[t].slice()) h.call(self, ev);',
  '    };',
  '    const respondExecute = (script) => {',
  '      const data = evalInRemote(script);',
  '      emit("message", {',
  '        data: JSON.stringify({',
  '          type: "execute_result",',
  '          data: data === undefined || data === null ? null : String(data),',
  '        }),',
  '      });',
  '    };',
  '    self.send = (payload) => {',
  '      let msg = null;',
  '      try { msg = JSON.parse(payload); } catch (err) { return; }',
  '      if (!msg || msg.type !== "execute" || typeof msg.script !== "string") return;',
  '      if (remoteReady) setTimeout(() => respondExecute(msg.script), 0);',
  '      else pendingExecutes.push(() => respondExecute(msg.script));',
  '    };',
  '    self.close = () => { self.readyState = 3; emit("close", { code: 1000, reason: "e2e-fake" }); };',
  '    setTimeout(() => { ensureRemote(); self.readyState = 1; emit("open", {}); }, 0);',
  '  }',
  '  function PatchedWebSocket(url, protocols) {',
  '    const s = String(url);',
  '    if (s.indexOf(WS_MARK) >= 0) return new FakeSessionSocket(s);',
  '    return new NativeWebSocket(s, protocols);',
  '  }',
  '  PatchedWebSocket.prototype = NativeWebSocket.prototype;',
  '  PatchedWebSocket.CONNECTING = 0;',
  '  PatchedWebSocket.OPEN = 1;',
  '  PatchedWebSocket.CLOSING = 2;',
  '  PatchedWebSocket.CLOSED = 3;',
  '  window.WebSocket = PatchedWebSocket;',
  '})();',
].join('\n')

/** 数据面命中计数:断言链路真的经过被 mock 的产品调用(而非绕道成功) */
interface DataPlaneHits {
  probe: number
  sessions: number
  embedProxy: number
}

function jsonOk(route: Route, data: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 0, message: 'ok', data }),
  })
}

async function mockBrowserDataPlane(page: Page, hits: DataPlaneHits): Promise<void> {
  await page.addInitScript({ content: FAKE_WS_INIT_SCRIPT })

  await page.route('**/api/chat/conversations**', async (route) => {
    if (route.request().method() === 'GET') {
      await jsonOk(route, { conversations: [], page: 1, pageSize: 20, total: 0 })
    } else {
      await jsonOk(route, { conversation: null })
    }
  })

  await page.route('**/api/browser/probe', async (route) => {
    hits.probe += 1
    await jsonOk(route, { url: TARGET_URL, canEmbed: false })
  })

  await page.route('**/api/embed-proxy/raw**', async (route) => {
    hits.embedProxy += 1
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: PROXY_ERROR_HTML,
    })
  })

  await page.route('**/api/browser/sessions**', async (route) => {
    if (route.request().method() === 'POST') hits.sessions += 1
    await jsonOk(route, {
      session_id: SESSION_ID,
      url: TARGET_URL,
      title: 'E2E 订单页',
      cookie_count: 0,
    })
  })
}

/** UI 驱动进入 cdp 态:开面板(+ 菜单 → 内置浏览器)→ 地址栏导航 → 等 CdpBrowserView 独有控件出现 */
async function openWorkPanelWithCdpTab(page: Page): Promise<void> {
  await page.goto('/chat', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="ai-side-panel-aside"] textarea').first()).toBeVisible({
    timeout: 30_000,
  })

  await page.getByRole('button', { name: '添加视图' }).click()
  const plusMenu = page.locator('[data-testid="global-topbar-plus-menu"]')
  await expect(plusMenu).toBeVisible()
  await plusMenu.getByRole('menuitem', { name: '内置浏览器' }).click()

  const panel = page.locator('[data-testid="web-work-panel"]')
  await expect(panel).toBeVisible()
  const addressInput = panel.locator('input[type="text"]').first()
  await expect(addressInput).toBeVisible()
  await addressInput.fill('e2e-annotation.test/order')
  await addressInput.press('Enter')

  // 「点选元素」按钮只在 CdpBrowserView 内渲染 ⇒ 它的出现即证明
  // probe→proxy-error→sessions→mode=cdp 整条降级链跑通(web-work-panel.tsx isCdpMode 判定)
  await expect(page.locator('[data-testid="pick-element-toggle"]')).toBeVisible({ timeout: 20_000 })
}

/** 读假远端页的注入痕迹(window.__ihuiPickInstalled + #ihui-pick-style 哨兵) */
function probeRemoteState(
  page: Page,
): Promise<{ exists: boolean; installed: boolean; hasSentinel: boolean }> {
  return page.evaluate((frameId: string) => {
    const found = document.getElementById(frameId)
    const cw = found instanceof HTMLIFrameElement ? found.contentWindow : null
    if (!cw) return { exists: false, installed: false, hasSentinel: false }
    const w = cw as unknown as { __ihuiPickInstalled?: unknown; document: Document }
    return {
      exists: true,
      installed: w.__ihuiPickInstalled === true,
      hasSentinel: w.document.getElementById('ihui-pick-style') !== null,
    }
  }, REMOTE_IFRAME_ID)
}

/** 点开「点选元素」→ 真点击假远端页按钮 → 等样式面板出现(600ms read 轮询上限兜在 15s) */
async function pickRemoteOrderButton(page: Page): Promise<void> {
  const toggle = page.locator('[data-testid="pick-element-toggle"]')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.frameLocator(`#${REMOTE_IFRAME_ID}`).locator('#order-btn').click()
  await expect(page.locator('[data-testid="annotation-style-panel"]')).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('D42 浏览器视觉标注全链路', () => {
  let hits: DataPlaneHits

  test.beforeEach(async ({ adminPage: page }) => {
    test.setTimeout(120_000)
    hits = { probe: 0, sessions: 0, embedProxy: 0 }
    await mockBrowserDataPlane(page, hits)
  })

  test('T1 开面板:tab 进入 cdp 态,数据面 probe→proxy-error→sessions 整链被经过', async ({
    adminPage: page,
  }) => {
    await openWorkPanelWithCdpTab(page)
    const panel = page.locator('[data-testid="web-work-panel"]')
    // cdp 态渲染的是 canvas 画面视图(不是 iframe / 截图 img)
    await expect(panel.locator('canvas')).toBeVisible()
    await expect(panel.locator('input[type="text"]').first()).toHaveValue(TARGET_URL)
    expect(hits.probe).toBeGreaterThanOrEqual(1)
    expect(hits.embedProxy).toBeGreaterThanOrEqual(1)
    expect(hits.sessions).toBe(1)
  })

  test('T2 点选开关注入生效:假远端页装出 __ihuiPickInstalled 与样式哨兵;关闭时摘除哨兵', async ({
    adminPage: page,
  }) => {
    await openWorkPanelWithCdpTab(page)
    const before = await probeRemoteState(page)
    expect(before.exists).toBe(true)
    expect(before.installed).toBe(false)
    expect(before.hasSentinel).toBe(false)

    const toggle = page.locator('[data-testid="pick-element-toggle"]')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => (await probeRemoteState(page)).installed, { timeout: 10_000 })
      .toBe(true)
    expect((await probeRemoteState(page)).hasSentinel).toBe(true)

    // 关开关 → effect cleanup 注入 PICK_REMOVE_SCRIPT → 样式表(捕获监听器的短路哨兵)被摘
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect
      .poll(async () => (await probeRemoteState(page)).hasSentinel, { timeout: 10_000 })
      .toBe(false)
  })

  test('T3 点选远端元素:样式面板 7 字段齐备且取远端 computedStyle;批注缺失时禁用提交', async ({
    adminPage: page,
  }) => {
    await openWorkPanelWithCdpTab(page)
    await pickRemoteOrderButton(page)

    const panel = page.locator('[data-testid="annotation-style-panel"]')
    await expect(panel).toBeVisible()
    await expect(panel.getByText('button#order-btn')).toBeVisible()
    await expect(page.locator('[data-testid="picked-element-text"]')).toHaveText(
      '订单编号 A20260927',
    )

    // 7 个样式字段全部落到面板输入框,值即假远端页的 computedStyle(逐字面断言,改采集即红)
    const expected: ReadonlyArray<readonly [string, string]> = [
      ['style-color', 'rgb(225, 29, 72)'],
      ['style-backgroundColor', 'rgb(254, 242, 242)'],
      ['style-border', '1px solid rgb(225, 29, 72)'],
      ['style-borderRadius', '4px'],
      ['style-fontSize', '14px'],
      ['style-margin', '8px'],
      ['style-padding', '6px'],
    ]
    for (const [testId, value] of expected) {
      const field = page.locator(`[data-testid="${testId}"]`)
      await expect(field).toBeEnabled()
      await expect(field).toHaveValue(value)
    }

    // 「批注缺失时禁用提交」态:note 为空 → 添加到对话 disabled;填入 → enabled
    await expect(page.locator('[data-testid="add-to-conversation"]')).toBeDisabled()
    await page.locator('[data-testid="annotation-note"]').fill('主按钮颜色太浅')
    await expect(page.locator('[data-testid="add-to-conversation"]')).toBeEnabled()
  })

  test('T4 批注「添加到对话」:派发 ihui:add-text-reference,输入区出现引用 chip 且批注清空', async ({
    adminPage: page,
  }) => {
    await openWorkPanelWithCdpTab(page)
    await pickRemoteOrderButton(page)
    // 签名一致的基线:警示条不应存在(把它当"永远不出现"断言 = 变异取证 M4 的反向半边)
    await expect(page.locator('[data-testid="stale-warning"]')).toHaveCount(0)

    const note = '把订单按钮颜色改深'
    await page.locator('[data-testid="annotation-note"]').fill(note)
    await page.locator('[data-testid="add-to-conversation"]').click()

    await expect(page.locator('[data-testid="annotation-note"]')).toHaveValue('')
    await expect(page.locator('[data-testid="add-to-conversation"]')).toBeDisabled()

    const chipRow = page
      .locator('[data-testid="ai-side-panel-aside"] li')
      .filter({ hasText: '视觉标注 [button#order-btn]' })
      .first()
    await expect(chipRow).toBeVisible({ timeout: 10_000 })
    await chipRow.locator('button').first().click()
    const preview = chipRow.locator('p').first()
    await expect(preview).toContainText(`批注: ${note}`)
    await expect(preview).toContainText('样式快照: 颜色: rgb(225, 29, 72)')
  })

  test('T5 annotationStale:发送前元素签名漂移 → 弱警示条出现,且不阻塞派发', async ({
    adminPage: page,
  }) => {
    await openWorkPanelWithCdpTab(page)
    await pickRemoteOrderButton(page)
    await expect(page.locator('[data-testid="stale-warning"]')).toHaveCount(0)

    // 点选完成、面板打开之后才改远端元素文本:open 时重查已判 match=true,
    // 之后唯一能把 stale 置真的代码 = handleAdd 发送前的第二次 recheckStale
    await page
      .frameLocator(`#${REMOTE_IFRAME_ID}`)
      .locator('#order-btn')
      .evaluate((el) => {
        el.textContent = '订单编号 A20260927(已变更)'
      })

    await page.locator('[data-testid="annotation-note"]').fill('颜色仍偏浅')
    await page.locator('[data-testid="add-to-conversation"]').click()

    await expect(page.locator('[data-testid="stale-warning"]')).toBeVisible({ timeout: 10_000 })
    // "弱"警示的定义:警示不阻塞派发 —— chip 照常入输入区
    await expect(
      page
        .locator('[data-testid="ai-side-panel-aside"] li')
        .filter({ hasText: '视觉标注 [button#order-btn]' })
        .first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="annotation-note"]')).toHaveValue('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
