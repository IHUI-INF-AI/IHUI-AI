/**
 * SearchInput 搜索输入框(mobile-rn 端)
 *
 * 对齐历史项目 search-bar / 搜索框组件:
 * - 左侧:搜索图标(Unicode 🔍 16pt,color text.tertiary)
 * - 中间:TextInput flex 1,fontSize 14,color text.primary,placeholderTextColor text.tertiary
 * - 右侧:清除按钮(有值时显示,16×16 圆形,bgColor text.tertiary,Unicode × fontSize 12,hitSlop 8)
 * - 容器:胶囊形(h 40 / paddingHorizontal 12 / borderRadius 20 / bgColor surface.muted / gap 8)
 *   胶囊形为输入框视觉惯例,符合 AGENTS.md §4 圆角守门(输入框例外)
 * - 聚焦态:borderWidth 1 + borderColor brand.DEFAULT,覆盖在 surface.muted 上
 *
 * Props:
 * - value:受控值
 * - onChangeText:输入变化回调
 * - placeholder:占位文字
 * - onSubmit?:提交(回车)回调
 * - onFocus?:聚焦回调
 * - onBlur?:失焦回调
 * - autoFocus?:是否自动聚焦
 *
 * 浅色优雅风,无霓虹/无渐变,系统字体(无 ttf),复用 @ihui/design-tokens 的 rnLightTokens。
 */
import { useCallback, useState } from 'react'
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

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  onFocus,
  onBlur,
  autoFocus = false,
}: SearchInputProps) {
  const [focused, setFocused] = useState(false)

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

  const showClear = value.length > 0

  return (
    <View
      style={[
        styles.container,
        focused ? styles.containerFocused : null,
      ]}
    >
      <Text style={styles.icon} accessibilityElementsHidden>
        {SEARCH_ICON}
      </Text>

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
})

export default SearchInput
