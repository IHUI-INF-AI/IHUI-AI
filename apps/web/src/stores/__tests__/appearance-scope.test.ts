// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it } from 'vitest'

import { APPEARANCE_DEFAULTS } from '../appearance-settings'
import { messageStyleVars, useAppearanceScopeStore } from '../appearance-scope'

beforeEach(() => {
  useAppearanceScopeStore.getState().resetScope()
  useAppearanceScopeStore.setState({ lastSyncedAt: 0, cloudSyncEnabled: false, syncState: 'idle' })
})

describe('工作区外观覆盖', () => {
  it('保存即启用,清除后删除', () => {
    const scope = useAppearanceScopeStore.getState()
    scope.setWorkspaceConfig('g:/demo', { ...APPEARANCE_DEFAULTS, uiScale: 1.2 })
    expect(useAppearanceScopeStore.getState().workspaces['g:/demo']).toEqual({
      enabled: true,
      config: { ...APPEARANCE_DEFAULTS, uiScale: 1.2 },
    })

    scope.setWorkspaceEnabled('g:/demo', false)
    expect(useAppearanceScopeStore.getState().workspaces['g:/demo']?.enabled).toBe(false)

    scope.clearWorkspace('g:/demo')
    expect(useAppearanceScopeStore.getState().workspaces['g:/demo']).toBeUndefined()
  })

  it('对不存在的工作区直接启用时落默认快照', () => {
    useAppearanceScopeStore.getState().setWorkspaceEnabled('g:/new', true)
    expect(useAppearanceScopeStore.getState().workspaces['g:/new']?.config.uiScale).toBe(
      APPEARANCE_DEFAULTS.uiScale,
    )
  })
})

describe('单条消息样式覆盖', () => {
  it('越界值夹紧,未知枚举被忽略', () => {
    const scope = useAppearanceScopeStore.getState()
    scope.setMessageOverride('m1', {
      fontScale: 9,
      codeFontSize: 99,
      textAlign: 'justify',
    })
    expect(useAppearanceScopeStore.getState().messages.m1).toEqual({
      fontScale: 1.6,
      codeFontSize: 22,
      textAlign: 'justify',
    })

    scope.setMessageOverride('m2', { fontFamily: 'unknown' as never })
    expect(useAppearanceScopeStore.getState().messages.m2).toBeUndefined()
  })

  it('clearMessageField 只删一个字段,清空后整条移除', () => {
    const scope = useAppearanceScopeStore.getState()
    scope.setMessageOverride('m1', { fontScale: 1.2, textAlign: 'justify' })
    scope.clearMessageField('m1', 'fontScale')
    expect(useAppearanceScopeStore.getState().messages.m1).toEqual({ textAlign: 'justify' })
    scope.clearMessageField('m1', 'textAlign')
    expect(useAppearanceScopeStore.getState().messages.m1).toBeUndefined()
  })

  it('messageStyleVars 只编译已设置的字段', () => {
    expect(messageStyleVars(undefined)).toEqual({})
    expect(messageStyleVars({ fontScale: 1.2, textAlign: 'justify' })).toEqual({
      '--message-font-multiplier': '1.2',
      '--message-text-align': 'justify',
    })
    expect(messageStyleVars({ fontFamily: 'legibility' })['--message-font-family']).toContain(
      'OpenDyslexic',
    )
  })
})

describe('快照导入导出', () => {
  it('version 不符直接拒绝', () => {
    expect(useAppearanceScopeStore.getState().applySnapshot({ version: 2 })).toBe(false)
  })

  it('往返保留工作区与消息覆盖,坏条目跳过', () => {
    const scope = useAppearanceScopeStore.getState()
    scope.setWorkspaceConfig('g:/demo', { ...APPEARANCE_DEFAULTS, chatFontScale: 1.3 })
    scope.setMessageOverride('m1', { textAlign: 'justify' })
    const snapshot = useAppearanceScopeStore.getState().exportSnapshot()

    useAppearanceScopeStore.getState().resetScope()
    expect(useAppearanceScopeStore.getState().applySnapshot(snapshot)).toBe(true)

    const state = useAppearanceScopeStore.getState()
    expect(state.workspaces['g:/demo']?.config.chatFontScale).toBe(1.3)
    expect(state.messages.m1).toEqual({ textAlign: 'justify' })

    expect(
      state.applySnapshot({
        version: 1,
        workspaces: { bad: null, ok: { enabled: true, config: { uiScale: 1.1 } } },
        messages: { m2: { fontScale: 'x' }, m3: { fontScale: 1.1 } },
      }),
    ).toBe(true)
    expect(useAppearanceScopeStore.getState().workspaces.ok?.config.uiScale).toBe(1.1)
    expect(useAppearanceScopeStore.getState().messages.m2).toBeUndefined()
    expect(useAppearanceScopeStore.getState().messages.m3).toEqual({ fontScale: 1.1 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
