// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps, ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { ActivityIndicator, Pressable, Text } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, type ButtonBaseProps } from '@ihui/design-tokens'

import { registerUiField, type UiFieldHandle } from './field-host'

export const buttonVariants = cva('flex flex-row items-center justify-center rounded-md', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
      outline: 'border border-input bg-transparent text-foreground',
      ghost: 'bg-transparent text-foreground',
    },
    size: {
      sm: 'h-8 px-3',
      md: 'h-10 px-4',
      lg: 'h-12 px-6',
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
