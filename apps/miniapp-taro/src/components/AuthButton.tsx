import { View, Text, Image } from '@tarojs/components'
import { type ReactNode, type ReactElement } from 'react'

/**
 * 认证按钮共享组件 — 对齐 zhs_app-ZZ login.vue / register.vue 的 btn
 * zcbutton.png 背景图(Image 组件作背景层,兼容微信小程序),3 个变体:
 * - login: border-radius 30rpx + color #fff + text-shadow(登录/找回密码页)
 * - register: border-radius 15rpx + color rgba(0,0,0,0.5)(注册页)
 * 样式由各页面 CSS 定义 .login-btn / .btn / .btn-bg / .btn-text 类名
 */

export interface AuthButtonProps {
  /** 按钮文字 */
  children: ReactNode
  /** 点击回调 */
  onClick: () => void
  /** 禁用态(loading 时传 true) */
  disabled?: boolean
  /** 视觉变体:login=登录/找回密码,register=注册 */
  variant?: 'login' | 'register'
}

export default function AuthButton({
  children,
  onClick,
  disabled = false,
  variant = 'login',
}: AuthButtonProps): ReactElement {
  const variantClass = variant === 'register' ? 'btn-register' : 'btn-login'
  return (
    <View className="login-btn">
      <View
        className={`btn ${variantClass} ${disabled ? 'btn-disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
      >
        <Image className="btn-bg" src="/static/images/zcbutton.png" mode="scaleToFill" />
        <Text className="btn-text">{children}</Text>
      </View>
    </View>
  )
}
