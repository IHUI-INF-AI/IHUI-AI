/**
 * 语音输入组件(mobile-rn 端)— 占位实现
 *
 * 当前 mobile-rn 未安装 expo-av / expo-speech-recognition,本组件用
 * 长按手势 + 计时器 + 假数据占位,等安装后再补真实录音与 ASR 逻辑。
 *
 * 依赖待安装(见 .trae-cn/tmp/p0-5-rn-expo-av-needed.txt):
 * - expo-av (录音) 或 expo-audio(SDK 53+)
 * - expo-speech-recognition (语音转文字) 或后端 ASR 接口
 *
 * 用法:
 *   <VoiceInput onComplete={(text) => setInputText(text)} />
 *
 * 交互:长按按钮 0.3s 开始录音 → 波形动画 + 计时器 → 松开触发 onComplete。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../i18n'

export interface VoiceInputProps {
  /** 识别完成时回调(松开按钮时触发) */
  onComplete?: (text: string) => void
  /** 识别过程中回调(占位实现不触发,保留 API 兼容) */
  onChange?: (text: string) => void
  /** 禁用 */
  disabled?: boolean
  /** 自定义按钮文案 */
  placeholder?: string
}

// 占位假数据:模拟 ASR 返回的文本(等接入真实 ASR 后移除)
const FAKE_RESULTS = [
  '你好,请帮我写一首诗',
  '今天天气怎么样?',
  '帮我查询最近的新闻',
  '请介绍一下 React Native',
  '给我讲个故事吧',
]
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

  const finalize = useCallback(() => {
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // 占位:返回一个假文本(等安装 expo-av 后替换为真实 ASR)
    const fake =
      FAKE_RESULTS[Math.floor(Math.random() * FAKE_RESULTS.length)] ?? ''
    onChange?.(fake)
    onComplete?.(fake)
  }, [onChange, onComplete])

  // 录音启动:计时器 + 波形动画
  useEffect(() => {
    if (!recording) return
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
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
    if (recording && duration >= RECORD_MAX_SECONDS) {
      finalize()
    }
  }, [recording, duration, finalize])

  const handleLongPress = useCallback(() => {
    if (disabled || recording) return
    setRecording(true)
    setDuration(0)
  }, [disabled, recording])

  const handlePressOut = useCallback(() => {
    if (!recording) return
    finalize()
  }, [recording, finalize])

  const barHeight = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 28],
  })

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
            <Animated.View
              style={[styles.bar, { height: barHeight }]}
              className="w-1 bg-red-500"
            />
            <Animated.View
              style={[styles.bar, { height: barHeight }]}
              className="w-1 bg-red-400"
            />
            <Animated.View
              style={[styles.bar, { height: barHeight }]}
              className="w-1 bg-red-500"
            />
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

const styles = StyleSheet.create({
  bar: { borderRadius: 2 },
})

export default VoiceInput
