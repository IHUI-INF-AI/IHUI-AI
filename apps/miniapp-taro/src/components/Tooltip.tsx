// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import {
  TOOLTIP_GAP_PX,
  TOOLTIP_PADDING_X_PX,
  TOOLTIP_PADDING_Y_PX,
  TOOLTIP_RADIUS_TIER,
  TOOLTIP_SHADOW_TIER,
  TOOLTIP_TEXT_TIER,
} from '@ihui/shared/ui/tooltip-spec'

/**
 * 轻提示组件 —— 与 `packages/ui-native/src/tooltip.tsx` 逐类对齐(「一模一样」契约)。
 *
 * **取值档一律取自 `@ihui/shared/ui/tooltip-spec`**(与 web 壳、RN 壳同源);本文件只做
 * 「档 → 本端承载类」的映射,映射表与 RN 壳逐字相等(由 `scripts/gen-ui-mirror.mjs` 派生复核)。
 *
 * 与 RN 的分歧(规则6 承载差异,逐条登记):
 * - 触发:RN 用 `Modal` + `onLongPress` 长按 + `measureInWindow` 自绘定位;本端无 Modal/测量通道,
 *   保留既有「点击/触摸切换 + absolute 定位」机制(视觉 token 仍同源);
 * - `max-w-[240px]` / `z-20` / `line-clamp-2`:本端定位与裁剪承载,RN 侧是同值的 style 通道;
 * - 间隙档:RN 用 spec 数值直接进 style,本端只有类名通道 ⇒ 开 `mb-*`/`mt-*` 两张本地映射,
 *   键仍按 spec 的 4px 档取值,由 `TOOLTIP_GAP_PX` 驱动选择(不手写数字)。
 */

const RADIUS_CLASS: Record<typeof TOOLTIP_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 12: 'px-3' }
const PADDING_Y_CLASS: Record<number, string> = { 6: 'py-1.5' }
const TEXT_CLASS: Record<typeof TOOLTIP_TEXT_TIER, string> = { xs: 'text-xs' }
const SHADOW_CLASS: Record<typeof TOOLTIP_SHADOW_TIER, string> = { md: 'shadow-md' }

/** 本端承载:RN 的 `TOOLTIP_GAP_PX` 数值在本端落成外边距类(4px 档 = mb-1/mt-1)。 */
const GAP_BOTTOM_CLASS: Record<number, string> = { 4: 'mb-1' }
const GAP_TOP_CLASS: Record<number, string> = { 4: 'mt-1' }

export interface TooltipProps {
  text: string
  children?: React.ReactNode
  placement?: 'top' | 'bottom'
}

export default function Tooltip({ text, children, placement = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <View className="relative inline-block">
      <View
        onClick={() => setShow(!show)}
        onTouchStart={() => setShow(true)}
        hoverClass="opacity-60"
      >
        {children}
      </View>
      {show && (
        <View
          className={cn(
            'absolute z-20 left-1/2 max-w-[240px] line-clamp-2 border border-border bg-popover',
            RADIUS_CLASS[TOOLTIP_RADIUS_TIER],
            PADDING_X_CLASS[TOOLTIP_PADDING_X_PX],
            PADDING_Y_CLASS[TOOLTIP_PADDING_Y_PX],
            SHADOW_CLASS[TOOLTIP_SHADOW_TIER],
            placement === 'top' ? 'bottom-full' : 'top-full',
            placement === 'top' ? GAP_BOTTOM_CLASS[TOOLTIP_GAP_PX] : GAP_TOP_CLASS[TOOLTIP_GAP_PX],
          )}
          style={{ transform: 'translateX(-50%)' }}
          onClick={() => setShow(false)}
          hoverClass="opacity-60"
        >
          <Text className={cn(TEXT_CLASS[TOOLTIP_TEXT_TIER], 'text-popover-foreground')}>
            {text}
          </Text>
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
