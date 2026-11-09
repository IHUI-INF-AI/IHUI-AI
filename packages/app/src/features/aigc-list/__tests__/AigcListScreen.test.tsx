// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AigcListScreen, type AigcListItem, type AigcListScreenProps } from '../AigcListScreen'

/**
 * AigcListScreen 音频端口 — 缺省必须走 capability-off(显式失败提示),
 * 注入后必须把音频地址交给宿主端口,不允许 noop 冒充播放成功。
 */
const t = (key: string): string => key

const AUDIO_URL = 'https://cdn.example.com/audio.mp3'

const audioItem: AigcListItem = {
  id: 'aigc-audio-1',
  title: '音频作品',
  fileType: 3,
  createdAt: '2026-11-02',
  audioUrl: AUDIO_URL,
  coverUrl: 'https://cdn.example.com/cover.png',
  duration: '00:12',
}

function renderScreen(overrides: Partial<AigcListScreenProps> = {}) {
  const onToast = vi.fn()
  const onPressItem = vi.fn()
  const props: AigcListScreenProps = {
    t,
    items: [audioItem],
    categories: [{ key: 'all', label: '全部' }],
    category: 'all',
    loading: false,
    refreshing: false,
    error: '',
    onSelectCategory: vi.fn(),
    onRefresh: vi.fn(),
    onPressItem,
    onPublish: vi.fn(),
    onBack: vi.fn(),
    onToast,
    ...overrides,
  }
  // 守门 theme-prop-wiring：渲染点显式接线，用变量不写字面量。
  const testColorScheme: 'light' | 'dark' = 'light'
  const { container } = render(<AigcListScreen {...props} colorScheme={testColorScheme} />)
  return { onToast, onPressItem, container }
}

describe('AigcListScreen 音频端口', () => {
  it('未注入 audio ⇒ capability-off:点播放显式失败,不静默假成功', () => {
    const { onToast, onPressItem } = renderScreen()
    fireEvent.click(screen.getByText('aigcList.playAudio'))
    expect(onToast).toHaveBeenCalledWith('common.failed')
    expect(onPressItem).not.toHaveBeenCalled()
    cleanup()
  })

  it('注入 audio ⇒ 点播放把音频地址交给端口', () => {
    const play = vi.fn()
    const { onToast } = renderScreen({ audio: { play, pause: vi.fn(), stop: vi.fn() } })
    fireEvent.click(screen.getByText('aigcList.playAudio'))
    expect(play).toHaveBeenCalledWith(AUDIO_URL)
    expect(onToast).not.toHaveBeenCalled()
    cleanup()
  })
})

describe('AigcListScreen 轮播可选端口', () => {
  it('未注入 carousel ⇒ 不渲染轮播(缺省关闭)', () => {
    const { container } = renderScreen()
    expect(container.querySelector('[testid="aigc-list-carousel"]')).toBeNull()
    cleanup()
  })

  it('注入 carousel ⇒ 共享屏渲染卡片,点击回调带回条目', () => {
    const onPress = vi.fn()
    const { container } = renderScreen({ carousel: { items: [audioItem], onPress } })
    expect(container.querySelector('[testid="aigc-list-carousel"]')).toBeTruthy()
    fireEvent.click(container.querySelector('[testid="aigc-carousel-aigc-audio-1"]')!)
    expect(onPress).toHaveBeenCalledWith(audioItem)
    cleanup()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
