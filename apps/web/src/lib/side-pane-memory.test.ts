// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SIDE_PANE_DRAFT_OWNER_KEY,
  buildSidePaneMemoryKey,
  getSidePaneCollapsedPreference,
  getSidePaneMemoryOldestKeyForTests,
  getSidePaneMemorySizeForTests,
  normalizeSidePaneMemoryState,
  readSidePaneMemoryState,
  resetSidePaneMemoryForTests,
  saveSidePaneCollapsedPreference,
  saveSidePaneMemoryState,
  setSidePaneMemoryRawForTests,
} from './side-pane-memory'

/**
 * 辅助面板记忆 按 workspace 键控 + LRU 上限 单测(2026-09-30,票 G-977985)。
 *
 * 锁定四条不变量:
 *  1. 同 workspace 切会话:辅助面板状态保留(键不含会话 id)
 *  2. 切换 60 个 workspace 后 Map 尺寸 ≤50 且最旧被逐出
 *  3. 折叠偏好按 owner 分桶且 draft 归一 `__draft__`
 *  4. 旧字段读取 normalize(旧单地址迁移、未知键丢弃、缺省回落)
 */

const WS = { workspacePath: 'G:/ws/a' }
const WS_REMOTE = { workspacePath: 'G:/ws/a', workspaceIdentity: 'remote:host:1' }

beforeEach(() => {
  resetSidePaneMemoryForTests()
})

describe('键控:只按工作区身份,不含会话 id', () => {
  it('同 workspace 切会话:辅助面板状态保留', () => {
    const keyA = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-1' })
    saveSidePaneMemoryState(keyA, { paneState: { browserTab: 'https://example.com' } })

    // 切到同工作区的另一个会话:键相同 → 命中同一份记忆
    const keyB = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-2' })
    expect(keyB).toBe(keyA)
    const state = readSidePaneMemoryState(keyB)
    expect(state.paneState).toEqual({ browserTab: 'https://example.com' })
  })

  it('不同 workspace 身份互不串用(本地同路径 vs 远程身份)', () => {
    const localKey = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-1' })
    const remoteKey = buildSidePaneMemoryKey({ ...WS_REMOTE, sessionId: 'sess-1' })
    expect(remoteKey).not.toBe(localKey)
    saveSidePaneMemoryState(remoteKey, { isPaneCollapsed: false })
    expect(readSidePaneMemoryState(localKey).isPaneCollapsed).toBe(true)
    expect(readSidePaneMemoryState(remoteKey).isPaneCollapsed).toBe(false)
  })

  it('空工作区键返回 null(调用方按无键处理)', () => {
    expect(buildSidePaneMemoryKey({ workspacePath: '  ', sessionId: 's1' })).toBeNull()
  })
})

describe('LRU 50 上限', () => {
  it('切换 60 个 workspace 后 Map 尺寸 ≤50 且最旧被逐出', () => {
    const keys = Array.from({ length: 60 }, (_, index) =>
      buildSidePaneMemoryKey({ workspacePath: `G:/ws-${index}`, sessionId: null })!,
    )
    for (const [index, key] of keys.entries()) {
      saveSidePaneMemoryState(key, { paneState: { index } })
    }
    expect(getSidePaneMemorySizeForTests()).toBe(50)
    // 最旧(ws-0)被逐出;最新(ws-59)保留
    expect(readSidePaneMemoryState(keys[0]!).paneState).toBeNull()
    expect(readSidePaneMemoryState(keys[59]!).paneState).toEqual({ index: 59 })
    expect(getSidePaneMemoryOldestKeyForTests()).toBe(keys[10])
  })

  it('读取会 touch LRU:最近读过的键不会先被逐出', () => {
    const keys = Array.from({ length: 50 }, (_, index) =>
      buildSidePaneMemoryKey({ workspacePath: `G:/ws-${index}`, sessionId: null })!,
    )
    for (const key of keys) {
      saveSidePaneMemoryState(key, { isPaneCollapsed: false })
    }
    // touch 最旧键,再写入一个新键:keys[1] 被逐出,刚 touch 过的 keys[0] 仍在
    readSidePaneMemoryState(keys[0]!)
    saveSidePaneMemoryState('G:/ws-new', {})
    expect(getSidePaneMemorySizeForTests()).toBe(50)
    expect(getSidePaneMemoryOldestKeyForTests()).toBe(keys[2])
    expect(readSidePaneMemoryState(keys[0]!).isPaneCollapsed).toBe(false)
    expect(readSidePaneMemoryState(keys[1]!).paneState).toBeNull()
  })
})

describe('对话级折叠偏好分桶', () => {
  it('按 owner 会话分桶;draft(null)归一 `__draft__`', () => {
    const key = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-1' })
    saveSidePaneCollapsedPreference(key, 'sess-1', false)
    saveSidePaneCollapsedPreference(key, null, true)

    const state = readSidePaneMemoryState(key)
    expect(getSidePaneCollapsedPreference(state, 'sess-1')).toBe(false)
    expect(getSidePaneCollapsedPreference(state, null)).toBe(true)
    // 未写过的 owner 桶为 undefined,回落 UI 默认
    expect(getSidePaneCollapsedPreference(state, 'sess-other')).toBeUndefined()
    // 桶键确实是草稿键
    expect(SIDE_PANE_DRAFT_OWNER_KEY).toBe('__draft__')
    expect(state.isPaneCollapsed).toBe(true)
  })

  it('不同工作区的同 owner 桶互不影响', () => {
    const keyA = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-1' })
    const keyB = buildSidePaneMemoryKey({ workspacePath: 'G:/ws/b', sessionId: 'sess-1' })
    saveSidePaneCollapsedPreference(keyA, 'sess-1', false)
    saveSidePaneCollapsedPreference(keyB, 'sess-1', true)
    expect(getSidePaneCollapsedPreference(readSidePaneMemoryState(keyA), 'sess-1')).toBe(false)
    expect(getSidePaneCollapsedPreference(readSidePaneMemoryState(keyB), 'sess-1')).toBe(true)
  })
})

describe('旧字段读取 normalize', () => {
  it('旧版单地址字段 viewerUrl 迁移进 viewerUrls.primary', () => {
    const key = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-1' })
    setSidePaneMemoryRawForTests(key!, { viewerUrl: 'https://legacy.example.com' })
    const state = readSidePaneMemoryState(key)
    expect(state.viewerUrls).toEqual({ primary: 'https://legacy.example.com' })
  })

  it('未知键丢弃、类型不符回落默认', () => {
    const normalized = normalizeSidePaneMemoryState({
      isPaneCollapsed: 'yes',
      collapsedByOwner: { a: false, bad: 'nope' },
      viewerUrls: { tab1: 'https://a', bad: 3 },
      junk: { deep: true },
    })
    expect(normalized.isPaneCollapsed).toBe(true) // 类型不符回落默认
    expect(normalized.collapsedByOwner).toEqual({ a: false }) // 非布尔丢弃
    expect(normalized.viewerUrls).toEqual({ tab1: 'https://a' })
    expect((normalized as unknown as Record<string, unknown>).junk).toBeUndefined()
  })

  it('viewerUrls 已有内容时旧字段不再迁移(新结构优先)', () => {
    const normalized = normalizeSidePaneMemoryState({
      viewerUrl: 'https://legacy',
      viewerUrls: { tab1: 'https://current' },
    })
    expect(normalized.viewerUrls).toEqual({ tab1: 'https://current' })
  })

  it('写路径同样 normalize:patch 合并后按新形状落库', () => {
    const key = buildSidePaneMemoryKey({ ...WS, sessionId: 'sess-1' })
    saveSidePaneMemoryState(key, { isPaneCollapsed: false, viewerUrls: { tab1: 'https://x' } })
    saveSidePaneMemoryState(key, { viewerUrls: { tab2: 'https://y' } })
    const state = readSidePaneMemoryState(key)
    expect(state.isPaneCollapsed).toBe(false)
    expect(state.viewerUrls).toEqual({ tab1: 'https://x', tab2: 'https://y' })
  })

  it('无键读写都是安全空操作/默认值', () => {
    expect(readSidePaneMemoryState(null)).toEqual({
      paneState: null,
      isPaneCollapsed: true,
      collapsedByOwner: {},
      viewerUrls: {},
    })
    expect(() => saveSidePaneMemoryState(null, { isPaneCollapsed: false })).not.toThrow()
    expect(() => saveSidePaneCollapsedPreference(null, 's1', false)).not.toThrow()
    expect(getSidePaneMemorySizeForTests()).toBe(0)
  })
})
