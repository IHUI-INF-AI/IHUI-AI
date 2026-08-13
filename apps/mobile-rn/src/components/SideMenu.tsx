/**
 * SideMenu 通用侧边菜单组件 (mobile-rn 端)
 * 从右侧滑出的简单菜单列表,用于 NavBar 右上角 ☰ 按钮触发的分类切换。
 * 与 AI 对话社区专用的 Drawer 区分:Drawer 是完整功能抽屉(用户区+历史对话+主菜单),
 * SideMenu 是轻量级菜单列表(仅 key+label+icon)。
 * 平台特有:依赖 react-native Modal + Animated,不适合共享层。
 */
import { useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface SideMenuItem {
  key: string
  label: string
  icon?: string
}

export interface SideMenuProps {
  visible: boolean
  onClose: () => void
  items: SideMenuItem[]
  onSelect: (key: string) => void
  activeKey?: string
  title?: string
}

export default function SideMenu({
  visible,
  onClose,
  items,
  onSelect,
  activeKey,
  title,
}: SideMenuProps) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()
    } else {
      slideAnim.setValue(0)
    }
  }, [visible, slideAnim])

  const handleSelect = (key: string) => {
    onSelect(key)
    onClose()
  }

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [220, 0],
  })

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.container,
            {
              paddingTop: insets.top + 8,
              transform: [{ translateX }],
            },
          ]}
        >
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {items.map((item) => {
            const isActive = item.key === activeKey
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handleSelect(item.key)}
                style={({ pressed }) => [styles.item, pressed ? { opacity: 0.6 } : null]}
              >
                {item.icon ? <Text style={styles.icon}>{item.icon}</Text> : null}
                <Text
                  style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: 220,
    backgroundColor: tk.surface.card,
    borderLeftWidth: 0,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: tk.text.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  icon: {
    fontSize: 18,
    lineHeight: 20,
  },
  label: {
    fontSize: 15,
    flex: 1,
  },
  labelActive: {
    color: tk.brand.DEFAULT,
    fontWeight: '600',
  },
  labelInactive: {
    color: tk.text.primary,
  },
})
