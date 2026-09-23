// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { TextInput, useColorScheme } from 'react-native'
import { cn } from '@ihui/design-tokens'

import { registerUiField, type UiFieldHandle } from './field-host'

export type InputProps = ComponentProps<typeof TextInput>

function asText(node: ReactNode | unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  return ''
}

/** 结构性敏感信号:这两项为真时连 describe 都不该出现,不是"标注不可写" */
function isStructurallySensitive(secureTextEntry: unknown, keyboardType: unknown): boolean {
  return secureTextEntry === true || keyboardType === 'visible-password'
}

/**
 * 可被 AI 填写的输入框。要点是**不假装能写**(2026-09-21 接入控件注册表):
 * - 非受控(没传 `value`)→ 值由本组件 state 持有,`write` 调这个 setter 是真生效的状态变化。
 * - 受控(传了 `value`)→ 写自己的 state 界面不动,唯一合法 path 是父组件的 `onChangeText`
 *   (用户键盘输入走的就是它)。给了才可写;没给就如实 `writable:false`,让 fill 拿
 *   UNSUPPORTED_ACTION,而不是"回了 ok 而界面没动"。
 * - 密码 / 验证码 / visible-password 一律不注册,AI 侧连看见都看不见。
 */
// 2026-07-28 修复 NativeWind 4.x + React 19 的 setState 警告
// 根因:focus 状态变化导致 className 字符串变化(focused && 'border-primary'),
// 触发 NativeWind 动态样式订阅,其他组件渲染时触发 TextInput 内部 setState。
// 修复:把动态边框色从 className 迁移到 style prop,className 保持稳定。
// primary 色值同步自 global.css / tokens.css:light=hsl(0 0% 0%),dark=hsl(0 0% 100%)
export function Input({
  className,
  onFocus,
  onBlur,
  style,
  value,
  defaultValue,
  onChangeText,
  editable,
  secureTextEntry,
  keyboardType,
  placeholder,
  accessibilityLabel,
  multiline,
  maxLength,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const colorScheme = useColorScheme()
  const primaryColor = colorScheme === 'dark' ? 'hsl(0 0% 100%)' : 'hsl(0 0% 0%)'

  const controlled = value !== undefined && value !== null
  const [selfValue, setSelfValue] = useState<string>(() =>
    asText(controlled ? value : defaultValue),
  )
  const text = controlled ? asText(value) : selfValue
  // 注册只做一次(deps []),故父组件回调必须经 ref 取当下,否则会永远调用首次渲染的旧闭包
  const onChangeTextRef = useRef(onChangeText)
  onChangeTextRef.current = onChangeText

  // 读值/读态一律经 ref 拿"当下",id 只在首次挂载申领一次(重渲染不漂移)
  const liveRef = useRef({
    controlled,
    text,
    editable,
    label: '',
    sensitive: false,
    constraint: '',
  })
  liveRef.current = {
    controlled,
    text,
    editable,
    label: asText(accessibilityLabel) || asText(placeholder),
    sensitive: isStructurallySensitive(secureTextEntry, keyboardType),
    constraint: [
      multiline ? 'multiline' : '',
      typeof maxLength === 'number' ? `maxLength=${maxLength}` : '',
      typeof keyboardType === 'string' && keyboardType !== 'default' ? keyboardType : '',
    ]
      .filter(Boolean)
      .join(' '),
  }

  const register = useCallback((): UiFieldHandle | null => {
    return registerUiField({
      kind: 'input',
      label: () => liveRef.current.label,
      value: () => liveRef.current.text,
      disabled: () => liveRef.current.editable === false,
      constraint: () => liveRef.current.constraint,
      sensitive: () => liveRef.current.sensitive,
      writable: () =>
        liveRef.current.controlled ? typeof onChangeTextRef.current === 'function' : true,
      write: (next: string) => {
        const commit = onChangeTextRef.current
        if (liveRef.current.controlled) {
          if (typeof commit !== 'function') throw new Error('受控输入未提供 onChangeText,无法写入')
          commit(next)
          return
        }
        setSelfValue(next)
        commit?.(next)
      },
    })
  }, [])

  useEffect(() => {
    const handle = register()
    if (!handle) return
    return () => handle.dispose()
  }, [register])

  return (
    <TextInput
      className={cn(
        'h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground',
        className,
      )}
      style={[style, focused ? { borderColor: primaryColor } : null]}
      placeholderTextColor="#9ca3af"
      value={text}
      onChangeText={onChangeText}
      editable={editable}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      multiline={multiline}
      maxLength={maxLength}
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
