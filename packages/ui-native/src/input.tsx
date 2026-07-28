import { useState } from 'react'
import type { ComponentProps } from 'react'
import { TextInput, useColorScheme } from 'react-native'
import { cn } from '@ihui/design-tokens'

export type InputProps = ComponentProps<typeof TextInput>

// 2026-07-28 修复 NativeWind 4.x + React 19 的 setState 警告
// 根因:focus 状态变化导致 className 字符串变化(focused && 'border-primary'),
// 触发 NativeWind 动态样式订阅,其他组件渲染时触发 TextInput 内部 setState。
// 修复:把动态边框色从 className 迁移到 style prop,className 保持稳定。
// primary 色值同步自 global.css / tokens.css:light=hsl(0 0% 0%),dark=hsl(0 0% 100%)
export function Input({ className, onFocus, onBlur, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false)
  const colorScheme = useColorScheme()
  const primaryColor = colorScheme === 'dark' ? 'hsl(0 0% 100%)' : 'hsl(0 0% 0%)'
  return (
    <TextInput
      className={cn(
        'h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground',
        className,
      )}
      style={[style, focused ? { borderColor: primaryColor } : null]}
      placeholderTextColor="#9ca3af"
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      {...props}
    />
  )
}
