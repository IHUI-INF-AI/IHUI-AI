/**
 * ToggleButtonGroup 开关按钮组 (mobile-rn 端)
 *
 * 对齐历史项目 ToggleButtonGroup.vue(水平滚动的多开关按钮组):
 * - 水平 ScrollView,内含若干 toggle 按钮(icon + label)
 * - enabled 态视觉强化(深色边框 + 主文字色),disabled 态浅色描边
 * - 点击按钮 → onToggle(key),由父级维护 items[].enabled 状态(多选模式)
 * - 浅色优雅风,无霓虹无渐变,无蓝色发光边框
 *
 * 任务规格:
 *   interface ToggleButtonItem { key: string; label: string; icon?: string; enabled: boolean }
 *   interface ToggleButtonGroupProps { items: ToggleButtonItem[]; onToggle: (key: string) => void }
 */
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface ToggleButtonItem {
  key: string
  label: string
  icon?: string
  enabled: boolean
}

export interface ToggleButtonGroupProps {
  items: ToggleButtonItem[]
  onToggle: (key: string) => void
}

const CONTAINER_PADDING_V = 6
const CONTAINER_GAP = 8
const BUTTON_PADDING_H = 12
const BUTTON_PADDING_V = 6
const BUTTON_RADIUS = 8
const BUTTON_GAP = 6
const ICON_FONT_SIZE = 14
const LABEL_FONT_SIZE = 12

export function ToggleButtonGroup({ items, onToggle }: ToggleButtonGroupProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map((item) => {
        const buttonStyle = item.enabled ? styles.buttonEnabled : styles.buttonDisabled
        const labelStyle = item.enabled ? styles.labelEnabled : styles.labelDisabled
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.7}
            onPress={() => onToggle(item.key)}
            style={[styles.button, buttonStyle]}
            accessibilityRole="switch"
            accessibilityState={{ checked: item.enabled }}
            accessibilityLabel={item.label}
          >
            {item.icon ? (
              <Text style={[styles.icon, labelStyle]} allowFontScaling={false}>
                {item.icon}
              </Text>
            ) : null}
            <Text style={labelStyle} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: CONTAINER_GAP,
    paddingVertical: CONTAINER_PADDING_V,
  } as ViewStyle,
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BUTTON_GAP,
    paddingHorizontal: BUTTON_PADDING_H,
    paddingVertical: BUTTON_PADDING_V,
    borderRadius: BUTTON_RADIUS,
  } as ViewStyle,
  buttonEnabled: {
    backgroundColor: tk.surface.muted,
    borderWidth: 1,
    borderColor: tk.text.primary,
  } as ViewStyle,
  buttonDisabled: {
    backgroundColor: tk.surface.light,
    borderWidth: 1,
    borderColor: tk.border.light,
  } as ViewStyle,
  icon: {
    fontSize: ICON_FONT_SIZE,
  } as TextStyle,
  labelEnabled: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '600',
    color: tk.text.primary,
  } as TextStyle,
  labelDisabled: {
    fontSize: LABEL_FONT_SIZE,
    color: tk.text.secondary,
  } as TextStyle,
})

export default ToggleButtonGroup
