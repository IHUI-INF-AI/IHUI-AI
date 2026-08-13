/**
 * GlobalFloatBox 全局浮窗按钮(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp 项目 App.vue 行 5-23 的全局浮窗:
 * - 3 个按钮:推广 📣 / 咨询 💬 / 更多 ⋯(Uniapp 用 iconfont,RN 用 emoji 替代)
 * - 展开/收起箭头(toggleFloatbox):收起时只显示箭头,展开时显示 3 个按钮
 * - 固定右下角(position absolute, bottom 100+, right 16)
 * - 圆角 8,背景 tokens.surface.card + 阴影,按钮竖向排列
 * - 自动隐藏:App 切到后台(onHide)收起,切回前台(onShow)展开
 *
 * 内聚管理:expanded 状态 + AppState 监听在组件内部,对外只暴露 3 个回调。
 * 实际跳转是后续任务,本组件用 console.info + Alert.alert 兜底。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface GlobalFloatBoxProps {
  /** 推广按钮回调(未传则用 Alert 兜底) */
  onPromote?: () => void
  /** 咨询按钮回调(未传则用 Alert 兜底) */
  onConsult?: () => void
  /** 更多按钮回调(未传则用 Alert 兜底) */
  onMore?: () => void
}

const CONTAINER_BOTTOM = 100
const CONTAINER_RIGHT = 16
const CONTAINER_BORDER_RADIUS = 8
const CONTAINER_PADDING = 4
const ITEM_SIZE = 44
const ITEM_BORDER_RADIUS = 6
const ITEM_GAP = 4
const ICON_FONT_SIZE = 18
const LABEL_FONT_SIZE = 10
const LABEL_MARGIN_TOP = 2
const ARROW_HEIGHT = 28
const ARROW_FONT_SIZE = 12

type FloatItemKey = 'promote' | 'consult' | 'more'

interface FloatItemDef {
  key: FloatItemKey
  icon: string
  label: string
  handler: () => void
}

export function GlobalFloatBox({ onPromote, onConsult, onMore }: GlobalFloatBoxProps) {
  // expanded = true 展开显示 3 个按钮;false 收起只显示箭头
  const [expanded, setExpanded] = useState(true)

  // 自动隐藏:onHide(active→inactive/background)收起,onShow(→active)展开
  // 复刻 Uniapp App.vue onShow 中 floatboxVisible = true 的语义
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setExpanded(true)
      } else {
        setExpanded(false)
      }
    })
    return () => subscription.remove()
  }, [])

  const toggleFloatbox = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const handlePromote = useCallback(() => {
    if (onPromote) {
      onPromote()
      return
    }
    console.info('[GlobalFloatBox] promote clicked')
    Alert.alert('推广', '推广功能即将上线')
  }, [onPromote])

  const handleConsult = useCallback(() => {
    if (onConsult) {
      onConsult()
      return
    }
    console.info('[GlobalFloatBox] consult clicked')
    Alert.alert('咨询', '咨询功能即将上线')
  }, [onConsult])

  const handleMore = useCallback(() => {
    if (onMore) {
      onMore()
      return
    }
    console.info('[GlobalFloatBox] more clicked')
    Alert.alert('更多', '更多功能即将上线')
  }, [onMore])

  const items: FloatItemDef[] = [
    { key: 'promote', icon: '📣', label: '推广', handler: handlePromote },
    { key: 'consult', icon: '💬', label: '咨询', handler: handleConsult },
    { key: 'more', icon: '⋯', label: '更多', handler: handleMore },
  ]

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.container}>
        {expanded &&
          items.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={item.handler}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.label}>{item.label}</Text>
            </Pressable>
          ))}
        <Pressable
          style={({ pressed }) => [styles.arrow, pressed && styles.itemPressed]}
          onPress={toggleFloatbox}
          accessibilityRole="button"
          accessibilityLabel={expanded ? '收起浮窗' : '展开浮窗'}
        >
          <Text style={styles.arrowText}>{expanded ? '▼' : '▲'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: CONTAINER_BOTTOM,
    right: CONTAINER_RIGHT,
    zIndex: 1000,
  } as ViewStyle,
  container: {
    backgroundColor: tokens.surface.card,
    borderRadius: CONTAINER_BORDER_RADIUS,
    padding: CONTAINER_PADDING,
    alignItems: 'center',
    // iOS 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    // Android 阴影
    elevation: 4,
  } as ViewStyle,
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ITEM_GAP,
  } as ViewStyle,
  itemPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  icon: {
    fontSize: ICON_FONT_SIZE,
    lineHeight: ICON_FONT_SIZE + 2,
    textAlign: 'center',
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    color: tokens.text.secondary,
    marginTop: LABEL_MARGIN_TOP,
    textAlign: 'center',
  },
  arrow: {
    width: ITEM_SIZE,
    height: ARROW_HEIGHT,
    borderRadius: ITEM_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  arrowText: {
    fontSize: ARROW_FONT_SIZE,
    color: tokens.text.tertiary,
    textAlign: 'center',
  },
})

export default GlobalFloatBox
