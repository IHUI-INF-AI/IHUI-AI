/**
 * Drawer 侧滑抽屉组件 (mobile-rn 端)
 *
 * 对齐历史项目 DrawerComponent:
 * - 左侧滑入抽屉,菜单列表 + 半透明黑色遮罩
 * - 250ms ease-out translateX 0 -> -screenWidth 动画
 * - 浅色优雅风,系统字体
 *
 * 用 react-native Animated API(不引入新依赖)。
 * 安全区:顶部 StatusBar.currentHeight(Android 24/25/...+ 兼容 iOS 44),
 *       底部 Platform.OS === 'ios' ? 34 : 0(避开 Home Indicator)。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  type ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'

export interface DrawerMenuItem {
  key: string
  label: string
  icon?: string
}

export interface DrawerProps {
  visible: boolean
  onClose: () => void
  menuItems: DrawerMenuItem[]
  onItemPress: (key: string) => void
}

const FIXED_WIDTH = 280
const NARROW_SCREEN_THRESHOLD = 380
const NARROW_SCREEN_RATIO = 0.75
const ANIM_DURATION_MS = 250
const OVERLAY_OPACITY = 0.5
const ITEM_HEIGHT = 48
const ICON_SIZE = 20
const CLOSE_ICON_SIZE = 24
const HORIZONTAL_PADDING = 16

function getDrawerWidth(screenWidth: number): number {
  return screenWidth > NARROW_SCREEN_THRESHOLD
    ? FIXED_WIDTH
    : Math.round(screenWidth * NARROW_SCREEN_RATIO)
}

function getTopPadding(): number {
  return Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 0)
}

function getBottomPadding(): number {
  return Platform.OS === 'ios' ? 34 : 0
}

export function Drawer({ visible, onClose, menuItems, onItemPress }: DrawerProps) {
  const screenWidth = Dimensions.get('window').width
  const drawerWidth = getDrawerWidth(screenWidth)
  const topPadding = getTopPadding()
  const bottomPadding = getBottomPadding()

  // progress: 0 = 隐藏(translateX = -screenWidth),1 = 显示(translateX = 0)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: ANIM_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [progress, visible])

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth, 0],
  })

  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, OVERLAY_OPACITY],
  })

  const handleItemPress = (key: string) => {
    onItemPress(key)
    onClose()
  }

  const renderItem = ({ item }: ListRenderItemInfo<DrawerMenuItem>) => (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => handleItemPress(item.key)}
      android_ripple={{ color: tokens.surface.muted }}
    >
      {item.icon ? (
        <Text style={styles.itemIcon}>{item.icon}</Text>
      ) : (
        <View style={styles.itemIconPlaceholder} />
      )}
      <Text style={styles.itemLabel} numberOfLines={1}>
        {item.label}
      </Text>
      <Text style={styles.itemArrow}>›</Text>
    </Pressable>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
          <View
            style={[styles.drawerInner, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
          >
            <View style={styles.header}>
              <View style={styles.headerSpacer} />
              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel="关闭抽屉"
              >
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>

            <FlatList
              data={menuItems}
              keyExtractor={(item) => item.key}
              renderItem={renderItem}
              ItemSeparatorComponent={null}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  } as ViewStyle,
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.surface.card,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 0 },
    elevation: 8,
  },
  drawerInner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  closeBtnPressed: {
    backgroundColor: tokens.surface.muted,
  },
  closeIcon: {
    fontSize: CLOSE_ICON_SIZE,
    lineHeight: CLOSE_ICON_SIZE + 2,
    color: tokens.text.secondary,
    fontWeight: '500',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  itemPressed: {
    backgroundColor: tokens.surface.muted,
  },
  itemIcon: {
    fontSize: ICON_SIZE,
    lineHeight: ICON_SIZE + 2,
    color: tokens.text.primary,
    width: ICON_SIZE + 8,
    textAlign: 'center',
  },
  itemIconPlaceholder: {
    width: ICON_SIZE + 8,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    color: tokens.text.primary,
    marginLeft: 12,
  },
  itemArrow: {
    fontSize: 20,
    lineHeight: 20,
    color: tokens.text.tertiary,
    marginLeft: 8,
  },
})

export default Drawer
