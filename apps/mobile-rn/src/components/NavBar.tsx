// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NavBar 顶部导航栏(mobile-rn 端)
 *
 * 对齐历史 Uniapp navigation-bars 组件(4 变体:index/indexa/indexb/indexc):
 * - 左侧:back 按钮(可选)+ leftActions(菜单/drawer/分类等,多按钮)
 * - 中间:title + 可选 subtitle(flex 居中)
 * - 右侧:rightActions(搜索/设置/分类等,多按钮)+ rightAction(兼容旧 ReactNode)
 * - sticky 支持(对齐 Uniapp viscosity,position:sticky + top:0 + zIndex)
 * - 不自绘背景、不画底边线:顶栏与页面同色,由所在屏的 shell 底色透出
 * - 状态栏:顶距由 App.tsx 的 SafeAreaView 单点注入,本组件不再自加(否则双份)
 */
import { type ReactNode } from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native'
import { tokens } from '../theme/active-tokens'
import { ChevronLeft } from 'lucide-react-native'
import type { AppIcon } from '@ihui/types'
import { backChevronBoxStyle, backChevronGlyphPx } from '@ihui/shared/ui/back-chevron-spec'
import {
  NAVBAR_ACTION_GLYPH_PX,
  NAVBAR_ACTION_LABEL_FONT_PX,
  NAVBAR_ROW_HEIGHT_PX,
  NAVBAR_ROW_HEIGHT_SUBTITLE_PX,
  NAVBAR_SIDE_PADDING_PX,
  NAVBAR_SIDE_PLACEHOLDER_PX,
  NAVBAR_SUBTITLE_FONT_PX,
  NAVBAR_SUBTITLE_MARGIN_TOP_PX,
  NAVBAR_TITLE_FONT_PX,
  navbarActionBoxStyle,
} from '@ihui/shared/ui/navbar-spec'

export interface NavBarAction {
  /** emoji 字符 / 图片 URL(http:// / / 开头)/ lucide 图标组件引用(统一图标) */
  icon: AppIcon | string
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
}

/// 行高/侧占位/按钮盒/字号不在本文件取数 —— 唯一源是 @ihui/shared/ui/navbar-spec(与小程序端同档);
/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等。hitSlop 是 RN 独有命中扩张通道(waiver,数值对齐)。
const BACK_BUTTON_STYLE = backChevronBoxStyle((px: number) => px)
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
}: NavBarProps) {
  const contentHeight = subtitle ? NAVBAR_ROW_HEIGHT_SUBTITLE_PX : NAVBAR_ROW_HEIGHT_PX
  const hasLeftContent =
    onBack !== undefined || (leftActions !== undefined && leftActions.length > 0)
  const hasRightContent =
    (rightActions !== undefined && rightActions.length > 0) || rightAction !== undefined

  return (
    <View style={[styles.container, sticky ? STICKY_STYLE : null]}>
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
              <ChevronLeft size={backChevronGlyphPx()} color={tokens.text.primary} />
            </TouchableOpacity>
          ) : null}
          {leftActions?.map((action, index) => (
            <NavBarActionButton key={index} action={action} />
          ))}
          {!hasLeftContent ? <View style={styles.sidePlaceholder} /> : null}
        </View>

        {/* 中间:title + subtitle(flex 居中)。
            2026-09-23 修复 P1:两侧功能图标过多压缩标题空间,"智汇AI" 4 字在 18px 下被截断为"智汇..."。
            方案 B+C:center 加 minWidth:80 确保标题区至少容纳 4 个中文字 + title 字号 18→16 释放横向空间。 */}
        <View style={[styles.center, { minWidth: 80 }]}>
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
  const renderIcon = (): ReactNode => {
    if (typeof action.icon === 'string') {
      if (isImageUrl(action.icon)) {
        return (
          <Image source={{ uri: action.icon }} style={styles.actionImage} resizeMode="contain" />
        )
      }
      return (
        <Text style={styles.actionEmoji} allowFontScaling={false}>
          {action.icon}
        </Text>
      )
    }
    const Icon = action.icon
    return <Icon size={NAVBAR_ACTION_GLYPH_PX} color={tokens.text.secondary} />
  }
  return (
    <TouchableOpacity
      onPress={action.onPress}
      hitSlop={ACTION_HIT_SLOP}
      style={styles.actionBtn}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      {renderIcon()}
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
    // 档位唯一源 navbar-spec(对齐 Uniapp navigation-bars 的 padding: 0 20rpx,20rpx = 10dp)
    paddingHorizontal: NAVBAR_SIDE_PADDING_PX,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: BACK_BUTTON_STYLE,
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    // 字号唯一源 navbar-spec(2026-09-23 P1 定格 16,防"智汇AI"截断;与小程序端同档)
    fontSize: NAVBAR_TITLE_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  subtitle: {
    fontSize: NAVBAR_SUBTITLE_FONT_PX,
    color: tokens.text.secondary,
    marginTop: NAVBAR_SUBTITLE_MARGIN_TOP_PX,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: NAVBAR_SIDE_PLACEHOLDER_PX,
  },
  legacyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sidePlaceholder: {
    width: NAVBAR_SIDE_PLACEHOLDER_PX,
  },
  actionBtn: {
    // 盒宽/盒高/居中唯一源 navbar-spec;gap 与内边距是"图标+文字"并排的端内布局,不是跨端档
    ...navbarActionBoxStyle((px: number) => px),
    paddingHorizontal: 6,
    gap: 4,
  },
  actionImage: {
    width: NAVBAR_ACTION_GLYPH_PX,
    height: NAVBAR_ACTION_GLYPH_PX,
  },
  actionEmoji: {
    fontSize: NAVBAR_ACTION_GLYPH_PX,
    color: tokens.text.primary,
    lineHeight: NAVBAR_ACTION_GLYPH_PX + 2,
    includeFontPadding: false,
  },
  actionLabel: {
    fontSize: NAVBAR_ACTION_LABEL_FONT_PX,
    color: tokens.text.primary,
    maxWidth: 60,
  },
})

export default NavBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
