// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  Image,
  Text,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import type {
  CategoryContentPrimitives,
  CategoryImagePrimitiveProps,
  CategoryTextPrimitiveProps,
} from './category-bar-core'

/**
 * 分类栏的 **RN 原语注入层**:把核心要求的「文本 / 图片 / 字形」三件原语落到 RN 组件上。
 *
 * 形态 A(横滑条)、形态 B(下拉窗)都从这里取同一份注入 —— 端内适配只有这一处,
 * 核心 `category-bar-core.tsx` 不 import 'react-native'。日后小程序 / web 接入时,
 * 各自再写一份同契约的 adapter 即可,核心与条目结构不动。
 */

export type RnCategoryTextStyle = StyleProp<TextStyle>
export type RnCategoryImageStyle = StyleProp<ImageStyle>

function RnCategoryText({
  style,
  numberOfLines,
  ellipsizeMode,
  children,
}: CategoryTextPrimitiveProps<RnCategoryTextStyle>) {
  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode}>
      {children}
    </Text>
  )
}

function RnCategoryImage({
  source,
  style,
  resizeMode,
}: CategoryImagePrimitiveProps<RnCategoryImageStyle>) {
  return <Image source={source as ImageSourcePropType} style={style} resizeMode={resizeMode} />
}

export const rnCategoryPrimitives: CategoryContentPrimitives<
  RnCategoryTextStyle,
  RnCategoryImageStyle
> = {
  Text: RnCategoryText,
  Image: RnCategoryImage,
}

/** 字形载体:item.icon 是 lucide 组件引用,这里只做一次收口转型(核心不持图标类型)。 */
export function renderRnCategoryIcon(icon: unknown, size: number, color: string) {
  const Glyph = icon as LucideIcon
  return <Glyph size={size} color={color} />
}
