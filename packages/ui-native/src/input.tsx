// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { TextInput, useColorScheme } from 'react-native'
import { cn } from '@ihui/design-tokens'
import {
  INPUT_BORDER_WIDTH_PX,
  INPUT_HEIGHT_PX,
  INPUT_PADDING_X_PX,
  INPUT_RADIUS_TIER,
  INPUT_TEXT_TIER,
} from '@ihui/shared/ui/input-spec'

import { registerUiField, type UiFieldHandle } from './field-host'

/**
 * 平台专属项(不下沉 input-spec,两端允许不同形,逐条登记):
 *  - `placeholderTextColor` / `secureTextEntry` / `keyboardType` / `multiline` / `maxLength`:
 *    本端的输入**行为**档,web 端走 HTML input 原生属性另一条通道;
 *  - focus 边框色走 **style prop**(见下面 2026-07-28 注释):动态 className 会触发 NativeWind 4.x
 *    + React 19 的样式订阅警告 ⇒ 那是**色**的承载,不是几何;web 端仍严格走类名;
 *  - **AI 可填注册逻辑**(下面 :38-119 的 register / useEffect):本端独有的行为契约,
 *    web 端没有 field-host 通道 ⇒ 规则6。本票只沉几何,那一段一行未动;
 *  - `border-input`:边框色(nativewind 主题)⇒ 色值不下沉,只沉宽度;
 *  - 无 `py-1` / `shadow-sm` / `w-full`:本端高度已由 INPUT_HEIGHT_PX 单点定档、无控件投影通道;
 *  - 类名字面量:必须留在本文件 —— nativewind 只扫本包源,spec 文件不在扫描面内,拼串产不出规则。
 *  ⇒ 取值档一律取自 input-spec,本文件只做"档 → 本端承载类"的映射。
 */
const HEIGHT_CLASS: Record<number, string> = { 36: 'h-9' }
const RADIUS_CLASS: Record<typeof INPUT_RADIUS_TIER, string> = { sm: 'rounded-sm' }
const PADDING_X_CLASS: Record<number, string> = { 12: 'px-3' }
const TEXT_CLASS: Record<typeof INPUT_TEXT_TIER, string> = { sm: 'text-sm' }
const BORDER_WIDTH_CLASS: Record<number, string> = { 1: 'border' }

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
        'bg-transparent text-foreground',
        HEIGHT_CLASS[INPUT_HEIGHT_PX],
        RADIUS_CLASS[INPUT_RADIUS_TIER],
        BORDER_WIDTH_CLASS[INPUT_BORDER_WIDTH_PX],
        PADDING_X_CLASS[INPUT_PADDING_X_PX],
        TEXT_CLASS[INPUT_TEXT_TIER],
        'border-input',
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
