// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps, ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { ActivityIndicator, Pressable, Text } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  cn,
  SHARED_BUTTON_BASE_CLASS,
  SHARED_BUTTON_SIZE_CLASSES,
  SHARED_BUTTON_VARIANT_CLASSES,
  type ButtonBaseProps,
} from '@ihui/design-tokens'

import { registerUiField, type UiFieldHandle } from './field-host'

// 共享 variant/size 档位唯一源:@ihui/design-tokens 的 button-variants.ts(ui-react 同源)。
// 2026-10-10 机主拍板「统一网页端和手机端按钮样式」:底与字色此前是"RN 显式写、web 靠继承",
// 于是同一档名在两端渲染成不同串 —— 现在它们进共享基座(以 web 定稿为基准,对 web 是零观感变化),
// RN 不再追加同名原子(继续追加会与基座同族冲突,实际生效由 Tailwind 输出顺序决定,不是由我们决定)。
// hover/shadow 这类平台修饰在 RN 侧不存在,故不追加。
// default 档由共享配置给 `bg-cta text-cta-foreground`(AGENTS §4 主 CTA 唯一写法),
// 替换此前的 `bg-primary text-primary-foreground`(值全等、语义错位 —— primary 在 web 兼任墨色)。
export const buttonVariants = cva(`flex flex-row ${SHARED_BUTTON_BASE_CLASS} rounded-md`, {
  variants: {
    variant: {
      ...SHARED_BUTTON_VARIANT_CLASSES,
      outline: SHARED_BUTTON_VARIANT_CLASSES.outline,
      ghost: SHARED_BUTTON_VARIANT_CLASSES.ghost,
    },
    size: {
      ...SHARED_BUTTON_SIZE_CLASSES,
      // lg 已收进基座(h-10 px-8,取 web 定稿),RN 原 h-12 px-6 随本票统一 —— 现读 RN 侧 size="lg"
      // 显式传参 0 处,所以这次收敛不冲击既有布局。
      // **md 是 RN 独占档**(h-10=40),不在"同档名必须同值"的射程内,但它使 RN 的默认按钮
      // (defaultVariants size='md')仍比 web 的 default(h-9=36) 高 4px。动它等于全站 RN 按钮变矮,
      // 而 40px 是移动端触摸目标的余量 —— 属另一格决定,已登记台账,不在本票顺手改。
      lg: SHARED_BUTTON_SIZE_CLASSES.lg,
      md: 'h-10 px-4',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export interface ButtonProps
  extends
    ComponentProps<typeof Pressable>,
    ButtonBaseProps,
    Omit<VariantProps<typeof buttonVariants>, 'variant' | 'size'> {
  loading?: boolean
  children?: ReactNode
}

/** 标签取 children 的纯文本(可能是 ['保存', <Icon/>] 这类混合数组) */
function textOfChildren(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => textOfChildren(child)).join('')
  return ''
}

/**
 * 可被 AI 点击的按钮(2026-09-21 接入控件注册表)。
 *
 * 只交出**真实存在**的通道:没传 `onPress` 就不注册(不去"模拟"一个谁也看不见的事件),
 * 删除 / 支付 / 注销类由注册表按标签文本一律拒绝入表 —— 误触即不可逆损失,收益为零。
 */
export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  accessibilityLabel,
  onPress,
  ...props
}: ButtonProps) {
  // 注册一次(deps []),故 onPress/label 必须经 ref 读当下,否则会一直点到首次渲染的旧闭包
  const liveRef = useRef({ onPress, label: '', busy: false, disabled: false })
  liveRef.current = {
    onPress,
    label: textOfChildren(accessibilityLabel) || textOfChildren(children),
    busy: loading === true,
    disabled: disabled === true,
  }

  const register = useCallback((): UiFieldHandle | null => {
    const press = liveRef.current.onPress
    if (typeof press !== 'function') return null
    return registerUiField({
      kind: 'button',
      label: () => liveRef.current.label,
      disabled: () => liveRef.current.disabled || liveRef.current.busy,
      // RN 的类型签名要求传 GestureResponderEvent,注册表触发时并没有真实手势事件:
      // 界面里的 onPress 绝大多数忽略入参,极少数读 e.nativeEvent 的会抛错,
      // 由注册表如实回 EXECUTION_FAILED —— 不伪造一个假事件
      press: () => (liveRef.current.onPress as ((e?: unknown) => void) | undefined)?.(),
    })
  }, [])

  useEffect(() => {
    const handle = register()
    if (!handle) return
    return () => handle.dispose()
  }, [register])

  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), disabled && 'opacity-50', className)}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text className="text-sm font-medium leading-none">{children}</Text>
      )}
    </Pressable>
  )
}
