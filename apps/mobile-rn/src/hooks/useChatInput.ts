// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useChatInput — ChatScreen MessageInput 所需的所有输入态 + 平台能力封装(mobile-rn 端)
 *
 * 集中管理:
 * - inputFiles:附件列表(图片/文档/视频)
 * - isVoiceMode / isRecording:语音模式 + 录音状态(expo-audio)
 * - isFullscreen:全屏放大模式
 * - isFocused:输入框焦点
 * - agentVariables:Agent 变量填槽(本任务先返空数组,后续接入)
 *
 * 平台 API:
 * - 图片/文件选择:expo-image-picker
 * - 语音录制:expo-audio(useAudioRecorder)
 *
 * 2026-07-29:补全 ChatScreen 包装层所需的 13+ MessageInput props/事件。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import type { MessageInputAgentVariable, MessageInputFile, MessageInputFileType } from '@ihui/types'

let fileIdCounter = 0
const nextFileId = (): string => `file-${Date.now()}-${++fileIdCounter}`

type AssetLike = {
  uri?: string | null
  fileName?: string | null
  mimeType?: string | null
  type?: 'image' | 'video' | string | null
}

function inferTypeFromMime(
  mime: string | null | undefined,
  fallback: MessageInputFileType,
): MessageInputFileType {
  if (!mime) return fallback
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'document'
}

function buildFileFromAsset(asset: AssetLike, fallback: MessageInputFileType): MessageInputFile {
  const mime = asset.mimeType ?? null
  let type: MessageInputFileType = fallback
  if (asset.type === 'image' || asset.type === 'video') {
    type = asset.type
  } else if (mime) {
    type = inferTypeFromMime(mime, fallback)
  }
  return {
    id: nextFileId(),
    url: asset.uri ?? '',
    filename: asset.fileName ?? undefined,
    type,
  }
}

export interface UseChatInputResult {
  inputFiles: MessageInputFile[]
  isVoiceMode: boolean
  isRecording: boolean
  /** 录音时长(秒,长按期间每秒 +1;松开清零) */
  recordingDuration: number
  isInputFullscreen: boolean
  isInputFocused: boolean
  agentVariables: MessageInputAgentVariable[]

  onInputAddImage: () => Promise<void>
  onInputAddFile: () => Promise<void>
  onInputRemoveFile: (id: string) => void
  onInputVoiceToggle: () => void
  onInputFullscreenToggle: () => void
  onInputFocus: () => void
  onInputBlur: () => void
  onInputVoiceStart: () => Promise<void>
  onInputVoiceEnd: () => Promise<void>
  onInputAgentVariableTextChange: (index: number, value: string) => void
  onInputAgentVariableImageChange: (index: number) => Promise<void>
}

export interface UseChatInputOptions {
  /**
   * 录音不可用回调(2026-10-15:原失败路径走 Alert.alert,react-native-web 上是 no-op,
   * web 预览长按麦克风静默失效 —— 与 useVoiceRecorder 的 onUnavailable 同构收口)。
   * reason 语义与 use-voice-recorder 对齐:permission-denied / record-failed。
   * 调用方(ChatScreen)接 showToast;回调缺省时保留 Alert 兜底(原生端行为不变)。
   */
  onVoiceUnavailable?: (reason: 'permission-denied' | 'record-failed', message: string) => void
  /**
   * 录音完成回调(2026-10-16 录音消息上线):松手拿到本地录音 uri + 时长(秒),
   * 由调用方上传服务器并作为语音气泡消息发送。替代原「占位 inputFiles」方案
   * (那个方案只把本地 uri 挂成 document 附件,发不出去也回听不了)。
   */
  onVoiceRecorded?: (uri: string, durationSec: number) => void
}

export function useChatInput(options?: UseChatInputOptions): UseChatInputResult {
  const [inputFiles, setInputFiles] = useState<MessageInputFile[]>([])
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [recordingDuration, setRecordingDuration] = useState<number>(0)
  const [isInputFullscreen, setIsInputFullscreen] = useState<boolean>(false)
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false)
  const [agentVariables, setAgentVariables] = useState<MessageInputAgentVariable[]>([])

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!)
  const recordingRef = useRef<boolean>(false)
  // 录音计时:ref 镜像供回调读「松手这一瞬」的时长(state 版供 UI 显示)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)
  // 回调走 ref 持有(useCallback 依赖零抖动,recorder 不会因调用方每次渲染传新箭头而重挂)
  const onVoiceUnavailableRef = useRef(options?.onVoiceUnavailable)
  onVoiceUnavailableRef.current = options?.onVoiceUnavailable
  const onVoiceRecordedRef = useRef(options?.onVoiceRecorded)
  onVoiceRecordedRef.current = options?.onVoiceRecorded

  const clearDurationTimer = (): void => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
  }

  // 首次进入:申请麦克风权限 + 配置音频模式(静默模式 + 允许录音)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync()
        if (cancelled) return
        if (status.granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })
        }
      } catch {
        // 权限失败不阻塞 UI,语音按钮按下时再次校验
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 卸载:若仍在录音则强制停止
  useEffect(
    () => () => {
      if (recordingRef.current) {
        recordingRef.current = false
        void recorder.stop().catch(() => undefined)
      }
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    },
    [recorder],
  )

  const onInputAddImage = useCallback(async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      if (result.canceled) return
      const asset = result.assets?.[0] as AssetLike | undefined
      if (!asset?.uri) return
      const file = buildFileFromAsset(asset, 'image')
      setInputFiles((prev) => [...prev, file])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown'
      Alert.alert('image picker error', msg)
    }
  }, [])

  const onInputAddFile = useCallback(async (): Promise<void> => {
    // 项目未安装 expo-document-picker:fallback 为调 ImagePicker.MediaTypeOptions.All(图片 + 视频)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      if (result.canceled) return
      const asset = result.assets?.[0] as AssetLike | undefined
      if (!asset?.uri) return
      // type 字段存在(来自 ImagePicker)优先,否则从 mimeType 推断
      const fallback: MessageInputFileType = Platform.OS === 'ios' ? 'image' : 'image'
      const file = buildFileFromAsset(asset, fallback)
      setInputFiles((prev) => [...prev, file])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown'
      Alert.alert('file picker error', msg)
    }
  }, [])

  const onInputRemoveFile = useCallback((id: string): void => {
    setInputFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const onInputVoiceToggle = useCallback((): void => {
    setIsVoiceMode((prev) => {
      if (prev && recordingRef.current) {
        // 退出语音模式时若仍在录音 → 主动停止
        recordingRef.current = false
        void recorder.stop().catch(() => undefined)
        setIsRecording(false)
        clearDurationTimer()
      }
      return !prev
    })
  }, [recorder])

  const onInputFullscreenToggle = useCallback((): void => {
    setIsInputFullscreen((prev) => !prev)
  }, [])

  const onInputFocus = useCallback((): void => {
    setIsInputFocused(true)
  }, [])

  const onInputBlur = useCallback((): void => {
    setIsInputFocused(false)
  }, [])

  const onInputVoiceStart = useCallback(async (): Promise<void> => {
    if (recordingRef.current) return
    // 按住中即置位(长按会话活跃标记):原实现只在 record() 后置位,导致 prepare 后的
    // "已松开"守卫恒真 ⇒ 全平台长按永不开始录音且无任何反馈(2026-10-15 web 实测静默)。
    // prepare 期间松开由 onInputVoiceEnd 清掉本标记,守卫据实判定。
    recordingRef.current = true
    // 计时与按住同帧启动:UI 从第一帧就走时长(微信同感),ref 镜像供松手时读取
    durationRef.current = 0
    setRecordingDuration(0)
    clearDurationTimer()
    durationTimerRef.current = setInterval(() => {
      durationRef.current += 1
      setRecordingDuration(durationRef.current)
    }, 1000)
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync()
      if (!status.granted) {
        recordingRef.current = false
        clearDurationTimer()
        setIsRecording(false)
        const message = '无法访问麦克风,请检查权限设置'
        if (onVoiceUnavailableRef.current) {
          onVoiceUnavailableRef.current('permission-denied', message)
          return
        }
        Alert.alert('permission denied', 'microphone permission required')
        return
      }
      await recorder.prepareToRecordAsync()
      // prepare 期间用户可能已松开 → 不再开始
      if (!recordingRef.current) {
        clearDurationTimer()
        return
      }
      recorder.record()
      setIsRecording(true)
    } catch (err: unknown) {
      recordingRef.current = false
      setIsRecording(false)
      clearDurationTimer()
      const msg = err instanceof Error ? err.message : 'unknown'
      if (onVoiceUnavailableRef.current) {
        onVoiceUnavailableRef.current('record-failed', msg || '录音启动失败,请重试')
        return
      }
      Alert.alert('recorder error', msg)
    }
  }, [recorder])

  const onInputVoiceEnd = useCallback(async (): Promise<void> => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setIsRecording(false)
    clearDurationTimer()
    const durationSec = durationRef.current
    let uri = ''
    try {
      await recorder.stop()
      uri = recorder.uri ?? ''
    } catch {
      uri = ''
    }
    if (!uri) return
    // 2026-10-16 录音消息:本地录音交给调用方上传并作为语音气泡发送。
    // 原「占位 document 附件」方案已废 —— 那条路既发不出去,也没有回听入口。
    onVoiceRecordedRef.current?.(uri, durationSec)
  }, [recorder])

  const onInputAgentVariableTextChange = useCallback((index: number, value: string): void => {
    setAgentVariables((prev) => {
      if (index < 0 || index >= prev.length) return prev
      const next = prev.slice()
      const target = next[index]
      if (!target) return prev
      next[index] = { ...target, value }
      return next
    })
  }, [])

  const onInputAgentVariableImageChange = useCallback(async (index: number): Promise<void> => {
    // 复用 onInputAddImage 的 picker,选定后写入对应变量
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      })
      if (result.canceled) return
      const asset = result.assets?.[0] as AssetLike | undefined
      if (!asset?.uri) return
      setAgentVariables((prev) => {
        if (index < 0 || index >= prev.length) return prev
        const next = prev.slice()
        const target = next[index]
        if (!target) return prev
        next[index] = { ...target, value: asset.uri ?? '' }
        return next
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown'
      Alert.alert('agent variable image error', msg)
    }
  }, [])

  return {
    inputFiles,
    isVoiceMode,
    isRecording,
    recordingDuration,
    isInputFullscreen,
    isInputFocused,
    agentVariables,
    onInputAddImage,
    onInputAddFile,
    onInputRemoveFile,
    onInputVoiceToggle,
    onInputFullscreenToggle,
    onInputFocus,
    onInputBlur,
    onInputVoiceStart,
    onInputVoiceEnd,
    onInputAgentVariableTextChange,
    onInputAgentVariableImageChange,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
