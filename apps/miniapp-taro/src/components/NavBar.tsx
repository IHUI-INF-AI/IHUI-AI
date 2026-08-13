import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { cn } from '@ihui/design-tokens'
// 菜单图标 SVG(对齐原项目,统一从 @/assets/remote/ 引入;Vite 编译时内联为 base64,兼容微信小程序 <Image>)
import menuIconSrc from '@/assets/remote/images/menu.svg'
import { rpx, px } from '@/utils/rpx'


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

const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }

export default function NavBar({
  title = '',
  showBack = true,
  bgColor = 'var(--color-card)',
  textColor = 'var(--color-foreground)',
  onBack,
  rightText,
  onRightClick,
  notification,
  variant = 'default',
  onMenuClick,
  onJoinClick,
  joinText = '加入社区群',
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
          style={{ height: px(navBarHeight), padding: '0 20rpx' }}
        >
          {/* 左侧:返回首页按钮 + 菜单按钮(对齐原项目 navigation-bars: @pack + @menu-click) */}
          <View className="flex items-center gap-[12rpx]">
            {onPack ? (
              <View
                className="flex items-center justify-center"
                style={{ width: rpx(40), height: rpx(40) }}
                onClick={onPack}
              >
                <Text style={{ fontSize: rpx(32), color: textColor, fontWeight: 'bold' }}>{'‹'}</Text>
              </View>
            ) : null}
            <View
              className="flex items-center justify-center"
              style={{ width: rpx(40), height: rpx(40) }}
              onClick={onMenuClick}
            >
              <Image src={menuIconSrc} style={{ width: rpx(40), height: rpx(40) }} mode="aspectFit" />
            </View>
          </View>
          {/* 中间:标题切换(每日资讯/排行榜)或普通标题 */}
          {onActiveNav ? (
            <View className="flex flex-1 items-center justify-center gap-[40rpx]">
              <View onClick={() => onActiveNav(0)}>
                <Text style={{
                  color: activeTitleIndex === 0 ? '#00F2FF' : 'rgba(255,255,255,0.6)',
                  fontSize: rpx(28),
                  fontWeight: activeTitleIndex === 0 ? '600' : 'normal' as const,
                  textDecoration: activeTitleIndex === 0 ? 'underline' : 'none' as const,
                }}>每日资讯</Text>
              </View>
              <View onClick={() => onActiveNav(1)}>
                <Text style={{
                  color: activeTitleIndex === 1 ? '#00F2FF' : 'rgba(255,255,255,0.6)',
                  fontSize: rpx(28),
                  fontWeight: activeTitleIndex === 1 ? '600' : 'normal' as const,
                  textDecoration: activeTitleIndex === 1 ? 'underline' : 'none' as const,
                }}>排行榜</Text>
              </View>
            </View>
          ) : (
            <View className="flex flex-1 items-center justify-center">
              <Text className="font-bold truncate" style={{ color: textColor, fontSize: rpx(30), maxWidth: rpx(300) }}>
                {title}
              </Text>
            </View>
          )}
          {/* 右侧:反馈按钮 / 分类按钮 / 搜索按钮 / 加入社区群按钮(对齐原项目 navigationBars) */}
          <View className="ml-auto flex flex-shrink-0 items-center gap-[12rpx]">
            {showFeedback ? (
              <View
                className="flex items-center justify-center"
                style={{ width: rpx(40), height: rpx(40) }}
                onClick={onFeedbackClick}
              >
                <Text style={{ fontSize: rpx(28), color: textColor }}>💬</Text>
              </View>
            ) : null}
            {showFenLei ? (
              <View
                className="flex items-center justify-center"
                style={{ width: rpx(40), height: rpx(40) }}
                onClick={onFenLeiClick}
              >
                <Text style={{ fontSize: rpx(28), color: textColor }}>☰</Text>
              </View>
            ) : null}
            {showSearch ? (
              <View
                className="flex items-center justify-center"
                style={{ width: rpx(40), height: rpx(40) }}
                onClick={onSearchClick}
              >
                <Text style={{ fontSize: rpx(28), color: textColor }}>🔍</Text>
              </View>
            ) : null}
            {onJoinClick ? (
              <View
                className="flex flex-shrink-0 items-center justify-center"
                style={{
                  height: rpx(48),
                  padding: '0 16rpx',
                  border: '3rpx solid var(--color-primary)',
                  borderRadius: rpx(8),
                  background: 'var(--color-card)',
                }}
                onClick={onJoinClick}
              >
                <Text style={{ color: 'var(--color-primary)', fontSize: rpx(22), fontWeight: 'bold', whiteSpace: 'nowrap' }}>{joinText}</Text>
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
              className="flex-1 truncate text-[24rpx]"
              style={{ color: 'var(--color-notification-text)' }}
            >
              {notification.text}
            </Text>
            <Text
              className="ml-[16rpx] text-[32rpx] leading-none"
              style={{ color: 'var(--color-notification-text)' }}
              onClick={notification.onClose}
            >
              ×
            </Text>
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
        <View
          className={cn('absolute left-3 flex items-center justify-center w-8 h-8 rounded-lg')}
          style={{ top: px(statusBarHeight + (navBarHeight - 32) / 2) }}
          onClick={handleBack}
        >
          <Text style={{ color: textColor, fontSize: '22px' }}>{'‹'}</Text>
        </View>
      )}
      <Text
        className="text-base font-medium truncate max-w-[60%]"
        style={{ color: textColor, lineHeight: px(navBarHeight) }}
      >
        {title}
      </Text>
      {rightText && (
        <View
          className={cn('absolute right-3 flex items-center justify-center h-8 px-2')}
          style={{ top: px(statusBarHeight + (navBarHeight - 32) / 2) }}
          onClick={onRightClick}
        >
          <Text style={{ color: textColor, fontSize: '14px' }}>{rightText}</Text>
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
            className="flex-1 truncate text-[24rpx]"
            style={{ color: 'var(--color-notification-text)' }}
          >
            {notification.text}
          </Text>
          <Text
            className="ml-[16rpx] text-[32rpx] leading-none"
            style={{ color: 'var(--color-notification-text)' }}
            onClick={notification.onClose}
          >
            ×
          </Text>
        </View>
      )}
    </View>
  )
}
