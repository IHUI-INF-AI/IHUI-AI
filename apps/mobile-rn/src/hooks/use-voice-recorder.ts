// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useVoiceRecorder — 语音录音 + STT 转写 hook(mobile-rn)
 *
 * 从 VoiceInput 组件提取录音/转写核心逻辑(expo-audio 录音 → ai-service
 * /api/voice/stt 转文字),供 InputArea 内嵌麦克风(HomeScreen 大输入框)复用。
 * VoiceInput 组件本身保持不动(AiAssistantN8nScreen 仍在使用)。
 *
 * 交互契约(对齐 VoiceInput):长按 start → 松开 stop → 转写完成回调 onComplete(text);
 * 失败/无权限/空录音回调 onComplete('')。
 * 2026-10-15:新增 onUnavailable(无权限/录音启动失败的用户可见反馈入口)+ 授权懒补办
 * (web 端挂载期预请求无手势上下文必失败,原先此后长按永远静默)+ 松开竞态守卫。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import { voiceSttFromReactNative } from '@ihui/api-client'
import { getToken } from '../lib/token'

const RECORD_MAX_SECONDS = 60
// 授权请求兜底超时:内嵌/无麦克风的浏览器里 getUserMedia 系授权可能永远 pending
// (不 resolve 也不 reject),不兜底 = 长按再次陷入静默。4s 与业务探测超时同量级。
const PERMISSION_REQUEST_TIMEOUT_MS = 4_000

export interface UseVoiceRecorderOptions {
  /** 转写完成回调(空串 = 失败/无权限/空录音) */
  onComplete?: (text: string) => void
  /** 录音无法开始的用户可见反馈回调(无权限 / prepare 失败)。
   *  2026-10-15:此前 start() 的两条失败路径都只回调 onComplete(''),界面零反馈,
   *  web 预览长按麦克风表现为「点了没反应」(用户报障)。 */
  onUnavailable?: (reason: 'permission-denied' | 'record-failed') => void
  /** ai-service URL(默认 http://localhost:8803,与 VoiceInput 一致) */
  aiServiceUrl?: string
  /** 语言提示(默认 zh) */
  language?: string
}

export function useVoiceRecorder({
  onComplete,
  onUnavailable,
  aiServiceUrl = 'http://localhost:8803',
  language = 'zh',
}: UseVoiceRecorderOptions = {}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false)
  const permissionRef = useRef(false)
  // start 异步续体的代次:授权等待/prepare 期间用户松开(stop)会推进代次,
  // 续体据此放弃开始,避免「手指已抬起却凭空进入录音态」。
  const startEpochRef = useRef(0)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!)

  // 请求麦克风权限 + 配置音频模式
  useEffect(() => {
    void (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync()
        permissionRef.current = status.granted
        if (status.granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })
        }
      } catch {
        permissionRef.current = false
      }
    })()
  }, [])

  // 卸载时停止录音
  useEffect(
    () => () => {
      if (recordingRef.current) {
        recordingRef.current = false
        void recorder.stop().catch(() => {})
      }
    },
    [recorder],
  )

  const stop = useCallback(async () => {
    // 推进代次:让仍在等待授权/prepare 的 start 续体放弃(用户已松开)
    startEpochRef.current += 1
    if (!recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    let uri = ''
    try {
      await recorder.stop()
      uri = recorder.uri ?? ''
    } catch {
      uri = ''
    }

    // 录音 URI → ai-service STT 转文字(空串 = 失败,调用方自行忽略)
    if (!uri) {
      onComplete?.('')
      return
    }

    setTranscribing(true)
    try {
      const text = await voiceSttFromReactNative(uri, {
        language,
        aiServiceUrl,
        token: getToken() ?? undefined,
      })
      onComplete?.(text)
    } catch {
      onComplete?.('')
    } finally {
      setTranscribing(false)
    }
  }, [onComplete, recorder, language, aiServiceUrl])

  const start = useCallback(() => {
    if (recordingRef.current) return
    const epoch = ++startEpochRef.current
    void (async () => {
      // 授权懒补办:挂载期的预请求在 web 端没有用户手势上下文(浏览器要求权限弹窗必须
      // 挂在手势上),一旦失败 permissionRef 恒 false ⇒ 此后长按永远静默无反应(web 预览
      // 实测病灶)。长按本身就是手势,在这里补一次请求;真机已授权时此分支零开销。
      if (!permissionRef.current) {
        try {
          // Promise.race 兜底:授权永不 resolve 的环境(无麦克风设备的内嵌浏览器)按无权限处理,
          // 保证 onUnavailable 反馈必然触达
          const status = await Promise.race([
            AudioModule.requestRecordingPermissionsAsync(),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), PERMISSION_REQUEST_TIMEOUT_MS),
            ),
          ])
          permissionRef.current = status !== null && status.granted
          if (permissionRef.current) {
            try {
              await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })
            } catch {
              /* 音频模式配置失败不拦录音,prepareToRecordAsync 自己会报 */
            }
          }
        } catch {
          permissionRef.current = false
        }
      }
      // 授权等待期间用户已松开 ⇒ 不要凭空进入录音态
      if (epoch !== startEpochRef.current) return
      if (!permissionRef.current) {
        onUnavailable?.('permission-denied')
        onComplete?.('')
        return
      }
      recordingRef.current = true
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      try {
        await recorder.prepareToRecordAsync()
        if (!recordingRef.current) {
          // 用户在 prepare 期间松开 → 直接停止
          try {
            await recorder.stop()
          } catch {
            /* ignore */
          }
          return
        }
        recorder.record()
      } catch {
        if (recordingRef.current) {
          recordingRef.current = false
          setRecording(false)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          onUnavailable?.('record-failed')
          onComplete?.('')
        }
      }
    })()
  }, [recorder, onComplete, onUnavailable])

  // 达到上限自动结束
  useEffect(() => {
    if (recording && duration >= RECORD_MAX_SECONDS) void stop()
  }, [recording, duration, stop])

  return { recording, transcribing, duration, start, stop }
}

export default useVoiceRecorder
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
