// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D62(G-76)装车回归:VoiceSubtitleBar 必须在**生产宿主树**里真实渲染。
//
// 此前该组件仅被自身测试 import,生产零渲染 ⇒ "播报期间字幕可见 / 静音并显示
// 字幕 / 录音纪要 × 播报互斥"这些票面语义在界面上拿不到。本文件从宿主
// VoiceToolbar(message-input.tsx 真实渲染的语音入口)出发,用真实音频元素的
// 媒体事件驱动 speaking/muted,用真实录音栈的 recording 态驱动互斥提示 ——
// 断言的是"宿主真调了",不是组件自证。
//
// 音频观测口径:voice-toolbar 在 window 捕获阶段监听 HTMLAudioElement 的
// play/playing/pause/ended —— 用例把 audio 挂进 document 后 dispatch 事件即可
// 走同一条链,不需要真实解码播声。

import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VoiceToolbar } from '../voice-toolbar'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@ihui/api-client', () => {
  class VoiceSttHttpErrorMock extends Error {
    status = 0
  }
  return { voiceSttFromBlob: vi.fn(), VoiceSttHttpError: VoiceSttHttpErrorMock }
})

vi.mock('@/stores/auth-store', () => ({
  useWebAuthStore: (sel: (s: { token: string | null }) => unknown) => sel({ token: null }),
}))

const chatState: { messages: Array<{ role?: string; content?: string }> } = { messages: [] }
vi.mock('@/stores/chat', () => ({
  useChatStore: (sel: (s: typeof chatState) => unknown) => sel(chatState),
}))

vi.mock('@/components/chat/voice-stream-speaker', () => ({
  readHandsFree: () => false,
  VOICE_HANDSFREE_KEY: 'ihui_voice_handsfree',
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: unknown }) => children,
}))

/** 造一个在播/暂停的音频元素(挂进 document,事件才会途经 window 捕获监听) */
function makeAudio(muted = false): HTMLAudioElement {
  const audio = new Audio()
  audio.muted = muted
  document.body.appendChild(audio)
  return audio
}

function dispatchMedia(el: HTMLAudioElement, type: 'play' | 'pause' | 'ended') {
  act(() => {
    el.dispatchEvent(new Event(type))
  })
}

function stubMicSuccess() {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [] } as unknown as MediaStream)),
    },
  })
  class FakeMediaRecorder {
    state = 'inactive'
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      this.onstop?.()
    }
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
}

afterEach(() => {
  chatState.messages = []
  Reflect.deleteProperty(window.navigator, 'mediaDevices')
  for (const node of Array.from(document.body.children)) node.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('D62 装车 / 播报期间字幕真实渲染(宿主 = VoiceToolbar)', () => {
  it('无声播时整条为 null;音频 play 事件一落地,字幕条即在宿主树中出现且携带播报正文', async () => {
    chatState.messages = [{ role: 'assistant', content: '今天讨论了三个结论' }]
    const { container } = render(<VoiceToolbar onTranscript={vi.fn()} />)
    expect(container.querySelector('[data-testid="voice-subtitle-bar"]')).toBeNull()

    const audio = makeAudio()
    dispatchMedia(audio, 'play')

    const bar = container.querySelector('[data-testid="voice-subtitle-bar"]')
    expect(bar, '宿主必须真渲染字幕条(此前生产零消费点)').not.toBeNull()
    expect(bar?.getAttribute('data-subtitle-visible')).toBe('true')
    expect(bar?.getAttribute('data-subtitle-state')).toBe('live')
    expect(bar?.querySelector('[data-subtitle-text]')?.textContent).toBe('今天讨论了三个结论')

    dispatchMedia(audio, 'pause')
    expect(container.querySelector('[data-testid="voice-subtitle-bar"]')).toBeNull()
  })

  it('「静音并显示字幕」实机成立:音频 muted 仍在播 → 字幕**仍然可见**(mutedSubtitles)', () => {
    chatState.messages = [{ role: 'assistant', content: '静音不等于隐藏字幕' }]
    const { container } = render(<VoiceToolbar onTranscript={vi.fn()} />)
    const audio = makeAudio(true)
    dispatchMedia(audio, 'play')

    const bar = container.querySelector('[data-testid="voice-subtitle-bar"]')
    expect(bar?.getAttribute('data-subtitle-state')).toBe('mutedSubtitles')
    expect(bar?.querySelector('[data-subtitle-muted="true"]')).not.toBeNull()
    expect(bar?.querySelector('[data-subtitle-text]')?.textContent).toBe('静音不等于隐藏字幕')
  })
})

describe('D62 装车 / 录音纪要进行中 × 播报 互斥提示可达', () => {
  it('录音中(真栈 recording)+ 播报(play)→ 宿主树只呈现互斥提示,不给边录边播假象', async () => {
    stubMicSuccess()
    const { container } = render(<VoiceToolbar onTranscript={vi.fn()} />)
    fireEvent.click(container.querySelector('[data-testid="voice-toolbar-main"]') as Element)

    // 录音态上桥:纪要双视图先渲染(无播报 → 无冲突)
    await waitFor(() => {
      expect(container.querySelector('[data-summary-recording="true"]')).not.toBeNull()
    })
    expect(container.querySelector('[data-voice-conflict]')).toBeNull()

    const audio = makeAudio()
    dispatchMedia(audio, 'play')

    const conflict = container.querySelector('[data-voice-conflict="true"]')
    expect(conflict, '双激活必须落互斥提示').not.toBeNull()
    expect(conflict?.querySelector('[data-conflict-message]')?.textContent).toBe('conflict')
    expect(container.querySelector('[data-subtitle-line]')).toBeNull()
  })

  it('仅录音(不播报)时双视图切换真实可用(view 状态回到宿主)', async () => {
    stubMicSuccess()
    const { container } = render(<VoiceToolbar onTranscript={vi.fn()} />)
    fireEvent.click(container.querySelector('[data-testid="voice-toolbar-main"]') as Element)
    await waitFor(() => {
      expect(container.querySelector('[data-summary-recording="true"]')).not.toBeNull()
    })
    const taskBtn = container.querySelector('[data-view="taskFlow"]') as HTMLButtonElement
    expect(taskBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(taskBtn)
    expect(container.querySelector('[data-view="taskFlow"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
