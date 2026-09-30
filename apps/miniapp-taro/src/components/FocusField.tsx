// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Input, Textarea } from '@tarojs/components'
import type { InputProps, TextareaProps } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { useFieldFocus } from '@/hooks/use-field-focus'

export { useFieldFocus } from '@/hooks/use-field-focus'

/**
 * 带聚焦描边的输入框/多行输入 —— 小程序端的唯一实现(对位 RN 侧
 * packages/app/src/components/TextField.tsx 与 web 侧的 `focus:*` 工具类)。
 *
 * 立因(2026-09-30):端内 31 处"有描边的输入框对聚焦无反应"(wxss 不支持 `:focus`
 * 伪类,此前唯一接了聚焦态的只有登录页一行)。描边取色只有一个出处 ——
 * hooks/use-field-focus.ts 的 `var(--color-primary)` 墨档(亮纯黑/暗纯白,聚焦只换色
 * 不换宽 ⇒ 零布局跳动),本组件不做第二份取色。
 *
 * 用法:直接替换 `<Input` ⇒ `<FocusInput`、`<Textarea` ⇒ `<FocusTextarea`,
 * 其余 props 原样透传;调用方自带的 onFocus/onBlur 会被链式调用而不是覆盖。
 * 描边画在外层容器上的形态(WRAP)不用本组件:在容器组件顶部取
 * `const ff = useFieldFocus()`,Input 上铺 `{...ff.spread}`、容器上铺 `style={ff.focusStyle}`。
 */
type FocusProps<B> = Omit<B, 'style' | 'onFocus' | 'onBlur'> & {
  style?: string | CSSProperties
  onFocus?: B extends { onFocus?: infer F } ? F : never
  onBlur?: B extends { onBlur?: infer F } ? F : never
}

/** 聚焦描边叠加在调用方 style 之上(调用方的其它样式字段优先,聚焦色最后落) */
function mergeStyle(
  style: string | CSSProperties | undefined,
  focusStyle: CSSProperties | undefined,
): string | CSSProperties | undefined {
  if (!focusStyle) return style
  if (typeof style === 'string') return `${style};border-color:var(--color-primary)`
  return { ...style, ...focusStyle }
}

export function FocusInput({ style, onFocus, onBlur, ...rest }: FocusProps<InputProps>) {
  const ff = useFieldFocus()
  return (
    <Input
      {...rest}
      style={mergeStyle(style, ff.focusStyle)}
      onFocus={(e) => {
        ff.onFocus()
        onFocus?.(e)
      }}
      onBlur={(e) => {
        ff.onBlur()
        onBlur?.(e)
      }}
    />
  )
}

export function FocusTextarea({ style, onFocus, onBlur, ...rest }: FocusProps<TextareaProps>) {
  const ff = useFieldFocus()
  return (
    <Textarea
      {...rest}
      style={mergeStyle(style, ff.focusStyle)}
      onFocus={(e) => {
        ff.onFocus()
        onFocus?.(e)
      }}
      onBlur={(e) => {
        ff.onBlur()
        onBlur?.(e)
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
