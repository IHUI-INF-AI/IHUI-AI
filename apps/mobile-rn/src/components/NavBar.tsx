/**
 * NavBar 顶部导航栏(mobile-rn 端)
 *
 * 对齐历史项目 nav-bar / navigation-bars 组件:
 * - 左侧:返回按钮(可选,hitSlop 12,Unicode ‹)
 * - 中间:标题(fontSize 16 / fontWeight 600),可副标题(fontSize 12 / text.secondary)
 * - 右侧:自定义操作区(ReactNode)
 * - 高度:无副标题 44,有副标题 56
 * - 背景:默认 surface.card,transparent=true 透传
 * - 底部:1px 边框 border.light(透传模式无)
 * - 状态栏:paddingTop = StatusBar.currentHeight(动态)
 */
import { type ReactNode } from 'react'
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface NavBarProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  rightAction?: ReactNode
  transparent?: boolean
}

const HEIGHT_DEFAULT = 44
const HEIGHT_WITH_SUBTITLE = 56
const STATUS_BAR_HEIGHT = StatusBar.currentHeight ?? 0
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

export function NavBar({
  title,
  subtitle,
  onBack,
  rightAction,
  transparent = false,
}: NavBarProps) {
  const contentHeight = subtitle ? HEIGHT_WITH_SUBTITLE : HEIGHT_DEFAULT

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : tokens.surface.card,
          borderBottomWidth: transparent ? 0 : 1,
          borderBottomColor: tokens.border.light,
          paddingTop: STATUS_BAR_HEIGHT,
        },
      ]}
    >
      <View style={[styles.row, { height: contentHeight }]}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={BACK_HIT_SLOP}
            style={styles.backBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.backArrow}>{'‹'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sidePlaceholder} />
        )}

        <View style={styles.center}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? (
          <View style={styles.right}>{rightAction}</View>
        ) : (
          <View style={styles.sidePlaceholder} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: tokens.text.primary,
    lineHeight: 30,
    includeFontPadding: false,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 2,
  },
  right: {
    minWidth: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sidePlaceholder: {
    width: 32,
  },
})

export default NavBar
