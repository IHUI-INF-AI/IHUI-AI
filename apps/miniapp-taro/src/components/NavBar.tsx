import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { cn } from '@ihui/design-tokens'

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
  menuIcon = '☰',
  joinText = '加入社区群',
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
        <View style={{ height: `${statusBarHeight}px` }} />
        {/* 标题栏:flex 行布局,左菜单 / 中标题 / 右加入按钮 */}
        <View
          className="relative flex items-center"
          style={{ height: `${navBarHeight}px`, padding: '0 20rpx' }}
        >
          {/* 左侧:菜单按钮 */}
          <View
            className="flex items-center justify-center"
            style={{ width: '40rpx', height: '40rpx' }}
            onClick={onMenuClick}
          >
            <Text style={{ color: textColor, fontSize: '30rpx' }}>{menuIcon}</Text>
          </View>
          {/* 中间:标题(absolute 居中,对齐 .center-row-absolute)*/}
          <View
            className="absolute left-1/2 top-1/2 flex items-center justify-center"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <Text
              className="font-bold"
              style={{ color: textColor, fontSize: '30rpx' }}
            >
              {title}
            </Text>
          </View>
          {/* 右侧:加入社区群按钮(对齐 .btn_join / .nav-join-btn:border 3rpx + 圆角 8rpx + 字号 24rpx)*/}
          <View
            className="ml-auto flex items-center justify-center"
            style={{
              height: '48rpx',
              padding: '0 14rpx',
              border: '3rpx solid #000',
              borderRadius: '8rpx',
              background: 'var(--color-card)',
            }}
            onClick={onJoinClick}
          >
            <Text style={{ color: '#000', fontSize: '24rpx', fontWeight: 'bold' }}>
              {joinText}
            </Text>
          </View>
        </View>
        {notification && (
          <View
            className="flex items-center justify-between px-[32rpx] py-[16rpx]"
            style={{ backgroundColor: 'var(--color-notification-bg)' }}
          >
            <Text className="flex-1 truncate text-[24rpx]" style={{ color: 'var(--color-notification-text)' }}>
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
        paddingTop: `${statusBarHeight}px`,
        height: `${statusBarHeight + navBarHeight}px`,
      }}
    >
      {showBack && (
        <View
          className={cn('absolute left-3 flex items-center justify-center w-8 h-8 rounded-lg')}
          style={{ top: `${statusBarHeight + (navBarHeight - 32) / 2}px` }}
          onClick={handleBack}
        >
          <Text style={{ color: textColor, fontSize: '22px' }}>{'‹'}</Text>
        </View>
      )}
      <Text
        className="text-base font-medium truncate max-w-[60%]"
        style={{ color: textColor, lineHeight: `${navBarHeight}px` }}
      >
        {title}
      </Text>
      {rightText && (
        <View
          className={cn('absolute right-3 flex items-center justify-center h-8 px-2')}
          style={{ top: `${statusBarHeight + (navBarHeight - 32) / 2}px` }}
          onClick={onRightClick}
        >
          <Text style={{ color: textColor, fontSize: '14px' }}>{rightText}</Text>
        </View>
      )}
      {notification && (
        <View
          className="absolute left-0 right-0 flex items-center justify-between px-[32rpx] py-[16rpx]"
          style={{ top: `${statusBarHeight + navBarHeight}px`, backgroundColor: 'var(--color-notification-bg)' }}
        >
          <Text className="flex-1 truncate text-[24rpx]" style={{ color: 'var(--color-notification-text)' }}>
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
