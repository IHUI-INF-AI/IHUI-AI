// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useVoiceRecorder — 语音录音 + STT 转写 hook(mobile-rn)
 *
 * 从 VoiceInput 组件提取录音/转写核心逻辑(expo-audio 录音 → ai-service
 * /api/voice/stt 转文字),供 InputArea 内嵌麦克风(HomeScreen 大输入框)复用。
 * VoiceInput 组件本身保持不动(AiAssistantN8nScreen 仍在使用)。
 *
 * 交互契约(对齐 VoiceInput):长按 start → 松开 stop → 转写完成回调 onComplete(text);
 * 失败/无权限/空录音回调 onComplete('')。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import { voiceSttFromReactNative } from '@ihui/api-client'
import { getToken } from '../lib/token'

const RECORD_MAX_SECONDS = 60

export interface UseVoiceRecorderOptions {
  /** 转写完成回调(空串 = 失败/无权限/空录音) */
  onComplete?: (text: string) => void
  /** ai-service URL(默认 http://localhost:8803,与 VoiceInput 一致) */
  aiServiceUrl?: string
  /** 语言提示(默认 zh) */
  language?: string
}

export function useVoiceRecorder({
  onComplete,
  aiServiceUrl = 'http://localhost:8803',
  language = 'zh',
}: UseVoiceRecorderOptions = {}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false)
  const permissionRef = useRef(false)
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
    if (!permissionRef.current) {
      onComplete?.('')
      return
    }
    recordingRef.current = true
    setRecording(true)
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    void (async () => {
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
          onComplete?.('')
        }
      }
    })()
  }, [recorder, onComplete])

  // 达到上限自动结束
  useEffect(() => {
    if (recording && duration >= RECORD_MAX_SECONDS) void stop()
  }, [recording, duration, stop])

  return { recording, transcribing, duration, start, stop }
}

export default useVoiceRecorder
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
