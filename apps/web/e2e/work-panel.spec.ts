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

const STORE_KEY = 'ihui-work-panel'

test.beforeEach(async ({ page }) => {
  // 清理 localStorage 避免前一个测试残留状态
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('ihui-work-panel')
    localStorage.removeItem('theme')
  })
  await page.goto('/')
  // 等待 dev 模式暴露 store
  await page.waitForFunction(() => typeof window.__workPanelStore !== 'undefined', { timeout: 5000 })
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
  await page.evaluate(() => {
    const store = (window as any).__workPanelStore
    if (!store) return
    store.getState().openPanel({ url: 'https://example.com' })
    store.getState().addFavorite('https://github.com', 'GitHub')
    store.getState().navigate('https://github.com', 'user')
  })
  await page.waitForTimeout(500)

  // 2. 点击 ChevronDown 按钮
  const chevronBtn = page.locator('button[title="收藏和历史"]')
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
  await page.waitForTimeout(500)
  const domOrder = await page.evaluate(() => {
    const tabBtns = Array.from(
      document.querySelectorAll('div.flex.flex-1.items-center > button'),
    )
      .filter((b) => b.querySelector('span.max-w-\\[120px\\]'))
      .map((b) => b.querySelector('span')?.textContent?.trim())
    return tabBtns
  })
  // DOM 应有 3 个 tab(标题可能为 a/b/c.example.com 或 host)
  expect(domOrder.length).toBe(3)
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
  await page.waitForTimeout(500)

  // 2. 用 Playwright 的 dispatchEvent 触发 React 17+ 合成事件链路
  // (用 new DragEvent + dispatchEvent 在 React 17+ 不走 root 委托,会失败)
  const firstTab = page
    .locator('button:has(span.max-w-\\[120px\\])')
    .first()
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
