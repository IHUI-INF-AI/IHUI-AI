// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { t } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  LOADING_INLINE_PADDING_Y_PX,
  LOADING_LABEL_FONT_PX,
  LOADING_LABEL_GAP_PX,
  loadingSpinnerBoxStyle,
} from '@ihui/shared/ui/loading-spec'
import { rpx } from '@/utils/rpx'

export interface LoadingProps {
  fullScreen?: boolean
  text?: string
  mask?: boolean
}

/// 数字与盒子结构在 @ihui/shared/ui/loading-spec;本文件只做 rpx 换算 + 挂 Taro 原语。
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)
const SPINNER_BOX_STYLE = loadingSpinnerBoxStyle(toUnit)
const LABEL_STYLE = {
  marginTop: toUnit(LOADING_LABEL_GAP_PX),
  fontSize: toUnit(LOADING_LABEL_FONT_PX),
}
/// CSSProperties 不认 paddingVertical,故拆成 top/bottom 两键(同一档位,不是第二份真相)
const INLINE_STYLE = {
  paddingTop: toUnit(LOADING_INLINE_PADDING_Y_PX),
  paddingBottom: toUnit(LOADING_INLINE_PADDING_Y_PX),
}

export default function Loading({
  fullScreen = false,
  text = t('common.loadingShort'),
  mask = true,
}: LoadingProps) {
  const spinner = (
    <View className="flex flex-col items-center justify-center">
      <View
        className="border-2 border-border border-t-muted-foreground rounded-full animate-spin"
        style={SPINNER_BOX_STYLE}
      />
      {text ? (
        <Text className="text-muted-foreground" style={LABEL_STYLE}>
          {text}
        </Text>
      ) : null}
    </View>
  )

  if (fullScreen) {
    return (
      <View
        className={`fixed inset-0 z-[100] flex items-center justify-center ${
          mask ? 'bg-[var(--color-black-40)]' : ''
        }`}
      >
        <View className="flex flex-col items-center justify-center px-6 py-5 bg-card rounded-xl shadow-sm">
          {spinner}
        </View>
      </View>
    )
  }

  return (
    <View className="flex items-center justify-center" style={INLINE_STYLE}>
      {spinner}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
