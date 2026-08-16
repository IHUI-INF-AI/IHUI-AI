/** 语音输入组件(mobile-rn)— expo-audio 真实录音 + ai-service faster-whisper 转文字。
 *
 * 2026-07-28 修复 bug:原实现只返回音频 URI,没调用 STT 转文字。
 * 现在改为:录音停止 → 上传到 ai-service /api/voice/stt → 返回转写文字。
 *
 * 对齐历史 Uniapp VoiceInput/index.vue 补全(不破坏现有录音/STT):
 * - 图片弹出层(相机/相册/文件:onImageSelected(type) 回调预留,不引入原生依赖)
 * - 遮罩层(弹出层打开时透明遮罩拦截点击以关闭,分离点击/长按)
 * - 清除按钮(清除最近一次语音结果:onChange?.('') 回传)
 * - 50 线语音动画 → 简化 12 条波形条(单 Animated 循环 + 相位错峰)
 *
 * 共享类型 VoiceInputMinimalProps 已下沉到 @ihui/types,
 * 本地 Props extends Minimal 并追加 aiServiceUrl/language + 图片/清除扩展。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { formatShortDuration } from '@ihui/shared/utils'
import { voiceSttFromReactNative } from '@ihui/api-client'
import type { VoiceInputMinimalProps } from '@ihui/types'

/** 图片弹出层来源类型(对齐 Uniapp handleIconClick(type):camera/album/file) */
export type VoiceImageSource = 'camera' | 'album' | 'file'

export interface VoiceInputProps extends VoiceInputMinimalProps {
  /** ai-service URL(默认 http://localhost:8803) */
  aiServiceUrl?: string
  /** 语言提示(默认 zh) */
  language?: string
  /** 图片弹出层选择回调(预留:相机/相册/文件,不引入原生图片选择依赖) */
  onImageSelected?: (type: VoiceImageSource) => void
  /** 是否显示图片弹出层入口(默认 true,对齐原版 search-add 按钮) */
  showImagePicker?: boolean
  /** 是否显示清除按钮(默认 true,清除最近一次语音结果) */
  showClear?: boolean
}

const RECORD_MAX_SECONDS = 60
const WAVE_BAR_COUNT = 12
const WAVE_MIN = 6
const WAVE_MAX = 28
const WAVE_SAMPLES = [0, 0.25, 0.5, 0.75, 1]

const IMAGE_SOURCES: ReadonlyArray<{ type: VoiceImageSource; emoji: string; label: string }> = [
  { type: 'camera', emoji: '📷', label: '相机' },
  { type: 'album', emoji: '🖼️', label: '相册' },
  { type: 'file', emoji: '📁', label: '文件' },
]

export function VoiceInput({
  onComplete,
  onChange,
  disabled = false,
  placeholder,
  aiServiceUrl = 'http://localhost:8803',
  language = 'zh',
  onImageSelected,
  showImagePicker = true,
  showClear = true,
}: VoiceInputProps) {
  const { t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [showImagePopup, setShowImagePopup] = useState(false)
  const [lastResult, setLastResult] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveAnim = useRef(new Animated.Value(0)).current
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

    // 录音 URI → ai-service STT 转文字(2026-07-28 修复:原实现直接返回 URI)
    if (!uri) {
      setLastResult('')
      onChange?.('')
      onComplete?.('')
      return
    }

    setTranscribing(true)
    try {
      const text = await voiceSttFromReactNative(uri, { language, aiServiceUrl })
      setLastResult(text)
      onChange?.(text)
      onComplete?.(text)
    } catch {
      setLastResult('')
      onChange?.('')
      onComplete?.('')
    } finally {
      setTranscribing(false)
    }
  }, [onChange, onComplete, recorder, language, aiServiceUrl])

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
          onComplete?.('')
        }
      }
    })()
  }, [disabled, recorder, onComplete])

  const handlePressOut = useCallback(() => {
    if (!recordingRef.current) return
    void finalize()
  }, [finalize])

  // 清除最近一次语音结果(对齐 Uniapp clearSearch)
  const handleClear = useCallback(() => {
    setLastResult('')
    onChange?.('')
  }, [onChange])

  // 图片弹出层选择(回调预留,不引入原生图片选择依赖)
  const handleImagePick = useCallback(
    (type: VoiceImageSource) => {
      setShowImagePopup(false)
      onImageSelected?.(type)
    },
    [onImageSelected],
  )

  // 12 条波形(单 Animated 循环 + 相位错峰,替代原版 50 线)
  const bars = useMemo(
    () =>
      Array.from({ length: WAVE_BAR_COUNT }, (_, i) => {
        const phase = (i / WAVE_BAR_COUNT) * Math.PI * 2
        const heights = WAVE_SAMPLES.map(
          (s) => WAVE_MIN + ((1 + Math.sin(s * Math.PI * 2 + phase)) / 2) * (WAVE_MAX - WAVE_MIN),
        )
        return waveAnim.interpolate({ inputRange: WAVE_SAMPLES, outputRange: heights })
      }),
    [waveAnim],
  )

  return (
    <View style={styles.container}>
      {/* 遮罩层:图片弹出层打开时,透明遮罩拦截点击以关闭(分离点击/长按) */}
      {showImagePopup ? (
        <Pressable
          style={styles.mask}
          onPress={() => setShowImagePopup(false)}
          accessibilityLabel="关闭图片菜单"
        />
      ) : null}

      {/* 图片弹出层入口(对齐原版 search-add 按钮) */}
      {showImagePicker ? (
        <Pressable
          style={styles.imageToggleBtn}
          onPress={() => setShowImagePopup((v) => !v)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="添加图片"
        >
          <Text style={styles.imageToggleIcon} allowFontScaling={false}>
            {'＋'}
          </Text>
        </Pressable>
      ) : null}

      {/* 语音按钮:长按录音,松开转写 */}
      <Pressable
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        delayLongPress={300}
        disabled={disabled || transcribing}
        style={[
          styles.voiceBtn,
          recording ? styles.voiceBtnRecording : null,
          transcribing ? styles.voiceBtnTranscribing : null,
          disabled || transcribing ? styles.voiceBtnDisabled : null,
        ]}
        accessibilityLabel={t('chat.voice')}
        accessibilityRole="button"
      >
        {recording ? (
          <View style={styles.waveRow}>
            {bars.map((h, i) => (
              <Animated.View key={i} style={[styles.bar, { height: h }]} />
            ))}
            <Text style={styles.recordingText}>{formatShortDuration(duration)} 松开结束</Text>
          </View>
        ) : transcribing ? (
          <Text style={styles.transcribingText}>转写中…</Text>
        ) : (
          <Text style={styles.idleText}>{placeholder ?? '按住说话'}</Text>
        )}
      </Pressable>

      {/* 清除按钮(有结果时显示,对齐原版 clearIcon) */}
      {showClear && lastResult !== '' ? (
        <Pressable
          style={styles.clearBtn}
          onPress={handleClear}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="清除结果"
        >
          <Text style={styles.clearIcon} allowFontScaling={false}>
            {'×'}
          </Text>
        </Pressable>
      ) : null}

      {/* 图片弹出层:相机 / 相册 / 文件 */}
      {showImagePopup ? (
        <View style={styles.imagePopup}>
          {IMAGE_SOURCES.map((item) => (
            <Pressable
              key={item.type}
              style={styles.popupItem}
              onPress={() => handleImagePick(item.type)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.popupEmoji} allowFontScaling={false}>
                {item.emoji}
              </Text>
              <Text style={styles.popupLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  mask: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  } as ViewStyle,
  imageToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  imageToggleIcon: {
    fontSize: 18,
    lineHeight: 22,
    color: tokens.text.secondary,
  } as TextStyle,
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  voiceBtnRecording: {
    backgroundColor: tokens.danger.light,
  } as ViewStyle,
  voiceBtnTranscribing: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  voiceBtnDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  } as ViewStyle,
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: tokens.danger.DEFAULT,
  } as ViewStyle,
  recordingText: {
    marginLeft: 8,
    fontSize: 12,
    color: tokens.danger.DEFAULT,
  } as TextStyle,
  transcribingText: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as TextStyle,
  idleText: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as TextStyle,
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  clearIcon: {
    fontSize: 16,
    lineHeight: 18,
    color: tokens.text.secondary,
    fontWeight: '600',
  } as TextStyle,
  imagePopup: {
    position: 'absolute',
    bottom: '110%',
    left: 0,
    flexDirection: 'row',
    gap: 4,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    zIndex: 10,
    elevation: 4,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  } as ViewStyle,
  popupItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  } as ViewStyle,
  popupEmoji: {
    fontSize: 20,
    lineHeight: 24,
  } as TextStyle,
  popupLabel: {
    fontSize: 11,
    color: tokens.text.secondary,
    marginTop: 2,
  } as TextStyle,
})

export default VoiceInput
