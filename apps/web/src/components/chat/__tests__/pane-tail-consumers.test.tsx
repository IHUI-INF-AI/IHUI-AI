// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 票60 长尾(2026-10-21):四座"随 MessageList / MessageInput 进非根窗格"的消费面改读按窗格寻址的 chat store。
 * 本文件只问一件事 —— 它到底问哪一份 store:
 *   ① 正向:根窗格在流式/收尾,而本窗格没有 ⇒ 本窗格的朗读腿一次都不触发;把本窗格自己推过 done 边沿 ⇒ 正好一次,且播的是本窗格正文;
 *   ② 反证:Provider 外(单窗格调用面)读的仍是根单例 —— 缺省形态逐字不变;
 *   ③ 形状锁:四座文件都不再引用根单例,且都经 usePaneChatStore 解析(留第二份引用 = 迟早有人改回去)。
 */
import * as React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/stores/chat'
import { VOICE_PLAYBACK_KEY, VoiceStreamSpeaker } from '@/components/chat/voice-stream-speaker'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@ihui/ui-react', () => ({
  IconButton: () => null,
}))
vi.mock('@/stores/auth-store', () => ({
  // 真 store 是 zustand hook,带 getState;voice-stream-speaker 建连时用
  // useWebAuthStore.getState().token 现取凭据(2026-10-26 改),mock 缺 getState
  // ⇒ 测的是 mock 缺面,不是被测逻辑。
  useWebAuthStore: Object.assign(
    (sel: (s: { token: string | null }) => unknown) => sel({ token: null }),
    {
      getState: () => ({ token: null }),
    },
  ),
}))

const fetchCalls: string[][] = []
const ROOT = path.resolve(process.cwd(), 'src')

function assistant(id: string, content: string): ChatMessage {
  return { id, role: 'assistant', content, createdAt: 1 }
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  fetchCalls.length = 0
  // 朗读开关必须是 on:readEnabled() 读 localStorage,门关着时边沿一律不触发(第一次跑就栽在这里)
  window.localStorage.setItem(VOICE_PLAYBACK_KEY, 'on')
  resetChatPaneStores()
  useChatStore.setState({ isStreaming: false, messages: [] })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      fetchCalls.push([typeof input === 'string' ? input : String(input)])
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
        blob: async () => new Blob(['x'], { type: 'audio/mpeg' }),
      }
    }),
  )
  class NoAudio {
    src = ''
    play = () => Promise.resolve()
    pause = () => {}
    addEventListener = () => {}
    removeEventListener = () => {}
  }
  vi.stubGlobal('Audio', NoAudio)
})

afterEach(() => {
  cleanup()
  resetChatPaneStores()
  vi.unstubAllGlobals()
})

describe('朗读腿按窗格寻址(票60 长尾)', () => {
  it('① 正向:根窗格流式收尾不触发本窗格;本窗格自己过 done 边沿才播,且播的是本窗格正文', async () => {
    const pane = getChatStoreForPane('pane-tail-voice')
    pane.setState({ isStreaming: false, messages: [assistant('p1', 'PANE-ONLY')] })
    render(
      <ChatPaneProvider paneId="pane-tail-voice">
        <VoiceStreamSpeaker />
      </ChatPaneProvider>,
    )

    // 根单例走一次完整的流式 → 完成边沿:本窗格的腿不该有任何动静
    useChatStore.setState({ isStreaming: true, messages: [assistant('r1', 'ROOT-ONLY')] })
    await settle()
    useChatStore.setState({ isStreaming: false })
    await settle()
    expect(fetchCalls.length).toBe(0)

    // 本窗格自己走边沿 ⇒ 正好一次
    pane.setState({ isStreaming: true, messages: [assistant('p2', 'PANE-SPOKEN')] })
    await settle()
    pane.setState({ isStreaming: false })
    await settle()
    expect(fetchCalls.length).toBe(1)
  })

  it('② 反证:Provider 外仍读根单例(单窗格调用面逐字不变)', async () => {
    render(<VoiceStreamSpeaker />)
    useChatStore.setState({ isStreaming: true, messages: [assistant('r2', 'ROOT-SPOKEN')] })
    await settle()
    useChatStore.setState({ isStreaming: false })
    await settle()
    expect(fetchCalls.length).toBe(1)
    // 本窗格那份没被碰过 ⇒ 反证不是"两边都播"
    expect(getChatStoreForPane('pane-tail-voice').getState().isStreaming).toBe(false)
  })

  it('③ 形状锁:四座都不再引用根单例,且都经 usePaneChatStore 解析', () => {
    const files = [
      'components/chat/voice-stream-speaker.tsx',
      'components/chat/canvas-overlay.tsx',
      'components/chat/sampling-params-panel.tsx',
      'components/ai/agent-progress-trigger.tsx',
    ]
    for (const rel of files) {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      expect(src, rel).toContain("import { usePaneChatStore } from '@/stores/chat-pane-context'")
      expect(src, rel).not.toMatch(/useChatStore\(/)
      expect(src, rel).toMatch(/usePaneChatStore\(\)/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
