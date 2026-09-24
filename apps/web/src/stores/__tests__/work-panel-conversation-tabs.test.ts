// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { WORK_PANEL_STORAGE_KEY } from '@ihui/shared/constants'

// mock api-client,避免 work-panel 拉真实后端(loadUrl → probeEmbed)
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: true, data: { screenshot: '' } }),
  buildEmbedProxyUrl: (targetUrl: string) =>
    `/api/embed-proxy/raw?url=${encodeURIComponent(targetUrl)}`,
}))

import {
  useWorkPanelStore,
  buildWorkPanelPersistedState,
  pruneTabBuckets,
  MAX_CONVERSATION_TAB_BUCKETS,
  WORK_PANEL_GLOBAL_BUCKET_KEY,
  WORK_PANEL_DEFAULT_WIDTH,
  type WorkPanelTabBucket,
} from '../work-panel'
import type { WorkPanelTab } from '@ihui/types'

/** 清空 localStorage + 重置 store(含 D50② 作用域字段) */
function resetStore() {
  localStorage.clear()
  useWorkPanelStore.setState({
    open: false,
    width: WORK_PANEL_DEFAULT_WIDTH,
    isResizing: false,
    addressInput: '',
    tabs: [],
    activeTabId: null,
    conversationId: null,
    conversationTabs: {},
    favorites: [],
    recentUrls: [],
  })
}

const live = () => useWorkPanelStore.getState()
const persisted = () => buildWorkPanelPersistedState(live())

function fakeTab(id: string, url: string): WorkPanelTab {
  return {
    id,
    type: 'browser',
    title: url,
    url,
    history: [url],
    historyIndex: 0,
    state: { status: 'idle', url, mode: 'iframe' },
    closable: true,
    createdAt: 1,
    updatedAt: 1,
  }
}

function bucketOf(id: string, url: string, updatedAt: number): WorkPanelTabBucket {
  return { tabs: [fakeTab(id, url)], activeTabId: id, updatedAt }
}

describe('D50② 分桶读写(partialize 磁盘形态)', () => {
  beforeEach(() => resetStore())

  it('会话内开 tab → conversationTabs[A] 携带该 tab,顶层 tabs 仍是全局视图', () => {
    live().setConversationScope('conv-a')
    live().newTab('https://a1.example.com')
    const p = persisted()
    // 反向对照:若 partialize 忘了按作用域路由(=改造前直存活视图),p.tabs 会是 [a1] → 本断言红
    expect(p.tabs).toEqual([])
    expect(p.activeTabId).toBeNull()
    const bucket = p.conversationTabs?.['conv-a']
    expect(bucket?.tabs.map((t) => t.url)).toEqual(['https://a1.example.com'])
    expect(bucket?.activeTabId).toBe(live().activeTabId)
    expect(bucket && 'updatedAt' in bucket).toBe(true)
  })

  it('会话桶持久化同样剔除 screenshot / 瞬态(体积有界的第二道保障)', () => {
    live().setConversationScope('conv-a')
    live().newTab('https://a1.example.com')
    useWorkPanelStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({
        ...t,
        state: {
          ...t.state,
          screenshot: 'data:image/png;base64,HUGE',
          status: 'screenshot' as const,
        },
      })),
    }))
    const bucket = persisted().conversationTabs?.['conv-a']
    expect(bucket?.tabs[0]?.state.screenshot).toBeUndefined()
    expect(bucket?.tabs[0]?.state.status).toBe('idle')
  })

  it('无会话时顶层 tabs/activeTabId 逐位等于活视图(旧格式向后兼容)', () => {
    live().newTab('https://g1.example.com')
    const p = persisted()
    expect(p.tabs?.map((t) => t.url)).toEqual(['https://g1.example.com'])
    expect(p.activeTabId).toBe(live().activeTabId)
    // 全局暂存位不得泄漏进持久化的 conversationTabs
    expect(p.conversationTabs && WORK_PANEL_GLOBAL_BUCKET_KEY in p.conversationTabs).toBe(false)
    // 旧字段全保留(width/favorites/recentUrls)
    expect(p.width).toBe(WORK_PANEL_DEFAULT_WIDTH)
    expect(p.favorites).toEqual([])
    expect(p.recentUrls).toEqual([])
  })

  it('存储键沿用共享常量单键,不新增第二条 key', () => {
    expect(WORK_PANEL_STORAGE_KEY).toBe('ihui-work-panel')
    live().setConversationScope('conv-a')
    live().newTab('https://a1.example.com')
    // 同一 store 名(persist name)= 常量值;分桶数据在同一条记录内
    expect(live().conversationTabs['conv-a']).toBeUndefined() // 当前作用域不落归档(单份真相)
    const p = persisted()
    expect(p.conversationTabs?.['conv-a']).toBeDefined() // 折叠发生在磁盘形态
  })
})

describe('D50② 跨会话切换恢复(setConversationScope)', () => {
  beforeEach(() => resetStore())

  it('A→B→A 恢复 tabs 集合 + 激活指针 + 地址栏同步', () => {
    live().setConversationScope('conv-a')
    live().newTab('https://a1.example.com')
    live().newTab('https://a2.example.com')
    const a1 = live().tabs[0]!.id
    live().setActiveTab(a1)

    live().setConversationScope('conv-b')
    // 反向对照:若切换只改 conversationId 不搬运视图,这里 tabs 仍是 A 的两个 → 红
    expect(live().tabs).toEqual([])
    expect(live().activeTabId).toBeNull()
    expect(live().addressInput).toBe('')

    live().setConversationScope('conv-a')
    expect(live().tabs.map((t) => t.url)).toEqual([
      'https://a1.example.com',
      'https://a2.example.com',
    ])
    expect(live().activeTabId).toBe(a1)
    expect(live().addressInput).toBe('https://a1.example.com')
  })

  it('无 conversationId 退回全局桶,全局行为不变', () => {
    live().newTab('https://g1.example.com')
    const g1 = live().tabs[0]!.id
    live().setConversationScope('conv-a')
    expect(live().tabs).toEqual([])
    // 会话中持久化时顶层仍是全局视图(stash 进 __global__),不被会话 tab 污染
    expect(persisted().tabs?.map((t) => t.url)).toEqual(['https://g1.example.com'])
    live().setConversationScope(null)
    expect(live().tabs.map((t) => t.url)).toEqual(['https://g1.example.com'])
    expect(live().activeTabId).toBe(g1)
  })

  it('同作用域重复切换是 no-op(不会用陈旧归档覆盖活视图)', () => {
    live().setConversationScope('conv-a')
    live().newTab('https://a1.example.com')
    const before = live().tabs
    live().setConversationScope('conv-a')
    // 反向对照:若实装每次调用都重装桶(缺 idempotence 早退),活视图会被清成 [] → 红
    expect(live().tabs).toBe(before)
    expect(live().tabs).toHaveLength(1)
  })

  it('空 tab 会话切走不留桶条目(桶记录不被空会话撑大)', () => {
    live().setConversationScope('conv-empty')
    live().setConversationScope(null)
    expect(live().conversationTabs['conv-empty']).toBeUndefined()
    expect(persisted().conversationTabs && 'conv-empty' in persisted().conversationTabs!).toBe(
      false,
    )
  })

  it('会话全部关完后切走 → 桶移除,回来是空视图', () => {
    live().setConversationScope('conv-a')
    live().newTab('https://a1.example.com')
    live().closeTab(live().tabs[0]!.id)
    live().setConversationScope('conv-b')
    expect(live().conversationTabs['conv-a']).toBeUndefined()
    live().setConversationScope('conv-a')
    expect(live().tabs).toEqual([])
  })
})

describe('D50② 体积上限:LRU 裁剪', () => {
  beforeEach(() => resetStore())

  it('连续切换 25 个会话后持久化桶数封顶 = MAX_CONVERSATION_TAB_BUCKETS,最旧先淘汰', () => {
    for (let i = 0; i < 25; i++) {
      live().setConversationScope(`conv-${i}`)
      live().newTab(`https://c${i}.example.com`)
    }
    const p = persisted()
    const keys = Object.keys(p.conversationTabs ?? {})
    expect(keys.length).toBe(MAX_CONVERSATION_TAB_BUCKETS)
    // 最旧的 conv-0..conv-4 已被淘汰
    for (let i = 0; i < 5; i++) expect(keys).not.toContain(`conv-${i}`)
    // 反向对照:当前会话 conv-24 必须活着(protectKey 判据,若 protect 失效即红)
    expect(keys).toContain('conv-24')
    expect(keys).toContain('conv-23')
    expect(p.conversationTabs?.['conv-24']?.tabs[0]?.url).toBe('https://c24.example.com')
  })

  it('pruneTabBuckets:全局暂存位不占会话名额、永不驱逐;protectKey 同样豁免', () => {
    const buckets: Record<string, WorkPanelTabBucket> = {
      [WORK_PANEL_GLOBAL_BUCKET_KEY]: bucketOf('g', 'https://g.com', 1), // 最旧也不许被删
      c1: bucketOf('t1', 'https://1.com', 10),
      c2: bucketOf('t2', 'https://2.com', 20),
      c3: bucketOf('t3', 'https://3.com', 30),
    }
    const pruned = pruneTabBuckets(buckets, 2, {
      globalKey: WORK_PANEL_GLOBAL_BUCKET_KEY,
      protectKey: 'c2',
    })
    // 会话名额只算 c1/c2/c3 → 淘汰 c1;c2 被 protect(即使比 c1…同分也不动);全局暂存保留
    expect(Object.keys(pruned).sort()).toEqual([WORK_PANEL_GLOBAL_BUCKET_KEY, 'c2', 'c3'])
    // 反向对照:若把全局暂存位计入名额,3 项里会多删一个 → 上面的精确集合断言即红
  })

  it('未超上限不裁剪、且不产生新对象引用(纯函数语义)', () => {
    const buckets: Record<string, WorkPanelTabBucket> = {
      c1: bucketOf('t1', 'https://1.com', 10),
      c2: bucketOf('t2', 'https://2.com', 20),
    }
    expect(pruneTabBuckets(buckets, 20)).toBe(buckets)
  })

  it('内存归档同样受帽:第 26 次切换后 conversationTabs(不含全局暂存)≤ MAX', () => {
    for (let i = 0; i < 26; i++) {
      live().setConversationScope(`conv-${i}`)
      live().newTab(`https://m${i}.example.com`)
    }
    const archived = Object.keys(live().conversationTabs).filter(
      (k) => k !== WORK_PANEL_GLOBAL_BUCKET_KEY,
    )
    expect(archived.length).toBeLessThanOrEqual(MAX_CONVERSATION_TAB_BUCKETS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
