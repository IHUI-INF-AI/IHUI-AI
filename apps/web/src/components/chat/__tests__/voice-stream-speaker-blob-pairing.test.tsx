// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * VoiceStreamSpeaker 的两组回归:
 *
 * ① blob URL 成对释放:本组件此前是全仓 `createObjectURL` 落点里唯一一个
 *    "有 create 无 revoke"的,而 TTS 播报是每轮回答一次的常规动作 —— 每次
 *    合成都永久压住一条 blob URL 和它引用的整块音频。判据是**计数配对**:
 *    每条用例结尾都断言 `revoke 次数 === create 次数`(播放进行中的那例除外,
 *    它显式断言"此刻还不该释放")。正常播完 / 构造失败抛错 / 播完前卸载。
 *
 * ② 段间静默内可打断(2026-10-24 D11 第二工客户端腿):mock NDJSON 流,
 *    正例断言"命中判据后 abort 传输层且后续段不再起播",反例断言"起音落在
 *    有声区(非段尾余量窗)时两段都照播"。
 * ③ VAD 采集约束:断言取流声明 AEC/NS/AGC,且实现拒绝约束时回落无约束取流、
 *    判据照常生效(防"扬声器回声误触发打断")。
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
  static durationSeconds = 0
  src: string
  duration = FakeAudio.durationSeconds
  currentTime = 0
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

/** 等异步链跑完:fetch → read → createObjectURL → new Audio → play。 */
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

// ---- /voice/tts/stream 的最小 NDJSON 替身(不触网、不依赖真 TTS) ----
const encoder = new TextEncoder()

/** 逐行下发的 body;gate 用于把后续行卡到"打断之后"才到达。 */
function ndjsonBody(lines: string[], gate?: Promise<void>) {
  let index = 0
  return {
    getReader: () => ({
      read: async (): Promise<{ value?: Uint8Array; done: boolean }> => {
        if (index > 0 && gate) await gate
        if (index >= lines.length) return { done: true }
        return { value: encoder.encode(lines[index++]), done: false }
      },
    }),
  }
}

function ndjsonFetch(lines: string[], gate?: Promise<void>) {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    body: ndjsonBody(lines, gate),
  }))
}

function segmentLine(index: number): string {
  return (
    '{"type":"segment","index":' +
    index +
    ',"total":2,"text":"第' +
    (index + 1) +
    '段。","contentType":"audio/mpeg","audioBase64":"' +
    btoa('audio-bytes') +
    '"}\n'
  )
}

/** 与 app/core/voice_barge_in.policy_payload 同形(阈值只从这一帧来)。 */
const POLICY_LINE =
  JSON.stringify({
    type: 'policy',
    policy: 'silence_gap_only',
    frameHopMs: 100,
    minVoicedMs: 300,
    segmentLeadSilenceMs: 180,
    segmentTailSilenceMs: 570,
    segmentGapMs: 750,
    voicedRmsThreshold: 0.02,
  }) + '\n'

import { VoiceStreamSpeaker as Speaker } from '../voice-stream-speaker'

/** 两个 describe 共用的扬声器环境:开关置 on、URL 计数、Audio 替身。 */
function resetSpeakerEnv(): void {
  created.length = 0
  revoked.length = 0
  urlSeq = 0
  FakeAudio.instances = []
  FakeAudio.throwOnConstruct = false
  FakeAudio.durationSeconds = 0
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
}

function cleanupSpeakerEnv(): void {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.removeItem('ihui_voice_playback')
}

describe('VoiceStreamSpeaker blob URL 成对释放', () => {
  beforeEach(() => {
    resetSpeakerEnv()
    // 无 policy 帧的流:老行为(整段逐段播完),正好覆盖"无 policy 不武装 VAD"
    vi.stubGlobal('fetch', ndjsonFetch([segmentLine(0)]))
  })

  afterEach(() => {
    cleanupSpeakerEnv()
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

describe('段间静默内可打断(barge-in)', () => {
  let energy = 0
  let gate: Promise<void> = Promise.resolve()
  let openGate: () => void = () => {}
  let lastSignal: AbortSignal | undefined

  class FakeAnalyser {
    fftSize = 2048
    getFloatTimeDomainData(samples: Float32Array): void {
      samples.fill(energy)
    }
  }

  class FakeAudioContext {
    createMediaStreamSource(): { connect: () => void } {
      return { connect: () => {} }
    }
    createAnalyser(): FakeAnalyser {
      return new FakeAnalyser()
    }
    close(): Promise<void> {
      return Promise.resolve()
    }
  }

  beforeEach(() => {
    resetSpeakerEnv()
    energy = 0
    lastSignal = undefined
    gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    FakeAudio.durationSeconds = 1 // 1000ms 段:尾静默 570ms ⇒ 窗 [430,1000]
    vi.stubGlobal('AudioContext', FakeAudioContext)
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: () => {} }] })) },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        lastSignal = init?.signal ?? undefined
        return {
          ok: true,
          status: 200,
          body: ndjsonBody([POLICY_LINE + segmentLine(0), segmentLine(1)], gate),
        }
      }),
    )
  })

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'mediaDevices')
    cleanupSpeakerEnv()
  })

  /** 等一个 100ms 能量帧期满(setInterval 步长取自 policy,真实计时器)。 */
  async function waitFrame(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120))
    })
  }

  it('段尾余量内起音满 300ms:abort 传输层,第二段不再起播', async () => {
    const { unmount } = triggerSpeak()
    await flush()
    expect(FakeAudio.instances).toHaveLength(1)
    expect(created).toHaveLength(1)

    // 有声 onset 从 530ms 起,连续 3 帧 → run_start=430 恰在窗内
    energy = 0.2
    const audio = FakeAudio.instances[0]!
    audio.currentTime = 0.53
    await waitFrame()
    audio.currentTime = 0.63
    await waitFrame()
    audio.currentTime = 0.73
    await waitFrame()

    expect(audio.pauseCalls).toBe(1) // 当前声已停
    expect(lastSignal?.aborted).toBe(true) // 传输层已 abort(服务端不再合成后续段)

    // 让第二段在打断之后才到达:客户端仍不得起播它
    openGate()
    await act(async () => {
      audio.emit('ended')
    })
    await flush()
    expect(FakeAudio.instances).toHaveLength(1)
    expect(created).toHaveLength(1)
    unmount()
  })

  it('起音落在有声区(非窗内):不打断,第二段照常播', async () => {
    FakeAudio.durationSeconds = 2 // 2000ms 段 ⇒ 窗 [1430,2000]
    const { unmount } = triggerSpeak()
    await flush()
    expect(FakeAudio.instances).toHaveLength(1)

    openGate() // 第二段先到达并排队
    energy = 0.2
    const audio = FakeAudio.instances[0]!
    for (const at of [0.8, 0.9, 1.0, 1.5, 1.9]) {
      audio.currentTime = at
      await waitFrame()
    }
    expect(audio.pauseCalls).toBe(0)
    expect(lastSignal?.aborted).toBe(false)

    audio.currentTime = 2
    await act(async () => {
      audio.emit('ended')
    })
    await flush()
    expect(FakeAudio.instances).toHaveLength(2)
    unmount()
  })

  it('VAD 取流声明回声抑制三项约束(AEC/NS/AGC 取 true)', async () => {
    const { unmount } = triggerSpeak()
    await flush()

    const mic = window.navigator.mediaDevices.getUserMedia as unknown as {
      mock: { calls: unknown[][] }
    }
    expect(mic.mock.calls).toEqual([
      [{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }],
    ])
    unmount()
  })

  it('实现不认这三项约束:退回无约束取流,判据照常生效', async () => {
    const unsupported = Object.assign(new Error('constraints unsupported'), {
      name: 'OverconstrainedError',
    })
    const mic = vi
      .fn<() => Promise<{ getTracks: () => Array<{ stop: () => void }> }>>()
      .mockRejectedValueOnce(unsupported)
      .mockResolvedValueOnce({ getTracks: () => [{ stop: () => {} }] })
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: mic },
    })

    const { unmount } = triggerSpeak()
    await flush()
    expect(mic.mock.calls).toHaveLength(2)
    expect(mic.mock.calls[1]).toEqual([{ audio: true }])

    // 回落取到的那条流仍接上分析器:段尾余量内起音满 300ms 依旧打断
    energy = 0.2
    const audio = FakeAudio.instances[0]!
    for (const at of [0.53, 0.63, 0.73]) {
      audio.currentTime = at
      await waitFrame()
    }
    expect(audio.pauseCalls).toBe(1)
    expect(lastSignal?.aborted).toBe(true)
    unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
