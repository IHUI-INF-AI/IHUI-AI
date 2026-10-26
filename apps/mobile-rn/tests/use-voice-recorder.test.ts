// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useVoiceRecorder 契约单测(2026-10-15 立,web 预览「长按麦克风静默无反应」修复配套)。
 *
 * 只锁修复引入的四个行为面(证据链 = 渲染真 hook → 驱动 start/stop → 断言回调与录音态):
 * ① 授权懒补办仍被拒 → onUnavailable('permission-denied') 有用户可见反馈,不再静默;
 * ② 挂载期预请求失败(web 无手势上下文的真实病灶)→ 长按时懒补办成功,正常进录音态,
 *    且 stop 后走 STT 链路把转写文本回填给 onComplete;
 * ③ 松开竞态守卫:授权 pending 期间 stop() → start 续体按代次放弃,不凭空进录音态;
 * ④ prepareToRecordAsync 失败 → onUnavailable('record-failed') + onComplete('') 兜底。
 *
 * 取材纪律:expo-audio 是原生依赖(真实入口拉 expo-modules-core,vitest 下解析即死),
 * 用 factory 替身替掉;@ihui/api-client 与 ../src/lib/token 同样 factory 替身 —— 替身之外的
 * 行为(真权限弹窗/真网络)不归本套件管。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  requestRecordingPermissionsAsync: vi.fn(),
  setAudioModeAsync: vi.fn(),
  prepareToRecordAsync: vi.fn(),
  record: vi.fn(),
  stop: vi.fn(),
  voiceSttFromReactNative: vi.fn(),
  getToken: vi.fn(() => 'test-token'),
  /**
   * lib/token 的凭据兜带(2026-10-26 立)。本套件只把它当**替身出口**:
   * 默认把 run 用 getToken() 的值喂回去(等价修复前所见),个别用例改写它来证明
   * "STT 拿的是兜带给的凭据,不是 hook 自己快照的那一份"。
   * 判据本体(该不该续期 / 算不算凭据被否定)住在 lib/token,单测在 tests/token.test.ts。
   */
  runWithFreshToken: vi.fn(),
  isCredentialRejected: vi.fn(() => false),
}))

vi.mock('expo-audio', () => {
  // useAudioRecorder 必须返回稳定实例:真包内部 memo 化 recorder;若每次渲染换新对象,
  // hook 的卸载清理 effect([recorder] 依赖)会在每次重渲染时把 recordingRef 打回 false,
  // 测出来的就是替身的假病灶而不是实现的行为。
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

vi.mock('@ihui/api-client', () => ({
  voiceSttFromReactNative: mocks.voiceSttFromReactNative,
}))

vi.mock('../src/lib/token', () => ({
  getToken: mocks.getToken,
  runWithFreshToken: mocks.runWithFreshToken,
  isCredentialRejected: mocks.isCredentialRejected,
}))

import { useVoiceRecorder } from '../src/hooks/use-voice-recorder'

type HarnessApi = ReturnType<typeof useVoiceRecorder>

function Harness({
  onComplete,
  onUnavailable,
  onSttFailed,
  apiRef,
}: {
  onComplete?: (text: string) => void
  onUnavailable?: (reason: 'permission-denied' | 'record-failed') => void
  onSttFailed?: (reason: 'credential' | 'other') => void
  apiRef: { current: HarnessApi | null }
}) {
  const state = useVoiceRecorder({ onComplete, onUnavailable, onSttFailed })
  apiRef.current = state
  return createElement('div', { 'data-recording': String(state.recording) })
}

/** 冲掉挂载 effect / start 续体里排队的微任务(两跳保证 await 链全部落定) */
async function flushMicrotasks() {
  await act(async () => {})
  await act(async () => {})
}

function recordingAttr(container: HTMLElement): string | null {
  return container.querySelector('[data-recording]')?.getAttribute('data-recording') ?? null
}

describe('useVoiceRecorder — 失败路径必须有用户可见反馈(不再静默)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.setAudioModeAsync.mockResolvedValue(undefined)
    mocks.prepareToRecordAsync.mockResolvedValue(undefined)
    mocks.stop.mockResolvedValue(undefined)
    mocks.voiceSttFromReactNative.mockResolvedValue('转写文本')
    mocks.getToken.mockReturnValue('test-token')
    // 兜带默认:把当前凭据喂回 run(与修复前 hook 自己取到的那一份同值,既有断言一条不动)
    mocks.runWithFreshToken.mockImplementation((run: (t: string | null) => Promise<string>) =>
      run(mocks.getToken()),
    )
    mocks.isCredentialRejected.mockReturnValue(false)
  })

  it('挂载预请求被拒后,长按懒补办仍被拒 → onUnavailable("permission-denied") + onComplete("")', async () => {
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false })
    const onComplete = vi.fn()
    const onUnavailable = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    const { container } = render(createElement(Harness, { onComplete, onUnavailable, apiRef }))
    await flushMicrotasks() // 冲掉挂载期预请求

    act(() => {
      apiRef.current?.start()
    })
    await flushMicrotasks()

    // 挂载 1 次 + 长按懒补办 1 次:懒补办真的发生了,而不是复用挂载失败的旧结论
    expect(mocks.requestRecordingPermissionsAsync).toHaveBeenCalledTimes(2)
    expect(onUnavailable).toHaveBeenCalledWith('permission-denied')
    expect(onComplete).toHaveBeenCalledWith('')
    expect(recordingAttr(container)).toBe('false')
  })

  it('挂载期预请求失败(web 无手势病灶)→ 长按懒补办成功:进录音态、record()、stop 后走 STT', async () => {
    mocks.requestRecordingPermissionsAsync
      .mockRejectedValueOnce(new Error('permissions must be requested from a user gesture'))
      .mockResolvedValueOnce({ granted: true })
    const onComplete = vi.fn()
    const onUnavailable = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    const { container } = render(createElement(Harness, { onComplete, onUnavailable, apiRef }))
    await flushMicrotasks() // 挂载期预请求拒绝落定
    expect(recordingAttr(container)).toBe('false')

    act(() => {
      apiRef.current?.start()
    })
    await flushMicrotasks()

    expect(mocks.prepareToRecordAsync).toHaveBeenCalledTimes(1)
    expect(mocks.record).toHaveBeenCalledTimes(1)
    expect(recordingAttr(container)).toBe('true')
    expect(onUnavailable).not.toHaveBeenCalled()

    // 松开 → recorder.stop() → uri 在 → STT 转写 → onComplete 收到文本
    await act(async () => {
      await apiRef.current?.stop()
    })
    expect(mocks.voiceSttFromReactNative).toHaveBeenCalledWith('file:///mock/recording.m4a', {
      language: 'zh',
      aiServiceUrl: 'http://localhost:8803',
      token: 'test-token',
    })
    expect(onComplete).toHaveBeenCalledWith('转写文本')
    expect(recordingAttr(container)).toBe('false')
  })

  it('授权 pending 期间松开(stop)→ start 续体按代次放弃,不凭空进录音态、无任何回调', async () => {
    let resolvePermission!: (value: { granted: boolean }) => void
    mocks.requestRecordingPermissionsAsync.mockImplementation(
      () =>
        new Promise<{ granted: boolean }>((resolve) => {
          resolvePermission = resolve
        }),
    )
    const onComplete = vi.fn()
    const onUnavailable = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    const { container } = render(createElement(Harness, { onComplete, onUnavailable, apiRef }))
    await flushMicrotasks() // 挂载期预请求挂起中

    act(() => {
      apiRef.current?.start() // 长按:发起懒补办,授权挂起
    })
    await flushMicrotasks()
    act(() => {
      apiRef.current?.stop() // 手指抬起:推进代次
    })
    await flushMicrotasks()
    resolvePermission({ granted: true }) // 授权此刻才回来
    await flushMicrotasks()
    await flushMicrotasks()

    expect(mocks.prepareToRecordAsync).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
    expect(recordingAttr(container)).toBe('false')
    expect(onUnavailable).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('prepareToRecordAsync 失败 → onUnavailable("record-failed") + onComplete("") + 退出录音态', async () => {
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true })
    mocks.prepareToRecordAsync.mockRejectedValueOnce(new Error('prepare failed'))
    const onComplete = vi.fn()
    const onUnavailable = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    const { container } = render(createElement(Harness, { onComplete, onUnavailable, apiRef }))
    await flushMicrotasks() // 挂载期预请求成功 → permissionRef 已置真

    act(() => {
      apiRef.current?.start()
    })
    await flushMicrotasks()

    // 已授权时空按短路懒补办,不再发起第二次请求
    expect(mocks.requestRecordingPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(onUnavailable).toHaveBeenCalledWith('record-failed')
    expect(onComplete).toHaveBeenCalledWith('')
    expect(recordingAttr(container)).toBe('false')
  })
})

/**
 * 2026-10-26 审计第 3 条:STT 这一腿此前直传 `getToken()` 快照 —— access token 15 分钟过期后
 * ai-service 恒 401,而这次 401 不经过 api-client 的出口,没有任何一层替它续期。
 * 现在它必须经过 lib/token 的兜带(新鲜度前置 + 只重试一次),且失败必须可归因。
 *
 * 分工纪律:兜带**本体**的判据用例在 tests/token.test.ts(测的是实现);本套件只测调用点
 * ——「走没走兜带」「拿的是谁给的凭据」「失败有没有递出原因」。
 */
describe('useVoiceRecorder — STT 走凭据兜带 + 失败可归因', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.setAudioModeAsync.mockResolvedValue(undefined)
    mocks.prepareToRecordAsync.mockResolvedValue(undefined)
    mocks.stop.mockResolvedValue(undefined)
    mocks.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true })
    mocks.voiceSttFromReactNative.mockResolvedValue('转写文本')
    mocks.getToken.mockReturnValue('test-token')
    mocks.runWithFreshToken.mockImplementation((run: (t: string | null) => Promise<string>) =>
      run(mocks.getToken()),
    )
    mocks.isCredentialRejected.mockReturnValue(false)
  })

  /** 渲染 → 长按 → 松开(让 stop 里的转写链跑完) */
  async function recordAndRelease(apiRef: { current: HarnessApi | null }) {
    await flushMicrotasks()
    act(() => {
      apiRef.current?.start()
    })
    await flushMicrotasks()
    await act(async () => {
      await apiRef.current?.stop()
    })
    await flushMicrotasks()
  }

  it('转写用的凭据来自兜带,不是 hook 自己取的 getToken() 快照', async () => {
    mocks.runWithFreshToken.mockImplementation((run: (t: string | null) => Promise<string>) =>
      run('fresh-from-wrapper'),
    )
    const apiRef: { current: HarnessApi | null } = { current: null }
    render(createElement(Harness, { apiRef }))
    await recordAndRelease(apiRef)

    expect(mocks.runWithFreshToken).toHaveBeenCalledTimes(1)
    expect(mocks.voiceSttFromReactNative).toHaveBeenCalledWith(
      'file:///mock/recording.m4a',
      expect.objectContaining({ token: 'fresh-from-wrapper' }),
    )
    // 反向锁:调用点不再自己摸凭据源(第二份取值必然漂移)
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('续期后仍被否定 ⇒ onSttFailed("credential") + onComplete(""),不冒充成功', async () => {
    mocks.runWithFreshToken.mockRejectedValue(
      Object.assign(new Error('401 Unauthorized'), { status: 401 }),
    )
    mocks.isCredentialRejected.mockReturnValue(true)
    const onComplete = vi.fn()
    const onSttFailed = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    render(createElement(Harness, { onComplete, onSttFailed, apiRef }))
    await recordAndRelease(apiRef)

    expect(onSttFailed).toHaveBeenCalledTimes(1)
    expect(onSttFailed).toHaveBeenCalledWith('credential')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('')
    expect(mocks.voiceSttFromReactNative).not.toHaveBeenCalled()
  })

  it('非凭据类失败(网络/5xx)⇒ onSttFailed("other") —— 归因不由界面猜', async () => {
    mocks.runWithFreshToken.mockRejectedValue(new Error('fetch failed'))
    mocks.isCredentialRejected.mockReturnValue(false)
    const onSttFailed = vi.fn()
    const onComplete = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    render(createElement(Harness, { onComplete, onSttFailed, apiRef }))
    await recordAndRelease(apiRef)

    expect(onSttFailed).toHaveBeenCalledWith('other')
    expect(onComplete).toHaveBeenCalledWith('')
  })

  it('调用方没接 onSttFailed 也不炸(退化成 console.warn + onComplete(""))', async () => {
    mocks.runWithFreshToken.mockRejectedValue(new Error('boom'))
    const onComplete = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const apiRef: { current: HarnessApi | null } = { current: null }
    render(createElement(Harness, { onComplete, apiRef }))
    await recordAndRelease(apiRef)

    expect(onComplete).toHaveBeenCalledWith('')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('原始录音模式(transcribe=false)不碰兜带(那条腿不发 STT 请求)', async () => {
    const onRecorded = vi.fn()
    const apiRef: { current: HarnessApi | null } = { current: null }
    function Raw() {
      apiRef.current = useVoiceRecorder({ transcribe: false, onRecorded })
      return null
    }
    render(createElement(Raw))
    await recordAndRelease(apiRef)

    expect(onRecorded).toHaveBeenCalledWith('file:///mock/recording.m4a', 0)
    expect(mocks.runWithFreshToken).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
