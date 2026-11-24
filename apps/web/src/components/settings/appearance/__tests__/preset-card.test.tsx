// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 预设卡片(2026-11-15 v4)
 *
 * 只验证「卡片 → store」这一段:内置预设落配置、保存当前为自定义预设、删除。
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAppearanceStore } from '@/stores/appearance-settings'
import { useAppearancePresetsStore } from '@/stores/appearance-presets'
import { PresetCard } from '../preset-card'

beforeEach(() => {
  useAppearanceStore.getState().resetAll()
  useAppearancePresetsStore.setState({ presets: [] })
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PresetCard', () => {
  it('点击内置阅读预设即写入全局配置', () => {
    render(<PresetCard />)
    fireEvent.click(screen.getByTestId('appearance-preset-apply-reading'))
    const state = useAppearanceStore.getState()
    expect(state.fontFamily).toBe('serif')
    expect(state.lineHeight).toBe('relaxed')
  })

  it('保存当前设置为自定义预设,应用后恢复该快照', () => {
    render(<PresetCard />)
    fireEvent.click(screen.getByTestId('appearance-preset-apply-focus'))
    const focusContentWidth = useAppearanceStore.getState().contentWidth

    fireEvent.change(screen.getByTestId('appearance-preset-name'), {
      target: { value: '专注快照' },
    })
    fireEvent.click(screen.getByTestId('appearance-preset-save'))

    const presets = useAppearancePresetsStore.getState().presets
    expect(presets).toHaveLength(1)
    expect(presets[0]?.name).toBe('专注快照')

    useAppearanceStore.getState().resetAll()
    fireEvent.click(screen.getByTestId(`appearance-preset-apply-custom-${presets[0]!.id}`))
    expect(useAppearanceStore.getState().contentWidth).toBe(focusContentWidth)
    expect(useAppearanceStore.getState().showToolCalls).toBe(false)
  })

  it('确认后删除自定义预设', () => {
    useAppearancePresetsStore.getState().addPreset('待删除', { uiScale: 1.1 })
    const preset = useAppearancePresetsStore.getState().presets[0]!

    render(<PresetCard />)
    fireEvent.click(screen.getByTestId(`appearance-preset-delete-${preset.id}`))
    expect(useAppearancePresetsStore.getState().presets).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
