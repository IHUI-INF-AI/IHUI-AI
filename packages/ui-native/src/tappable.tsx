// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { forwardRef, useState } from 'react'
import { Pressable } from 'react-native'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'

/** 按下时的不透明度。与旧 pressFeedback 同值:低于 0.5 在深色底上像"消失",高于 0.8 看不出来。 */
const PRESSED_OPACITY = 0.65

/**
 * style 刻意取 `StyleProp<ViewStyle>` 而**不是** PressableProps['style']:后者允许函数形态,
 * 而函数形态正是 cssInterop 会吃掉的写法。类型层先拒绝,比运行时静默丢样式好。
 *
 * `pressedStyle` 给的是**该元素自己的设计档按压样式**(如 `textBtnPressed` 换背景色)。
 * 传了它就不再叠默认不透明度 —— 否则同一元素同时吃两套按压观感,而设计档本来就不是不透明度。
 */
type TappableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
}

/**
 * 触屏按压反馈的唯一口。
 *
 * 为什么不能用 `style={fn}`:本仓 babel 用 `importSource: react-native-css-interop`,
 * `wrap-jsx` **无条件**把注册表内组件(Pressable/TouchableOpacity/View/Text…)换成 interop 版。
 * interop 的 normalize config 对 `{className:'style'}` 会算出 `inlineProp='style'`,于是只要元素
 * 传了 style(与有没有 className 无关)就走 `collectInlineRules` ⇒ 非数组声明进 `applyRules` 的
 * else 分支 `assignToTarget(props, { ...declaration })`;而 `{ ...函数 }` === `{}` ⇒ 原 style
 * 被空对象盖掉 —— 后果不是"少个按压态",是**该元素整份内联样式消失**(守门 131 的真机定案同型)。
 *
 * 所以 pressed 态只能由组件内部持有,把 style 以**数组**形态交给原生 Pressable(数组是本仓
 * RN 侧的主流写法,interop 对它逐元素合并,值保留)。
 */
export const Tappable = forwardRef<React.ComponentRef<typeof Pressable>, TappableProps>(
  function Tappable({ style, pressedStyle, onPressIn, onPressOut, ...rest }, ref) {
    const [pressed, setPressed] = useState(false)
    return (
      <Pressable
        {...rest}
        ref={ref}
        onPressIn={(e) => {
          setPressed(true)
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          setPressed(false)
          onPressOut?.(e)
        }}
        style={
          pressedStyle
            ? [style, pressed && pressedStyle]
            : [style, pressed && { opacity: PRESSED_OPACITY }]
        }
      />
    )
  },
)

export const __test__ = { PRESSED_OPACITY }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
