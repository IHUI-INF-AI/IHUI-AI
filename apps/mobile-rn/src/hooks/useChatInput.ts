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
import type {
  MessageInputAgentVariable,
  MessageInputFile,
  MessageInputFileType,
} from '@ihui/types'

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

export function useChatInput(): UseChatInputResult {
  const [inputFiles, setInputFiles] = useState<MessageInputFile[]>([])
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [isInputFullscreen, setIsInputFullscreen] = useState<boolean>(false)
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false)
  const [agentVariables, setAgentVariables] = useState<MessageInputAgentVariable[]>([])

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!)
  const recordingRef = useRef<boolean>(false)

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
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync()
      if (!status.granted) {
        Alert.alert('permission denied', 'microphone permission required')
        return
      }
      await recorder.prepareToRecordAsync()
      // prepare 期间用户可能已松开 → 不再开始
      if (!recordingRef.current) {
        return
      }
      recorder.record()
      recordingRef.current = true
      setIsRecording(true)
    } catch (err: unknown) {
      recordingRef.current = false
      setIsRecording(false)
      const msg = err instanceof Error ? err.message : 'unknown'
      Alert.alert('recorder error', msg)
    }
  }, [recorder])

  const onInputVoiceEnd = useCallback(async (): Promise<void> => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setIsRecording(false)
    let uri = ''
    try {
      await recorder.stop()
      uri = recorder.uri ?? ''
    } catch {
      uri = ''
    }
    if (!uri) return
    // 录音暂存为占位附件(类型=image 不可,语音非图片/视频,采用 'document' 占位)
    // 实际项目应上传服务器,这里只做本地 uri 占位 + console.log
    const placeholder: MessageInputFile = {
      id: nextFileId(),
      url: uri,
      filename: 'voice.m4a',
      type: 'document',
    }
    setInputFiles((prev) => [...prev, placeholder])
    // 上传接入点:此处可调 uploadFileMultipart 上传到服务器,获得 CDN URL 后替换 placeholder.url
    // 当前阶段:只 console.log 兜底
    // eslint-disable-next-line no-console
    console.log('[useChatInput] voice recorded uri=', uri, '待上传到服务器后替换为远端 url')
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
