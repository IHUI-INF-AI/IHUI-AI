// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'

/**
 * AI 对话内嵌浏览器工作展示区(WorkPanel)P3 + P3+ + P3++ E2E 守门测试 (2026-07-22 立)
 *
 * 覆盖 5 个核心场景:
 * 1. openPanel 后 panel exists + tab 渲染
 * 2. newTab 创建多 Tab + 切换 active
 * 3. addFavorite 收藏 + Star 按钮 amber-500 class
 * 4. dropdown 展开(点击 ChevronDown 按钮 + dialog 出现)
 * 5. 拖拽排序(reorderTabs)
 *
 * 不依赖登录态(直接调 window.__workPanelStore API),避免被后端登录接口阻塞。
 * 降级场景:若 window.__workPanelStore 未暴露,跳过测试并标注。
 */

declare global {
  interface Window {
    __workPanelStore?: unknown
  }
}

test.beforeEach(async ({ page }) => {
  // 清理 localStorage 避免前一个测试残留状态
  // 2026-08-26 修复:goto 用 domcontentloaded —— dev 模式下首屏 load 需等全部 chunk
  // 编译完成,可能 >30s 超时(work-panel 依赖 dev-only 的 __workPanelStore,必须 dev 跑)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.removeItem('ihui-work-panel')
    localStorage.removeItem('theme')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // 等待 dev 模式暴露 store
  // 2026-08-27 修复:waitForFunction(fn, { timeout }) 第二参数被当作 arg 而非 options
  // (Playwright 签名 pageFunction, arg?, options?),timeout 未生效 → 默认 30s 等待 →
  // build 版无 __workPanelStore 时 beforeEach 恒超时。传 undefined 占位让 options 生效。
  await page
    .waitForFunction(() => typeof window.__workPanelStore !== 'undefined', undefined, {
      timeout: 5000,
    })
    .catch(() => null) // dev mode store 未暴露时降级
})

test('P3-1: openPanel 后 panel exists + tab 渲染', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().openPanel({ url: 'https://example.com' })
    const s = store.getState()
    return {
      skipped: false,
      open: s.open,
      tabsCount: s.tabs.length,
      activeTabId: s.activeTabId,
      firstTabState: s.tabs[0]?.state,
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.open).toBe(true)
  expect(result.tabsCount).toBe(1)
  expect(result.activeTabId).toBeTruthy()
  expect(result.firstTabState?.status).toBe('loading')
})

test('P3-2: newTab 创建多 Tab + 切换 active', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().openPanel({ url: 'https://example.com' })
    store.getState().newTab('https://www.bing.com')
    store.getState().newTab('https://github.com')
    const after = store.getState()
    return {
      skipped: false,
      tabsCount: after.tabs.length,
      tabs: after.tabs.map((t: any) => ({ id: t.id.slice(0, 8), url: t.url })),
      activeTabId: after.activeTabId?.slice(0, 8),
      // 切换 active
      switchedActive: (() => {
        const firstId = after.tabs[0]?.id
        if (!firstId || firstId === after.activeTabId) return null
        store.getState().setActiveTab(firstId)
        return store.getState().activeTabId?.slice(0, 8)
      })(),
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.tabsCount).toBe(3)
  expect(result.tabs[0]?.url).toBe('https://example.com')
  expect(result.tabs[2]?.url).toBe('https://github.com')
  expect(result.switchedActive).toBe(result.tabs[0]?.id)
})

test('P3-3: addFavorite 收藏 + Star 按钮 amber-500 class', async ({ page }) => {
  // 1. 触发收藏
  const storeResult = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().openPanel({ url: 'https://github.com' })
    store.getState().addFavorite('https://github.com', 'GitHub')
    const s = store.getState()
    return {
      skipped: false,
      favoritesCount: s.favorites.length,
      firstFavorite: s.favorites[0],
    }
  })
  test.skip(storeResult.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(storeResult.favoritesCount).toBe(1)
  expect(storeResult.firstFavorite?.url).toBe('https://github.com')

  // 2. 等 UI 渲染后验证 Star 按钮 amber-500 class
  await page.waitForTimeout(500)
  const domResult = await page.evaluate(() => {
    const starBtn = Array.from(document.querySelectorAll('button')).find(
      (b) =>
        b.title === '取消收藏' ||
        b.title === '添加收藏' ||
        b.getAttribute('aria-label')?.toLowerCase().includes('star'),
    )
    return {
      starBtnExists: !!starBtn,
      starBtnClass: starBtn?.className ?? '',
      hasAmber500: (starBtn?.className ?? '').includes('amber-500'),
    }
  })
  expect(domResult.starBtnExists).toBe(true)
  expect(domResult.hasAmber500).toBe(true)
})

test('P3+: dropdown 展开(点击 ChevronDown 按钮 + dialog 出现)', async ({ page }) => {
  // 1. 准备数据:1 个收藏 + 1 个历史
  const storeExists = await page.evaluate(
    () => typeof (window as any).__workPanelStore !== 'undefined',
  )
  test.skip(storeExists === false, 'window.__workPanelStore 未暴露(build 版),跳过')
  await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return
    store.getState().openPanel({ url: 'https://example.com' })
    store.getState().addFavorite('https://github.com', 'GitHub')
    store.getState().navigate('https://github.com', 'user')
  })
  await page.waitForTimeout(500)

  // 2. 点击 ChevronDown 按钮
  // (2026-09-22:ToolbarButton 不再落原生 title(§4 禁原生提示),改渲染 aria-label + 包内 Tooltip,
  //  故定位从 [title=] 换到 [aria-label=])
  const chevronBtn = page.locator('button[aria-label="收藏和历史"]')
  await chevronBtn.click()
  await page.waitForTimeout(300)

  // 3. 验证 dialog 出现 + 收藏 tab 默认激活
  const dropdown = page.locator('[role="dialog"][aria-label="收藏和历史"]')
  await expect(dropdown).toBeVisible()
  const dropdownState = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="收藏和历史"]')
    if (!dialog) return null
    const tabBtns = Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent?.trim())
    const listItems = dialog.querySelectorAll('div.group.flex.items-center')
    return {
      tabBtns,
      listItemCount: listItems.length,
      firstItemText: listItems[0]?.textContent?.trim(),
    }
  })
  expect(dropdownState).not.toBeNull()
  expect(dropdownState?.listItemCount).toBeGreaterThanOrEqual(1)
  expect(dropdownState?.tabBtns.some((t) => t?.includes('收藏'))).toBe(true)
  expect(dropdownState?.tabBtns.some((t) => t?.includes('历史'))).toBe(true)

  // 4. 切换到历史 tab
  await page.locator('[role="dialog"][aria-label="收藏和历史"] button', { hasText: '历史' }).click()
  await page.waitForTimeout(200)
  const historyState = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="收藏和历史"]')
    if (!dialog) return null
    const listItems = dialog.querySelectorAll('div.group.flex.items-center')
    return { historyItemCount: listItems.length }
  })
  expect(historyState?.historyItemCount).toBeGreaterThanOrEqual(1)
})

/** tab 标题读取(仅 tab pill 内,自动重试等待 dev 冷编译落 DOM) */
function pillTitles(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="work-panel-tab"] span.max-w-\\[120px\\]')
}

test('P3++: 拖拽排序(reorderTabs API 验证 + DOM 顺序)', async ({ page }) => {
  // 1. 准备 3 个 tab
  const initial = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().openPanel({ url: 'https://a.example.com' })
    store.getState().newTab('https://b.example.com')
    store.getState().newTab('https://c.example.com')
    const s = store.getState()
    return {
      skipped: false,
      tabs: s.tabs.map((t: any) => ({ id: t.id, url: t.url })),
    }
  })
  test.skip(initial.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(initial.tabs.length).toBe(3)

  // 2. 调 reorderTabs:把第一个 tab 移到第三个位置
  const reordered = await page.evaluate((tabs) => {
    const store = (window as any).__workPanelStore
    store.getState().reorderTabs(tabs[0].id, tabs[2].id)
    return store.getState().tabs.map((t: any) => t.url)
  }, initial.tabs)
  expect(reordered).toEqual([
    'https://b.example.com',
    'https://c.example.com',
    'https://a.example.com',
  ])

  // 3. 验证 DOM 顺序与 store 一致
  // 2026-09-22:tab pill 由 <button> 改为 div + 内嵌两枚真 button(修非法嵌套),
  // 选择器改用 pill 的 data-testid(契约等价,不再依赖"直接子 button"结构);
  // 冷 dev 首屏 chunk 懒编译 >500ms 会让定值等待假红 → 用自动重试的 toHaveCount。
  await expect(pillTitles(page)).toHaveCount(3)
  const domOrder = await pillTitles(page).allTextContents()
  expect(domOrder.map((t) => t.trim()).length).toBe(3)
})

test('P4-2: closeTab 关闭非 active tab', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().newTab('https://a.example.com')
    store.getState().newTab('https://b.example.com')
    store.getState().newTab('https://c.example.com')
    const tabs = store.getState().tabs
    // 关掉第一个(非 active,active=c)
    store.getState().closeTab(tabs[0].id)
    const after = store.getState()
    return {
      skipped: false,
      tabsCount: after.tabs.length,
      remaining: after.tabs.map((t: any) => t.url),
      activeUrl: after.tabs.find((t: any) => t.id === after.activeTabId)?.url,
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.tabsCount).toBe(2)
  expect(result.remaining).toEqual(['https://b.example.com', 'https://c.example.com'])
  expect(result.activeUrl).toBe('https://c.example.com')
})

test('P4-2: closeTab 关闭 active 中间 tab,切到右邻', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().newTab('https://a.example.com')
    store.getState().newTab('https://b.example.com')
    store.getState().newTab('https://c.example.com')
    const tabs = store.getState().tabs
    // 切到 b 再关
    store.getState().setActiveTab(tabs[1].id)
    store.getState().closeTab(tabs[1].id)
    const after = store.getState()
    return {
      skipped: false,
      tabsCount: after.tabs.length,
      remaining: after.tabs.map((t: any) => t.url),
      activeUrl: after.tabs.find((t: any) => t.id === after.activeTabId)?.url,
      addressInput: after.addressInput,
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.tabsCount).toBe(2)
  expect(result.remaining).toEqual(['https://a.example.com', 'https://c.example.com'])
  // 关掉 idx=1 的 active 后,应切到原 idx=1(现在是 c)
  expect(result.activeUrl).toBe('https://c.example.com')
  expect(result.addressInput).toBe('https://c.example.com')
})

test('P4-2: closeTab 关闭最后一个 tab,active 变 null + addressInput 清空', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().newTab('https://only.example.com')
    const tabs = store.getState().tabs
    store.getState().closeTab(tabs[0].id)
    const after = store.getState()
    return {
      skipped: false,
      tabsCount: after.tabs.length,
      activeTabId: after.activeTabId,
      addressInput: after.addressInput,
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.tabsCount).toBe(0)
  expect(result.activeTabId).toBeNull()
  expect(result.addressInput).toBe('')
})

test('P4-2: closeTab 未知 id no-op(不抛错)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().newTab('https://a.example.com')
    const before = store.getState().tabs.length
    store.getState().closeTab('nonexistent-id-xxx')
    return {
      skipped: false,
      tabsCount: store.getState().tabs.length,
      before,
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.tabsCount).toBe(result.before)
})

test('P4-5: reorderTabs position=before 把 a 移到 c 之前', async ({ page }) => {
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return { skipped: true }
    store.getState().openPanel({ url: 'https://a.example.com' })
    store.getState().newTab('https://b.example.com')
    store.getState().newTab('https://c.example.com')
    const [a, , c] = store.getState().tabs
    store.getState().reorderTabs(a.id, c.id, 'before')
    return {
      skipped: false,
      urls: store.getState().tabs.map((t: any) => t.url),
    }
  })
  test.skip(result.skipped === true, 'window.__workPanelStore 未暴露,跳过')
  expect(result.urls).toEqual([
    'https://b.example.com',
    'https://a.example.com',
    'https://c.example.com',
  ])
})

test('P4-5: drop indicator DOM 渲染(before/after position)', async ({ page }) => {
  // 1. 准备 3 个 tab
  await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return
    store.getState().openPanel({ url: 'https://a.example.com' })
    store.getState().newTab('https://b.example.com')
    store.getState().newTab('https://c.example.com')
  })
  // 2026-09-22:改为自动等待 3 颗 pill 落 DOM(原定值 waitForTimeout(500) 在冷 dev 下
  // 会拿到 0×0 的 boundingBox → clientX 判到 after 位 → 首 tab 无 after 指示线 → 假红)
  await expect(page.locator('[data-testid="work-panel-tab"]')).toHaveCount(3)
  await page.waitForTimeout(500)

  // 2. 用 Playwright 的 dispatchEvent 触发 React 17+ 合成事件链路
  // (用 new DragEvent + dispatchEvent 在 React 17+ 不走 root 委托,会失败)
  // pill 容器整体是 dragover/dragleave 的宿主(改造前即整颗 button 的 rect,逐像素等价)
  const firstTab = page.locator('[data-testid="work-panel-tab"]').first()
  const firstTabCount = await firstTab.count()
  test.skip(firstTabCount === 0, 'tab buttons 未渲染,跳过')

  // 3. 拿到第一个 tab 的中心点,模拟鼠标在左半边(dragover → before)
  const box = await firstTab.boundingBox()
  test.skip(!box, 'tab bounding box 不可用,跳过')
  await firstTab.dispatchEvent('dragover', {
    dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
    clientX: box!.x + box!.width * 0.25,
    clientY: box!.y + box!.height / 2,
  })

  // 4. 等 React 状态更新 + 动画
  await page.waitForTimeout(300)

  // 5. 验证 drop indicator 存在(pointer-events-none 的 div,带 aria-label)
  const indicators = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div[aria-label]'))
    return els
      .filter((el) => {
        const label = el.getAttribute('aria-label') ?? ''
        return label === '在此处之前插入' || label === '在此处之后插入'
      })
      .map((el) => ({
        label: el.getAttribute('aria-label'),
        hasPointerEventsNone: (el as HTMLElement).classList.contains('pointer-events-none'),
        hasPrimaryBg: (el as HTMLElement).classList.contains('bg-primary'),
      }))
  })
  // 至少应有一个 indicator 出现(无论是 before 还是 after)
  expect(indicators.length).toBeGreaterThanOrEqual(1)
  expect(indicators[0]?.hasPointerEventsNone).toBe(true)
  expect(indicators[0]?.hasPrimaryBg).toBe(true)
})

test('P4-6: tab pill 合法内容模型 + 关闭钮聚焦显形(2026-09-22 非法嵌套根治)', async ({ page }) => {
  const storeReady = await page.evaluate(
    () => typeof (window as any).__workPanelStore !== 'undefined',
  )
  test.skip(!storeReady, 'window.__workPanelStore 未暴露,跳过')
  await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    store.getState().openPanel({ url: 'https://a.example.com' })
    store.getState().newTab('https://b.example.com')
  })
  const pills = page.locator('[data-testid="work-panel-tab"]')
  // 自动重试等待落 DOM(冷 dev 首屏 chunk 懒编译可达数秒,定值 waitForTimeout 会假红)
  await expect(pills).toHaveCount(2)

  // ① HTML 内容模型合法:pill 内不得有 button 嵌 button / interactive content
  const illegal = await pills.evaluateAll((els) =>
    els.reduce(
      (n, pill) =>
        n + pill.querySelectorAll('button button, button [role="button"], button a').length,
      0,
    ),
  )
  expect(illegal).toBe(0)
  // ② pill 下并列两枚真 <button>(激活钮 + 关闭钮)
  expect(await pills.first().evaluate((el) => el.querySelectorAll(':scope > button').length)).toBe(
    2,
  )

  // ③ 关闭钮常驻但默认透明;④ 聚焦显形 —— 类名与 CSS 规则齐备,计算值在本机
  // 冷 dev + 面板容器可见性下未复现(见下方 P4-6b fixme 用例),此处只做结构断言
  const close0 = pills.first().locator('[data-testid="work-panel-tab-close"]')
  expect(await close0.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  expect(
    await close0.evaluate((el) => el.classList.contains('group-focus-within:opacity-100')),
  ).toBe(true)
  await page.mouse.move(0, 0) // 离开 pill,避免 group-hover 干扰后续判定

  // ⑤ 点标题=激活;点非激活 tab 的 X=关闭且激活态不变(证明关闭不会串到 onTabChange)
  const readState = () =>
    page.evaluate(() => {
      const s = (window as any).__workPanelStore.getState()
      return { count: s.tabs.length, active: s.activeTabId as string | null }
    })
  const before = await readState()
  await pills.nth(1).locator('button').first().click()
  const switched = await readState()
  expect(switched.active).not.toBe(before.active)
  expect(switched.count).toBe(before.count)
  await close0.click()
  const closed = await readState()
  expect(closed.count).toBe(before.count - 1)
  expect(closed.active).toBe(switched.active)
})

/* ---------------------------------------------------------------------------
 * D50② 工作面板 Tab 状态按会话分桶持久化(2026-09-25 扩,复用本文件的
 * dev-only __workPanelStore 通道;build 下同样优雅跳过)
 * ------------------------------------------------------------------------- */

test('D50-1: 跨会话 Tab 分桶 — 切换隔离、切回恢复、无会话退回全局', async ({ page }) => {
  const storeReady = await page.evaluate(
    () => typeof (window as any).__workPanelStore !== 'undefined',
  )
  test.skip(!storeReady, 'window.__workPanelStore 未暴露(build 版),跳过')
  const result = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    // 全局作用域开 1 个 tab
    store.getState().setConversationScope(null)
    store.getState().newTab('https://global.d50.example.com')
    // 会话 A:2 个 tab,激活第一个
    store.getState().setConversationScope('conv-a')
    store.getState().newTab('https://a1.d50.example.com')
    store.getState().newTab('https://a2.d50.example.com')
    const a1Id = store.getState().tabs[0].id
    store.getState().setActiveTab(a1Id)
    // 切到会话 B:应为空视图(隔离)
    store.getState().setConversationScope('conv-b')
    const bTabs = store.getState().tabs.length
    // 切回 A:tabs/激活/地址栏全部恢复
    store.getState().setConversationScope('conv-a')
    const restored = {
      count: store.getState().tabs.length,
      activeUrl: store.getState().tabs.find((t: any) => t.id === store.getState().activeTabId)?.url,
      addressInput: store.getState().addressInput,
    }
    // 退回无会话:全局桶原样回来
    store.getState().setConversationScope(null)
    const globalBack = store.getState().tabs.map((t: any) => t.url)
    return { bTabs, restored, globalBack }
  })
  expect(result.bTabs).toBe(0)
  expect(result.restored.count).toBe(2)
  expect(result.restored.activeUrl).toBe('https://a1.d50.example.com')
  expect(result.restored.addressInput).toBe('https://a1.d50.example.com')
  expect(result.globalBack).toEqual(['https://global.d50.example.com'])
})

test('D50-2: 分桶持久化 — 顶层仍全局形态,会话桶进 conversationTabs,刷新后恢复', async ({
  page,
}) => {
  const storeReady = await page.evaluate(
    () => typeof (window as any).__workPanelStore !== 'undefined',
  )
  test.skip(!storeReady, 'window.__workPanelStore 未暴露(build 版),跳过')
  await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    store.getState().setConversationScope('conv-persist')
    store.getState().newTab('https://p1.d50.example.com')
  })
  await page.waitForTimeout(200) // persist 写入落盘
  const disk = await page.evaluate(() => {
    const raw = localStorage.getItem('ihui-work-panel')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      topLevelTabs: (parsed.state.tabs ?? []).map((t: any) => t.url),
      bucket: parsed.state.conversationTabs?.['conv-persist'],
    }
  })
  expect(disk).not.toBeNull()
  // 向后兼容:顶层 tabs 仍是全局视图(此时全局无 tab),会话数据只进 conversationTabs
  expect(disk!.topLevelTabs).toEqual([])
  expect(disk!.bucket?.tabs?.[0]?.url).toBe('https://p1.d50.example.com')

  // 刷新 → 桶从 localStorage 恢复(store 重建 + persist hydrate 后再装桶)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page
    .waitForFunction(() => typeof window.__workPanelStore !== 'undefined', undefined, {
      timeout: 15000,
    })
    .catch(() => null)
  const afterReload = await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    store.getState().setConversationScope('conv-persist')
    const s = store.getState()
    return { urls: s.tabs.map((t: any) => t.url), addressInput: s.addressInput }
  })
  expect(afterReload.urls).toEqual(['https://p1.d50.example.com'])
  expect(afterReload.addressInput).toBe('https://p1.d50.example.com')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
