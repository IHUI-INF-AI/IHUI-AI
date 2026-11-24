// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-voice-recorder-lifecycle.test.ts — 小程序端语音录制器生命周期/取消语义回归锁
 *
 * 覆盖三处历史缺陷(2026-11-07 深度审计发现):
 *  ① stopRecording 用固定 500ms 定时器赌 onStop 已回调 —— 慢机型 onStop 迟于 500ms 时
 *     resolve 出空路径,用户刚录的语音被静默丢弃;且 500ms 内永远拿不到真路径。
 *  ② cancelRecording 先清 tempFilePath,但 onStop 是异步回调,稍后会把被取消文件路径写回;
 *     连同下一次录音的 500ms 窗口,会把「已取消的旧音频」当成本次录音上传。
 *  ③ init() 每次按下语音键都重新 getRecorderManager + createInnerAudioContext +
 *     重复注册 onStop/onError —— 反复录音累积音频上下文与回调(小程序有实例上限)。
 *
 * 修前必须真红:①②③ 三组断言在旧实现下分别失败;修后全绿。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  stopCb: null as ((res: { tempFilePath: string }) => void) | null,
  errorCb: null as ((err: { errMsg?: string }) => void) | null,
  audioCreated: 0,
  starts: 0,
  stops: 0,
}))

vi.mock('@tarojs/taro', () => {
  const manager = {
    start: () => {
      h.starts += 1
    },
    stop: () => {
      h.stops += 1
    },
    onStop: (cb: (res: { tempFilePath: string }) => void) => {
      h.stopCb = cb
    },
    onError: (cb: (err: { errMsg?: string }) => void) => {
      h.errorCb = cb
    },
  }
  return {
    default: {
      getRecorderManager: () => manager,
      createInnerAudioContext: () => {
        h.audioCreated += 1
        return {
          autoplay: false,
          src: '',
          play: vi.fn(),
          stop: vi.fn(),
          onEnded: vi.fn(),
          onError: vi.fn(),
        }
      },
    },
  }
})

async function loadRecorder() {
  vi.resetModules()
  h.stopCb = null
  h.errorCb = null
  h.audioCreated = 0
  h.starts = 0
  h.stops = 0
  const mod = await import('@/utils/voice-recorder')
  return mod.default as {
    init: () => void
    startRecording: () => void
    stopRecording: () => Promise<string>
    cancelRecording: () => void
    getTempFilePath: () => string
  }
}

describe('小程序语音录制器 · 生命周期与取消语义', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('① onStop 迟于 500ms 时仍返回真实路径,不得静默丢音', async () => {
    const vr = await loadRecorder()
    vr.init()
    vr.startRecording()

    const pending = vr.stopRecording()
    // 慢机型:onStop 在 700ms 才回调
    vi.advanceTimersByTime(700)
    h.stopCb?.({ tempFilePath: 'wxfile://rec-b.mp3' })

    await expect(pending).resolves.toBe('wxfile://rec-b.mp3')
  })

  it('② 取消后迟到的 onStop 不得把被取消文件路径写回', async () => {
    const vr = await loadRecorder()
    vr.init()
    vr.startRecording()
    vr.cancelRecording()

    h.stopCb?.({ tempFilePath: 'wxfile://cancelled.mp3' })

    expect(vr.getTempFilePath()).toBe('')
  })

  it('③ init 幂等:重复调用不得累积音频上下文', async () => {
    const vr = await loadRecorder()
    vr.init()
    const afterFirst = h.audioCreated
    vr.init()
    expect(h.audioCreated).toBe(afterFirst)
  })

  it('④ 上一段被取消的路径不得被下一次录音复用', async () => {
    const vr = await loadRecorder()
    vr.init()

    // 第一段:录音 → 取消 → 迟到的 onStop 想把旧路径写回
    vr.startRecording()
    vr.cancelRecording()
    h.stopCb?.({ tempFilePath: 'wxfile://cancelled.mp3' })

    // 第二段:正常录音,onStop 仍未来得及回调
    vr.startRecording()
    let settled = false
    let value = ''
    const pending = vr.stopRecording().then((v) => {
      settled = true
      value = v
      return v
    })
    vi.advanceTimersByTime(500)
    await Promise.resolve()
    expect(settled, '500ms 内不得用旧路径提前 settle').toBe(false)

    h.stopCb?.({ tempFilePath: 'wxfile://rec-second.mp3' })
    await expect(pending).resolves.toBe('wxfile://rec-second.mp3')
    expect(value).toBe('wxfile://rec-second.mp3')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
