// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * useChatInput 契约单测(2026-10-15 立,ChatScreen「长按麦克风静默失效」修复配套)。
 *
 * 根因:useChatInput 的录音失败反馈走 Alert.alert,而 react-native-web 上 Alert 是
 * no-op ⇒ web 预览长按麦克风零反馈。修复引入 onVoiceUnavailable 回调(与
 * useVoiceRecorder 的 onUnavailable 同构),本套件只锁修复的行为面:
 * ① 权限被拒 + 已传回调 → onVoiceUnavailable('permission-denied', 文案) 被调,
 *    且不再走 Alert(web 病灶不再静默);
 * ② 权限被拒 + 未传回调 → 保留 Alert 兜底(原生端行为不变);
 * ③ prepareToRecordAsync 抛错 + 已传回调 → onVoiceUnavailable('record-failed', …);
 * ④ 全链路成功 → 回调与 Alert 均不被调,正常进入录音态(回归守护)。
 *
 * 取材纪律:expo-audio / expo-image-picker 是原生依赖(vitest 下解析即死),factory
 * 替身替掉;react-native 用全局替身展开并注入 Alert spy(全局替身无 Alert 导出)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { render, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  requestRecordingPermissionsAsync: vi.fn(),
  setAudioModeAsync: vi.fn(),
  prepareToRecordAsync: vi.fn(),
  record: vi.fn(),
  stop: vi.fn(),
  alert: vi.fn(),
}))

vi.mock('expo-audio', () => {
  // useAudioRecorder 必须返回稳定实例(同 use-voice-recorder.test.ts 的教训):
  // 每次渲染换新对象会触发 hook 的卸载清理 effect([recorder] 依赖)打翻 recordingRef。
  const recorderInstance = {
    prepareToRecordAsync: mocks.prepareToRecordAsync,
    record: mocks.record,
    stop: mocks.stop,
    uri: 'file:///mock/recording.m4a',
  }
  return {
    AudioModule: { requestRecordingPermissionsAsync: mocks.requestRecordingPermissionsAsync },
    RecordingPresets: { HIGH_QUALITY: { isMeteringEnabled: true } },
    setAudioModeAsync: mocks.setAudioModeAsync,
    useAudioRecorder: () => recorderInstance,
  }
})

vi.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images', All: 'All' },
  launchImageLibraryAsync: vi.fn(),
}))

// 全局 react-native 替身没有 Alert 导出(useChatInput 具名导入 Alert/Platform),
// 展开替身并注入 Alert spy;其余组件面沿用全局替身,不重写。
vi.mock('react-native', async () => {
  const rn = await import('./__mocks__/react-native')
  return { ...rn, Alert: { alert: mocks.alert } }
})

import { useChatInput } from '../src/hooks/useChatInput'

async function flushMicrotasks() {
  await act(async () => {})
  await act(async () => {})
}

describe('useChatInput — 录音失败必须有用户可见反馈(不再静默)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.setAudioModeAsync.mockResolvedValue(undefined)
    mocks.prepareToRecordAsync.mockResolvedValue(undefined)
    mocks.stop.mockResolvedValue(undefined)
  })

  it('① 权限被拒 + 已传回调 → onVoiceUnavailable("permission-denied") 被调,不走 Alert', async () => {
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false })
    const onVoiceUnavailable = vi.fn()
    const { result } = renderHook(() => useChatInput({ onVoiceUnavailable }))

    await act(async () => {
      await result.current.onInputVoiceStart()
    })
    await flushMicrotasks()

    expect(onVoiceUnavailable).toHaveBeenCalledTimes(1)
    expect(onVoiceUnavailable).toHaveBeenCalledWith(
      'permission-denied',
      '无法访问麦克风,请检查权限设置',
    )
    expect(mocks.alert).not.toHaveBeenCalled()
    expect(mocks.prepareToRecordAsync).not.toHaveBeenCalled()
  })

  it('② 权限被拒 + 未传回调 → 保留 Alert 兜底(原生端行为不变)', async () => {
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false })
    const { result } = renderHook(() => useChatInput())

    await act(async () => {
      await result.current.onInputVoiceStart()
    })
    await flushMicrotasks()

    expect(mocks.alert).toHaveBeenCalledWith('permission denied', 'microphone permission required')
  })

  it('③ prepareToRecordAsync 抛错 + 已传回调 → onVoiceUnavailable("record-failed", 原始消息)', async () => {
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true })
    mocks.prepareToRecordAsync.mockRejectedValue(new Error('getUserMedia failed'))
    const onVoiceUnavailable = vi.fn()
    const { result } = renderHook(() => useChatInput({ onVoiceUnavailable }))

    await act(async () => {
      await result.current.onInputVoiceStart()
    })
    await flushMicrotasks()

    expect(onVoiceUnavailable).toHaveBeenCalledTimes(1)
    expect(onVoiceUnavailable).toHaveBeenCalledWith('record-failed', 'getUserMedia failed')
    expect(mocks.alert).not.toHaveBeenCalled()
    expect(result.current.isRecording).toBe(false)
  })

  it('④ 全链路成功 → 正常进入录音态,回调与 Alert 均不被调(回归守护)', async () => {
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true })
    const onVoiceUnavailable = vi.fn()
    const { result } = renderHook(() => useChatInput({ onVoiceUnavailable }))

    await act(async () => {
      await result.current.onInputVoiceStart()
    })
    await flushMicrotasks()

    expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(1)
    expect(mocks.record).toHaveBeenCalledTimes(1)
    expect(result.current.isRecording).toBe(true)
    expect(onVoiceUnavailable).not.toHaveBeenCalled()
    expect(mocks.alert).not.toHaveBeenCalled()
  })

  it('⑤ 渲染冒烟:Hook 挂载不炸(权限预请求静默失败不阻塞 UI)', async () => {
    mocks.requestRecordingPermissionsAsync.mockRejectedValue(new Error('no web context'))
    const apiRef = { current: null as ReturnType<typeof useChatInput> | null }
    function Harness() {
      const state = useChatInput()
      apiRef.current = state
      return createElement('div')
    }
    render(createElement(Harness))
    await flushMicrotasks()
    expect(apiRef.current).not.toBeNull()
    expect(apiRef.current!.isVoiceMode).toBe(false)
  })

  it('⑥ prepare 期间松开 → 不 record、不进录音态(松开竞态守卫保留)', async () => {
    let resolvePrepare: (() => void) | undefined
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true })
    mocks.prepareToRecordAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePrepare = resolve
      }),
    )
    const { result } = renderHook(() => useChatInput())

    // 按下(不等待,让 prepare 挂起)→ 期间松开
    let startPromise: Promise<void> | undefined
    act(() => {
      startPromise = result.current.onInputVoiceStart()
    })
    await act(async () => {
      await result.current.onInputVoiceEnd()
    })
    resolvePrepare!()
    await act(async () => {
      await startPromise
    })
    await flushMicrotasks()

    expect(mocks.record).not.toHaveBeenCalled()
    expect(result.current.isRecording).toBe(false)
  })
})
