// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端输入框的聚焦描边唯一实现 —— 与 RN 端 `packages/app/src/components/TextField.tsx`
 * 同一条例外位的载体(AGENTS §4「唯一例外位:输入框/选择控件的聚焦态描边取墨档」)。
 *
 * 平台特有:依赖 `@tarojs/components` 的 Input/Textarea,不能与 RN 那份合并成一份源。
 * 但**规矩只有一条**:聚焦上色取 `var(--color-primary)`(亮纯黑/暗纯白),两端不得各取一档。
 *
 * 为什么描边用内联而不是类名切换:端内多数输入框今天**没有任何静态描边**(实测 44 个文件 / 82 个
 * 站点里,自身类名带 `border` 的只有 1 个)。类名切换要赢过 Tailwind 产出的 `.border-input`
 * 就得排加载顺序或加 `!important`(后者被守门明令禁止);内联不存在这个问题。
 * 反过来,少数**已有**描边类的输入框不能被本组件在常态涂成透明(那会让它们的可见边框消失),
 * 所以常态只在"调用方自己没画 border"时才补 1px 透明占位 —— 判据见 `hasRestingBorder`。
 *
 * 为什么要补那 1px 透明占位:weapp 的 `box-sizing: border-box` 由 preflight 全局给定,
 * 预留描边位后聚焦只换颜色 ⇒ 不产生 1px 布局跳动(与 web `border border-input` →
 * `focus-visible:border-primary` 换色不换宽同形)。
 */
import { Input, Textarea } from '@tarojs/components'
import { useState, type ComponentProps } from 'react'
import { computeFocusStyle, mergeFocusStyle } from './focus-field-style'

type InputProps = ComponentProps<typeof Input>
type TextareaProps = ComponentProps<typeof Textarea>

export function FocusInput({ className, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <Input
      {...rest}
      className={className}
      style={mergeFocusStyle(computeFocusStyle(focused, className), style as Record<string, string> | undefined)}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
    />
  )
}

export function FocusTextarea({ className, style, onFocus, onBlur, ...rest }: TextareaProps) {
  const [focused, setFocused] = useState(false)
  return (
    <Textarea
      {...rest}
      className={className}
      style={mergeFocusStyle(computeFocusStyle(focused, className), style as Record<string, string> | undefined)}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
