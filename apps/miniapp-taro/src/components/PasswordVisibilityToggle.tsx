import { View, Image } from '@tarojs/components'
import { type ReactElement } from 'react'

/**
 * 密码可见性切换共享组件 — 对齐 zhs_app-ZZ login.vue 的 password-toggle
 * visible 时显示 eye-gray.svg,hidden 时显示 eye-slash-gray.svg
 * 样式由各页面 CSS 定义 .password-toggle / .eye-icon 类名
 */

export interface PasswordVisibilityToggleProps {
  /** 密码是否明文显示 */
  visible: boolean
  /** 点击切换回调 */
  onToggle: () => void
}

export default function PasswordVisibilityToggle({
  visible,
  onToggle,
}: PasswordVisibilityToggleProps): ReactElement {
  return (
    <View className="password-toggle" onClick={onToggle}>
      <Image
        className="eye-icon"
        src={visible ? '/static/images/eye-gray.svg' : '/static/images/eye-slash-gray.svg'}
        mode="aspectFit"
      />
    </View>
  )
}
