/**
 * NavBar 顶部导航栏(mobile-rn 端)
 *
 * 对齐历史 Uniapp navigation-bars 组件(4 变体:index/indexa/indexb/indexc):
 * - 左侧:back 按钮(可选)+ leftActions(菜单/drawer/分类等,多按钮)
 * - 中间:title + 可选 subtitle(flex 居中)
 * - 右侧:rightActions(搜索/设置/分类等,多按钮)+ rightAction(兼容旧 ReactNode)
 * - sticky 支持(对齐 Uniapp viscosity,position:sticky + top:0 + zIndex)
 * - backgroundColor 自定义(对齐 Uniapp backgroundColor)
 * - 状态栏:paddingTop = StatusBar.currentHeight(动态)
 * - 向后兼容:title?/onBack?/rightAction?/transparent? 旧 API 全保留
 */
import { type ReactNode } from 'react'
import { Image, StatusBar, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface NavBarAction {
  /** emoji 字符 或 图片 URL(http:// / / 开头)*/
  icon: string
  label?: string
  onPress: () => void
}

export interface NavBarProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  /** 左侧额外按钮(菜单/drawer),渲染在 back 之后 */
  leftActions?: ReadonlyArray<NavBarAction>
  /** 右侧多按钮(搜索/设置/分类等) */
  rightActions?: ReadonlyArray<NavBarAction>
  /** 兼容旧 API:单个 rightAction ReactNode */
  rightAction?: ReactNode
  /** sticky 支持(对齐 Uniapp viscosity) */
  sticky?: boolean
  /** 自定义背景色(对齐 Uniapp backgroundColor) */
  backgroundColor?: string
  /** 兼容旧 API:透明背景 + 无边框 */
  transparent?: boolean
}

const HEIGHT_DEFAULT = 44
const HEIGHT_WITH_SUBTITLE = 56
const STATUS_BAR_HEIGHT = StatusBar.currentHeight ?? 0
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const
const ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 } as const

/**
 * RN 类型 position 不含 'sticky'(StyleSheetTypes.d.ts 仅声明 'absolute'|'relative'|'static'),
 * 但 RN 0.71+ 运行时原生层支持 position:'sticky'(主要在 ScrollView 上下文生效)。
 * 用 as unknown as ViewStyle 绕过类型检查;运行时 RN 原生层处理 'sticky'。
 */
const STICKY_STYLE = { position: 'sticky', top: 0, zIndex: 1001 } as unknown as ViewStyle

function isImageUrl(icon: string): boolean {
  return icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('file:')
}

export function NavBar({
  title,
  subtitle,
  onBack,
  leftActions,
  rightActions,
  rightAction,
  sticky = false,
  backgroundColor,
  transparent = false,
}: NavBarProps) {
  const contentHeight = subtitle ? HEIGHT_WITH_SUBTITLE : HEIGHT_DEFAULT
  const hasCustomBg = backgroundColor !== undefined
  const showBorder = !transparent && !hasCustomBg
  const resolvedBg = hasCustomBg ? backgroundColor : transparent ? 'transparent' : tokens.surface.card
  const hasLeftContent = onBack !== undefined || (leftActions !== undefined && leftActions.length > 0)
  const hasRightContent =
    (rightActions !== undefined && rightActions.length > 0) || rightAction !== undefined

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: resolvedBg,
          borderBottomWidth: showBorder ? 1 : 0,
          borderBottomColor: tokens.border.light,
          paddingTop: STATUS_BAR_HEIGHT,
        },
        sticky ? STICKY_STYLE : null,
      ]}
    >
      <View style={[styles.row, { height: contentHeight }]}>
        {/* 左侧:back + leftActions */}
        <View style={styles.leftSection}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={BACK_HIT_SLOP}
              style={styles.backBtn}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="返回"
            >
              <Text style={styles.backArrow}>{'‹'}</Text>
            </TouchableOpacity>
          ) : null}
          {leftActions?.map((action, index) => (
            <NavBarActionButton key={index} action={action} />
          ))}
          {!hasLeftContent ? <View style={styles.sidePlaceholder} /> : null}
        </View>

        {/* 中间:title + subtitle(flex 居中) */}
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

        {/* 右侧:rightActions + rightAction(兼容旧 API) */}
        <View style={styles.rightSection}>
          {rightActions?.map((action, index) => (
            <NavBarActionButton key={index} action={action} />
          ))}
          {rightAction ? <View style={styles.legacyRight}>{rightAction}</View> : null}
          {!hasRightContent ? <View style={styles.sidePlaceholder} /> : null}
        </View>
      </View>
    </View>
  )
}

interface NavBarActionButtonProps {
  action: NavBarAction
}

function NavBarActionButton({ action }: NavBarActionButtonProps) {
  const isImg = isImageUrl(action.icon)
  return (
    <TouchableOpacity
      onPress={action.onPress}
      hitSlop={ACTION_HIT_SLOP}
      style={styles.actionBtn}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      {isImg ? (
        <Image source={{ uri: action.icon }} style={styles.actionImage} resizeMode="contain" />
      ) : (
        <Text style={styles.actionEmoji} allowFontScaling={false}>
          {action.icon}
        </Text>
      )}
      {action.label ? (
        <Text style={styles.actionLabel} numberOfLines={1}>
          {action.label}
        </Text>
      ) : null}
    </TouchableOpacity>
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
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
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
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 32,
  },
  legacyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sidePlaceholder: {
    width: 32,
  },
  actionBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionImage: {
    width: 20,
    height: 20,
  },
  actionEmoji: {
    fontSize: 18,
    color: tokens.text.primary,
    lineHeight: 22,
    includeFontPadding: false,
  },
  actionLabel: {
    fontSize: 13,
    color: tokens.text.primary,
    maxWidth: 60,
  },
})

export default NavBar
