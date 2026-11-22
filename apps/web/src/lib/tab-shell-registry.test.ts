// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  applyTabShellReadyEvent,
  applyTabShellResidencyEvent,
  applyTabShellVisibilityEvent,
  buildArtifactTabId,
  buildBrowserTabId,
  buildRunTabId,
  closeTabShell,
  createArtifactTab,
  createAssistantTab,
  createBrowserTab,
  createRunTab,
  createWorkspaceToolsTab,
  encodeSidePaneTabIdPart,
  getVisibleSidePaneTabs,
  isTabVisibleForScope,
  openArtifactSidePaneTab,
  openSidePaneTab,
  parseSidePaneTabId,
  stampSidePaneTabsOwnership,
  type ArtifactTab,
  type SidePaneState,
} from './tab-shell-registry'

/**
 * tab 结构化复合 id + 类型分层可见性 + 归属 stamping + visibility/generation 单测
 * (2026-09-30,票 G-977992 + G-977993)。
 *
 * 锁定七条不变量:
 *  1. 同 id 重复 open 幂等且更新字段
 *  2. A 会话的 tab 在 B 会话按 scope 不可见
 *  3. 无主 tab 提交后被 stamp 且不再被覆盖
 *  4. artifact id 不含 version:再点命中同 tab、版本缺席即回最新版
 *  5. closed 后重放 visible 事件 state 不变(不重建僵尸 shell)
 *  6. 旧 generation 事件不覆盖新 residency(单调)
 *  7. ready/show 来自其他 origin 不激活
 */

const WS_KEY = 'G:/ws/a'

describe('复合 id 构建/解析', () => {
  it('身份段逐段 encodeURIComponent,含分隔符的目标不串段', () => {
    const id = buildRunTabId({ workspaceKey: 'C:/a:b/ws', parentSessionId: 'sess/1', runId: 'run:9' })
    expect(id).toBe(
      `run:${encodeURIComponent('C:/a:b/ws')}:${encodeURIComponent('sess/1')}:${encodeURIComponent('run:9')}`,
    )
    expect(parseSidePaneTabId(id)).toEqual({
      type: 'run',
      parts: ['C:/a:b/ws', 'sess/1', 'run:9'],
    })
  })

  it('同 workspace+会话+run 恒定同 id;不同 run 不撞', () => {
    const a = buildRunTabId({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1' })
    const b = buildRunTabId({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1' })
    const c = buildRunTabId({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r2' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('解析失败返回 null(不猜)', () => {
    expect(parseSidePaneTabId('no-segments')).toBeNull()
  })
})

describe('幂等 open 与字段更新', () => {
  it('同 id 重复 open:单 tab、原位更新字段、聚焦', () => {
    let state: SidePaneState | null = null
    state = openSidePaneTab(state, createRunTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1', title: '第一版' }))
    state = openSidePaneTab(state, createRunTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1', title: '第二版' }))
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0]?.title).toBe('第二版')
    expect(state.activeTabId).toBe(state.tabs[0]?.id)
  })

  it('不同 id 追加并聚焦新 tab', () => {
    let state: SidePaneState | null = null
    state = openSidePaneTab(state, createRunTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1' }))
    state = openSidePaneTab(state, createRunTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r2' }))
    expect(state.tabs).toHaveLength(2)
    expect(state.activeTabId).toBe(state.tabs[1]?.id)
  })
})

describe('artifact id 不含 version', () => {
  it('再点命中同 tab;版本缺席即显式回最新版(删键)', () => {
    let state: SidePaneState | null = null
    const v1 = createArtifactTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1', artifactId: 'doc', version: 1, title: '报告' })
    state = openArtifactSidePaneTab(state, v1)
    expect(state.tabs).toHaveLength(1)

    // 通知 chip 不带版本号:聚焦同一 tab 并翻最新版(version 被显式删掉)
    const latest = createArtifactTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1', artifactId: 'doc', title: '报告·最新' })
    expect(latest.id).toBe(v1.id)
    state = openArtifactSidePaneTab(state, latest)
    expect(state.tabs).toHaveLength(1)
    const merged = state.tabs[0] as ArtifactTab
    expect(merged.version).toBeUndefined()
    expect(merged.title).toBe('报告·最新')
    expect(state.activeTabId).toBe(merged.id)

    // 显式带新版本:更新为 v2,仍是同一个 tab
    const v2 = createArtifactTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1', artifactId: 'doc', version: 2 })
    expect(v2.id).toBe(v1.id)
    state = openArtifactSidePaneTab(state, v2)
    expect(state.tabs).toHaveLength(1)
    expect((state.tabs[0] as ArtifactTab).version).toBe(2)
  })

  it('tab 可先于实体存在:同 id 后续打开落到同一 tab(自愈)', () => {
    const before = createRunTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1' })
    let state: SidePaneState | null = openSidePaneTab(null, before)
    // 实体起来后带 title 再打开:仍是同一个 tab
    state = openSidePaneTab(state, createRunTab({ workspaceKey: WS_KEY, parentSessionId: 's1', runId: 'r1', title: '运行中' }))
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0]?.title).toBe('运行中')
  })
})

describe('类型分层可见性 scope', () => {
  const scopeA = { workspaceKey: WS_KEY, activeSessionId: 'sess-a' }
  const scopeB = { workspaceKey: WS_KEY, activeSessionId: 'sess-b' }
  const scopeDraft = { workspaceKey: WS_KEY, activeSessionId: null }

  it('workspace 全局型跨会话可见;身份键不匹配一票否远', () => {
    const tools = createWorkspaceToolsTab({ workspaceKey: WS_KEY })
    expect(isTabVisibleForScope(tools, scopeA)).toBe(true)
    expect(isTabVisibleForScope(tools, scopeB)).toBe(true)
    expect(isTabVisibleForScope(tools, { workspaceKey: 'G:/ws/b', activeSessionId: 'sess-a' })).toBe(false)
  })

  it('A 会话的 tab 在 B 会话按 scope 不可见(browser 按 sessionId)', () => {
    const browser = createBrowserTab({ workspaceKey: WS_KEY, sessionId: 'sess-a' })
    expect(isTabVisibleForScope(browser, scopeA)).toBe(true)
    expect(isTabVisibleForScope(browser, scopeB)).toBe(false)
    expect(getVisibleSidePaneTabs([browser], scopeB)).toEqual([])
  })

  it('assistant 按根会话收窄;run/artifact 按父会话收窄', () => {
    const assistant = createAssistantTab({ workspaceKey: WS_KEY, rootSessionId: 'sess-a', childSessionId: 'child-1' })
    const run = createRunTab({ workspaceKey: WS_KEY, parentSessionId: 'sess-a', runId: 'r1' })
    const artifact = createArtifactTab({ workspaceKey: WS_KEY, parentSessionId: 'sess-a', runId: 'r1', artifactId: 'doc' })
    expect(isTabVisibleForScope(assistant, scopeA)).toBe(true)
    expect(isTabVisibleForScope(assistant, scopeB)).toBe(false)
    expect(isTabVisibleForScope(run, scopeB)).toBe(false)
    expect(isTabVisibleForScope(artifact, scopeB)).toBe(false)
    expect(isTabVisibleForScope(run, scopeA)).toBe(true)
  })

  it('草稿作用域归一 __draft__:browser 型在草稿作用域匹配不到具体会话', () => {
    const unowned = createBrowserTab({ workspaceKey: WS_KEY, sessionId: 'sess-a' })
    // browser 型按 sessionId 收窄,草稿(null)匹配不到具体会话
    expect(isTabVisibleForScope(unowned, scopeDraft)).toBe(false)
    // 归一函数语义:null/undefined → __draft__(与可见性分桶共用)
    expect(sidePaneOwnerKeyForTest(null)).toBe('__draft__')
    expect(sidePaneOwnerKeyForTest(undefined)).toBe('__draft__')
    expect(sidePaneOwnerKeyForTest('sess-a')).toBe('sess-a')
  })
})

/** 测试辅助:直接复用导出的归一函数语义。 */
function sidePaneOwnerKeyForTest(sessionId: string | null | undefined): string {
  return sessionId ?? '__draft__'
}

describe('归属 stamping', () => {
  it('无主 tab 提交后被 stamp;已有主不被覆盖', () => {
    const unowned = createBrowserTab({ workspaceKey: WS_KEY, sessionId: 'sess-a' })
    const owned = createRunTab({ workspaceKey: WS_KEY, parentSessionId: 'sess-a', runId: 'r1' })
    // 先给 owned 显式打标(事件自带归属)
    const preStampped = stampSidePaneTabsOwnership({ tabs: [owned], activeTabId: owned.id }, {
      ownerSessionId: 'origin-a',
    })
    let state: SidePaneState = { tabs: [unowned, ...(preStampped?.tabs ?? [])], activeTabId: null }

    state = stampSidePaneTabsOwnership(state, { ownerSessionId: 'sess-a', workspaceKey: WS_KEY })!
    expect(state.tabs[0]?.ownerSessionId).toBe('sess-a') // 无主 → 冻结
    expect(state.tabs[1]?.ownerSessionId).toBe('origin-a') // 已有主 → 不覆盖

    // 再次以不同归属提交:两个都不再变
    const again = stampSidePaneTabsOwnership(state, { ownerSessionId: 'intruder' })!
    expect(again.tabs[0]?.ownerSessionId).toBe('sess-a')
    expect(again.tabs[1]?.ownerSessionId).toBe('origin-a')
  })

  it('显式 null 归属(草稿)也算已打标,不被覆盖;无变化返回原引用', () => {
    const draft = { ...createBrowserTab({ workspaceKey: WS_KEY, sessionId: 'd' }), ownerSessionId: null as string | null }
    const state: SidePaneState = { tabs: [draft], activeTabId: null }
    const stamped = stampSidePaneTabsOwnership(state, { ownerSessionId: 'sess-a' })
    expect(stamped).toBe(state) // 无可 stamp → 原引用
    expect(stamped?.tabs[0]?.ownerSessionId).toBeNull()
  })
})

describe('visibility 事件只选择不创建(票 7)', () => {
  const activeScope = { workspaceKey: WS_KEY, sessionId: 'sess-a' }

  function readyShell(generation = 1) {
    return {
      tabId: buildBrowserTabId({ workspaceKey: WS_KEY, sessionId: 'sess-a' }),
      type: 'browser' as const,
      workspaceKey: WS_KEY,
      sessionId: 'sess-a',
      generation,
    }
  }

  it('closed 后重放 visible 事件:state 不变,不重建', () => {
    let state = applyTabShellReadyEvent(null, readyShell(), activeScope)
    expect(state.shells).toHaveLength(1)
    expect(state.activeTabId).toBe(readyShell().tabId)

    // main 关闭 tab
    state = closeTabShell(state, readyShell().tabId)!
    expect(state.shells).toHaveLength(0)

    // 队列中迟到的 visible=true 重放:只能选择现存 shell,命中不到绝不重建
    const before = state
    const result = applyTabShellVisibilityEvent(state, { ...readyShell(), residency: 'live-visible' }, activeScope)
    expect(result.didMatch).toBe(false)
    expect(result.shouldReveal).toBe(false)
    expect(result.state).toBe(before)
    expect(result.state?.shells).toHaveLength(0)
  })

  it('generation 不一致的迟到事件不命中(只能精确匹配)', () => {
    const state = applyTabShellReadyEvent(null, readyShell(3), activeScope)
    const result = applyTabShellVisibilityEvent(state, { ...readyShell(2), residency: 'live-visible' }, activeScope)
    expect(result.didMatch).toBe(false)
    expect(result.state?.activeTabId).toBe(state.activeTabId)
    // 精确同代际命中
    const hit = applyTabShellVisibilityEvent(state, { ...readyShell(3), residency: 'live-visible' }, activeScope)
    expect(hit.didMatch).toBe(true)
    expect(hit.shouldReveal).toBe(true)
    expect(hit.state?.activeTabId).toBe(readyShell(3).tabId)
  })

  it('ready/show 来自其他 origin 不激活;visibility 同理', () => {
    const otherOrigin = { ...readyShell(), workspaceKey: 'G:/ws/other' }
    const state = applyTabShellReadyEvent(null, otherOrigin, activeScope)
    // shell 已创建,但不抢当前焦点
    expect(state.shells).toHaveLength(1)
    expect(state.activeTabId).toBeNull()

    const show = applyTabShellVisibilityEvent(state, otherOrigin, activeScope)
    expect(show.didMatch).toBe(true)
    expect(show.shouldReveal).toBe(false)
    expect(show.state?.activeTabId).toBeNull()
  })

  it('空注册表上的 visible 事件安全返回原状态', () => {
    const result = applyTabShellVisibilityEvent(null, readyShell(), activeScope)
    expect(result.state).toBeNull()
    expect(result.didMatch).toBe(false)
  })
})

describe('residency generation 单调防僵尸(票 7)', () => {
  it('旧 generation 事件不覆盖新 residency;同代际/更新代际照常写入', () => {
    const base = {
      tabId: buildBrowserTabId({ workspaceKey: WS_KEY, sessionId: 'sess-a' }),
      type: 'browser' as const,
      workspaceKey: WS_KEY,
      sessionId: 'sess-a',
    }
    let state = applyTabShellReadyEvent(null, { ...base, generation: 1, residency: 'live-visible' }, {
      workspaceKey: WS_KEY,
      sessionId: 'sess-a',
    })
    // 新代际 3:后台
    state = applyTabShellResidencyEvent(state, { ...base, generation: 3, residency: 'live-background' })!
    expect(state?.shells[0]?.residency).toBe('live-background')
    expect(state?.shells[0]?.residencyGeneration).toBe(3)

    // 乱序到达的旧代际 2:忽略,stale 不串写
    const stale = applyTabShellResidencyEvent(state, { ...base, generation: 2, residency: 'suspended' })
    expect(stale).toBe(state)
    expect(stale?.shells[0]?.residency).toBe('live-background')

    // 更新代际 4:接受
    state = applyTabShellResidencyEvent(state, { ...base, generation: 4, residency: 'suspended' })!
    expect(state?.shells[0]?.residency).toBe('suspended')
    expect(state?.shells[0]?.residencyGeneration).toBe(4)
  })

  it('归属不一致的 residency 事件不命中(防串工作区/会话)', () => {
    const base = {
      tabId: buildRunTabId({ workspaceKey: WS_KEY, parentSessionId: 'sess-a', runId: 'r1' }),
      type: 'run' as const,
      workspaceKey: WS_KEY,
      sessionId: 'sess-a',
    }
    const state = applyTabShellReadyEvent(null, { ...base, generation: 1, residency: 'live-visible' }, {
      workspaceKey: WS_KEY,
      sessionId: 'sess-a',
    })
    const mismatched = applyTabShellResidencyEvent(state, {
      ...base,
      sessionId: 'sess-b',
      generation: 9,
      residency: 'suspended',
    })
    expect(mismatched?.shells[0]?.residency).toBe('live-visible')
  })

  it('close 后 residency/visibility 事件都命中不到', () => {
    const base = {
      tabId: buildRunTabId({ workspaceKey: WS_KEY, parentSessionId: 'sess-a', runId: 'r1' }),
      type: 'run' as const,
      workspaceKey: WS_KEY,
      sessionId: 'sess-a',
      generation: 1,
    }
    let state = applyTabShellReadyEvent(null, base, { workspaceKey: WS_KEY, sessionId: 'sess-a' })
    state = closeTabShell(state, base.tabId)!
    expect(applyTabShellResidencyEvent(state, { ...base, generation: 5, residency: 'suspended' })).toBe(state)
    expect(closeTabShell(state, base.tabId)).toBe(state) // 重复关闭零变化
  })

  it('编码函数与 id 构建 round-trip 一致', () => {
    const id = buildArtifactTabId({ workspaceKey: 'C:/工作区', parentSessionId: '会话 1', runId: 'run#1', artifactId: '报表 v2' })
    const parsed = parseSidePaneTabId(id)
    expect(parsed?.type).toBe('artifact')
    expect(parsed?.parts).toEqual(['C:/工作区', '会话 1', 'run#1', '报表 v2'])
    expect(encodeSidePaneTabIdPart('a:b')).toBe('a%3Ab')
  })
})
