// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import type { ViewStyle } from 'react-native'

import type { AppThemeTokens } from '../theme/tokens'

/**
 * 容器级(WRAP)聚焦描边的唯一实现。
 *
 * 为什么需要它:AGENTS §4 的输入框唯一实现 `TextField` 是**输入框级**的(描边画在裸
 * TextInput 上)。而搜索框/输入行这一族把描边画在**外层容器**上(容器里同时有放大镜、
 * 语音键、清除键),换成 TextField 等于把描边从整行挪到裸输入框 —— 那是视觉回归,不是收口。
 * 小程序端同一形态早有 `apps/miniapp-taro/src/hooks/use-field-focus.ts`(形态②:handlers
 * 在 Input 上、style 铺容器);RN/共享侧此前没有等价物,于是每个 WRAP 站点各写一份
 * `useState(focused)` + 各挑一次墨档色值 —— 正是"改一端忘另一端"的开口。
 *
 * 取值纪律(与 `TextField` 逐字同档,不新增第二个色源):
 *  - 聚焦描边取墨档 `tokens.brand.DEFAULT`(亮 #000000 / 暗 #FFFFFF,随主题反转)。
 *    这是 AGENTS §4「描边不得取墨档」的**唯一例外位**(输入/选择控件聚焦态),
 *    门 83 R8 对 RN 形态只认 `focused ? {` 这一条件书写 ⇒ 下面必须写成三元,
 *    不得改成 `focused && {…}` 短路(判据不认短路)。
 *  - 只换颜色、不换宽度:未聚焦返回 `undefined`,完全不介入宿主元素的常态样式 ⇒ 零布局跳动
 *    (与 `TextField` 的 `RESTING_BORDER` 同一语义)。
 */

/** 聚焦描边的唯一取色:墨档。WRAP 站点不得绕开它自己挑 brand 色值。 */
export function wrapFocusInk(tk: AppThemeTokens): string {
  return tk.brand.DEFAULT
}

/** 聚焦态容器描边;未聚焦 ⇒ undefined(不介入常态样式)。 */
export function wrapFocusBorder(tk: AppThemeTokens, focused: boolean): ViewStyle | undefined {
  return focused ? { borderColor: wrapFocusInk(tk) } : undefined
}

export interface WrapFocusOptions {
  /** 宿主自己的聚焦回调 —— 本 hook 记账之外必须原样透传,不得吃掉 */
  onFocus?: () => void
  onBlur?: () => void
}

export interface WrapFocus {
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  /** 铺到容器:`style={[常态, ff.focusBorder]}` */
  focusBorder: ViewStyle | undefined
  /** 便捷展开:铺到 Input —— `{...ff.spread}` */
  spread: { onFocus: () => void; onBlur: () => void }
}

/**
 * @param tk 已按主题解析好的 token 集(调用方本就持有,不再从别处取第二份色源)
 */
export function useWrapFocus(tk: AppThemeTokens, options: WrapFocusOptions = {}): WrapFocus {
  const { onFocus: onFocusProp, onBlur: onBlurProp } = options
  const [focused, setFocused] = useState(false)

  const handleFocus = useCallback(() => {
    setFocused(true)
    onFocusProp?.()
  }, [onFocusProp])

  const handleBlur = useCallback(() => {
    setFocused(false)
    onBlurProp?.()
  }, [onBlurProp])

  const focusBorder = useMemo(() => wrapFocusBorder(tk, focused), [tk, focused])

  return {
    focused,
    onFocus: handleFocus,
    onBlur: handleBlur,
    focusBorder,
    spread: { onFocus: handleFocus, onBlur: handleBlur },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
