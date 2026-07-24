/** 语音输入组件(mobile-rn)— expo-audio 真实录音,长按录制 m4a/aac,松开返回 URI */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio'
import { useI18n } from '../i18n'

export interface VoiceInputProps {
  /** 录音完成时回调(松开按钮时触发,参数为音频 URI) */
  onComplete?: (text: string) => void
  /** 录音过程中回调(保留 API 兼容,本实现仅在完成时触发) */
  onChange?: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

const RECORD_MAX_SECONDS = 60

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function VoiceInput({
  onComplete,
  onChange,
  disabled = false,
  placeholder,
}: VoiceInputProps) {
  const { t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveAnim = useRef(new Animated.Value(0)).current
  const recordingRef = useRef(false)
  const permissionRef = useRef(false)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)

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

  const finalize = useCallback(async () => {
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
    onChange?.(uri)
    onComplete?.(uri)
  }, [onChange, onComplete, recorder])

  // 计时器 + 波形动画
  useEffect(() => {
    if (!recording) return
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(waveAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]),
    )
    loop.start()
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      loop.stop()
    }
  }, [recording, waveAnim])

  // 达到上限自动结束
  useEffect(() => {
    if (recording && duration >= RECORD_MAX_SECONDS) void finalize()
  }, [recording, duration, finalize])

  const handleLongPress = useCallback(() => {
    if (disabled || recordingRef.current) return
    if (!permissionRef.current) {
      onComplete?.('')
      return
    }
    recordingRef.current = true
    setRecording(true)
    setDuration(0)
    void (async () => {
      try {
        await recorder.prepareToRecordAsync()
        if (!recordingRef.current) {
          // 用户在 prepare 期间松开 → 直接停止
          try { await recorder.stop() } catch { /* ignore */ }
          return
        }
        recorder.record()
      } catch {
        if (recordingRef.current) {
          recordingRef.current = false
          setRecording(false)
          onComplete?.('')
        }
      }
    })()
  }, [disabled, recorder, onComplete])

  const handlePressOut = useCallback(() => {
    if (!recordingRef.current) return
    void finalize()
  }, [finalize])

  const barHeight = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 28] })

  return (
    <View className="flex-row items-center">
      <Pressable
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        delayLongPress={300}
        disabled={disabled}
        className={
          recording
            ? 'items-center justify-center rounded-lg bg-red-50 px-3 py-2'
            : 'items-center justify-center rounded-lg bg-gray-50 px-3 py-2 disabled:opacity-40'
        }
        accessibilityLabel={t('chat.voice')}
        accessibilityRole="button"
      >
        {recording ? (
          <View className="flex-row items-center gap-1.5">
            <Animated.View style={[styles.bar, { height: barHeight }]} className="w-1 bg-red-500" />
            <Animated.View style={[styles.bar, { height: barHeight }]} className="w-1 bg-red-400" />
            <Animated.View style={[styles.bar, { height: barHeight }]} className="w-1 bg-red-500" />
            <Text className="ml-1 text-xs text-red-600">
              {formatDuration(duration)} 松开结束
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-gray-600">{placeholder ?? '按住说话'}</Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({ bar: { borderRadius: 2 } })

export default VoiceInput
