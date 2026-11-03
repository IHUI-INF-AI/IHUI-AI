// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D62(G-76)装车回归:麦克风四类错误必须**经真栈**逐类可辨。
 *
 * 链路:VoiceToolbar 主按钮单击 → VoiceInput(录音栈,hidden 桥接)→ getUserMedia
 * 抛 DOMException → **classifyMicError(共享层唯一归一入口)** → handle.micError →
 * RAF 轮询上桥 → VoiceSubtitleBar 逐类渲染。
 * 用例只喂 DOMException 名,断言落点是四类各自的 data-mic-error + 各自文案键 ——
 * 若端内有人把分类抄成 if/switch 或合并成一个笼统文案,键名即对不上,本文件必红。
 */

import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MIC_ERROR_KINDS, type MicErrorKind } from '@ihui/shared/chat/voice-subtitles'

import { VoiceToolbar } from '../voice-toolbar'

// t() 取恒等:断言键位即断言"该态取的是这一类的键",与文案措辞解耦。
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

// Speaker 模块只被 voice-toolbar 取 readHandsFree/常量,测试里不必拉起其真实依赖
vi.mock('@/components/chat/voice-stream-speaker', () => ({
  readHandsFree: () => false,
  VOICE_HANDSFREE_KEY: 'ihui_voice_handsfree',
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: unknown }) => children,
}))

function stubMicRejection(name: string) {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.reject(new DOMException(name, name))) },
  })
  vi.stubGlobal('MediaRecorder', class FakeMediaRecorder {})
}

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'mediaDevices')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('D62 麦克风四类错误 / 真栈逐类可辨(host = VoiceToolbar)', () => {
  const cases: Array<[string, MicErrorKind]> = [
    ['NotAllowedError', 'noPermission'],
    ['NotFoundError', 'noDevice'],
    ['NotReadableError', 'occupied'],
    ['AbortError', 'startFailed'],
  ]

  for (const [domName, kind] of cases) {
    it(`${domName} → 字幕条呈现 ${kind} 专属错误态与专属文案键`, async () => {
      stubMicRejection(domName)
      const { container } = render(<VoiceToolbar onTranscript={vi.fn()} />)
      // 渲染前置:无错误时不得有错误条(防"恒红"假绿)
      expect(container.querySelector('[data-mic-error]')).toBeNull()

      fireEvent.click(container.querySelector('[data-testid="voice-toolbar-main"]') as Element)

      const node = await waitFor(() => {
        const found = container.querySelector(`[data-mic-error="${kind}"]`)
        expect(found, `${domName} 应归类为 ${kind}`).not.toBeNull()
        return found as Element
      })
      expect(node.getAttribute('data-mic-error')).toBe(kind)
      // 文案取自 ai.pane.voiceSubtitles.micError.<kind>:四类各自可辨,不得合并
      expect(node.querySelector('[data-mic-error-message]')?.textContent).toBe(`micError.${kind}`)
    })
  }

  it('四类两两可辨:同一 DOMException 名集下四个落点互不重合', async () => {
    // 逐个渲染收集 (kind, message) 对,四对必须两两不同(防"笼统文案"回潮)
    const seen: string[] = []
    for (const [domName, kind] of cases) {
      stubMicRejection(domName)
      const { container, unmount } = render(<VoiceToolbar onTranscript={vi.fn()} />)
      fireEvent.click(container.querySelector('[data-testid="voice-toolbar-main"]') as Element)
      const node = await waitFor(() => {
        const found = container.querySelector(`[data-mic-error="${kind}"]`)
        expect(found, domName).not.toBeNull()
        return found as Element
      })
      seen.push(`${kind}::${node.querySelector('[data-mic-error-message]')?.textContent}`)
      unmount()
    }
    expect(new Set(seen).size).toBe(MIC_ERROR_KINDS.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
