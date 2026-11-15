// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 无障碍卡片的本机字体提示(2026-11-15 v4)
 *
 * 关键回归:document.fonts.check 对不存在的字体也返回 true,必须走 FontFace + local()。
 * 这里用替身 FontFace 覆盖"缺失/已安装"两条分支,不依赖真机字体。
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAppearanceStore } from '@/stores/appearance-settings'
import { AccessibilityCard } from '../misc-cards'

class MissingFontFace {
  constructor(
    public family: string,
    public source: string,
  ) {}
  load(): Promise<MissingFontFace> {
    return Promise.reject(new Error('font not installed'))
  }
}

class PresentFontFace extends MissingFontFace {
  override load(): Promise<PresentFontFace> {
    return Promise.resolve(this)
  }
}

beforeEach(() => {
  useAppearanceStore.getState().resetAll()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function toggleLegibility() {
  const wrapper = screen.getByTestId('appearance-legibility-font')
  const toggle = wrapper.querySelector('[role="switch"]')
  if (!toggle) throw new Error('legibility switch not found')
  fireEvent.click(toggle)
}

describe('AccessibilityCard 阅读障碍字体提示', () => {
  it('本机未安装 OpenDyslexic 时提示使用内置 Lexend', async () => {
    vi.stubGlobal('FontFace', MissingFontFace)
    render(<AccessibilityCard />)

    toggleLegibility()

    const status = await screen.findByTestId('appearance-legibility-status')
    expect(status.textContent).toBe('legibilityFontFallback')
  })

  it('本机已安装 OpenDyslexic 时提示优先使用本机字体', async () => {
    vi.stubGlobal('FontFace', PresentFontFace)
    render(<AccessibilityCard />)

    toggleLegibility()

    const status = await screen.findByTestId('appearance-legibility-status')
    expect(status.textContent).toBe('legibilityFontDetected')
  })

  it('关闭开关后提示消失', async () => {
    vi.stubGlobal('FontFace', MissingFontFace)
    render(<AccessibilityCard />)

    toggleLegibility()
    await screen.findByTestId('appearance-legibility-status')

    toggleLegibility()
    await waitFor(() => expect(screen.queryByTestId('appearance-legibility-status')).toBeNull())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
