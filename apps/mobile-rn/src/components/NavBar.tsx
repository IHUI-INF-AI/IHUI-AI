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
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { currentRnTheme, tokens } from '../theme/active-tokens'
import { rnCssColor } from '@ihui/design-tokens'
import { Menu, MessageCircle, Search, X } from 'lucide-react-native'
import type { AppIcon } from '@ihui/types'
import { BackChevron } from '@ihui/rn-app'
import {
  NAVBAR_ACTION_GLYPH_PX,
  NAVBAR_ACTION_LABEL_FONT_PX,
  NAVBAR_ACTION_LABEL_MAX_WIDTH_PX,
  NAVBAR_CENTER_MIN_WIDTH_PX,
  NAVBAR_ROW_HEIGHT_PX,
  NAVBAR_ROW_HEIGHT_SUBTITLE_PX,
  NAVBAR_SIDE_PADDING_PX,
  NAVBAR_SIDE_PLACEHOLDER_PX,
  NAVBAR_SUBTITLE_FONT_PX,
  NAVBAR_SUBTITLE_MARGIN_TOP_PX,
  NAVBAR_TITLE_FONT_PX,
  NAVBAR_TITLE_MAX_WIDTH_PX,
  navbarActionBoxStyle,
} from '@ihui/shared/ui/navbar-spec'
import { NavBarCore, type NavBarCoreBoxProps, type NavBarCoreTextProps } from '@ihui/shared/ui'
import { useI18n } from '../i18n'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
export interface NavBarAction {
  /** emoji 字符 / 图片 URL(http:// / / 开头)/ lucide 图标组件引用(统一图标) */
  icon: AppIcon | string
  label?: string
  /** 无障碍朗读标签(纯图标按钮无可见 label 时用它保留语义,2026-10-15 抽屉钮去文字化) */
  a11yLabel?: string
  onPress: () => void
}

export interface NavBarNotification {
  text: string
  onClose?: () => void
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
  // ===== B 组收口:与小程序端同名同义的离散槽位(2026-11-04)=====
  /** 是否展示返回键(默认 true;仅 default 变体消费) */
  showBack?: boolean
  /** 顶栏底色覆盖(不传则保持"不自绘背景"的既有版面) */
  bgColor?: string
  /** 标题/副标题/右文字墨迹覆盖(不传则走主题档) */
  textColor?: string
  /** 右侧文字按钮(与小程序端 rightText 同槽) */
  rightText?: string
  onRightClick?: () => void
  /** 行下通知条(与小程序端同一结构) */
  notification?: NavBarNotification
  /** 'ai-home' = 粘性 + 左菜单 + 标题切换 + 右功能钮 + 通知条 */
  variant?: 'default' | 'ai-home'
  onMenuClick?: () => void
  onJoinClick?: () => void
  /** 菜单按钮文字/图片覆盖(不传用 Menu 矢量图标) */
  menuIcon?: string
  joinText?: string
  showFenLei?: boolean
  onFenLeiClick?: () => void
  showSearch?: boolean
  onSearchClick?: () => void
  showFeedback?: boolean
  onFeedbackClick?: () => void
  /** 返回首页按钮(ai-home 左槽,与返回上一页区分) */
  onPack?: () => void
  activeTitleIndex?: number
  onActiveNav?: (index: number) => void
}

/// 行高/侧占位/按钮盒/字号不在本文件取数 —— 唯一源是 @ihui/shared/ui/navbar-spec(与小程序端同档);
/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等。hitSlop 是 RN 独有命中扩张通道(waiver,数值对齐)。
/// 返回键本体走共享 `<BackChevron>`(与小程序端 NavBar 同一个核心),本文件不再自绘箭头与方块。
const ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 } as const

/// 骨架唯一源在 @ihui/shared/ui/navbar-core;本端只注入 RN 原语与样式/内容槽。
/// 行高、左右槽、标题/副标题字号与主题色仍全部住在本文件,核心不重取数。
function CoreBox({ style, children }: NavBarCoreBoxProps<StyleProp<ViewStyle>, string>) {
  return <View style={style}>{children}</View>
}

function CoreText({
  style,
  numberOfLines,
  children,
}: NavBarCoreTextProps<StyleProp<TextStyle>, string>) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  )
}

const NAVBAR_PLATFORM = { Box: CoreBox, Text: CoreText }

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
  showBack = true,
  bgColor,
  textColor,
  rightText,
  onRightClick,
  notification,
  variant = 'default',
  onMenuClick,
  onJoinClick,
  menuIcon,
  joinText,
  showFenLei,
  onFenLeiClick,
  showSearch,
  onSearchClick,
  showFeedback,
  onFeedbackClick,
  onPack,
  activeTitleIndex = 0,
  onActiveNav,
}: NavBarProps) {
  const { t } = useI18n()
  const aiHome = variant === 'ai-home'
  const contentHeight = subtitle ? NAVBAR_ROW_HEIGHT_SUBTITLE_PX : NAVBAR_ROW_HEIGHT_PX
  const ink = textColor ?? tokens.text.primary
  const subInk = textColor ?? tokens.text.secondary
  const showBackButton = !aiHome && showBack !== false && onBack !== undefined
  const menuButton = aiHome || onMenuClick !== undefined || menuIcon !== undefined
  const hasLeftContent =
    showBackButton || onPack !== undefined || menuButton || (leftActions?.length ?? 0) > 0
  const hasRightContent =
    (rightActions?.length ?? 0) > 0 ||
    rightAction !== undefined ||
    rightText !== undefined ||
    showFeedback === true ||
    showFenLei === true ||
    showSearch === true ||
    onJoinClick !== undefined

  const notificationNode = notification ? (
    <View
      style={[
        styles.notification,
        { backgroundColor: rnCssColor(currentRnTheme(), 'notificationBg') },
      ]}
    >
      <Text
        style={[
          styles.notificationText,
          { color: rnCssColor(currentRnTheme(), 'notificationText') },
        ]}
        numberOfLines={1}
      >
        {notification.text}
      </Text>
      <TouchableOpacity
        onPress={notification.onClose}
        hitSlop={ACTION_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={styles.notificationClose}
      >
        <X size={16} color={rnCssColor(currentRnTheme(), 'notificationText')} />
      </TouchableOpacity>
    </View>
  ) : null

  /* 中间:title + subtitle(flex 居中)。
     2026-09-23 修复 P1:两侧功能图标过多压缩标题空间,"智汇AI" 4 字在 18px 下被截断为"智汇..."。
     方案 B+C:center 加下限确保标题区至少容纳 4 个中文字 + title 字号 18→16 释放横向空间。
     下限与截断上限都不再写在本文件:唯一源是 navbar-spec 的
     NAVBAR_CENTER_MIN_WIDTH_PX / NAVBAR_TITLE_MAX_WIDTH_PX,小程序端取的是同一对档。 */
  return (
    <NavBarCore
      platform={NAVBAR_PLATFORM}
      containerStyle={[
        styles.container,
        aiHome || sticky ? STICKY_STYLE : null,
        bgColor ? { backgroundColor: bgColor } : null,
      ]}
      rowStyle={[styles.row, { height: contentHeight }]}
      leftStyle={styles.leftSection}
      left={
        <>
          {onPack ? (
            <BackChevron
              onPress={onPack}
              label={t('common.back')}
              colorScheme={currentRnTheme()}
              color={textColor}
            />
          ) : null}
          {onBack && showBack !== false ? (
            <BackChevron
              onPress={onBack}
              label={t('common.back')}
              colorScheme={currentRnTheme()}
              color={textColor}
            />
          ) : null}
          {menuButton ? (
            <NavBarActionButton
              action={{
                icon: menuIcon ?? Menu,
                onPress: onMenuClick ?? (() => {}),
                a11yLabel: t('NavBar.z2'),
              }}
            />
          ) : null}
          {leftActions?.map((action, index) => (
            <NavBarActionButton key={index} action={action} />
          ))}
          {!hasLeftContent ? <View style={styles.sidePlaceholder} /> : null}
        </>
      }
      centerStyle={styles.center}
      center={
        onActiveNav ? (
          <View style={styles.titleSwitch}>
            {[
              { label: t('NavBar.text1'), index: 0 },
              { label: t('ranking.title'), index: 1 },
            ].map((item) => (
              <TouchableOpacity
                key={item.index}
                onPress={() => onActiveNav?.(item.index)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeTitleIndex === item.index }}
              >
                <Text
                  style={[
                    styles.titleSwitchText,
                    {
                      color:
                        activeTitleIndex === item.index
                          ? tokens.brand.DEFAULT
                          : tokens.text.secondary,
                      fontWeight: activeTitleIndex === item.index ? '600' : '400',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : undefined
      }
      title={title}
      titleStyle={[styles.title, { color: ink }]}
      subtitle={subtitle}
      subtitleStyle={[styles.subtitle, { color: subInk }]}
      rightStyle={styles.rightSection}
      right={
        <>
          {showFeedback ? (
            <NavBarActionButton
              action={{
                icon: MessageCircle,
                onPress: onFeedbackClick ?? (() => {}),
                a11yLabel: t('NavBar.feedback'),
              }}
            />
          ) : null}
          {showFenLei ? (
            <NavBarActionButton
              action={{
                icon: Menu,
                onPress: onFenLeiClick ?? (() => {}),
                a11yLabel: t('NavBar.fenlei'),
              }}
            />
          ) : null}
          {showSearch ? (
            <NavBarActionButton
              action={{
                icon: Search,
                onPress: onSearchClick ?? (() => {}),
                a11yLabel: t('common.search'),
              }}
            />
          ) : null}
          {onJoinClick ? (
            <TouchableOpacity
              onPress={onJoinClick}
              hitSlop={ACTION_HIT_SLOP}
              style={styles.joinButton}
              accessibilityRole="button"
            >
              <Text style={styles.joinButtonText} numberOfLines={1}>
                {joinText ?? t('NavBar.z1')}
              </Text>
            </TouchableOpacity>
          ) : null}
          {rightActions?.map((action, index) => (
            <NavBarActionButton key={index} action={action} />
          ))}
          {rightAction ? <View style={styles.legacyRight}>{rightAction}</View> : null}
          {rightText ? (
            <TouchableOpacity
              onPress={onRightClick}
              hitSlop={ACTION_HIT_SLOP}
              accessibilityRole="button"
              style={styles.rightTextBtn}
            >
              <Text style={[styles.actionLabel, { color: ink }]} numberOfLines={1}>
                {rightText}
              </Text>
            </TouchableOpacity>
          ) : null}
          {!hasRightContent ? <View style={styles.sidePlaceholder} /> : null}
        </>
      }
      trailing={notificationNode}
    />
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
    // 墨迹色对齐 web 顶栏/侧边栏按钮的 text-foreground/80 —— RN 对应档是 text.medium
    // (亮 #404040 / 暗 #D4D4D4,2026-10-15 用户定:全部 NavBar 侧钮图标统一,整行深浅一致)
    return <Icon size={NAVBAR_ACTION_GLYPH_PX} color={tokens.text.medium} />
  }
  return (
    <TouchableOpacity
      onPress={action.onPress}
      hitSlop={ACTION_HIT_SLOP}
      style={styles.actionBtn}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={action.a11yLabel ?? action.label}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // 标题区下限唯一源 navbar-spec(2026-09-23 P1 定格 80);小程序端标题容器取同一档的 rpx 投影
    minWidth: NAVBAR_CENTER_MIN_WIDTH_PX,
  },
  title: {
    // 字号唯一源 navbar-spec(2026-09-23 P1 定格 16,防"智汇AI"截断;与小程序端同档)
    fontSize: NAVBAR_TITLE_FONT_PX,
    // 截断上限唯一源 navbar-spec:小程序 ai-home 标题就是这一档(原 rpx(300) = 150px)
    maxWidth: NAVBAR_TITLE_MAX_WIDTH_PX,
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
  // ===== B 组收口:ai-home 槽位 / 通知条(与小程序端同名同义)=====
  titleSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    // 40rpx = 20 逻辑 px(小程序端同一档)
    gap: rnSpacing.xl,
  },
  titleSwitchText: {
    fontSize: NAVBAR_TITLE_FONT_PX,
  },
  joinButton: {
    minWidth: NAVBAR_SIDE_PLACEHOLDER_PX,
    height: NAVBAR_ROW_HEIGHT_PX,
    paddingHorizontal: rnSpacing.sm,
    borderWidth: 1.5,
    borderColor: tokens.brand.DEFAULT,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    fontSize: NAVBAR_ACTION_LABEL_FONT_PX,
    color: tokens.brand.DEFAULT,
    fontWeight: '700',
  },
  rightTextBtn: {
    ...navbarActionBoxStyle((px: number) => px),
    paddingHorizontal: rnSpacing['xs-loose'],
    justifyContent: 'center',
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: rnSpacing.sm,
  },
  notificationText: {
    flex: 1,
    fontSize: NAVBAR_SUBTITLE_FONT_PX,
  },
  notificationClose: {
    marginLeft: rnSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    // 盒宽/盒高/居中唯一源 navbar-spec;gap 与内边距是"图标+文字"并排的端内布局,不是跨端档
    ...navbarActionBoxStyle((px: number) => px),
    paddingHorizontal: rnSpacing['xs-loose'],
    gap: rnSpacing.xs,
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
    // 侧按钮文字宽度上限唯一源 navbar-spec;小程序端的 rightText 取同一档(不再是"只有 RN 有上限")
    maxWidth: NAVBAR_ACTION_LABEL_MAX_WIDTH_PX,
  },
})

export default NavBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
