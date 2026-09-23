// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Check, ChevronDown } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius } from '@ihui/design-tokens'
import type { CategoryItem, ColorSchemeName } from './types'

export interface CategoryDropdownProps {
  /** 选项(必填) */
  items: readonly CategoryItem[]
  /** 当前选中 id(必填) */
  selectedId: string | null
  /** 选中回调(必填,选中后自动关面板) */
  onSelect: (id: string) => void
  /** 配色(选填,默认 light) */
  colorScheme?: ColorSchemeName
  /** 触发器无障碍标签(选填,默认复用选中项 label) */
  triggerA11yLabel?: string
  /** 遮罩无障碍标签(选填,调用方传入,组件无中文默认) */
  backdropA11yLabel?: string
  /** 面板最大高度(选填,默认 320) */
  panelMaxHeight?: number
  /**
   * 未选中时触发器显示的文案(选填)。
   * 必须由调用方传(组件内不留中文默认):SetNeedScreen 一类表单选择器依赖
   * `form.cycle || '周期数'` 这种占位文案,没有这一档时它们的字段会渲染成空白触发器。
   */
  placeholder?: string
  /** 面板标题(选填,同样由调用方传 i18n 文案;PlazaScreen 的弹层标题属可见内容) */
  panelTitle?: string
  /** 受控开关(选填):传入即由外部持有开合态(供 NavBar 动作这类外部触发点使用) */
  visible?: boolean
  /** 受控开合回调(选填,与 visible 配套) */
  onVisibleChange?: (next: boolean) => void
  /** 只渲染面板、不渲染触发器(选填):外部已有触发入口(如顶栏图标)时置 true */
  hideTrigger?: boolean
  /** 容器外层样式(选填) */
  style?: StyleProp<ViewStyle>
  /** 测试标识(选填) */
  testID?: string
}

interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 下拉分类窗(形态 B):点击触发器开下拉面板,面板内选项纵向列表(项多可纵滑),
 * 触发器行与面板横滑条语义一致。遮罩点击/Android 返回键关闭,旋转即关。
 * 视觉:触发器高 36 radius-lg(8);面板 radius-xl(12)+完整描边+内边距 4(菜单档)。
 */
export function CategoryDropdown({
  items,
  selectedId,
  onSelect,
  colorScheme = 'light',
  triggerA11yLabel,
  backdropA11yLabel,
  panelMaxHeight = 320,
  placeholder,
  panelTitle,
  visible,
  onVisibleChange,
  hideTrigger = false,
  style,
  testID,
}: CategoryDropdownProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const triggerRef = useRef<View>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const [anchor, setAnchor] = useState<AnchorRect | null>(null)
  const fade = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.96)).current

  // 受控/非受控两用:传 visible 即由外部(如顶栏 NavBar 图标动作)持有开合态
  const isControlled = visible !== undefined
  const open = isControlled ? visible : internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onVisibleChange?.(next)
    },
    [isControlled, onVisibleChange],
  )

  const selected = items.find((it) => it.id === selectedId) ?? null

  const openPanel = useCallback(() => {
    if (hideTrigger) {
      // 无触发器 ⇒ 没有可锚定的节点,直接走顶部面板回退
      setAnchor(null)
      setOpen(true)
      return
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const valid = Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0
      setAnchor(valid ? { x, y, width, height } : null)
      setOpen(true)
    })
  }, [hideTrigger, setOpen])

  const closePanel = useCallback(() => setOpen(false), [setOpen])

  // 开合动画
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: open ? 150 : 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: open ? 1 : 0.96,
        duration: open ? 150 : 120,
        useNativeDriver: true,
      }),
    ]).start()
  }, [open, fade, scale])

  // Android 返回键关闭(注册/卸载成对)
  useEffect(() => {
    if (!open) return undefined
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false)
      return true
    })
    return () => sub.remove()
  }, [open])

  // 旋转/尺寸变化即关(防锚过期):比对 ref,只在尺寸真变时关
  const dimsRef = useRef({ w: screenWidth, h: screenHeight })
  useEffect(() => {
    const prev = dimsRef.current
    if (prev.w !== screenWidth || prev.h !== screenHeight) {
      dimsRef.current = { w: screenWidth, h: screenHeight }
      setOpen(false)
    }
  }, [screenWidth, screenHeight])

  // 面板几何:优先锚定触发器正下方,下方不足上翻,失败回退顶部居中
  const maxPanelWidth = screenWidth - 32
  let panelStyle: ViewStyle
  if (anchor) {
    const below = screenHeight - (anchor.y + anchor.height) - 16
    const flip = below < 180 && anchor.y > 200
    panelStyle = {
      top: flip ? Math.max(16, anchor.y - panelMaxHeight - 4) : anchor.y + anchor.height + 4,
      left: Math.min(
        Math.max(16, anchor.x),
        screenWidth - 16 - Math.min(anchor.width, maxPanelWidth),
      ),
      width: Math.min(anchor.width, maxPanelWidth),
    }
  } else {
    panelStyle = { top: 96, left: 24, width: screenWidth - 48 }
  }

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
      setOpen(false)
    },
    [onSelect, setOpen],
  )

  return (
    <View style={style} testID={testID}>
      {hideTrigger ? null : (
        <Pressable
          onPress={openPanel}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={
            triggerA11yLabel ?? selected?.a11yLabel ?? selected?.label ?? placeholder
          }
          style={({ pressed }) => (pressed ? styles.triggerPressed : null)}
        >
          {/* 视觉不挂在 Pressable 的函数式 style 上(同 CategoryInlineBar 的真机取证) */}
          <View ref={triggerRef} collapsable={false} style={styles.trigger}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.triggerText, selected ? null : styles.triggerTextPlaceholder]}
            >
              {selected?.label ?? placeholder}
            </Text>
            {typeof selected?.count === 'number' ? (
              <View style={styles.countWrap}>
                <Text style={styles.countText}>{selected.count}</Text>
              </View>
            ) : null}
            <ChevronDown size={16} color={tk.text.secondary} />
          </View>
        </Pressable>
      )}
      <Modal visible={open} transparent animationType="none" onRequestClose={closePanel}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <Pressable
            style={styles.backdropPress}
            onPress={closePanel}
            accessibilityRole="button"
            accessibilityLabel={backdropA11yLabel}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            { maxHeight: panelMaxHeight, opacity: fade, transform: [{ scale }] },
          ]}
        >
          <ScrollView
            accessibilityRole="menu"
            contentContainerStyle={styles.panelList}
            showsVerticalScrollIndicator={false}
          >
            {panelTitle ? (
              <Text accessibilityRole="header" style={styles.panelTitle}>
                {panelTitle}
              </Text>
            ) : null}
            {items.length === 0 ? (
              <View style={styles.emptyBox} />
            ) : (
              items.map((item) => {
                const active = item.id === selectedId
                const Icon = item.icon
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelect(item.id)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={item.a11yLabel ?? item.label}
                    style={({ pressed }) => (pressed ? styles.optionPressed : null)}
                  >
                    <View style={active ? [styles.option, styles.optionActive] : styles.option}>
                      {Icon ? (
                        <Icon size={16} color={active ? tk.brandAccent.deep : tk.text.primary} />
                      ) : item.image ? (
                        <Image
                          source={item.image}
                          style={styles.optionImage}
                          resizeMode="contain"
                        />
                      ) : null}
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.optionText, active ? styles.optionTextActive : null]}
                      >
                        {item.label}
                      </Text>
                      {active ? <Check size={16} color={tk.brandAccent.deep} /> : null}
                    </View>
                  </Pressable>
                )
              })
            )}
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    trigger: {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    triggerPressed: {
      backgroundColor: tk.surface.muted,
    },
    triggerText: {
      flex: 1,
      fontSize: 14,
      color: tk.text.primary,
    },
    triggerTextPlaceholder: {
      color: tk.text.tertiary,
    },
    countWrap: {
      height: 16,
      minWidth: 16,
      paddingHorizontal: 4,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    countText: {
      fontSize: 10,
      fontWeight: '600',
      lineHeight: 10,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      color: tk.text.secondary,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: tk.overlay.modal,
    },
    backdropPress: {
      flex: 1,
    },
    panel: {
      position: 'absolute',
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      overflow: 'hidden',
    },
    panelList: {
      padding: 4,
      gap: 2,
    },
    panelTitle: {
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 4,
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    emptyBox: {
      height: 48,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: rnRadius.md,
    },
    optionPressed: {
      opacity: 0.7,
    },
    optionActive: {
      backgroundColor: tk.brandAccent.light,
    },
    optionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '400',
      color: tk.text.primary,
    },
    optionTextActive: {
      fontWeight: '600',
    },
    optionImage: {
      width: 16,
      height: 16,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
