// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外观作用域优先级(2026-11-15 v3)
 *
 * 判据:全局外观 < 工作区覆盖;工作区关闭时回到全局;
 * 快照缺字段时按字段回退到当前全局值(而不是 undefined / 出厂值)。
 */

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useResolvedAppearanceConfig } from '../use-resolved-appearance'
import { getAppearanceConfig, useAppearanceStore } from '@/stores/appearance-settings'
import { useAppearanceScopeStore } from '@/stores/appearance-scope'
import { useAiPanelStore } from '@/stores/ai-panel'

const WORKSPACE = { path: 'g:/demo-ws', name: 'demo-ws' }

describe('useResolvedAppearanceConfig', () => {
  beforeEach(() => {
    useAppearanceStore.setState({ chatFontScale: 1, textAlign: 'left' })
    useAppearanceScopeStore.setState({ workspaces: {}, messages: {} })
    useAiPanelStore.setState({ activeWorkspace: null })
  })
  afterEach(() => {
    useAiPanelStore.setState({ activeWorkspace: null })
    useAppearanceScopeStore.setState({ workspaces: {}, messages: {} })
  })

  it('无工作区时返回全局配置', () => {
    useAppearanceStore.setState({ chatFontScale: 1.2 })
    const { result } = renderHook(() => useResolvedAppearanceConfig())
    expect(result.current.chatFontScale).toBe(1.2)
  })

  it('工作区启用后覆盖优先于全局', () => {
    useAppearanceStore.setState({ chatFontScale: 1.2 })
    useAiPanelStore.setState({ activeWorkspace: WORKSPACE })
    useAppearanceScopeStore
      .getState()
      .setWorkspaceConfig(WORKSPACE.path, { ...getAppearanceConfig(), chatFontScale: 1.5 })

    const { result } = renderHook(() => useResolvedAppearanceConfig())
    expect(result.current.chatFontScale).toBe(1.5)
  })

  it('工作区关闭后回落到全局', () => {
    useAppearanceStore.setState({ chatFontScale: 1.2 })
    useAiPanelStore.setState({ activeWorkspace: WORKSPACE })
    useAppearanceScopeStore
      .getState()
      .setWorkspaceConfig(WORKSPACE.path, { ...getAppearanceConfig(), chatFontScale: 1.5 })
    useAppearanceScopeStore.getState().setWorkspaceEnabled(WORKSPACE.path, false)

    const { result } = renderHook(() => useResolvedAppearanceConfig())
    expect(result.current.chatFontScale).toBe(1.2)
  })

  it('快照缺字段时按字段回退到当前全局值', () => {
    useAppearanceStore.setState({ chatFontScale: 1.2, textAlign: 'justify' })
    useAiPanelStore.setState({ activeWorkspace: WORKSPACE })
    // 模拟旧版本/损坏快照:只有 chatFontScale,没有 textAlign
    useAppearanceScopeStore.setState({
      workspaces: {
        [WORKSPACE.path]: {
          enabled: true,
          config: { chatFontScale: 1.5 } as never,
        },
      },
    })

    const { result } = renderHook(() => useResolvedAppearanceConfig())
    expect(result.current.chatFontScale).toBe(1.5)
    expect(result.current.textAlign).toBe('justify')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
