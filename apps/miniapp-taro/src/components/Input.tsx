// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { Input as TaroInput } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import { useFieldFocus } from '@/hooks/use-field-focus'

/**
 * 输入框组件 —— 与 `packages/ui-native/src/input.tsx` 逐类对齐(「一模一样」契约)。
 *
 * 两端共用同一组 class(基座 `h-10 rounded-sm border border-input bg-transparent px-3 text-sm text-foreground`),
 * 故视觉由统一 token 保证一致。RN 端用 `focused ? { borderColor: primary }` 切聚焦描边;
 * 小程序端复用 `useFieldFocus`(全端唯一聚焦描边取色点,var(--color-primary) 墨档,聚焦只换色不换宽),
 * 与端内 FocusField 同一机制,避免第二份取色(AGENTS §6 单一真相源)。
 *
 * 各端原生 props 名不同(RN `onChangeText`/`secureTextEntry`/`keyboardType` ↔ Taro `onInput`/`password`/`type`),
 * 与 Card/Button/Switch 同策略:结构 + 视觉 token 对齐,原生 prop 各走各端。
 * RN 的 AI 控件注册表(registerUiField)是 RN 平台特性,小程序侧不接入。
 */
export type InputProps = ComponentProps<typeof TaroInput>

export function Input({ className, style, onFocus, onBlur, ...props }: InputProps) {
  const ff = useFieldFocus()
  // 聚焦态描边只在 focused 时介入(与 RN `style={[style, focused ? {borderColor} : null]}` 同语义);
  // 取色仍只来自 useFieldFocus(全端唯一聚焦描边取色点),本文件不再手写墨档取色 ——
  // 第二份取色正是 AGENTS §4 单一真相源要拦的形态。
  const focusBorder = ff.focusStyle?.borderColor
  const mergedStyle = focusBorder
    ? typeof style === 'string'
      ? `${style};border-color:${focusBorder}`
      : { ...(style as object), ...ff.focusStyle }
    : style

  return (
    <TaroInput
      className={cn(
        'h-10 rounded-sm border border-input bg-transparent px-3 text-sm text-foreground',
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
