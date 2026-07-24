import { View, Text } from '@tarojs/components'
import { useState, useRef, useEffect, useCallback } from 'react'
import streamingRecognizer from '@/utils/streaming-recognizer'
import { useI18n } from '@/i18n'

export interface VoiceInputProps {
  disabled?: boolean
  placeholder?: string
  /** 实时识别(部分结果) */
  onChange?: (text: string) => void
  /** 最终识别结果 */
  onComplete?: (text: string) => void
  onError?: (message: string) => void
}

const WAVE_BARS = [0, 1, 2, 3, 4, 5, 6]

export default function VoiceInput({
  disabled = false,
  placeholder,
  onChange,
  onComplete,
  onError,
}: VoiceInputProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [partial, setPartial] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 使用 ref 避免回调变更导致重复注册
  const cbRef = useRef({ onChange, onComplete, onError })
  cbRef.current = { onChange, onComplete, onError }

  useEffect(() => {
    streamingRecognizer.on('partial', (text) => {
      setPartial(text)
      cbRef.current.onChange?.(text)
    })
    streamingRecognizer.on('final', (text) => {
      setPartial('')
      cbRef.current.onComplete?.(text)
    })
    streamingRecognizer.on('error', (msg) => {
      cbRef.current.onError?.(msg)
    })
    return () => {
      streamingRecognizer.cancel()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecord = useCallback(async () => {
    if (disabled || recording) return
    try {
      setPartial('')
      setElapsed(0)
      await streamingRecognizer.startRecognizing()
      setRecording(true)
      timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000)
    } catch (err) {
      cbRef.current.onError?.(String((err as Error)?.message || '录音启动失败'))
    }
  }, [disabled, recording])

  const stopRecord = useCallback(async () => {
    if (!recording) return
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const text = await streamingRecognizer.stopRecognizing()
    if (text) cbRef.current.onComplete?.(text)
  }, [recording])

  const cancelRecord = useCallback(() => {
    if (!recording) return
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamingRecognizer.cancel()
    setPartial('')
  }, [recording])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <View className="w-full">
      <View
        className={`flex items-center justify-center min-h-12 rounded-lg px-4 py-3 ${
          recording ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted'
        } ${disabled ? 'opacity-50' : ''}`}
        onTouchStart={startRecord}
        onTouchEnd={stopRecord}
        onTouchCancel={cancelRecord}
      >
        {recording ? (
          <View className="flex flex-row items-center">
            <View className="flex flex-row items-center mr-2 h-5">
              {WAVE_BARS.map((i) => (
                <View
                  key={i}
                  className="w-1 mx-0.5 bg-red-500 rounded-sm animate-pulse"
                  style={{ height: '60%', animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </View>
            <Text className="text-sm text-red-600 dark:text-red-400 mr-2">
              {mm}:{ss}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {tt('ai.voice.releaseToSend', '松开发送')}
            </Text>
          </View>
        ) : (
          <Text className="text-sm text-foreground">
            {partial || placeholder || tt('ai.voice.holdToSpeak', '按住说话')}
          </Text>
        )}
      </View>
    </View>
  )
}
