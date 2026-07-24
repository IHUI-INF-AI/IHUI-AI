/**
 * 跨端组件 props 接口统一层(ui-react + ui-native 共享)
 *
 * 设计原则:
 * - 只定义两端完全一致的字段(variant/size 枚举共同子集 + 通用 props)
 * - 各端 extends BaseProps 后追加平台专属字段(如 web 的 className/asChild、rn 的 loading)
 * - 不合并组件实现(react-dom vs react-native),只统一类型契约
 */

/** VipBadge 共享 props(ui-react + ui-native 完全一致) */
export interface VipBadgeBaseProps {
  size?: 'sm' | 'md'
  label?: string
}

/** Badge variant 枚举(两端一致) */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/** Badge 共享 props */
export interface BadgeBaseProps {
  variant?: BadgeVariant
}

/** Button variant 共同子集(ui-react 额外有 secondary/link/hero-cta/login 等 11 个,ui-native 仅这 4 个) */
export type ButtonBaseVariant = 'default' | 'destructive' | 'outline' | 'ghost'

/** Button size 共同子集(ui-react 有 default/icon,ui-native 有 md) */
export type ButtonBaseSize = 'sm' | 'lg'

/** Button 共享 props(variant/size 限制为共同子集,各端可扩展) */
export interface ButtonBaseProps {
  variant?: ButtonBaseVariant
  size?: ButtonBaseSize
}
