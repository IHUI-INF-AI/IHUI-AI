// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// @vitest-environment jsdom
/**
 * VoiceStreamSpeaker 的 blob URL 成对释放回归。
 *
 * 立因:本组件此前是全仓 `createObjectURL` 落点里唯一一个"有 create 无 revoke"的
 * (`git grep -l` 两面差集实测:39 个文件有 create、其中只有它没有 revoke),而 TTS
 * 播报是每轮回答一次的常规动作 —— 每次合成都永久压住一条 blob URL 和它引用的整块音频。
 *
 * 判据是**计数配对**,不是"看起来释放了":每条用例结尾都断言
 * `revoke 次数 === create 次数`(播放进行中的那一例除外,它显式断言"此刻还不该释放")。
 * 三条路径各一条:正常播完 / 构造失败抛错 / 播完前卸载。
 */
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@ihui/ui-react', () => ({
  IconButton: () => null,
}))

const store: { isStreaming: boolean; messages: Array<{ role: string; content?: string }> } = {
  isStreaming: false,
  messages: [],
}
vi.mock('@/stores/chat', () => ({
  useChatStore: (sel: (s: typeof store) => unknown) => sel(store),
}))
vi.mock('@/stores/auth-store', () => ({
  useWebAuthStore: (sel: (s: { token: string | null }) => unknown) => sel({ token: null }),
}))

const created: string[] = []
const revoked: string[] = []
let urlSeq = 0

class FakeAudio {
  static instances: FakeAudio[] = []
  static throwOnConstruct = false
  src: string
  handlers = new Map<string, () => void>()
  playCalls = 0
  pauseCalls = 0

  constructor(src: string) {
    if (FakeAudio.throwOnConstruct) throw new Error('构造期异常(个别环境对非法 src 抛)')
    this.src = src
    FakeAudio.instances.push(this)
  }

  play(): Promise<void> {
    this.playCalls += 1
    return Promise.resolve()
  }

  pause(): void {
    this.pauseCalls += 1
  }

  addEventListener(type: string, handler: () => void): void {
    this.handlers.set(type, handler)
  }

  emit(type: string): void {
    this.handlers.get(type)?.()
  }
}

/** 等异步链跑完:fetch → blob → createObjectURL → new Audio → play。 */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** 走一次"流式 true → false"的 done 边沿,触发播报。 */
function triggerSpeak() {
  store.messages = [{ role: 'assistant', content: '你好,这是一段会被朗读的回复。' }]
  store.isStreaming = true
  const view = render(React.createElement(Speaker))
  act(() => {
    store.isStreaming = false
  })
  view.rerender(React.createElement(Speaker))
  return view
}

import { VoiceStreamSpeaker as Speaker } from '../voice-stream-speaker'

describe('VoiceStreamSpeaker blob URL 成对释放', () => {
  beforeEach(() => {
    created.length = 0
    revoked.length = 0
    urlSeq = 0
    FakeAudio.instances = []
    FakeAudio.throwOnConstruct = false
    store.isStreaming = false
    store.messages = []
    window.localStorage.setItem('ihui_voice_playback', 'on')

    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      void blob
      const url = `blob:mock/${(urlSeq += 1)}`
      created.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revoked.push(url)
    })
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['audio-bytes'], { type: 'audio/mpeg' }),
      })),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.localStorage.removeItem('ihui_voice_playback')
  })

  it('正常播完:创建一条、播完释放一条(且播放期间不提前释放)', async () => {
    const { unmount } = triggerSpeak()
    await flush()

    expect(created).toHaveLength(1)
    expect(revoked).toHaveLength(0) // 音频还在播,此刻释放会把声音掐掉
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]?.src).toBe(created[0])

    act(() => {
      FakeAudio.instances[0]?.emit('ended')
    })
    expect(revoked).toEqual(created)
    unmount()
  })

  it('异常路径(new Audio 抛错):create 仍被 revoke —— 不靠人眼看代码', async () => {
    FakeAudio.throwOnConstruct = true
    const { unmount } = triggerSpeak()
    await flush()

    // 句柄是在构造**之前**拿到的;构造函数抛错后组件的 catch 把它咽掉,
    // 没有 finally 里的释放就永久泄漏。这里断言的正是那一格。
    expect(created).toHaveLength(1)
    expect(revoked).toEqual(created)
    expect(FakeAudio.instances).toHaveLength(0)
    unmount()
  })

  it('播完前卸载:stopPlayback 收敛掉未释放的句柄', async () => {
    const { unmount } = triggerSpeak()
    await flush()
    expect(created).toHaveLength(1)

    act(() => {
      unmount()
    })
    expect(revoked).toEqual(created)
    expect(FakeAudio.instances[0]?.pauseCalls).toBe(1)
  })

  it('解码失败(audio error)同样释放,不留半死句柄', async () => {
    const { unmount } = triggerSpeak()
    await flush()
    act(() => {
      FakeAudio.instances[0]?.emit('error')
    })
    expect(revoked).toEqual(created)
    unmount()
  })

  it('响应非 2xx:根本不创建 URL(不留下"创建了却没有播放器持有"的悬挂)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, blob: async () => new Blob(['x']) })),
    )
    const { unmount } = triggerSpeak()
    await flush()
    expect(created).toHaveLength(0)
    expect(revoked).toHaveLength(0)
    unmount()
  })
})
