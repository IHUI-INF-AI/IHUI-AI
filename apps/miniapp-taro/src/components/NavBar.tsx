import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

export interface NavBarProps {
  title?: string
  showBack?: boolean
  bgColor?: string
  textColor?: string
  onBack?: () => void
  rightText?: string
  onRightClick?: () => void
}

const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }

export default function NavBar({
  title = '',
  showBack = true,
  bgColor = '#ffffff',
  textColor = '#1a1a1a',
  onBack,
  rightText,
  onRightClick,
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

  return (
    <View
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: bgColor,
        paddingTop: `${statusBarHeight}px`,
        height: `${statusBarHeight + navBarHeight}px`,
      }}
    >
      {showBack && (
        <View
          className="absolute left-3 flex items-center justify-center w-8 h-8 rounded-full"
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
          className="absolute right-3 flex items-center justify-center h-8 px-2"
          style={{ top: `${statusBarHeight + (navBarHeight - 32) / 2}px` }}
          onClick={onRightClick}
        >
          <Text style={{ color: textColor, fontSize: '14px' }}>{rightText}</Text>
        </View>
      )}
    </View>
  )
}
