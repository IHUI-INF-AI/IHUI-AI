import { useState } from 'react'
import type { ComponentProps } from 'react'
import { TextInput } from 'react-native'
import { cn } from '@ihui/design-tokens'

export type InputProps = ComponentProps<typeof TextInput>

export function Input({ className, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      className={cn(
        'h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground',
        focused && 'border-primary',
        className,
      )}
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
