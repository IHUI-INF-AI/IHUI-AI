// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外观配置导入导出(2026-11-15 v4)
 *
 * 覆盖整包版本迁移:
 *   - 导出 = version 3,含 appearance/scope/presets;
 *   - 导入 v3 应用预设,v2 不覆盖本机预设,旧版单配置仍可直接导入。
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAppearanceStore } from '@/stores/appearance-settings'
import { useAppearancePresetsStore } from '@/stores/appearance-presets'
import { useAppearanceScopeStore } from '@/stores/appearance-scope'
import { DataCard } from '../misc-cards'

const appearance = (config: Record<string, unknown>) => ({
  app: 'ihui-ai',
  kind: 'appearance',
  version: 1,
  config,
})

const scope = {
  version: 1,
  workspaces: {},
  messages: {},
  cloudSyncEnabled: false,
  lastSyncedAt: 0,
}

async function importJson(container: HTMLElement, payload: unknown) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([JSON.stringify(payload)], 'ihui-appearance.json', {
    type: 'application/json',
  })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

beforeEach(() => {
  useAppearanceStore.getState().resetAll()
  useAppearancePresetsStore.setState({ presets: [] })
  useAppearanceScopeStore.getState().resetScope()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('DataCard 整包导出', () => {
  it('导出 v3 整包,包含配置、作用域与自定义预设', async () => {
    useAppearanceStore.getState().update({ uiScale: 1.2 })
    useAppearancePresetsStore.getState().addPreset('导出预设', { lineHeight: 'relaxed' })

    let captured: Blob | undefined
    const createObjectURL = vi.fn((blob: Blob) => {
      captured = blob
      return 'blob:test'
    })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<DataCard />)
    fireEvent.click(screen.getByTestId('appearance-export'))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(await captured!.text()) as Record<string, unknown>
    expect(payload.version).toBe(3)
    expect(payload.appearance).toMatchObject({ app: 'ihui-ai', kind: 'appearance' })
    expect(payload.scope).toMatchObject({ version: 1 })
    expect(payload.presets).toEqual([
      expect.objectContaining({ name: '导出预设', overrides: { lineHeight: 'relaxed' } }),
    ])
  })
})

describe('DataCard 导入兼容', () => {
  it('v3 整包同时应用配置与预设', async () => {
    const { container } = render(<DataCard />)
    await importJson(container, {
      version: 3,
      appearance: appearance({ uiScale: 1.25, lineHeight: 'relaxed' }),
      scope,
      presets: [{ id: 'imported', name: '导入预设', overrides: { uiScale: 1.25 }, createdAt: 1 }],
    })

    await waitFor(() => expect(useAppearanceStore.getState().uiScale).toBe(1.25))
    expect(useAppearanceStore.getState().lineHeight).toBe('relaxed')
    expect(useAppearancePresetsStore.getState().presets).toEqual([
      expect.objectContaining({ id: 'imported', name: '导入预设' }),
    ])
  })

  it('v2 整包应用配置,但保留本机已有预设', async () => {
    useAppearancePresetsStore.getState().addPreset('本机预设', { uiScale: 1.05 })

    const { container } = render(<DataCard />)
    await importJson(container, {
      version: 2,
      appearance: appearance({ chatFontScale: 1.2 }),
      scope,
    })

    await waitFor(() => expect(useAppearanceStore.getState().chatFontScale).toBe(1.2))
    expect(useAppearancePresetsStore.getState().presets.map((preset) => preset.name)).toEqual([
      '本机预设',
    ])
  })

  it('旧版单配置 JSON 仍可导入', async () => {
    const { container } = render(<DataCard />)
    await importJson(container, { uiScale: 1.3, bionicReading: true })

    await waitFor(() => expect(useAppearanceStore.getState().uiScale).toBe(1.3))
    expect(useAppearanceStore.getState().bionicReading).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
