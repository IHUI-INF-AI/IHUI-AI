// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps, ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import {
  cn,
  SHARED_BUTTON_BASE_CLASS,
  SHARED_BUTTON_VARIANT_CLASSES,
  SHARED_BUTTON_SIZE_CLASSES,
} from '@ihui/design-tokens'

/**
 * 按钮组件 —— 与 `packages/ui-native/src/button.tsx` 逐类对齐(「一模一样」契约)。
 *
 * 两端共用同一份 @ihui/design-tokens 的 SHARED_BUTTON_* 共享 class(底 / 字色 / 尺寸档),
 * 故同一组类名在 RN(NativeWind)与小程序(Taro)渲染出完全一致的视觉:
 * - 基座:`flex flex-row items-center justify-center rounded-md`
 * - variant default: bg-cta text-cta-foreground / destructive / outline / ghost(共享 4 档)
 * - size: sm = h-8 px-3, md = h-10 px-4(对齐 RN 独占档), lg = h-10 px-8(共享档)
 *
 * 不在此处把共享档写为字面量:4 档 + sm/lg 由 button-variants.ts 单一真相源钉住,
 * 跨端回潮即红(守门 `scripts/tests/shared-button-tier-base.test.mjs`)。
 * RN 的 cva 实例与本文件用「同基座 + 同共享档 + 同追加档」保证等价,而非共用同一份 cva。
 */
type ButtonVariant = keyof typeof SHARED_BUTTON_VARIANT_CLASSES
type ButtonSize = keyof typeof SHARED_BUTTON_SIZE_CLASSES | 'md'

const BUTTON_BASE = `flex flex-row ${SHARED_BUTTON_BASE_CLASS} rounded-md`

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  ...SHARED_BUTTON_SIZE_CLASSES,
  // md 是 RN 独占档(h-10 px-4),小程序侧对齐同一串,使默认按钮两端同高同宽。
  md: 'h-10 px-4',
}

export interface ButtonProps extends Omit<ComponentProps<typeof View>, 'onClick'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  children?: ReactNode
}

/**
 * 可被点击的按钮。视觉与交互对齐 RN 端 Button:
 * - loading 时以 ActivityIndicator 替换文字(对应 RN 的 ActivityIndicator),并禁用点击;
 * - disabled / loading 时整体降透明度且不触发 onClick(对应 RN 的 Pressable disabled);
 * - hoverClass 提供点按反馈(对应 RN Pressable 的按压态),禁用态不触发。
 */
export function Button({
  className,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <View
      className={cn(
        BUTTON_BASE,
        SHARED_BUTTON_VARIANT_CLASSES[variant],
        BUTTON_SIZE_CLASSES[size],
        isDisabled && 'opacity-50',
        className,
      )}
      hoverClass={isDisabled ? 'none' : 'opacity-80'}
      onClick={isDisabled ? undefined : onClick}
      {...props}
    >
      {loading ? (
        <View className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Text className="text-sm font-medium leading-none">{children}</Text>
      )}
    </View>
  )
}

export default Button
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
