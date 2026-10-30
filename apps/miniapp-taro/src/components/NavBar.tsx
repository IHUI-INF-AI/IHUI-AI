// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { useTt, t } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro from '@tarojs/taro'
import { cn, rnRadius, TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  NAVBAR_ACTION_GLYPH_PX,
  NAVBAR_ACTION_LABEL_FONT_PX,
  NAVBAR_ACTION_LABEL_MAX_WIDTH_PX,
  NAVBAR_CENTER_MIN_WIDTH_PX,
  NAVBAR_SIDE_PADDING_PX,
  NAVBAR_TITLE_FONT_PX,
  NAVBAR_TITLE_MAX_WIDTH_PX,
  navbarActionBoxStyle,
} from '@ihui/shared/ui/navbar-spec'
import { rpx, px } from '@/utils/rpx'
import BackChevron from '@/components/BackChevron'

/// 档位数字与盒子结构在 @ihui/shared/ui/navbar-spec(与 RN 端同表);本文件只做 rpx 换算 + 挂 Taro 原语。
const toUnit = (logicalPx: number) => rpx(logicalPx * TARO_RPX_PER_PX)
/// LineIcon 的 size 收 rpx 数值(与 BackChevron 同一口径)
const ACTION_GLYPH_RPX_NUM = NAVBAR_ACTION_GLYPH_PX * TARO_RPX_PER_PX
const ACTION_BOX_STYLE = navbarActionBoxStyle(toUnit)
const TITLE_FONT = toUnit(NAVBAR_TITLE_FONT_PX)
/// 标题区下限 / 标题截断宽:与 RN 的 center.minWidth、title.maxWidth 同档同值(两端都真取它,
/// 不是把数字搬进声明而另一端仍渲染别的宽度)
const CENTER_STYLE = { minWidth: toUnit(NAVBAR_CENTER_MIN_WIDTH_PX) } as const
const TITLE_STYLE = { fontSize: TITLE_FONT, maxWidth: toUnit(NAVBAR_TITLE_MAX_WIDTH_PX) } as const
/// 侧按钮文字上限:与 RN 的 actionLabel.maxWidth 同档;配 truncate 才等价 RN 的 numberOfLines={1}
const ACTION_LABEL_STYLE = {
  fontSize: toUnit(NAVBAR_ACTION_LABEL_FONT_PX),
  maxWidth: toUnit(NAVBAR_ACTION_LABEL_MAX_WIDTH_PX),
} as const

export interface NavBarNotification {
  text: string
  onClose?: () => void
}

/**
 * NavBar 顶部导航栏
 *
 * 两种模式:
 * - 默认(兼容旧调用):fixed 顶部 + 左返回按钮 + 居中标题 + 右可选文字
 * - variant="ai-home"(首页专用):sticky 顶部 + 左菜单按钮 + 标题居中(对齐原项目 navigation-bars/index.vue:背景 #E9F0FD + 标题色 #171717 + 字号 30rpx)+ 右"加入社区群"按钮
 *
 * 其他页面(distribution 等)只传 title/bgColor/textColor,默认行为不变。
 */
export interface NavBarProps {
  title?: string
  showBack?: boolean
  bgColor?: string
  textColor?: string
  onBack?: () => void
  rightText?: string
  onRightClick?: () => void
  notification?: NavBarNotification
  /** 首页专用模式:sticky + menu + join 按钮 */
  variant?: 'default' | 'ai-home'
  /** ai-home 模式:左菜单按钮点击 */
  onMenuClick?: () => void
  /** ai-home 模式:右"加入社区群"按钮点击 */
  onJoinClick?: () => void
  /** ai-home 模式:菜单按钮文字(默认 ☰) */
  menuIcon?: string
  /** ai-home 模式:右侧按钮文字(默认"加入社区群") */
  joinText?: string
  /** ai-home 模式:showFenLei 分类按钮(对齐原项目 navigationBars) */
  showFenLei?: boolean
  /** ai-home 模式:分类按钮点击(对齐原项目 @nav-click) */
  onFenLeiClick?: () => void
  /** ai-home 模式:showSearch 搜索按钮(对齐原项目 isShowSearch) */
  showSearch?: boolean
  /** ai-home 模式:搜索按钮点击(对齐原项目 @clicksearch) */
  onSearchClick?: () => void
  /** showFeedback 反馈按钮(对齐原项目 @feedback-click) */
  showFeedback?: boolean
  /** 反馈按钮点击(对齐原项目 @feedback-click) */
  onFeedbackClick?: () => void
  /** @pack 返回首页回调(对齐原项目 @pack,区别于 onBack 的 navigateBack 行为) */
  onPack?: () => void
  /** ai-home 模式:标题切换当前索引(0=每日资讯,1=排行榜) */
  activeTitleIndex?: number
  /** ai-home 模式:标题切换回调(接收索引) */
  onActiveNav?: (index: number) => void
}

/// 平台机制差异(waiver):状态栏占位与行高在小程序端由微信胶囊实测推导
/// (menuButton.top / menuButton.height + 8),RN 端走 SafeAreaView + navbar-spec 行高档;
/// 通道各端保留,可共享的几何档(字号、内边距、标题上下限、侧按钮盒子)已全部收进 navbar-spec。
/// 返回命中块 36 **不在本文件取数** —— 它由 `<BackChevron>` 经 `backChevronBoxStyle`(唯一源
/// `GEOMETRY_PX.tapBox`)自持,本组件只负责把它放进一个行高的 flex 容器里居中;此前本文件用 36 做
/// `(navBarHeight - 36) / 2` 的算术 = 同一尺寸的第二个名字(守门 128 的 SL 正是这样报出来的)。
const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }

export default function NavBar({
  title = '',
  showBack = true,
  bgColor = 'var(--color-background)',
  textColor = 'var(--color-foreground)',
  onBack,
  rightText,
  onRightClick,
  notification,
  variant = 'default',
  onMenuClick,
  onJoinClick,
  joinText = t('NavBar.z1'),
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
  const tt = useTt()
  const statusBarHeight = menuButton.top
  const navBarHeight = menuButton.height + 8

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      Taro.navigateBack({ delta: 1 }).catch(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      })
    }
  }

  /// 行盒锚点:绝对悬浮的返回键 / 侧按钮都以"状态栏以下的这一行"为容器,由 flex 完成垂直居中。
  /// 此前这里做的是 `(navBarHeight - 盒子档) / 2` 的算术 —— 那要求本文件知道箭头方块与按钮盒多大,
  /// 而那两个尺寸的单一源在 backChevronBoxStyle / navbarActionBoxStyle 里(两条腿各自的返回键与
  /// 侧按钮都经同一份盒子出口取数)。算术删掉后尺寸只剩一处真相。
  /// ⚠️ 但**不要把它读成"渲染位置逐档等价"** —— 模拟器 A/B(2026-09-27,票③验收)量出来的是:
  /// 375 逻辑宽下两版同一档,而**更宽的屏上旧版恒偏下 (实际盒高 − 36)/2**:返回盒 72rpx 在 390/402
  /// 宽上实渲 37.44/38.59px,旧算术按声明档 36 居中 ⇒ 偏下 0.72/1.30px;右钮 64rpx 同理偏 0.64/1.16px。
  /// 也就是说旧写法在 375 之外**本来就没居中**(把 rpx 当 px 用了),flex 才是对的。
  const rowBoxStyle = { top: px(statusBarHeight), height: px(navBarHeight) } as const

  if (variant === 'ai-home') {
    // ===== ai-home 模式:对齐原项目 navigation-bars/index.vue(粘性 + 标题居中 + 左菜单 + 右加入按钮)=====
    return (
      <View
        className="sticky top-0 left-0 right-0 z-[1001] flex flex-col"
        style={{ backgroundColor: bgColor }}
      >
        {/* 状态栏占位 */}
        <View style={{ height: px(statusBarHeight) }} />
        {/* 标题栏:flex 行布局,左菜单 / 中标题 / 右加入按钮 */}
        <View
          className="relative flex items-center"
          style={{
            height: px(navBarHeight),
            paddingLeft: toUnit(NAVBAR_SIDE_PADDING_PX),
            paddingRight: toUnit(NAVBAR_SIDE_PADDING_PX),
          }}
        >
          {/* 左侧:返回首页按钮 + 菜单按钮(对齐原项目 navigation-bars: @pack + @menu-click) */}
          <View className="flex items-center gap-[12rpx]">
            {onPack ? <BackChevron onTap={onPack} color={textColor} /> : null}
            <View style={ACTION_BOX_STYLE} onClick={onMenuClick} hoverClass="opacity-60">
              <LineIcon
                name="menu"
                size={ACTION_GLYPH_RPX_NUM}
                color="var(--color-muted-foreground)"
              />
            </View>
          </View>
          {/* 中间:标题切换(每日资讯/排行榜)或普通标题 */}
          {onActiveNav ? (
            <View
              className="flex flex-1 items-center justify-center gap-[40rpx]"
              style={CENTER_STYLE}
            >
              <View onClick={() => onActiveNav(0)} hoverClass="opacity-60">
                <Text
                  style={{
                    color:
                      activeTitleIndex === 0
                        ? 'var(--color-primary)'
                        : 'var(--color-muted-foreground)',
                    fontSize: TITLE_FONT,
                    fontWeight: activeTitleIndex === 0 ? '600' : ('normal' as const),
                  }}
                >
                  {tt('NavBar.text1', '每日资讯')}
                </Text>
              </View>
              <View onClick={() => onActiveNav(1)} hoverClass="opacity-60">
                <Text
                  style={{
                    color:
                      activeTitleIndex === 1
                        ? 'var(--color-primary)'
                        : 'var(--color-muted-foreground)',
                    fontSize: TITLE_FONT,
                    fontWeight: activeTitleIndex === 1 ? '600' : ('normal' as const),
                  }}
                >
                  {tt('ranking.title', '排行榜')}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex flex-1 items-center justify-center" style={CENTER_STYLE}>
              {/* 标题截断宽与 RN 端同档(spec `NAVBAR_TITLE_MAX_WIDTH_PX` = 150,即原写法 rpx(300)
                  的同一数值):两端最终落到屏幕上的宽度相同,不是只把数字搬进声明。 */}
              <Text className="font-bold truncate" style={{ color: textColor, ...TITLE_STYLE }}>
                {title}
              </Text>
            </View>
          )}
          {/* 右侧:反馈按钮 / 分类按钮 / 搜索按钮 / 加入社区群按钮(对齐原项目 navigationBars) */}
          <View className="ml-auto flex flex-shrink-0 items-center gap-[12rpx]">
            {showFeedback ? (
              <View style={ACTION_BOX_STYLE} onClick={onFeedbackClick} hoverClass="opacity-60">
                <LineIcon
                  name="message-circle"
                  size={ACTION_GLYPH_RPX_NUM}
                  color="var(--color-muted-foreground)"
                />
              </View>
            ) : null}
            {showFenLei ? (
              <View style={ACTION_BOX_STYLE} onClick={onFenLeiClick} hoverClass="opacity-60">
                <LineIcon
                  name="menu"
                  size={ACTION_GLYPH_RPX_NUM}
                  color="var(--color-muted-foreground)"
                />
              </View>
            ) : null}
            {showSearch ? (
              <View style={ACTION_BOX_STYLE} onClick={onSearchClick} hoverClass="opacity-60">
                <LineIcon
                  name="search"
                  size={ACTION_GLYPH_RPX_NUM}
                  color="var(--color-muted-foreground)"
                />
              </View>
            ) : null}
            {onJoinClick ? (
              <View
                className="flex flex-shrink-0 items-center justify-center"
                style={{
                  // 侧按钮盒档(最小宽 + 定高)与同行图标钮、RN 的 actionBtn 同一份 spec 盒子;
                  // 原端内自写 height: rpx(48)=24px 是本文件里第二枚按钮盒档,收口到 spec 的 32。
                  ...ACTION_BOX_STYLE,
                  padding: '0 16rpx',
                  border: '3rpx solid var(--color-brand-accent-deep)',
                  borderRadius: rnRadius.sm,
                  background: 'var(--color-card)',
                }}
                onClick={onJoinClick}
                hoverClass="opacity-60"
              >
                <Text
                  style={{
                    color: 'var(--color-primary)',
                    fontSize: toUnit(NAVBAR_ACTION_LABEL_FONT_PX),
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {joinText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {notification && (
          <View
            className="flex items-center justify-between px-[32rpx] py-[16rpx]"
            style={{ backgroundColor: 'var(--color-notification-bg)' }}
          >
            <Text
              className="flex-1 truncate text-[length:24rpx]"
              style={{ color: 'var(--color-notification-text)' }}
            >
              {notification.text}
            </Text>
            {/* 关闭键载体 = 矢量(O81 票:原为字符 × 冒充图标);
                尺寸沿用该元素原数值档 32rpx,色档沿用 var(--color-notification-text) 不变 */}
            <LineIcon
              name="x"
              size={32}
              color="var(--color-notification-text)"
              className="ml-[16rpx]"
              onClick={notification.onClose}
            />
          </View>
        )}
      </View>
    )
  }

  // ===== 默认模式:fixed 顶部 + 返回按钮(兼容 distribution 等旧调用)=====
  return (
    <View
      className={cn('fixed top-0 left-0 right-0 z-50 flex items-center justify-center')}
      style={{
        backgroundColor: bgColor,
        paddingTop: px(statusBarHeight),
        height: px(statusBarHeight + navBarHeight),
      }}
    >
      {showBack && (
        <View className="absolute left-2 flex items-center" style={rowBoxStyle}>
          <BackChevron onTap={handleBack} color={textColor} />
        </View>
      )}
      <Text
        className="font-medium truncate max-w-[60%]"
        style={{ color: textColor, fontSize: TITLE_FONT, lineHeight: px(navBarHeight) }}
      >
        {title}
      </Text>
      {rightText && (
        <View className="absolute right-3 flex items-center" style={rowBoxStyle}>
          {/* 侧按钮盒子 = navbarActionBoxStyle(最小宽 28 + 定高 32 + 行内居中),与 RN 的 actionBtn
              同一条出口、同一份尺寸;端内只加自己的水平留白 px-2。 */}
          <View
            className="px-2"
            style={ACTION_BOX_STYLE}
            onClick={onRightClick}
            hoverClass="opacity-60"
          >
            {/* 侧按钮文字宽度上限与 RN 的 actionLabel 同一档(spec 60);truncate = RN 的 numberOfLines={1} */}
            <Text className="truncate" style={{ color: textColor, ...ACTION_LABEL_STYLE }}>
              {rightText}
            </Text>
          </View>
        </View>
      )}
      {notification && (
        <View
          className="absolute left-0 right-0 flex items-center justify-between px-[32rpx] py-[16rpx]"
          style={{
            top: px(statusBarHeight + navBarHeight),
            backgroundColor: 'var(--color-notification-bg)',
          }}
        >
          <Text
            className="flex-1 truncate text-[length:24rpx]"
            style={{ color: 'var(--color-notification-text)' }}
          >
            {notification.text}
          </Text>
          {/* 关闭键载体 = 矢量(与上方 ai-home 同一处 × 同批收口);尺寸/色档同口径 */}
          <LineIcon
            name="x"
            size={32}
            color="var(--color-notification-text)"
            className="ml-[16rpx]"
            onClick={notification.onClose}
          />
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
