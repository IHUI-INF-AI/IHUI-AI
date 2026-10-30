// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { Input as TaroInput } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import { useFieldFocus } from '@/hooks/use-field-focus'
import {
  INPUT_BORDER_WIDTH_PX,
  INPUT_HEIGHT_PX,
  INPUT_PADDING_X_PX,
  INPUT_RADIUS_TIER,
  INPUT_TEXT_TIER,
} from '@ihui/shared/ui/input-spec'

/**
 * 输入框组件 —— 与 `packages/ui-native/src/input.tsx` 逐类对齐(「一模一样」契约)。
 *
 * **取值档一律取自 `@ihui/shared/ui/input-spec`**(与 web 壳、RN 壳同源):改 spec 一处,三端同时跟随。
 * 本文件只做「档 → 本端承载类」的映射,映射表由 `scripts/gen-ui-mirror.mjs` 与 RN 壳逐条对账
 * (同名同值;漂移即红)—— 高度档 36 是 spec 裁定值,端内不再手写 `h-10`。
 *
 * 平台承载差异(规则6,逐条登记):
 * - 聚焦描边色:RN 走 style 的 borderColor;本端复用 `useFieldFocus`(全端唯一聚焦描边取色点),
 *   聚焦只换色不换宽,与端内 FocusField 同一机制,避免第二份取色(AGENTS §6 单一真相源);
 * - 原生 prop 名:RN `onChangeText`/`secureTextEntry`/`keyboardType` ↔ Taro `onInput`/`password`/`type`;
 * - RN 的 AI 控件注册表(registerUiField)是 RN 平台特性,小程序侧不接入。
 *
 * 类名字面量必须留在这里:spec 文件不在 Tailwind 扫描面内,拼串产不出规则。
 */
const HEIGHT_CLASS: Record<number, string> = { 36: 'h-9' }
const RADIUS_CLASS: Record<typeof INPUT_RADIUS_TIER, string> = { sm: 'rounded-sm' }
const PADDING_X_CLASS: Record<number, string> = { 12: 'px-3' }
const TEXT_CLASS: Record<typeof INPUT_TEXT_TIER, string> = { sm: 'text-sm' }
const BORDER_WIDTH_CLASS: Record<number, string> = { 1: 'border' }

export type InputProps = ComponentProps<typeof TaroInput>

export function Input({ className, style, onFocus, onBlur, ...props }: InputProps) {
  const ff = useFieldFocus()
  // 聚焦态描边只在 focused 时介入(与 RN `style={[style, focused ? {borderColor} : null]}` 同语义);
  // 取色仍只来自 useFieldFocus,本文件不再手写墨档取色 —— 第二份取色正是 AGENTS §4 要拦的形态。
  const focusBorder = ff.focusStyle?.borderColor
  const mergedStyle = focusBorder
    ? typeof style === 'string'
      ? `${style};border-color:${focusBorder}`
      : { ...(style as object), ...ff.focusStyle }
    : style

  return (
    <TaroInput
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
      style={mergedStyle}
      onFocus={(e) => {
        ff.onFocus()
        onFocus?.(e)
      }}
      onBlur={(e) => {
        ff.onBlur()
        onBlur?.(e)
      }}
      {...props}
    />
  )
}

export default Input
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
