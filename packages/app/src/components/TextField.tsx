// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState, type ComponentPropsWithRef } from 'react'
import { TextInput, type StyleProp, type TextStyle } from 'react-native'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * 带聚焦描边的输入框 —— RN/共享屏的唯一实现。
 *
 * 立因:原生 TextInput 默认**没有任何聚焦视觉反馈**,而 web 端自 2026 起一直是
 * `focus-visible:border-primary`(墨档:亮纯黑/暗纯白)。登录页当时是就地手写的一份
 * `FocusInput`,其余 60+ 个输入框连聚焦态都没有 —— 于是同一个动作在三个端上
 * 表现成三种样子,而用户报的是"所有输入框的激活态描边没了"。
 *
 * 为什么住在 packages/app 而不是各端各写:聚焦墨档取值必须只有一个出处
 * (AGENTS §3 共享层优先 / §4 跨端像素级同值)。各端各写一份 `useState(focused)`,
 * 对账门只能证明"两端都有聚焦",证不了"两端取同一档"。
 *
 * 三档取色与 web 逐字同形,不是近似:
 *  - 常态:1px 描边、颜色透明 —— 占位恒定,聚焦时只换颜色,**不产生 1px 布局跳动**
 *    (web 的 `border border-input` → `focus-visible:border-primary` 也是换色不换宽);
 *    调用方自带描边时排在后面,直接覆盖这一档,不会被本组件改写。
 *  - 聚焦:`tokens.brand.DEFAULT` 墨档(亮 #000000 / 暗 #FFFFFF,随主题反转)。
 *    这是 AGENTS §4"描边不得取墨档"的**唯一例外位**(聚焦态),守门 83 的 R8 按
 *    `focused ? …` 条件形态放行 —— 所以这里必须写成三元,不得改成 `&&` 短路
 *    (判据只认条件取值,写成 `focused && {…}` 会被算成绕门)。
 *  - `focusedStyle`:调用方确有差异需求时最后覆盖(如登录页把聚焦加粗到 2px)。
 *
 * `colorScheme` 是**必填** prop 而非 `= 'light'` 默认值 —— 与 `BackChevron` 同一条规矩:
 * 守门 91 只把"带默认值的形参"认作静默脱主题开关,必填改由 `tsc` 在调用点强制,比门更严。
 */
export type TextFieldProps = Omit<ComponentPropsWithRef<typeof TextInput>, 'style' | 'onFocus' | 'onBlur'> & {
  colorScheme: AppThemeMode
  style?: StyleProp<TextStyle>
  /** 聚焦时追加的差异化样式,排在共享墨档之后(用于覆盖粗细/颜色) */
  focusedStyle?: StyleProp<TextStyle>
  onFocus?: ComponentPropsWithRef<typeof TextInput>['onFocus']
  onBlur?: ComponentPropsWithRef<typeof TextInput>['onBlur']
}

/** 常态描边占位:宽度恒定、颜色透明,聚焦只换颜色 ⇒ 零布局跳动 */
const RESTING_BORDER: TextStyle = { borderWidth: 1, borderColor: 'transparent' }

export function TextField({ colorScheme, style, focusedStyle, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false)
  const tk = getTokens(colorScheme)
  return (
    <TextInput
      {...rest}
      style={[RESTING_BORDER, style, focused ? { borderColor: tk.brand.DEFAULT } : null, focused ? focusedStyle : null]}
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

export default TextField
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
