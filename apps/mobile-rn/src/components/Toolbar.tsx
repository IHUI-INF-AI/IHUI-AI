/**
 * Toolbar 横向操作按钮组 (mobile-rn 端)
 * 对齐历史项目 Toolbar/index.vue 的横向操作条语义 + miniapp-taro Toolbar 渲染结构,
 * 但 UI 形态是 32×32 工具按钮阵列(非图标 + 文字网格),常用于页面顶部工具条 / 悬浮工具条。
 *
 * 设计要点:
 * - 容器:surface.muted + borderRadius 8 + paddingHorizontal 12 paddingVertical 8 + gap 4
 * - 工具按钮:32×32 圆角 6,active 态 surface.card 背景 + border.light 1px + 极淡 shadow
 * - 分隔条:1px × 20,border.medium,位于指定 key 之后
 * - 浅色优雅风,无霓虹无渐变,系统字体,无 ttf 资源
 *
 * 平台特有:依赖 react-native Image + StyleSheet,不适合共享层。
 */
import { useMemo } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

/** 工具按钮项 */
export interface ToolbarItem {
  /** 唯一标识(用于 activeKey 匹配 + React key) */
  key: string
  /** 图标:http(s) URL / 绝对路径视为图片;其他短文本视为 emoji */
  icon: string
  /** 单项激活态(activeKey 缺省时生效) */
  active?: boolean
  /** 点击回调 */
  onPress: () => void
}

export interface ToolbarProps {
  items: ToolbarItem[]
  /** 分隔条位置:在指定 key 之后插入分隔条 */
  separators?: string[]
  /** 全局激活 key(覆盖 items[].active) */
  activeKey?: string
  /** 容器外层样式(用于页面层 flex 排版) */
  style?: StyleProp<ViewStyle>
}

/** 判断 icon 是否为图片路径(URL / 绝对路径) */
function isImagePath(icon: string): boolean {
  return /^(https?:)?\/\//.test(icon) || icon.startsWith('/')
}

export function Toolbar({ items, separators, activeKey, style }: ToolbarProps) {
  const separatorSet = useMemo<Set<string>>(() => new Set(separators ?? []), [separators])

  return (
    <View style={[styles.container, style]}>
      {items.map((item) => {
        const isActive = activeKey !== undefined ? activeKey === item.key : item.active === true
        const showSeparator = separatorSet.has(item.key)
        return (
          <View key={item.key} style={styles.rowItem}>
            <Pressable
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.key}
              accessibilityState={{ selected: isActive }}
              hitSlop={4}
              style={({ pressed }) => [
                styles.tool,
                isActive ? styles.toolActive : styles.toolInactive,
                pressed && !isActive ? styles.toolPressed : null,
              ]}
            >
              {isImagePath(item.icon) ? (
                <Image
                  source={{ uri: item.icon }}
                  style={styles.icon}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Text style={styles.iconEmoji} allowFontScaling={false}>
                  {item.icon}
                </Text>
              )}
            </Pressable>
            {showSeparator ? <View style={styles.separator} /> : null}
          </View>
        )
      })}
    </View>
  )
}

export default Toolbar

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface.muted,
    borderRadius: 12,
    gap: 4,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tool: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolInactive: {
    backgroundColor: 'transparent',
  },
  toolActive: {
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    // iOS 极淡投影
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    // Android 投影(elevation 与 iOS shadowOpacity=0.05 视觉对齐)
    elevation: 1,
  },
  toolPressed: {
    backgroundColor: tokens.surface.card,
  },
  icon: {
    width: 18,
    height: 18,
  },
  iconEmoji: {
    fontSize: 16,
    lineHeight: 20,
    color: tokens.text.primary,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: tokens.border.medium,
    marginHorizontal: 4,
  },
})
