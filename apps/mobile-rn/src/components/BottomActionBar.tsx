/**
 * BottomActionBar 底部操作栏 (mobile-rn 端)
 *
 * 对齐历史项目 BottomActionBar:
 * - 固定底部 100% 屏宽,顶部 1px 边框,surface.card 浅灰底
 * - 横向 flex row,gap 12,可容纳 2-3 个按钮(图标按钮 / 主按钮 / 次按钮)
 * - 主按钮:flex 1,h 44,borderRadius 8,brand.DEFAULT 填充 + surface.light 字
 * - 次按钮(可选):flex 1,h 44,borderRadius 8,描边 surface.light 卡底
 * - 图标按钮(可选):44×44 圆形,描边 border.light + emoji 18pt
 * - 底部 SafeArea padding(react-native-safe-area-context)
 * - 浅色优雅风,无霓虹 / 无渐变,系统字体
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface BottomActionBarAction {
  key: string
  label?: string
  icon?: string
  primary?: boolean
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}

export interface BottomActionBarProps {
  actions: ReadonlyArray<BottomActionBarAction>
}

const CONTAINER_PADDING_HORIZONTAL = 16
const CONTAINER_PADDING_VERTICAL = 12
const CONTAINER_GAP = 12
const ACTION_BUTTON_HEIGHT = 44
const ACTION_BUTTON_BORDER_RADIUS = 8
const ACTION_BUTTON_FONT_SIZE = 15
const ICON_BUTTON_SIZE = 44
const ICON_BUTTON_EMOJI_SIZE = 18
const ICON_BUTTON_BORDER_RADIUS = ICON_BUTTON_SIZE / 2
const LABEL_LETTER_SPACING = 0.2

export function BottomActionBar({ actions }: BottomActionBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: CONTAINER_PADDING_VERTICAL + insets.bottom },
      ]}
    >
      {actions.map((action) => (
        <BottomActionBarItem key={action.key} action={action} />
      ))}
    </View>
  )
}

interface BottomActionBarItemProps {
  action: BottomActionBarAction
}

function BottomActionBarItem({ action }: BottomActionBarItemProps) {
  const isIconOnly = action.icon !== undefined && action.label === undefined

  if (isIconOnly) {
    return <IconButton action={action} />
  }
  return <LabelButton action={action} />
}

function LabelButton({ action }: BottomActionBarItemProps) {
  const isPrimary = action.primary === true
  const isDisabled = action.disabled === true
  const isLoading = action.loading === true

  const handlePress = () => {
    if (!isDisabled && !isLoading) {
      action.onPress()
    }
  }

  const baseStyle: ViewStyle = isPrimary ? styles.primaryButton : styles.secondaryButton
  const pressedStyle: ViewStyle = isPrimary
    ? styles.primaryButtonPressed
    : styles.secondaryButtonPressed
  const disabledStyle: ViewStyle = styles.buttonDisabled

  const labelStyle: TextStyle = isPrimary
    ? styles.primaryButtonLabel
    : styles.secondaryButtonLabel

  const style = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
    baseStyle,
    pressed && !isDisabled && !isLoading ? pressedStyle : null,
    isDisabled || isLoading ? disabledStyle : null,
  ]

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={style}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? tokens.surface.light : tokens.text.primary}
        />
      ) : (
        <Text style={labelStyle} numberOfLines={1}>
          {action.label}
        </Text>
      )}
    </Pressable>
  )
}

function IconButton({ action }: BottomActionBarItemProps) {
  const isDisabled = action.disabled === true
  const isLoading = action.loading === true
  const icon = action.icon ?? ''

  const handlePress = () => {
    if (!isDisabled && !isLoading) {
      action.onPress()
    }
  }

  const style = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
    styles.iconButton,
    pressed && !isDisabled && !isLoading ? styles.iconButtonPressed : null,
    isDisabled || isLoading ? styles.buttonDisabled : null,
  ]

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      style={style}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={tokens.text.primary} />
      ) : (
        <Text style={styles.iconButtonEmoji} allowFontScaling={false}>
          {icon}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: CONTAINER_GAP,
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
    paddingTop: CONTAINER_PADDING_VERTICAL,
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  } as ViewStyle,
  primaryButton: {
    flex: 1,
    height: ACTION_BUTTON_HEIGHT,
    borderRadius: ACTION_BUTTON_BORDER_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  primaryButtonPressed: {
    opacity: 0.8,
  } as ViewStyle,
  primaryButtonLabel: {
    fontSize: ACTION_BUTTON_FONT_SIZE,
    lineHeight: ACTION_BUTTON_FONT_SIZE + 4,
    fontWeight: '500',
    letterSpacing: LABEL_LETTER_SPACING,
    color: tokens.surface.light,
    textAlign: 'center',
  } as TextStyle,
  secondaryButton: {
    flex: 1,
    height: ACTION_BUTTON_HEIGHT,
    borderRadius: ACTION_BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  secondaryButtonPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  secondaryButtonLabel: {
    fontSize: ACTION_BUTTON_FONT_SIZE,
    lineHeight: ACTION_BUTTON_FONT_SIZE + 4,
    fontWeight: '500',
    letterSpacing: LABEL_LETTER_SPACING,
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  iconButtonPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  iconButtonEmoji: {
    fontSize: ICON_BUTTON_EMOJI_SIZE,
    lineHeight: ICON_BUTTON_EMOJI_SIZE + 2,
    textAlign: 'center',
  } as TextStyle,
  buttonDisabled: {
    opacity: 0.5,
  } as ViewStyle,
})

export default BottomActionBar
