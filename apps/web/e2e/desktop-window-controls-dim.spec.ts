// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from '@playwright/test'

/**
 * 桌面端(Tauri 薄壳)自绘窗口三按钮 —— 模态遮罩"等效压暗" + 窗口失焦降亮 真实浏览器守门。
 *
 * 为什么必须是 e2e(单测跑 happy-dom 测不到的两件事):
 *  1. `detectModalOverlayColor()` 的 alpha 解析吃的是 **真实 Chromium 的 computed
 *     background-color**。Tailwind 4 把 `bg-black/80` 编成 `color-mix(in oklab, …)`,
 *     浏览器把它序列化回什么形状(`rgba(...)` / `oklab(... ... / .8)` /
 *     `color(srgb …)` / 原样 `color-mix(...)`)决定 `readAlpha()` 是否返回 0。
 *     返回 0 → 压暗层恒 `opacity-0` → 整个修复在真机上等于没做。happy-dom 甚至会
 *     静默丢弃 oklab 赋值(见 tests/modal-overlay-watcher.test.ts 注释),单测绿不代表真机绿。
 *  2. 失焦两态的 CSS 规则是否真落地
 *     规则写在 globals.css 的 `[data-window-controls][data-window-inactive='true'] > button`
 *     (历史上曾写成组件内 Tailwind 任意变体 `group-data-[…]/wc:`,实测生产构建没把它编进
 *     CSS 产物 → 真机两态无差异)。只有 getComputedStyle 数值能证明规则生效。
 *
 * 桌面环境怎么来的:`page.addInitScript()` 注入最小 Tauri 桩(`__TAURI_INTERNALS__`
 * 的 metadata / invoke / transformCallback / unregisterCallback),让 `isTauri()` 为真
 * → `isDesktop` 为真 → `[data-window-controls]` 容器与压暗层才会渲染。**不改生产代码**
 * 加任何测试后门。失焦态由桩主动派发 `tauri://blur` 事件驱动
 * (链路:@tauri-apps/api window.js `onFocusChanged` → `Window.listen` →
 *  `listen('tauri://blur')` → `invoke('plugin:event|listen', { handler: transformCallback(cb) })`,
 *  本地事件白名单只含 tauri://created|error,故 blur/focus 一定走 invoke 通道 → 桩可拦)。
 *
 * 跑法(web 包目录,私有 dev 端口,避开 8801 生产构建 —— 见 AGENTS 记忆「8801 是生产构建」):
 *   node_modules/.bin/next dev --turbopack -p 8877        # 私有 dev
 *   PLAYWRIGHT_BASE_URL=http://localhost:8877 E2E_SKIP_SEED=1 \
 *     pnpm exec playwright test e2e/desktop-window-controls-dim.spec.ts --reporter=line --no-deps
 */

const SCREENSHOT_DIR = 'e2e/screenshots/desktop-window-controls-dim'

/** 压暗层 / 遮罩 / 按钮的 computed 数值快照 */
interface ComputedProbe {
  opacity: string
  backgroundColor: string
  color: string
}

/** 遮罩候选层的证据行(打印用) */
interface OverlayEvidence {
  className: string
  position: string
  zIndex: string
  backgroundColor: string
  width: number
  height: number
}

/** 注入到页面上的桩控制面 */
interface TauriStubApi {
  setFocused(focused: boolean): void
  emitWindowEvent(event: string, payload: unknown): number
  listenerEvents(): string[]
  invokeCalls(): string[]
}

const WINDOW_CONTROLS_SELECTOR = '[data-window-controls]'
const DIM_LAYER_SELECTOR = '[data-window-controls-dim]'

/** 注入最小 Tauri IPC 桩:必须在任何页面脚本执行前存在(addInitScript 语义)。 */
async function installTauriStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const handlers = new Map<
      number,
      (evt: { event: string; id: number; payload: unknown }) => void
    >()
    const listeners: Array<{ event: string; handlerId: number; eventId: number }> = []
    const invokeLog: string[] = []
    let nextId = 1
    let focused = true

    const internals: Record<string, unknown> = {
      metadata: {
        currentWindow: { label: 'main' },
        windows: { main: { label: 'main' } },
        packageInfo: { version: '2.0.0' },
      },
      transformCallback(callback: (evt: unknown) => void) {
        const id = nextId++
        handlers.set(id, callback as (evt: { event: string; id: number; payload: unknown }) => void)
        return id
      },
      unregisterCallback(id: number) {
        handlers.delete(id)
      },
      invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
        invokeLog.push(cmd)
        switch (cmd) {
          case 'plugin:event|listen': {
            const entry = {
              event: String(args?.event ?? ''),
              handlerId: Number(args?.handler ?? 0),
              eventId: nextId++,
            }
            listeners.push(entry)
            return Promise.resolve(entry.eventId)
          }
          case 'plugin:event|unlisten':
            return Promise.resolve(null)
          case 'plugin:window|is_maximized':
            return Promise.resolve(false)
          case 'plugin:window|is_focused':
            return Promise.resolve(focused)
          case 'plugin:window|get_all_windows':
            return Promise.resolve([{ label: 'main' }])
          case 'plugin:window|is_decorated':
          case 'plugin:window|is_resizable':
          case 'plugin:window|is_maximizable':
          case 'plugin:window|is_minimizable':
          case 'plugin:window|is_closable':
          case 'plugin:window|is_visible':
          case 'plugin:window|is_minimized':
          case 'plugin:window|is_fullscreen':
            return Promise.resolve(false)
          case 'get_app_info':
            return Promise.resolve({
              name: '智汇AI',
              version: '0.0.0-e2e',
              platform: 'windows',
            })
          default:
            return Promise.resolve(null)
        }
      },
    }

    const api: TauriStubApi = {
      setFocused(value: boolean) {
        focused = value
      },
      emitWindowEvent(event: string, payload: unknown) {
        let fired = 0
        for (const l of listeners) {
          if (l.event !== event) continue
          handlers.get(l.handlerId)?.({ event, id: l.eventId, payload })
          fired += 1
        }
        return fired
      },
      listenerEvents() {
        return listeners.map((l) => l.event)
      },
      invokeCalls() {
        return invokeLog.slice(-40)
      },
    }

    const scope = globalThis as unknown as Record<string, unknown>
    scope.__TAURI_INTERNALS__ = internals
    scope.__TAURI_E2E_STUB__ = api
  })
}

/** 读 [data-window-controls-dim] / [data-window-controls] 的 computed 数值 + 属性 */
async function probeDimLayer(page: Page): Promise<{
  dim: ComputedProbe
  dimInlineStyle: string
  container: { modalDim: string | null; windowInactive: string | null; zIndex: string }
  controlsCount: number
}> {
  return page.evaluate(
    ([dimSel, boxSel]) => {
      const dim = document.querySelector(dimSel) as HTMLElement | null
      const box = document.querySelector(boxSel) as HTMLElement | null
      const buttons = document.querySelectorAll(`${boxSel} button`)
      if (!dim || !box) {
        return {
          dim: { opacity: 'NO-DIM-ELEMENT', backgroundColor: '', color: '' },
          dimInlineStyle: '',
          container: { modalDim: null, windowInactive: null, zIndex: '' },
          controlsCount: buttons.length,
        }
      }
      const cs = getComputedStyle(dim)
      const boxCs = getComputedStyle(box)
      return {
        dim: { opacity: cs.opacity, backgroundColor: cs.backgroundColor, color: cs.color },
        dimInlineStyle: dim.getAttribute('style') ?? '',
        container: {
          modalDim: box.getAttribute('data-modal-dim'),
          windowInactive: box.getAttribute('data-window-inactive'),
          zIndex: boxCs.zIndex,
        },
        controlsCount: buttons.length,
      }
    },
    [DIM_LAYER_SELECTOR, WINDOW_CONTROLS_SELECTOR] as const,
  )
}

/**
 * 独立判据筛遮罩候选:全屏覆盖 + computed position=fixed + z>=2000(watcher 的同款门槛,
 * 但由 e2e 自己算,不复用被测函数,避免"用被测实现验证被测实现")。
 */
async function findModalOverlays(page: Page): Promise<OverlayEvidence[]> {
  const overlays = await collectOverlayEvidence(page)
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 }
  return overlays.filter(
    (o) =>
      o.position === 'fixed' &&
      Number(o.zIndex) >= 2000 &&
      o.width >= viewport.width * 0.98 &&
      o.height >= viewport.height * 0.98,
  )
}

/** 取 z 最大的遮罩(与 watcher 的"多遮罩取最高 z"同判据,平手时保留 DOM 靠前者) */
function pickHighestZOverlay(overlays: OverlayEvidence[]): OverlayEvidence | undefined {
  return overlays.reduce<OverlayEvidence | undefined>(
    (best, o) => (best === undefined || Number(o.zIndex) > Number(best.zIndex) ? o : best),
    undefined,
  )
}

/** 主题切换:必须在页面脚本执行前写入(addInitScript),否则首帧按 light 渲染 */
async function installTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript((value) => {
    globalThis.localStorage.setItem('theme', value)
    document.documentElement.classList.toggle('dark', value === 'dark')
  }, theme)
}

/** 从 token 探出"黑色系 80% 遮罩"的 computed 序列化值,用于证明 Sheet 浅色遮罩不是黑底 */
async function probeBlack80(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.createElement('div')
    el.setAttribute('style', 'background-color: color-mix(in oklab, black 80%, transparent);')
    document.body.appendChild(el)
    const value = getComputedStyle(el).backgroundColor
    el.remove()
    return value
  })
}

/** 页面是否真处于 dark 变体(html.dark + --color-background 已换暗色) */
async function probeIsDark(page: Page): Promise<{ htmlClass: string; bodyBg: string }> {
  return page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }))
}

/** 独立于被测判据,枚举页面上所有 fixed inset-0 候选遮罩(证据打印 + 取登录遮罩色) */
async function collectOverlayEvidence(page: Page): Promise<OverlayEvidence[]> {
  return page.evaluate(() => {
    const out: OverlayEvidence[] = []
    for (const el of Array.from(document.querySelectorAll('[class~="fixed"][class~="inset-0"]'))) {
      const cs = getComputedStyle(el)
      if (el.closest('[data-window-controls-dim]')) continue
      out.push({
        className: (el.getAttribute('class') ?? '').slice(0, 90),
        position: cs.position,
        zIndex: cs.zIndex,
        backgroundColor: cs.backgroundColor,
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      })
    }
    return out
  })
}

/** 从 token 直接算出 Tailwind 工具类应解析成的期望值(不依赖该工具类是否被扫描生成) */
async function probeTokenValues(page: Page): Promise<{
  focused: { color: string; backgroundColor: string }
  inactive: { color: string; backgroundColor: string }
}> {
  return page.evaluate(() => {
    const probe = (styleText: string) => {
      const el = document.createElement('div')
      el.setAttribute('style', styleText)
      document.body.appendChild(el)
      const cs = getComputedStyle(el)
      const value = { color: cs.color, backgroundColor: cs.backgroundColor }
      el.remove()
      return value
    }
    return {
      // TOPBAR_BTN_BASE: text-foreground/80 + bg-card
      focused: probe(
        'color: color-mix(in oklab, var(--color-foreground) 80%, transparent); background-color: var(--color-card);',
      ),
      // globals.css 失焦规则: text-muted-foreground + bg-card/50
      inactive: probe(
        'color: var(--color-muted-foreground); background-color: color-mix(in oklab, var(--color-card) 50%, transparent);',
      ),
    }
  })
}

async function probeFirstWindowButton(page: Page): Promise<ComputedProbe> {
  return page.evaluate((boxSel) => {
    const btn = document.querySelector(`${boxSel} button`) as HTMLElement | null
    if (!btn) return { opacity: '', backgroundColor: 'NO-BUTTON', color: 'NO-BUTTON' }
    const cs = getComputedStyle(btn)
    return { opacity: cs.opacity, backgroundColor: cs.backgroundColor, color: cs.color }
  }, WINDOW_CONTROLS_SELECTOR)
}

/**
 * 模态期间的可点性判据:body 被 Radix(@radix-ui/react-dismissable-layer 的
 * disableOutsidePointerEvents → `document.body.style.pointerEvents = 'none'`)锁掉时,
 * 窗口按钮容器必须靠自身 `pointer-events-auto` 断掉这条继承链,否则未登录用户被登录窗
 * 挡住时物理上点不动 Min/Max/Close —— Windows 原生语义是模态存在时 caption 按钮仍可点。
 */
async function probePointerEvents(page: Page): Promise<{
  body: string
  container: string
  button: string
  dimLayer: string
}> {
  return page.evaluate(
    ([boxSel, dimSel]) => {
      const pe = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null
        return el ? getComputedStyle(el).pointerEvents : 'NO-ELEMENT'
      }
      return {
        body: getComputedStyle(document.body).pointerEvents,
        container: pe(boxSel),
        button: pe(`${boxSel} button`),
        dimLayer: pe(dimSel),
      }
    },
    [WINDOW_CONTROLS_SELECTOR, DIM_LAYER_SELECTOR] as const,
  )
}

/**
 * 触发一个真实全屏模态遮罩(登录 Dialog)。
 * 首选生产入口:SSR/middleware 重定向带回的 `?reauth=1&next=<私有路径>`,
 * 由 app/layout.tsx 挂载的 LoginRedirectListener 在客户端调 store.open('login')
 * (零菜单交互、零脆弱文案选择器,和真实"未登录被拦下"路径一致)。
 * 兜底才走侧边栏用户行 DropdownMenu →「登录」菜单项。
 */
async function openLoginDialog(page: Page): Promise<void> {
  const dialog = page.getByTestId('login-dialog')
  await page.goto('/?reauth=1&next=/agent-workbench', { waitUntil: 'domcontentloaded' })
  const openedByDeepLink = await dialog
    .waitFor({ state: 'visible', timeout: 25_000 })
    .then(() => true)
    .catch(() => false)
  if (openedByDeepLink) {
    console.info('[2] 遮罩触发方式 = reauth 深链 → LoginRedirectListener → store.open()')
    return
  }
  console.info('[2] reauth 深链未弹窗,回退侧边栏用户行菜单路径')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const userRow = page.getByRole('button', { name: /^登录$/ }).first()
  await expect(userRow, '未找到侧边栏用户行(登录)触发器').toBeVisible({ timeout: 25_000 })
  await userRow.hover()
  await userRow.click()
  const menuItem = page.getByRole('menuitem', { name: /登录/ }).last()
  await expect(menuItem, '用户行菜单未展开/无「登录」菜单项').toBeVisible({ timeout: 10_000 })
  await menuItem.click()
  await expect(dialog).toBeVisible({ timeout: 25_000 })
}

test.describe('桌面端窗口控制按钮 — 模态压暗 + 失焦降亮(真实 Chromium)', () => {
  test.setTimeout(180_000)

  test('遮罩开合驱动等效压暗层,失焦事件驱动按钮降亮', async ({ page }) => {
    test.info().annotations.push({
      type: 'target',
      description:
        'GlobalTopBar [data-window-controls] + modal-overlay-watcher.detectModalOverlayColor',
    })
    await installTauriStub(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // 等桌面分支渲染(压暗层与容器只在 isDesktop 为真时挂载)
    await page
      .locator(WINDOW_CONTROLS_SELECTOR)
      .waitFor({ state: 'attached', timeout: 60_000 })
      .catch(async () => {
        const stub = await page.evaluate(
          () => (globalThis as unknown as { __TAURI_E2E_STUB__?: TauriStubApi }).__TAURI_E2E_STUB__,
        )
        const invokes = await page.evaluate(
          () =>
            Array.from(
              document.querySelectorAll('[data-window-controls],[data-window-controls-dim]'),
            ).length,
        )
        throw new Error(
          `[data-window-controls] 未渲染 → isDesktop 未为真。桩存活=${!!stub} 命中元素数=${invokes}`,
        )
      })

    /* ---- 断言 1:无遮罩 → 压暗层 opacity=0,容器无 data-modal-dim ---- */
    const idle = await probeDimLayer(page)
    console.info(`[1] 无遮罩 dim.opacity=${idle.dim.opacity} dim.bg="${idle.dim.backgroundColor}"`)
    console.info(
      `[1] 容器 data-modal-dim=${String(idle.container.modalDim)} z-index=${idle.container.zIndex}`,
    )
    console.info(`[1] 压暗层内联 style="${idle.dimInlineStyle}" 按钮数=${idle.controlsCount}`)
    expect(idle.controlsCount, '窗口控制按钮应为 3 个(Min/Max/Close)').toBe(3)
    expect(idle.dim.backgroundColor, '未激活时压暗层背景应为 transparent').toBe('rgba(0, 0, 0, 0)')
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 10_000 })
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).not.toHaveAttribute('data-modal-dim')
    const idleOverlayEvidence = await collectOverlayEvidence(page)
    console.info(`[1] 页面 fixed inset-0 候选层(未开遮罩)=${idleOverlayEvidence.length} 个`)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-idle-no-overlay.png` })

    /* ---- 断言 4(前置采样):聚焦态按钮 computed 数值 ---- */
    const focusedBtn = await probeFirstWindowButton(page)
    console.info(
      `[4a] 聚焦态 minimize 按钮 color="${focusedBtn.color}" bg="${focusedBtn.backgroundColor}"`,
    )

    /* ---- 断言 2:打开真实模态遮罩(登录 Dialog) ---- */
    await openLoginDialog(page)
    // 压暗激活:先轮询 opacity=1,再取同帧数值(判据输入 = 遮罩 computed backgroundColor)
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '1', { timeout: 15_000 })
    const dimmed = await probeDimLayer(page)
    const modalOverlays = await findModalOverlays(page)
    console.info(`[2] 命中判据的遮罩层 ${modalOverlays.length} 个:`)
    for (const o of modalOverlays) {
      console.info(
        `      z=${o.zIndex} bg="${o.backgroundColor}" ${o.width}x${o.height} class="${o.className}"`,
      )
    }
    const topOverlay = modalOverlays.at(-1)
    expect(topOverlay, '登录 Dialog 应产生至少一个全屏 z>=2000 遮罩').toBeDefined()
    const overlayBg = topOverlay?.backgroundColor ?? ''
    expect(overlayBg, '遮罩 computed backgroundColor 取不到值').not.toBe('')
    console.info(`[2] ★判据输入(遮罩 computed backgroundColor)= "${overlayBg}"`)
    console.info(`[2] ★压暗层 computed backgroundColor= "${dimmed.dim.backgroundColor}"`)
    console.info(
      `[2] dim.opacity=${dimmed.dim.opacity} 容器 data-modal-dim=${String(dimmed.container.modalDim)}`,
    )
    expect(dimmed.dim.opacity, '遮罩打开后压暗层必须全不透明').toBe('1')
    expect(
      dimmed.dim.backgroundColor,
      `等效压暗定义:压暗层底色必须与遮罩逐字相等(遮罩="${overlayBg}" vs 压暗="${dimmed.dim.backgroundColor}")`,
    ).toBe(overlayBg)
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).toHaveAttribute('data-modal-dim', '1')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-modal-open-dim.png` })

    /* ---- 断言 2b:模态锁 body 时三按钮仍可被真实指针命中 ----
     * Radix 模态 Dialog 把 `document.body.style.pointerEvents` 写成 none(内联),
     * 容器与按钮默认继承 → 整个 caption 失效。先自证"锁确实在"(否则下面 auto 是空断言),
     * 再断言容器的 `pointer-events-auto` 把继承链断掉。压暗层必须仍是 none(它只负责压暗,
     * 一旦退化成 auto 就会盖住按钮吃掉点击,反而把可点性改回去)。 */
    await expect
      .poll(async () => (await probePointerEvents(page)).body, {
        message: 'Radix 未把 body 置 pointer-events:none —— 本用例前提不成立,判据会退化为空断言',
        timeout: 10_000,
      })
      .toBe('none')
    await expect
      .poll(async () => (await probePointerEvents(page)).container, {
        message: '窗口按钮容器未恢复 pointer-events:auto,模态期间 caption 点不动',
        timeout: 10_000,
      })
      .toBe('auto')
    await expect
      .poll(
        async () => {
          const pe = await probePointerEvents(page)
          return `${pe.button}|${pe.dimLayer}`
        },
        {
          message: '按钮须可命中(非 none)且压暗层须保持 pointer-events:none',
          timeout: 10_000,
        },
      )
      .toMatch(/^auto\|none$/)
    // trial hit-test:校验真实指针命中路径,不触发 onClick(不真 minimize/close 窗口)
    await page
      .locator(`${WINDOW_CONTROLS_SELECTOR} button`)
      .first()
      .click({ trial: true, timeout: 10_000 })
    const peModal = await probePointerEvents(page)
    console.info(
      `[2b] body=${peModal.body} 容器=${peModal.container} 按钮=${peModal.button} 压暗层=${peModal.dimLayer} → trial hit-test 通过`,
    )
    // 指针须离开 caption:容器已可命中 → 悬停会真触发 hover:bg-accent(rgb(224,224,224)),
    // 覆盖下方断言 4 的 bg-card/50 期望(trial click 把虚拟指针留在了按钮中心)。
    await page.mouse.move(20, 400)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-modal-open-controls-clickable.png` })

    /* ---- 断言 4:窗口失焦 → 容器 data-window-inactive + 按钮降亮 ----
     * 放在关闭遮罩前:登录窗开着才最贴近真实场景(模态期间失焦,两层效果叠加)。 */
    const emitted = await page.evaluate((event) => {
      const api = (globalThis as unknown as { __TAURI_E2E_STUB__?: TauriStubApi })
        .__TAURI_E2E_STUB__
      if (!api) return -1
      api.setFocused(false)
      return api.emitWindowEvent(event, null)
    }, 'tauri://blur')
    console.info(`[4] 桩派发 tauri://blur 命中监听器数=${emitted}`)
    expect(emitted, '桩未能派发 tauri://blur(监听未注册 → 事件链路断)').toBeGreaterThan(0)
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).toHaveAttribute(
      'data-window-inactive',
      'true',
      { timeout: 10_000 },
    )
    const refs = await probeTokenValues(page)
    // 按钮挂 Tailwind `transition-colors`(默认 150ms):即时采样会读到过渡中间帧
    // (实测 2026-09-22:首帧读到聚焦原值、重试读到 /0.835224 半程值),必须轮询到终态。
    await expect
      .poll(async () => (await probeFirstWindowButton(page)).color, {
        message: `失焦 color 未收敛到 text-muted-foreground 解析值 ${refs.inactive.color}`,
        timeout: 10_000,
      })
      .toBe(refs.inactive.color)
    await expect
      .poll(async () => (await probeFirstWindowButton(page)).backgroundColor, {
        message: `失焦 background-color 未收敛到 bg-card/50 解析值 ${refs.inactive.backgroundColor}`,
        timeout: 10_000,
      })
      .toBe(refs.inactive.backgroundColor)
    const inactiveBtn = await probeFirstWindowButton(page)
    console.info(
      `[4b] 失焦态 minimize 按钮 color="${inactiveBtn.color}" bg="${inactiveBtn.backgroundColor}"`,
    )
    console.info(
      `[4c] token 期望(聚焦) color="${refs.focused.color}" bg="${refs.focused.backgroundColor}"`,
    )
    console.info(
      `[4d] token 期望(失焦) color="${refs.inactive.color}" bg="${refs.inactive.backgroundColor}"`,
    )
    expect(inactiveBtn.color, '失焦 color 必须与聚焦不同(否则 group-data 变体未产出 CSS)').not.toBe(
      focusedBtn.color,
    )
    expect(inactiveBtn.backgroundColor, '失焦 background-color 必须与聚焦不同').not.toBe(
      focusedBtn.backgroundColor,
    )
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-modal-open-window-blurred.png` })

    // 重新聚焦 → 属性撤除,按钮回到聚焦数值(证明两态可逆,不是单向写死)
    await page.evaluate(() => {
      const api = (globalThis as unknown as { __TAURI_E2E_STUB__?: TauriStubApi })
        .__TAURI_E2E_STUB__
      api?.setFocused(true)
      api?.emitWindowEvent('tauri://focus', null)
    })
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).not.toHaveAttribute(
      'data-window-inactive',
      {
        timeout: 10_000,
      },
    )
    await expect
      .poll(async () => (await probeFirstWindowButton(page)).color, { timeout: 10_000 })
      .toBe(refs.focused.color)
    await expect
      .poll(async () => (await probeFirstWindowButton(page)).backgroundColor, { timeout: 10_000 })
      .toBe(refs.focused.backgroundColor)
    const refocusedBtn = await probeFirstWindowButton(page)
    console.info(
      `[4e] 回焦后 minimize 按钮 color="${refocusedBtn.color}" bg="${refocusedBtn.backgroundColor}"`,
    )

    /* ---- 断言 3:关闭遮罩 → opacity 回 0,data-modal-dim 消失 ---- */
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('login-dialog')).toBeHidden({ timeout: 15_000 })
    // 取消方向保留统一时长(与遮罩 fade-out 同步),故轮询到 0 而非即时断言
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 15_000 })
    const closed = await probeDimLayer(page)
    console.info(
      `[3] 关闭后 dim.opacity=${closed.dim.opacity} dim.bg="${closed.dim.backgroundColor}"`,
    )
    console.info(`[3] 关闭后 data-modal-dim=${String(closed.container.modalDim)}`)
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).not.toHaveAttribute('data-modal-dim')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-modal-closed.png` })
  })

  /* ================= 分支扩展:真机 oklab/color-mix 数值不被 happy-dom 覆盖 =================
   * 上面那一条只证明了「亮色 + 单层 Dialog 遮罩」这一条路径。以下 4 条补齐 watcher 的
   * 其余真机分支(单测在 happy-dom 上跑过,但 happy-dom 会静默丢弃 oklab / color-mix 赋值,
   * 所以这些分支的**浏览器序列化字符串**从未被证明过)。
   */

  test('分支1:深色主题下的登录遮罩同样被等效压暗', async ({ page }) => {
    await installTauriStub(page)
    await installTheme(page, 'dark')
    await page.setViewportSize({ width: 1280, height: 800 })
    await openLoginDialog(page)

    const theme = await probeIsDark(page)
    console.info(`[5] html class="${theme.htmlClass}" body bg="${theme.bodyBg}"`)
    expect(theme.htmlClass, '深色主题未生效(html 未挂 .dark)').toContain('dark')

    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '1', { timeout: 15_000 })
    const dimmed = await probeDimLayer(page)
    const overlays = await findModalOverlays(page)
    const top = pickHighestZOverlay(overlays)
    expect(top, '深色模式下登录 Dialog 应仍有全屏 z>=2000 遮罩').toBeDefined()
    const overlayBg = top?.backgroundColor ?? ''
    console.info(`[5] 深色遮罩 ${top?.zIndex} 层 z=${String(top?.zIndex)} bg="${overlayBg}"`)
    console.info(`[5] ★深色压暗层 computed backgroundColor="${dimmed.dim.backgroundColor}"`)
    expect(dimmed.dim.backgroundColor, '深色模式等效压暗必须与遮罩逐字相等').toBe(overlayBg)
    expect(dimmed.dim.opacity).toBe('1')
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).toHaveAttribute('data-modal-dim', '1')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-dark-modal-open-dim.png` })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('login-dialog')).toBeHidden({ timeout: 15_000 })
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 15_000 })
  })

  test('分支2:Sheet 浅色"变亮"遮罩(bg-white/80)驱动压暗层变亮而非压黑', async ({ page }) => {
    // 真实入口:/docs 是 proxy PUBLIC_PATHS 白名单内的游客可达页(见 src/lib/login-dialog-trigger.ts),
    // 其 layout 用 CategoryShell → <768px 渲染 SheetTrigger(aria-label="打开导航菜单"),
    // SheetContent 的遮罩为 packages/ui-react sheet.tsx:72 `bg-white/80 dark:bg-black/80`。
    await installTauriStub(page)
    await installTheme(page, 'light')
    await page.setViewportSize({ width: 767, height: 900 })
    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await page.locator(WINDOW_CONTROLS_SELECTOR).waitFor({ state: 'attached', timeout: 90_000 })

    const theme = await probeIsDark(page)
    expect(theme.htmlClass, '浅色主题下 html 不应挂 .dark').not.toContain('dark')

    // 手机视口(<768px)会强制 AI 面板进入全屏浮窗(ai-side-panel.tsx:1099
    // `ai-panel-root fixed inset-0 z-sticky`)。两件事在此一并取证:
    //  1) 它是全屏 + 不透明 + fixed,但 z-sticky=990 < 2000 → **不得**触发压暗(反向判据);
    //  2) 它盖住页面,真实用户须先点其"最小化"(Minus 图标)收成 FAB 才能点到导航抽屉。
    const aiPanel = page.getByTestId('ai-panel-root')
    const panelEvidence = await aiPanel
      .evaluate((el) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          position: cs.position,
          zIndex: cs.zIndex,
          backgroundColor: getComputedStyle(el.firstElementChild ?? el).backgroundColor,
          coversViewport:
            rect.width >= window.innerWidth * 0.98 && rect.height >= window.innerHeight * 0.98,
        }
      })
      .catch(() => undefined)
    console.info(
      `[6] AI 全屏浮窗: pos=${panelEvidence?.position} z=${panelEvidence?.zIndex} 覆盖=${String(panelEvidence?.coversViewport)}`,
    )
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 10_000 })
    const preSheet = await probeDimLayer(page)
    console.info(`[6] ★z<2000 全屏层不误触发: dim.opacity=${preSheet.dim.opacity}`)
    expect(preSheet.container.modalDim, 'z-sticky 全屏浮窗不得被当作模态遮罩压暗').toBeNull()

    const minimized = await page
      .locator('[data-testid="ai-panel-root"] button:has(svg.lucide-minus)')
      .first()
      .click({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    console.info(`[6] AI 面板最小化按钮点击=${String(minimized)}`)

    const sheetTrigger = page.getByRole('button', { name: '打开导航菜单' })
    await expect(sheetTrigger, '/docs 未渲染 CategoryShell 的移动端 Sheet 触发器').toBeVisible({
      timeout: 60_000,
    })
    let triggerPath = 'pointer click'
    await sheetTrigger.click({ timeout: 15_000 }).catch(async () => {
      // 兜底:直接触发 Radix SheetTrigger 自己的 onClick(仍是真实 handler,非注入 DOM)
      triggerPath = 'DOM click(Radix SheetTrigger 的原生 click(),因仍有浮层拦截指针)'
      await page.evaluate(() => {
        const el = document.querySelector('button[aria-label="打开导航菜单"]') as HTMLElement | null
        if (!el) throw new Error('未找到 SheetTrigger(aria-label="打开导航菜单")')
        el.click()
      })
    })
    console.info(`[6] Sheet 打开方式 = ${triggerPath}`)

    // Sheet 遮罩淡入 + watcher rAF 合并,统一用 poll 收敛(禁即时采样)
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '1', { timeout: 15_000 })
    const dimmed = await probeDimLayer(page)
    const overlays = await findModalOverlays(page)
    const top = pickHighestZOverlay(overlays)
    expect(top, 'Sheet 未产生全屏 z>=2000 遮罩').toBeDefined()
    const overlayBg = top?.backgroundColor ?? ''
    const black80 = await probeBlack80(page)
    console.info(`[6] Sheet 遮罩 class="${top?.className}"`)
    console.info(
      `[6] ★遮罩 computed bg="${overlayBg}" / 压暗层 computed bg="${dimmed.dim.backgroundColor}"`,
    )
    console.info(`[6] 参照:黑色系 80% 遮罩序列化值="${black80}"`)
    expect(overlayBg, '遮罩 computed backgroundColor 取不到值').not.toBe('')
    expect(
      dimmed.dim.backgroundColor,
      `Sheet 等效压暗定义:压暗层底色必须与遮罩逐字相等(遮罩="${overlayBg}" vs 压暗="${dimmed.dim.backgroundColor}")`,
    ).toBe(overlayBg)
    // 核心语义:浅色 Sheet 是"变亮"遮罩 —— 若判据把它当黑色系处理,顶栏会被压成黑块
    expect(
      overlayBg,
      '浅色 Sheet 遮罩不应退化为黑色系(sheet.tsx:72 的浅色分支是 bg-white/80)',
    ).not.toBe(black80)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-light-sheet-brighten-dim.png` })

    await page.keyboard.press('Escape')
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 15_000 })
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).not.toHaveAttribute('data-modal-dim')
  })

  test('分支3:双层遮罩陷阱(父 fixed 无背景,遮罩色在 absolute inset-0 子层)', async ({ page }) => {
    /**
     * ⚠ 判据级验证,非真实入口。
     * 全站唯一的双层结构是 apps/web/src/components/feedback/Drawer.tsx:117,121,
     * 其可达入口只有 `app/(main)/admin/users/UserDialog.tsx:104` 与
     * `app/(main)/admin/distribution/rules/page.tsx:196` —— 均为 admin 路由
     * (packages/auth preHandler roleId>=1),游客态 e2e 进不去,故按任务授权的
     * 最后手段在 page.evaluate 里插入**与 Drawer.tsx 逐字相同的 className** 节点驱动判据。
     */
    await installTauriStub(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.locator(WINDOW_CONTROLS_SELECTOR).waitFor({ state: 'attached', timeout: 90_000 })
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 10_000 })

    const injected = await page.evaluate(() => {
      // 父:Drawer.tsx:117 逐字 "fixed inset-0 z-modal"(无背景 —— 陷阱本体)
      const parent = document.createElement('div')
      parent.setAttribute('class', 'fixed inset-0 z-modal')
      parent.setAttribute('data-e2e-trap', 'drawer-double-layer')
      // 子:Drawer.tsx:121 逐字遮罩色段 "absolute inset-0 cursor-default bg-black/80"
      // (省略 animate-in/fade-in 动画段:动画首帧会让即时采样读到半透明,污染判据)
      const child = document.createElement('button')
      child.setAttribute('class', 'absolute inset-0 cursor-default bg-black/80')
      parent.appendChild(child)
      document.body.appendChild(parent)
      const parentCs = getComputedStyle(parent)
      const childCs = getComputedStyle(child)
      const rect = child.getBoundingClientRect()
      return {
        parentPosition: parentCs.position,
        parentZIndex: parentCs.zIndex,
        parentBackgroundColor: parentCs.backgroundColor,
        childPosition: childCs.position,
        childBackgroundColor: childCs.backgroundColor,
        childCoversViewport:
          rect.width >= window.innerWidth * 0.98 && rect.height >= window.innerHeight * 0.98,
      }
    })
    console.info(
      `[7] 注入双层父层: pos=${injected.parentPosition} z=${injected.parentZIndex} bg="${injected.parentBackgroundColor}"`,
    )
    console.info(
      `[7] 注入双层子层: pos=${injected.childPosition} bg="${injected.childBackgroundColor}" 全屏=${String(injected.childCoversViewport)}`,
    )
    // 前置自证:注入节点确实拿到了项目真实工具类(否则整条用例证明不了任何事)
    expect(injected.parentPosition).toBe('fixed')
    expect(Number(injected.parentZIndex), 'z-modal 工具类未生效').toBe(2000)
    expect(injected.parentBackgroundColor, '父层必须无背景才构成双层陷阱').toBe('rgba(0, 0, 0, 0)')
    expect(injected.childPosition).toBe('absolute')
    expect(injected.childCoversViewport).toBe(true)
    expect(injected.childBackgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '1', { timeout: 15_000 })
    const dimmed = await probeDimLayer(page)
    console.info(
      `[7] ★子层遮罩色="${injected.childBackgroundColor}" / 压暗层="${dimmed.dim.backgroundColor}"`,
    )
    expect(dimmed.dim.backgroundColor, '父层无背景时必须下探 absolute inset-0 子层取色').toBe(
      injected.childBackgroundColor,
    )
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-double-layer-drawer-trap.png` })

    await page.evaluate(() => {
      document.querySelector('[data-e2e-trap="drawer-double-layer"]')?.remove()
    })
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '0', { timeout: 15_000 })
    await expect(page.locator(WINDOW_CONTROLS_SELECTOR)).not.toHaveAttribute('data-modal-dim')
  })

  test('分支4:多遮罩叠加 → 取 z 最大者(登录 Dialog z=2000 + TagsView 搜索遮罩 z=2001)', async ({
    page,
  }) => {
    await installTauriStub(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openLoginDialog(page)
    await expect(page.locator(DIM_LAYER_SELECTOR)).toHaveCSS('opacity', '1', { timeout: 15_000 })

    const firstRound = await findModalOverlays(page)
    const loginOverlay = pickHighestZOverlay(firstRound)
    expect(loginOverlay, '登录 Dialog 未产生遮罩').toBeDefined()
    const loginBg = loginOverlay?.backgroundColor ?? ''
    console.info(
      `[8] 第一层遮罩 z=${loginOverlay?.zIndex} bg="${loginBg}" class="${loginOverlay?.className}"`,
    )

    // 第二层:TagsView 搜索弹层遮罩(TagsView.tsx:212 `fixed inset-0 z-popover bg-black/40`)。
    // 用 DOM click() 而非 page.click():Radix 模态 Dialog 打开时会把 body 置 pointer-events:none,
    // 真实指针点击命不中顶栏按钮 —— 这里触发的仍是按钮自己的 React onClick,链路一致。
    const triggerFound = await page.evaluate(() => {
      const btn = document.querySelector('button[data-topbar-search-btn]') as HTMLElement | null
      if (!btn) return false
      btn.click()
      return true
    })
    expect(triggerFound, '顶栏搜索触发器 button[data-topbar-search-btn] 未渲染').toBe(true)
    await expect(page.getByTestId('tagsview-search-overlay')).toBeAttached({ timeout: 15_000 })

    // 两层遮罩 + 压暗层重算是异步的(rAF 合并 + MutationObserver),必须 poll 到终态
    let stacked: { dim: ComputedProbe; overlays: OverlayEvidence[] } | undefined
    await expect
      .poll(
        async () => {
          const overlays = await findModalOverlays(page)
          const dim = (await probeDimLayer(page)).dim
          stacked = { dim: { ...dim }, overlays }
          const highest = pickHighestZOverlay(overlays)
          return (
            overlays.length >= 2 &&
            highest !== undefined &&
            dim.backgroundColor === highest.backgroundColor
          )
        },
        { message: '双层遮罩下压暗层未收敛到 z 最大者的颜色', timeout: 15_000 },
      )
      .toBe(true)

    const overlays = stacked?.overlays ?? []
    const dimBg = stacked?.dim.backgroundColor ?? ''
    const sorted = [...overlays].sort((a, b) => Number(a.zIndex) - Number(b.zIndex))
    for (const o of sorted)
      console.info(`[8] 在场遮罩 z=${o.zIndex} bg="${o.backgroundColor}" class="${o.className}"`)
    const highest = pickHighestZOverlay(overlays)
    const lowest = sorted[0]
    console.info(
      `[8] ★最高 z=${highest?.zIndex} bg="${highest?.backgroundColor}" / 最低 z=${lowest?.zIndex} bg="${lowest?.backgroundColor}"`,
    )
    console.info(`[8] ★压暗层 bg="${dimBg}" opacity=${stacked?.dim.opacity}`)
    expect(
      Number(highest?.zIndex),
      '第二层遮罩的 z 必须严格高于第一层,否则本用例证明不了取最高 z',
    ).toBeGreaterThan(Number(lowest?.zIndex ?? 0))
    expect(highest?.backgroundColor, '两层遮罩底色必须可区分,否则"取最高 z"断言是空断言').not.toBe(
      lowest?.backgroundColor,
    )
    expect(
      dimBg,
      `压暗层应等于 z 最大者(${highest?.backgroundColor})而非先出现的 ${lowest?.backgroundColor}`,
    ).toBe(highest?.backgroundColor ?? '')
    expect(dimBg, '先出现的遮罩色不得被沿用').not.toBe(loginBg)
    expect(stacked?.dim.opacity).toBe('1')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-two-overlays-highest-z.png` })

    // 撤掉高 z 那层 → 必须回落到仍打开的登录遮罩色(证明每帧重算,不是首次锁定)
    await page.evaluate(() => {
      ;(
        document.querySelector('[data-testid="tagsview-search-overlay"]') as HTMLElement | null
      )?.click()
    })
    await expect(page.getByTestId('tagsview-search-overlay')).not.toBeAttached({ timeout: 15_000 })
    await expect
      .poll(async () => (await probeDimLayer(page)).dim.backgroundColor, {
        message: '撤掉高 z 遮罩后压暗层未回落到登录遮罩色',
        timeout: 15_000,
      })
      .toBe(loginBg)
    const fallback = await probeDimLayer(page)
    console.info(
      `[8] 撤层高 z 后回落: dim.bg="${fallback.dim.backgroundColor}" (期望="${loginBg}")`,
    )
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-highest-z-removed-fallback.png` })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
