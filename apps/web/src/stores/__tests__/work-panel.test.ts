// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock api-client,避免 work-panel 拉真实后端
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: true, data: { screenshot: '' } }),
}))

import { useWorkPanelStore, WORK_PANEL_DEFAULT_WIDTH } from '../work-panel'

/** 清空 localStorage + 重置 store */
function resetStore() {
  localStorage.clear()
  useWorkPanelStore.setState({
    open: false,
    width: WORK_PANEL_DEFAULT_WIDTH,
    isResizing: false,
    addressInput: '',
    tabs: [],
    activeTabId: null,
    favorites: [],
    recentUrls: [],
  })
}

describe('useWorkPanelStore - 基础状态', () => {
  beforeEach(() => resetStore())

  it('初始状态全部为空', () => {
    const s = useWorkPanelStore.getState()
    expect(s.open).toBe(false)
    expect(s.tabs).toEqual([])
    expect(s.activeTabId).toBeNull()
    expect(s.favorites).toEqual([])
    expect(s.recentUrls).toEqual([])
    expect(s.addressInput).toBe('')
  })

  it('openPanel(无 url) 仅展开,不创建 tab', () => {
    useWorkPanelStore.getState().openPanel()
    const s = useWorkPanelStore.getState()
    expect(s.open).toBe(true)
    expect(s.tabs).toEqual([])
    expect(s.activeTabId).toBeNull()
  })
})

describe('useWorkPanelStore - newTab / navigate / setActiveTab', () => {
  beforeEach(() => resetStore())

  it('navigate 无 active tab 时创建 tab', () => {
    useWorkPanelStore.getState().navigate('https://example.com', 'user')
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]?.url).toBe('https://example.com')
    expect(s.activeTabId).toBe(s.tabs[0]?.id)
    expect(s.open).toBe(true)
  })

  it('navigate 自动补全 https://', () => {
    useWorkPanelStore.getState().navigate('example.com', 'user')
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe('https://example.com')
  })

  it('navigate 搜索词转 bing 搜索', () => {
    useWorkPanelStore.getState().navigate('hello world', 'user')
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe(
      'https://www.bing.com/search?q=hello%20world',
    )
  })

  it('newTab 创建空 tab 并激活', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(2)
    expect(s.activeTabId).toBe(s.tabs[1]?.id)
    expect(s.tabs[1]?.url).toBe('https://b.com')
  })

  it('newTab 超出 MAX_TABS=5 自动关闭最旧', () => {
    for (let i = 0; i < 6; i++) {
      useWorkPanelStore.getState().newTab(`https://t${i}.com`)
    }
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(5)
    // 最早 t0 已关闭
    expect(s.tabs[0]?.url).toBe('https://t1.com')
    // 最新 t5 在末尾
    expect(s.tabs[4]?.url).toBe('https://t5.com')
  })

  it('setActiveTab 切换并同步地址栏', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    const firstId = useWorkPanelStore.getState().tabs[0]!.id
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().setActiveTab(firstId)
    const s = useWorkPanelStore.getState()
    expect(s.activeTabId).toBe(firstId)
    expect(s.addressInput).toBe('https://a.com')
  })

  it('setActiveTab 未知 id 不变更', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    const before = useWorkPanelStore.getState().activeTabId
    useWorkPanelStore.getState().setActiveTab('nonexistent')
    expect(useWorkPanelStore.getState().activeTabId).toBe(before)
  })
})

describe('useWorkPanelStore - closeTab 边界(P4-2 核心)', () => {
  beforeEach(() => resetStore())

  it('关闭非 active tab:不动 active', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    const firstId = useWorkPanelStore.getState().tabs[0]!.id
    const secondId = useWorkPanelStore.getState().tabs[1]!.id
    useWorkPanelStore.getState().closeTab(firstId)
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]?.id).toBe(secondId)
    expect(s.activeTabId).toBe(secondId)
  })

  it('关闭 active tab:切到右侧相邻', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    // active = c
    const aId = useWorkPanelStore.getState().tabs[0]!.id
    const bId = useWorkPanelStore.getState().tabs[1]!.id
    const cId = useWorkPanelStore.getState().tabs[2]!.id
    useWorkPanelStore.getState().closeTab(aId) // 关 a(非 active)
    expect(useWorkPanelStore.getState().activeTabId).toBe(cId)
    useWorkPanelStore.getState().closeTab(cId) // 关 active c
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]?.id).toBe(bId)
    expect(s.activeTabId).toBe(bId)
  })

  it('关闭最后一个 active tab:active 变 null,addressInput 清空', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    const aId = useWorkPanelStore.getState().tabs[0]!.id
    useWorkPanelStore.getState().closeTab(aId)
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toEqual([])
    expect(s.activeTabId).toBeNull()
    expect(s.addressInput).toBe('')
  })

  it('关闭 active 中间 tab:切到右邻(原 idx 仍有效)', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const aId = useWorkPanelStore.getState().tabs[0]!.id
    const bId = useWorkPanelStore.getState().tabs[1]!.id
    const cId = useWorkPanelStore.getState().tabs[2]!.id
    // 切到 b 再关
    useWorkPanelStore.getState().setActiveTab(bId)
    useWorkPanelStore.getState().closeTab(bId)
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(2)
    expect(s.tabs.map((t) => t.id)).toEqual([aId, cId])
    // 切到原 idx=1 (c)
    expect(s.activeTabId).toBe(cId)
    expect(s.addressInput).toBe('https://c.com')
  })

  it('关闭 active 末尾 tab:切到左邻', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    const aId = useWorkPanelStore.getState().tabs[0]!.id
    const bId = useWorkPanelStore.getState().tabs[1]!.id
    useWorkPanelStore.getState().closeTab(bId) // 关 active
    const s = useWorkPanelStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.activeTabId).toBe(aId)
    expect(s.addressInput).toBe('https://a.com')
  })

  it('关闭不存在的 tab id:no-op', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    const before = useWorkPanelStore.getState()
    useWorkPanelStore.getState().closeTab('nonexistent')
    const after = useWorkPanelStore.getState()
    expect(after.tabs).toEqual(before.tabs)
    expect(after.activeTabId).toBe(before.activeTabId)
  })
})

describe('useWorkPanelStore - reorderTabs(P4++ 核心)', () => {
  beforeEach(() => resetStore())

  it('基本重排:把第一个移到第三个位置', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, b, c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(a!.id, c!.id)
    expect(useWorkPanelStore.getState().tabs.map((t) => t.id)).toEqual([b!.id, c!.id, a!.id])
  })

  it('同 id no-op', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    const [a, b] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(a!.id, a!.id)
    expect(useWorkPanelStore.getState().tabs.map((t) => t.id)).toEqual([a!.id, b!.id])
  })

  it('fromId 不存在 no-op', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    const a = useWorkPanelStore.getState().tabs[0]!
    useWorkPanelStore.getState().reorderTabs('nonexistent', a.id)
    expect(useWorkPanelStore.getState().tabs.map((t) => t.id)).toEqual([a.id])
  })

  it('toId 不存在 no-op', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    const a = useWorkPanelStore.getState().tabs[0]!
    useWorkPanelStore.getState().reorderTabs(a.id, 'nonexistent')
    expect(useWorkPanelStore.getState().tabs.map((t) => t.id)).toEqual([a.id])
  })

  it('重排不改变 activeTabId(用户拖完仍看着当前页)', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, b, c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().setActiveTab(b!.id) // 当前在 b
    useWorkPanelStore.getState().reorderTabs(a!.id, c!.id)
    expect(useWorkPanelStore.getState().activeTabId).toBe(b!.id)
  })

  it('向后拖(右移):a→c 位置后,b 升到 idx 0', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, , c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(a!.id, c!.id)
    expect(useWorkPanelStore.getState().tabs.map((t) => t.url)).toEqual([
      'https://b.com',
      'https://c.com',
      'https://a.com',
    ])
  })

  it('向前拖(左移):c→a 位置后', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, , c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(c!.id, a!.id)
    expect(useWorkPanelStore.getState().tabs.map((t) => t.url)).toEqual([
      'https://c.com',
      'https://a.com',
      'https://b.com',
    ])
  })
})

describe('useWorkPanelStore - reorderTabs position(P4-5)', () => {
  beforeEach(() => resetStore())

  it("position='before':a 移到 c 之前 → [b, a, c]", () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, , c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(a!.id, c!.id, 'before')
    expect(useWorkPanelStore.getState().tabs.map((t) => t.url)).toEqual([
      'https://b.com',
      'https://a.com',
      'https://c.com',
    ])
  })

  it("position='before':c 移到 a 之前 → [c, a, b]", () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, , c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(c!.id, a!.id, 'before')
    expect(useWorkPanelStore.getState().tabs.map((t) => t.url)).toEqual([
      'https://c.com',
      'https://a.com',
      'https://b.com',
    ])
  })

  it("position='before':相邻原位 no-op(a 在 b 前 → a 移到 b 之前不变化)", () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    const [a, b] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(a!.id, b!.id, 'before')
    expect(useWorkPanelStore.getState().tabs.map((t) => t.id)).toEqual([a!.id, b!.id])
  })

  it("position='after':相邻原位 no-op(b 在 a 后 → b 移到 a 之后不变化)", () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    const [a, b] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(b!.id, a!.id, 'after')
    expect(useWorkPanelStore.getState().tabs.map((t) => t.id)).toEqual([a!.id, b!.id])
  })

  it("position='before' 不改变 activeTabId", () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, b, c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().setActiveTab(b!.id)
    useWorkPanelStore.getState().reorderTabs(a!.id, c!.id, 'before')
    expect(useWorkPanelStore.getState().activeTabId).toBe(b!.id)
  })
})

describe('useWorkPanelStore - 持久化(P4-1 验证)', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkPanelStore.setState({
      tabs: [],
      activeTabId: null,
      favorites: [],
      recentUrls: [],
      width: WORK_PANEL_DEFAULT_WIDTH,
    })
  })

  it('reorderTabs 写回 localStorage(刷新后顺序保持)', async () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    useWorkPanelStore.getState().newTab('https://b.com')
    useWorkPanelStore.getState().newTab('https://c.com')
    const [a, , c] = useWorkPanelStore.getState().tabs
    useWorkPanelStore.getState().reorderTabs(a!.id, c!.id)
    // 给 zustand persist 异步写入一点时间
    await new Promise((r) => setTimeout(r, 10))
    const raw = localStorage.getItem('ihui-work-panel')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    const urls = parsed.state.tabs.map((t: { url: string }) => t.url)
    expect(urls).toEqual(['https://b.com', 'https://c.com', 'https://a.com'])
  })

  it('持久化时清除 screenshot 大字段', () => {
    useWorkPanelStore.getState().newTab('https://a.com')
    // 手动塞 screenshot 进 state(模拟 takeScreenshot 完成后)
    useWorkPanelStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({
        ...t,
        state: { ...t.state, screenshot: 'data:image/png;base64,HUGE_PAYLOAD', status: 'screenshot' },
      })),
    }))
    const raw = localStorage.getItem('ihui-work-panel')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    const persisted = parsed.state.tabs[0]
    expect(persisted.state.screenshot).toBeUndefined()
    expect(persisted.state.status).toBe('idle') // 重置回 idle
  })
})

describe('useWorkPanelStore - favorites / history', () => {
  beforeEach(() => resetStore())

  it('addFavorite 重复 url 不会重复添加', () => {
    useWorkPanelStore.getState().addFavorite('https://a.com', 'A')
    useWorkPanelStore.getState().addFavorite('https://a.com', 'A again')
    expect(useWorkPanelStore.getState().favorites).toHaveLength(1)
  })

  it('addFavorite 超过 MAX_FAVORITES=100 截断', () => {
    for (let i = 0; i < 105; i++) {
      useWorkPanelStore.getState().addFavorite(`https://f${i}.com`, `F${i}`)
    }
    expect(useWorkPanelStore.getState().favorites).toHaveLength(100)
  })

  it('removeFavorite 移除指定 url', () => {
    useWorkPanelStore.getState().addFavorite('https://a.com', 'A')
    useWorkPanelStore.getState().addFavorite('https://b.com', 'B')
    useWorkPanelStore.getState().removeFavorite('https://a.com')
    const favs = useWorkPanelStore.getState().favorites
    expect(favs).toHaveLength(1)
    expect(favs[0]?.url).toBe('https://b.com')
  })

  it('navigate 写入 recentUrls,重复 url 移到最前且不重复', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    useWorkPanelStore.getState().navigate('https://b.com', 'user')
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    const recent = useWorkPanelStore.getState().recentUrls
    expect(recent).toHaveLength(2)
    expect(recent[0]?.url).toBe('https://a.com')
    expect(recent[1]?.url).toBe('https://b.com')
  })

  it('recentUrls 超过 MAX_RECENT_URLS=30 截断', () => {
    for (let i = 0; i < 35; i++) {
      useWorkPanelStore.getState().navigate(`https://r${i}.com`, 'user')
    }
    expect(useWorkPanelStore.getState().recentUrls).toHaveLength(30)
  })

  it('clearHistory 清空 recentUrls', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    useWorkPanelStore.getState().navigate('https://b.com', 'user')
    useWorkPanelStore.getState().clearHistory()
    expect(useWorkPanelStore.getState().recentUrls).toEqual([])
  })
})

describe('useWorkPanelStore - back / forward / reload / stop', () => {
  beforeEach(() => resetStore())

  it('navigate 多次后 back 回退 historyIndex', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    useWorkPanelStore.getState().navigate('https://b.com', 'user')
    useWorkPanelStore.getState().navigate('https://c.com', 'user')
    useWorkPanelStore.getState().back()
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe('https://b.com')
    useWorkPanelStore.getState().back()
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe('https://a.com')
  })

  it('back 在 historyIndex=0 时 no-op', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    const before = useWorkPanelStore.getState().tabs[0]?.url
    useWorkPanelStore.getState().back()
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe(before)
  })

  it('forward 推进 historyIndex', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    useWorkPanelStore.getState().navigate('https://b.com', 'user')
    useWorkPanelStore.getState().back()
    useWorkPanelStore.getState().forward()
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe('https://b.com')
  })

  it('navigate 截断前进栈', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    useWorkPanelStore.getState().navigate('https://b.com', 'user')
    useWorkPanelStore.getState().back()
    useWorkPanelStore.getState().navigate('https://c.com', 'user')
    useWorkPanelStore.getState().forward() // 应 no-op(前进栈已截断)
    expect(useWorkPanelStore.getState().tabs[0]?.url).toBe('https://c.com')
  })

  it('stop 把 active tab 设为 idle', () => {
    useWorkPanelStore.getState().navigate('https://a.com', 'user')
    useWorkPanelStore.getState().stop()
    expect(useWorkPanelStore.getState().tabs[0]?.state.status).toBe('idle')
  })
})

describe('useWorkPanelStore - 窗口尺寸', () => {
  beforeEach(() => resetStore())

  it('setWidth 在 [MIN, MAX] 范围内', () => {
    useWorkPanelStore.getState().setWidth(100)
    expect(useWorkPanelStore.getState().width).toBe(320) // 强制到 MIN
    useWorkPanelStore.getState().setWidth(99999)
    expect(useWorkPanelStore.getState().width).toBe(900) // 强制到 MAX
  })
})
