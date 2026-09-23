// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回归:e2e — "两套上下键冲突"(2026-09-22 键位归属改版)
 *
 * 背景:use-full-page-scroll(整屏翻页)曾在 window 上无条件拦 ↑/↓/Home/End/PageUp/PageDown,
 * 与 use-message-list-scroll(用 ↑/↓/Home/End 切换聚焦消息)在 /chat 双触发
 * (app/(main)/chat/page.tsx 复用 WorkAreaHomePage)。修复后:
 *   1. 整屏翻页只吃 PageUp/PageDown;↑/↓/Home/End 让给对话流;
 *   2. 翻页 handler 有焦点守卫(INPUT/TEXTAREA/contenteditable 放行)与修饰键守卫;
 *   3. 翻页带 900ms 节流锁(use-full-page-scroll.ts triggerPage)。
 *
 * 判据(全部 DOM 数值,不靠截图):
 *   - PageIndicator 激活项 = rail(`div.fixed.top-1/2`)内 `:scope > button` 中
 *     `aria-current="true"` 的下标;激活态为 16x8 竖向胶囊(h-4 w-2),非激活 8x8 圆点。
 *   - keydown 是否被 preventDefault = 页内探针(window keydown 监听器 +
 *     queueMicrotask 读 e.defaultPrevented)写进 `<html data-e2e-key-probe>`。
 *   - 消息聚焦 = MessageItem 的 `data-message-id` + `data-message-focused="true|false"`。
 *
 * 运行(隔离 distDir 的 dev,勿用 8801 生产产物):
 *   PLAYWRIGHT_BASE_URL=http://localhost:8822 PLAYWRIGHT_WORKERS=1 \
 *     node_modules/.bin/playwright test e2e/full-page-scroll-keyboard.spec.ts --reporter=list
 */

import { expect, test as base, type Locator, type Page } from '@playwright/test'
import { test as authTest } from './fixtures'

/** 翻页节流锁 900ms + 渲染余量:断言"不翻页"前必须等过整个锁窗口 */
const THROTTLE_WINDOW_MS = 1_200

/** PageIndicator 容器(共享 float-indicator rail):fixed + top-1/2,z-index 层为 z-sticky */
const RAIL_SELECTOR = 'div.fixed.top-1\\/2'

function rail(page: Page): Locator {
  return page.locator(RAIL_SELECTOR).first()
}

/** 激活点下标(0-based);找不到返回 -1 */
async function activeDotIndex(page: Page): Promise<number> {
  return rail(page).evaluate((el) => {
    const buttons = Array.from(el.querySelectorAll(':scope > button'))
    return buttons.findIndex((b) => b.getAttribute('aria-current') === 'true')
  })
}

/** 各圆点高度(px):激活态 h-4≈16 竖向胶囊,非激活 h-2≈8 圆点 */
async function dotHeightsPx(page: Page): Promise<number[]> {
  return rail(page).evaluate((el) =>
    Array.from(el.querySelectorAll(':scope > button')).map(
      (b) => Math.round(b.getBoundingClientRect().height * 10) / 10,
    ),
  )
}

const ACTIVE_PILL_H = [14, 18] as const
const INACTIVE_DOT_H = [7, 9] as const

/**
 * 页内 keydown 探针:记录 `key:consumed|native` 序列(以 `|` 连接)写入
 * <html data-e2e-key-probe>。consumed = 事件被某监听器 preventDefault。
 * 探针在 React hook 的 window 监听器之后注册,queueMicrotask 保证在所有
 * 同步监听器跑完后才读 defaultPrevented。
 */
async function installKeyProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const entries: string[] = []
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      window.queueMicrotask(() => {
        entries.push(`${e.key}:${e.defaultPrevented ? 'consumed' : 'native'}`)
        document.documentElement.setAttribute('data-e2e-key-probe', entries.join('|'))
      })
    })
  })
}

async function keyProbeLog(page: Page): Promise<string[]> {
  const raw = await page.evaluate(() => document.documentElement.getAttribute('data-e2e-key-probe'))
  return raw === null || raw === '' ? [] : raw.split('|')
}

/** 把焦点从当前激活元素上摘掉,让按键 target 回落到 body(两 hook 的守卫都要求非输入态) */
async function blurActiveElement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  })
}

/** 等 PageIndicator rail 就绪(激活点存在且可见;viewport 1280x720 ≥ 768px 断点) */
async function waitForRail(page: Page, timeoutMs = 30_000): Promise<void> {
  await expect
    .poll(() => activeDotIndex(page), { timeout: timeoutMs, intervals: [250] })
    .toBeGreaterThanOrEqual(0)
}

/**
 * 等键盘翻页监听器真正挂上(hydration 完成判据):useFullPageScroll 的挂载 effect
 * 会把 history.scrollRestoration 设为 'manual'(SSR 阶段恒为 'auto')。
 * 不加这道门会在 SSR 帧上按键 —— 监听器还不存在,测试会假性/无意义通过。
 */
async function waitForPagingHydrated(page: Page, timeoutMs = 30_000): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.history.scrollRestoration), {
      timeout: timeoutMs,
      intervals: [250],
    })
    .toBe('manual')
}

/** 渲染出来的 MessageItem(data-message-id + data-message-focused 恒在) */
async function renderedMessageCount(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelectorAll('[data-message-id][data-message-focused]').length,
  )
}

interface FocusedMessageState {
  /** 当前 data-message-focused="true" 的条数 */
  count: number
  /** 唯一聚焦项的 data-message-id;无则 null */
  id: string | null
  /** 唯一聚焦项在全部已渲染消息中的下标;非唯一时 -1 */
  index: number
}

async function focusedMessageState(page: Page): Promise<FocusedMessageState> {
  return page.evaluate(() => {
    const all = Array.from(
      document.querySelectorAll<HTMLElement>('[data-message-id][data-message-focused]'),
    )
    const focuseds = all.filter((el) => el.getAttribute('data-message-focused') === 'true')
    const only = focuseds.length === 1 ? focuseds[0] : undefined
    return {
      count: focuseds.length,
      id: only?.getAttribute('data-message-id') ?? null,
      index: only === undefined ? -1 : all.indexOf(only),
    }
  })
}

/** GET /api/chat/conversations 的最小结构假设(未声明字段一律不依赖) */
interface ConversationSummary {
  id?: unknown
}
interface ConversationsResponse {
  data?: { conversations?: unknown }
}

async function listConversationIds(page: Page, limit = 5): Promise<string[]> {
  const res = await page.request.get('/api/chat/conversations?page=1&pageSize=20')
  if (!res.ok()) return []
  const body = (await res.json().catch(() => null)) as ConversationsResponse | null
  const items: unknown = body?.data?.conversations
  if (!Array.isArray(items)) return []
  const ids: string[] = []
  for (const item of items) {
    const id = (item as ConversationSummary | null)?.id
    if (typeof id === 'string' && ids.length < limit) ids.push(id)
  }
  return ids
}

base.describe('整屏翻页 × 对话流 键盘键位归属回归', () => {
  base(
    'P1 /:PageDown 翻页通道仍生效 — 激活点 0→1,按键被消费,激活项变 16px 胶囊',
    async ({ page }) => {
      await page.goto('/')
      await waitForRail(page)
      await waitForPagingHydrated(page)
      await installKeyProbe(page)

      const before = await activeDotIndex(page)
      const beforeHeights = await dotHeightsPx(page)
      console.log(`[P1] 翻页前:激活点下标 = ${before},各点高度 = ${JSON.stringify(beforeHeights)}`)
      expect(before, '初始应停在第 1 屏').toBe(0)
      expect(beforeHeights.length, '总屏数应 ≥2').toBeGreaterThanOrEqual(2)
      expect(beforeHeights[0]).toBeGreaterThanOrEqual(ACTIVE_PILL_H[0])
      expect(beforeHeights[0]).toBeLessThanOrEqual(ACTIVE_PILL_H[1])
      expect(beforeHeights[1]).toBeGreaterThanOrEqual(INACTIVE_DOT_H[0])
      expect(beforeHeights[1]).toBeLessThanOrEqual(INACTIVE_DOT_H[1])

      await page.keyboard.press('PageDown')
      await expect
        .poll(() => activeDotIndex(page), { timeout: 10_000, intervals: [200] })
        .toBe(before + 1)
      // 圆点尺寸有 transition-all duration-300,等动画结束再量几何
      await page.waitForTimeout(450)

      const afterHeights = await dotHeightsPx(page)
      console.log(
        `[P1] 翻页后:激活点下标 = ${before + 1},各点高度 = ${JSON.stringify(afterHeights)}`,
      )
      expect(afterHeights[before]).toBeGreaterThanOrEqual(INACTIVE_DOT_H[0])
      expect(afterHeights[before]).toBeLessThanOrEqual(INACTIVE_DOT_H[1])
      expect(afterHeights[before + 1]).toBeGreaterThanOrEqual(ACTIVE_PILL_H[0])
      expect(afterHeights[before + 1]).toBeLessThanOrEqual(ACTIVE_PILL_H[1])
      expect(await keyProbeLog(page)).toContain('PageDown:consumed')
    },
  )

  base(
    'P2 /:ArrowDown/ArrowUp/Home/End 不再被整屏吞 — 激活点恒为 0,按键未被消费',
    async ({ page }) => {
      await page.goto('/')
      await waitForRail(page)
      await waitForPagingHydrated(page)
      await installKeyProbe(page)

      expect(await activeDotIndex(page)).toBe(0)
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const) {
        await page.keyboard.press(key)
        // 覆盖 900ms 节流锁:若方向键仍被翻页 handler 消费,激活点会在该窗口内变成 1
        await page.waitForTimeout(THROTTLE_WINDOW_MS)
        const idx = await activeDotIndex(page)
        console.log(`[P2] 按 ${key} 后 1.2s,激活点下标 = ${idx}(期望仍为 0)`)
        expect(idx, `按 ${key} 不得触发整屏翻页`).toBe(0)
      }

      const log = await keyProbeLog(page)
      console.log(`[P2] keydown 探针日志: ${JSON.stringify(log)}`)
      expect(log).toContain('ArrowDown:native')
      expect(log).toContain('ArrowUp:native')
      expect(log).toContain('Home:native')
      expect(log).toContain('End:native')
      expect(log.length, '四个键都应被探针记录').toBeGreaterThanOrEqual(4)
    },
  )

  base(
    'P3 /:焦点在 TEXTAREA 时 PageDown 被焦点守卫放行 — 激活点不变且按键未被消费',
    async ({ page }) => {
      await page.goto('/')
      await waitForRail(page)
      await waitForPagingHydrated(page)
      await installKeyProbe(page)

      await page.evaluate(() => {
        const ta = document.createElement('textarea')
        ta.id = 'e2e-focus-guard-probe'
        ta.style.cssText =
          'position:fixed;top:8px;left:8px;width:200px;height:60px;z-index:2147483647;'
        ta.value = 'x'.repeat(200) // 撑出内部滚动,PageDown 原生滚动 textarea
        document.body.appendChild(ta)
        ta.focus()
      })
      expect(
        await page.evaluate(() => document.activeElement?.id ?? ''),
        '焦点应已落在探针 textarea',
      ).toBe('e2e-focus-guard-probe')

      await page.keyboard.press('PageDown')
      await page.waitForTimeout(THROTTLE_WINDOW_MS)
      const idx = await activeDotIndex(page)
      const log = await keyProbeLog(page)
      console.log(
        `[P3] textarea 聚焦时按 PageDown:激活点 = ${idx}(期望 0),探针 = ${JSON.stringify(log)}`,
      )
      expect(idx, '焦点守卫:输入控件内 PageDown 不得翻页').toBe(0)
      expect(log).toContain('PageDown:native')

      await page.evaluate(() => document.getElementById('e2e-focus-guard-probe')?.remove())
    },
  )

  authTest(
    'P4 /chat:ArrowDown/ArrowUp 不触发整屏翻页 — 激活指示器不变',
    async ({ authenticatedPage }) => {
      authTest.setTimeout(180_000)
      const page = authenticatedPage
      await page.goto('/chat', { waitUntil: 'domcontentloaded' })
      if (!page.url().includes('/chat')) {
        authTest.skip(true, `/chat 被重定向到 ${page.url()},登录态未生效`)
      }
      if (
        await page
          .getByTestId('login-dialog')
          .isVisible()
          .catch(() => false)
      ) {
        authTest.skip(true, '登录弹窗出现,会话失效,无法验证 /chat 键位归属')
      }
      await waitForRail(page)
      await waitForPagingHydrated(page)

      const before = await activeDotIndex(page)
      await blurActiveElement(page)
      for (const key of ['ArrowDown', 'ArrowUp'] as const) {
        await page.keyboard.press(key)
        await page.waitForTimeout(THROTTLE_WINDOW_MS)
        const idx = await activeDotIndex(page)
        console.log(`[P4] /chat 按 ${key} 后 1.2s,翻页指示器激活点 = ${idx}(基线 ${before})`)
        expect(idx, `/chat 按 ${key} 不得出现整屏翻页副作用`).toBe(before)
      }
      console.log(`[P4] 已渲染消息条数 = ${await renderedMessageCount(page)}`)
    },
  )

  // 注:用 adminPage 而非 authenticatedPage —— globalSetup 每轮重建的 test@aizhs.top
  // 是全新账号(0 会话),P4b 需要真实历史消息;admin 账号持久保留会话数据。
  authTest(
    'P4b /chat:有历史消息时 ArrowDown 切换 data-message-focused 到相邻条',
    async ({ adminPage }) => {
      authTest.setTimeout(180_000)
      const page = adminPage
      const ids = await listConversationIds(page)
      console.log(`[P4b] 历史会话候选 id(${ids.length} 个): ${JSON.stringify(ids)}`)
      if (ids.length === 0) {
        authTest.skip(true, 'API 未返回任何历史会话,无法验证消息焦点切换(非断言失败)')
        return
      }
      let rendered = 0
      for (const id of ids) {
        await page.goto(`/chat?conversationId=${id}`, { waitUntil: 'domcontentloaded' })
        await expect
          .poll(() => renderedMessageCount(page), { timeout: 15_000, intervals: [500] })
          .toBeGreaterThan(1)
          .catch(() => {
            /* 该会话消息不足 2 条,尝试下一个候选 */
          })
        rendered = await renderedMessageCount(page)
        console.log(`[P4b] 会话 ${id} 渲染消息 ${rendered} 条`)
        if (rendered >= 2 && rendered <= 12) break // 保证全部渲染(未过 60 条虚拟化阈值),DOM 序=消息序
      }
      if (rendered < 2 || rendered > 12) {
        authTest.skip(
          true,
          `候选会话渲染消息数不在 2..12 区间(实测 ${rendered}),无法可靠断言相邻切换(非断言失败)`,
        )
        return
      }

      await blurActiveElement(page)
      const baseline = await focusedMessageState(page)
      expect(baseline.count, '初始不应有聚焦消息').toBe(0)

      await page.keyboard.press('ArrowDown')
      await expect
        .poll(() => focusedMessageState(page).then((s) => s.count), { timeout: 5_000 })
        .toBe(1)
      const first = await focusedMessageState(page)
      console.log(`[P4b] 第 1 次 ArrowDown:聚焦 ${first.id} @ 下标 ${first.index}/${rendered - 1}`)
      expect(first.id, '聚焦项应带 data-message-id').not.toBeNull()

      await page.keyboard.press('ArrowDown')
      await expect
        .poll(() => focusedMessageState(page).then((s) => (s.id === first.id ? null : s.id)), {
          timeout: 5_000,
          intervals: [200],
        })
        .not.toBeNull()
      const second = await focusedMessageState(page)
      console.log(
        `[P4b] 第 2 次 ArrowDown:聚焦 ${second.id} @ 下标 ${second.index}/${rendered - 1}`,
      )
      expect(second.count).toBe(1)
      expect(second.index, '焦点应移到相邻下一条(按 DOM 渲染序)').toBe(first.index + 1)
      expect(await activeDotIndex(page), '消息焦点切换期间翻页指示器不得动').toBe(0)
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
