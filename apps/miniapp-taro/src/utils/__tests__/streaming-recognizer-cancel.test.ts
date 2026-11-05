// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

// 录音器与上传接口全部打桩:判的是识别器自己的会话状态机,不是 Taro/网络。
const hoisted = vi.hoisted(() => {
  const stopCallbacks: Array<(res: { tempFilePath: string }) => void> = []
  const recorder = {
    start: vi.fn(),
    stop: vi.fn(),
    onStop: (cb: (res: { tempFilePath: string }) => void) => {
      stopCallbacks.push(cb)
    },
    onError: vi.fn(),
  }
  const upload = vi.fn()
  return { stopCallbacks, recorder, upload }
})

vi.mock('@tarojs/taro', () => ({
  default: { getRecorderManager: () => hoisted.recorder },
}))
vi.mock('@ihui/api-client/endpoints/voice-stt.taro', () => ({
  voiceSttFromTaro: hoisted.upload,
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('../auth', () => ({ getToken: () => 'test-token' }))
vi.mock('../api-config', () => ({ AI_SERVICE_BASE_URL: 'http://default-ai.local' }))

import { StreamingRecognizer } from '../streaming-recognizer'

/** 模拟 Taro 在录音真正停止后回调 onStop(可能晚于 cancel/卸载) */
function emitStop(tempFilePath: string) {
  for (const cb of hoisted.stopCallbacks) cb({ tempFilePath })
}

/** 让上传 Promise 与会话复核逻辑走完一轮微任务 */
function flush() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.stopCallbacks.length = 0
  hoisted.upload.mockReset()
})

describe('StreamingRecognizer 取消竞态', () => {
  // BUG 根因: cancel() 清空状态后,晚到的 onStop 仍会 finalizeRecognition ⇒ 上传 + 回填
  it('取消后晚到的 onStop 不得发请求、不得回填', async () => {
    const recognizer = new StreamingRecognizer()
    const onFinal = vi.fn()
    recognizer.on('final', onFinal)

    await recognizer.startRecognizing()
    recognizer.cancel()
    // 卸载(VoiceInput 的 cleanup 调 cancel)后,原生 onStop 才到达
    emitStop('cancelled.mp3')
    await flush()

    expect(hoisted.upload).not.toHaveBeenCalled()
    expect(recognizer.getResult()).toBe('')
    expect(onFinal).not.toHaveBeenCalled()
  })

  it('晚到 onStop 不得影响下一次录音:旧会话被丢弃,新会话仍能正常上传', async () => {
    const recognizer = new StreamingRecognizer()
    const onFinal = vi.fn()
    recognizer.on('final', onFinal)

    await recognizer.startRecognizing()
    recognizer.cancel()
    await recognizer.startRecognizing()

    // 属于被取消会话的 onStop 此刻才到 —— 既不能上传,也不能把新会话的录音状态改掉
    emitStop('late-old.mp3')
    await flush()
    expect(hoisted.upload).not.toHaveBeenCalled()
    expect(recognizer.getIsRecording()).toBe(true)

    hoisted.upload.mockResolvedValueOnce('新会话文本')
    recognizer.stopRecognizing()
    emitStop('new.mp3')
    await flush()

    expect(hoisted.upload).toHaveBeenCalledTimes(1)
    expect(recognizer.getResult()).toBe('新会话文本')
    expect(onFinal).toHaveBeenCalledWith('新会话文本')
  })

  it('正常停止仍上传一次并回填一次(修复不误伤正常路径)', async () => {
    const recognizer = new StreamingRecognizer()
    const onFinal = vi.fn()
    recognizer.on('final', onFinal)

    await recognizer.startRecognizing()
    hoisted.upload.mockResolvedValueOnce('你好')
    recognizer.stopRecognizing()
    emitStop('normal.mp3')
    await flush()

    expect(hoisted.upload).toHaveBeenCalledTimes(1)
    expect(recognizer.getResult()).toBe('你好')
    expect(onFinal).toHaveBeenCalledTimes(1)
    expect(onFinal).toHaveBeenCalledWith('你好')
  })

  it('上传途中被取消:晚到的转写结果不得回填', async () => {
    const recognizer = new StreamingRecognizer()
    const onFinal = vi.fn()
    recognizer.on('final', onFinal)

    let resolveUpload!: (text: string) => void
    hoisted.upload.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve
        }),
    )

    await recognizer.startRecognizing()
    recognizer.stopRecognizing()
    emitStop('in-flight.mp3')
    await flush()
    expect(hoisted.upload).toHaveBeenCalledTimes(1)

    recognizer.cancel()
    resolveUpload('迟到文本')
    await flush()

    expect(recognizer.getResult()).toBe('')
    expect(onFinal).not.toHaveBeenCalled()
  })
})

describe('StreamingRecognizer.configure', () => {
  it('配置真实透传给上传调用,且 undefined 不覆盖内置默认值', async () => {
    const recognizer = new StreamingRecognizer()
    recognizer.configure({ aiServiceUrl: 'http://custom-ai.local', language: 'en' })

    await recognizer.startRecognizing()
    hoisted.upload.mockResolvedValueOnce('')
    recognizer.stopRecognizing()
    emitStop('cfg.mp3')
    await flush()

    expect(hoisted.upload).toHaveBeenCalledWith(
      'cfg.mp3',
      expect.objectContaining({
        aiServiceUrl: 'http://custom-ai.local',
        language: 'en',
        token: 'test-token',
      }),
    )

    // VoiceInput 的 prop 缺省时会传 undefined —— 不能把默认值冲掉
    recognizer.configure({ aiServiceUrl: undefined, language: undefined })
    await recognizer.startRecognizing()
    hoisted.upload.mockResolvedValueOnce('')
    recognizer.stopRecognizing()
    emitStop('cfg2.mp3')
    await flush()

    expect(hoisted.upload).toHaveBeenLastCalledWith(
      'cfg2.mp3',
      expect.objectContaining({
        aiServiceUrl: 'http://custom-ai.local',
        language: 'en',
      }),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
