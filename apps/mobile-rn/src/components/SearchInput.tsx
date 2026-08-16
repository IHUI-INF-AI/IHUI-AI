/**
 * SearchInput 搜索输入框(mobile-rn 端)
 *
 * 对齐历史项目 search-bar / SearchInput/index.vue(原 uniapp 搜索容器,内置语音识别):
 * - 左侧:搜索图标(Unicode 🔍 16pt,color text.tertiary)
 * - 中间:TextInput flex 1,fontSize 14,color text.primary,placeholderTextColor text.tertiary
 * - 右侧:清除按钮(有值时显示,16×16 圆形,bgColor text.tertiary,Unicode × fontSize 12,hitSlop 8)
 *          + 语音切换按钮(🎤/⌨️ 20pt,键盘模式显 🎤 进入语音,语音模式显 ⌨️ 回键盘)
 * - 语音模式:中间 TextInput 替换为「按住说话」长按区(Pressable onLongPress,500ms),
 *   录音中背景 success.lightest + 边框 success.DEFAULT,提示切换为「松开结束」
 * - 容器:胶囊形(h 40 / paddingHorizontal 12 / borderRadius 20 / bgColor surface.muted / gap 8)
 *   胶囊形为输入框视觉惯例,符合 AGENTS.md §4 圆角守门(输入框例外)
 * - 聚焦态:borderWidth 1 + borderColor brand.DEFAULT,覆盖在 surface.muted 上
 *
 * Props(保留现有契约,语音能力全部可选,不破坏调用方):
 * - value:受控值
 * - onChangeText:输入变化回调
 * - placeholder:占位文字
 * - onSubmit?:提交(回车)回调
 * - onFocus?:聚焦回调
 * - onBlur?:失焦回调
 * - autoFocus?:是否自动聚焦
 * - onVoiceStart?:长按开始语音回调(待接后端/原生录音/STT)
 * - onVoiceEnd?:松开结束语音回调(待接后端/原生录音/STT)
 * - voiceText?:语音识别结果(由父组件在后端/原生识别完成后注入,自动回填 onChangeText)
 * - onVoiceToggle?:语音/键盘模式切换回调(isVoice:boolean)
 * - voiceEnabled?:是否启用语音入口(默认 true)
 *
 * 说明:真实录音与 STT 依赖原生模块 + 后端接口,本组件只做 UI + 回调预留,
 * 未引入任何新原生依赖(对齐原 uniapp WechatSI 插件 / APP 录音→上传→文字的职责边界)。
 *
 * 浅色优雅风,无霓虹/无渐变,系统字体(无 ttf),复用 @ihui/design-tokens 的 rnLightTokens。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface SearchInputProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  onSubmit?: () => void
  onFocus?: () => void
  onBlur?: () => void
  autoFocus?: boolean
  /** 长按开始语音回调(待接后端/原生录音) */
  onVoiceStart?: () => void
  /** 松开结束语音回调(待接后端/原生录音) */
  onVoiceEnd?: () => void
  /** 语音识别结果(父组件在后端/原生识别完成后注入,自动回填 value) */
  voiceText?: string
  /** 语音/键盘模式切换回调 */
  onVoiceToggle?: (isVoice: boolean) => void
  /** 是否启用语音入口 */
  voiceEnabled?: boolean
}

const CONTAINER_HEIGHT = 40
const CONTAINER_PADDING_HORIZONTAL = 12
const CONTAINER_BORDER_RADIUS = 20
const CONTAINER_GAP = 8
const ICON_FONT_SIZE = 16
const INPUT_FONT_SIZE = 14
const CLEAR_BUTTON_SIZE = 16
const CLEAR_BUTTON_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const
const CLEAR_ICON_FONT_SIZE = 12
const SEARCH_ICON = '\u{1F50D}'
const CLEAR_ICON = '\u00D7'
const VOICE_ICON = '\u{1F3A4}'
const KEYBOARD_ICON = '\u{2328}\u{FE0F}'
const VOICE_ICON_FONT_SIZE = 20
const VOICE_TOGGLE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const
const VOICE_LONG_PRESS_DELAY = 500
const VOICE_IDLE_TEXT = '按住说话'
const VOICE_RECORDING_TEXT = '松开结束'

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  onFocus,
  onBlur,
  autoFocus = false,
  onVoiceStart,
  onVoiceEnd,
  voiceText,
  onVoiceToggle,
  voiceEnabled = true,
}: SearchInputProps) {
  const [focused, setFocused] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const longPressTriggeredRef = useRef(false)
  const lastVoiceTextRef = useRef<string | undefined>(undefined)

  const handleFocus = useCallback(() => {
    setFocused(true)
    onFocus?.()
  }, [onFocus])

  const handleBlur = useCallback(() => {
    setFocused(false)
    onBlur?.()
  }, [onBlur])

  const handleSubmit = useCallback(
    (_e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      onSubmit?.()
    },
    [onSubmit],
  )

  const handleClear = useCallback(() => {
    onChangeText('')
  }, [onChangeText])

  // 语音/键盘模式切换(对齐原 uniapp toggleVoiceInput)
  const handleToggleVoiceMode = useCallback(() => {
    setIsVoiceMode((prev) => {
      const next = !prev
      onVoiceToggle?.(next)
      return next
    })
  }, [onVoiceToggle])

  // 长按语音(对齐原 uniapp startLongPress / endLongPress)
  const handleVoicePressIn = useCallback(() => {
    longPressTriggeredRef.current = false
  }, [])

  const handleVoiceLongPress = useCallback(() => {
    longPressTriggeredRef.current = true
    setIsRecording(true)
    onVoiceStart?.()
  }, [onVoiceStart])

  const handleVoicePressOut = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      setIsRecording(false)
      onVoiceEnd?.()
    }
  }, [onVoiceEnd])

  // 识别结果注入:父组件识别完成回填 voiceText → 回填 onChangeText(对齐原 uniapp onStop → emit change)
  useEffect(() => {
    if (voiceText && voiceText.trim() && voiceText !== lastVoiceTextRef.current) {
      lastVoiceTextRef.current = voiceText
      onChangeText(voiceText)
    }
  }, [voiceText, onChangeText])

  const showClear = value.length > 0

  return (
    <View style={[styles.container, focused ? styles.containerFocused : null]}>
      <Text style={styles.icon} accessibilityElementsHidden>
        {SEARCH_ICON}
      </Text>

      {isVoiceMode ? (
        <Pressable
          style={[styles.voiceArea, isRecording ? styles.voiceAreaRecording : null]}
          onPressIn={handleVoicePressIn}
          onLongPress={handleVoiceLongPress}
          onPressOut={handleVoicePressOut}
          delayLongPress={VOICE_LONG_PRESS_DELAY}
          accessibilityRole="button"
          accessibilityLabel="按住说话"
        >
          <Text style={[styles.voiceAreaText, isRecording ? styles.voiceAreaTextRecording : null]}>
            {isRecording ? VOICE_RECORDING_TEXT : VOICE_IDLE_TEXT}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          underlineColorAndroid="transparent"
        />
      )}

      {showClear ? (
        <Pressable
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={CLEAR_BUTTON_HIT_SLOP}
          accessibilityLabel="清除"
        >
          <Text style={styles.clearIcon}>{CLEAR_ICON}</Text>
        </Pressable>
      ) : null}

      {voiceEnabled ? (
        <Pressable
          style={styles.voiceToggleButton}
          onPress={handleToggleVoiceMode}
          hitSlop={VOICE_TOGGLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={isVoiceMode ? '切换键盘输入' : '切换语音输入'}
        >
          <Text style={[styles.voiceToggleIcon, isVoiceMode ? styles.voiceToggleIconActive : null]}>
            {isVoiceMode ? KEYBOARD_ICON : VOICE_ICON}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CONTAINER_HEIGHT,
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
    borderRadius: CONTAINER_BORDER_RADIUS,
    backgroundColor: tokens.surface.muted,
    gap: CONTAINER_GAP,
  },
  containerFocused: {
    borderWidth: 1,
    borderColor: tokens.brand.DEFAULT,
  },
  icon: {
    fontSize: ICON_FONT_SIZE,
    lineHeight: ICON_FONT_SIZE + 2,
    color: tokens.text.tertiary,
    includeFontPadding: false,
  },
  input: {
    flex: 1,
    fontSize: INPUT_FONT_SIZE,
    color: tokens.text.primary,
    paddingVertical: 0,
    margin: 0,
  },
  clearButton: {
    width: CLEAR_BUTTON_SIZE,
    height: CLEAR_BUTTON_SIZE,
    borderRadius: CLEAR_BUTTON_SIZE / 2,
    backgroundColor: tokens.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    fontSize: CLEAR_ICON_FONT_SIZE,
    lineHeight: CLEAR_ICON_FONT_SIZE + 2,
    color: tokens.surface.light,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  voiceToggleButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceToggleIcon: {
    fontSize: VOICE_ICON_FONT_SIZE,
    lineHeight: VOICE_ICON_FONT_SIZE + 4,
    color: tokens.text.secondary,
    includeFontPadding: false,
  },
  voiceToggleIconActive: {
    color: tokens.brand.DEFAULT,
  },
  voiceArea: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CONTAINER_BORDER_RADIUS / 2,
  },
  voiceAreaRecording: {
    backgroundColor: tokens.success.lightest,
    borderWidth: 1,
    borderColor: tokens.success.DEFAULT,
  },
  voiceAreaText: {
    fontSize: INPUT_FONT_SIZE,
    color: tokens.text.secondary,
  },
  voiceAreaTextRecording: {
    color: tokens.success.deepText,
  },
})

export default SearchInput
