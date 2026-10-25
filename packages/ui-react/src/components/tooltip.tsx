// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../lib/utils'
import {
  TOOLTIP_GAP_PX,
  TOOLTIP_PADDING_X_PX,
  TOOLTIP_PADDING_Y_PX,
  TOOLTIP_RADIUS_TIER,
  TOOLTIP_SHADOW_TIER,
  TOOLTIP_TEXT_TIER,
} from '@ihui/shared/ui/tooltip-spec'

/**
 * 平台专属项(不下沉 tooltip-spec,两端允许不同形,逐条登记):
 *  - `z-popover` / Portal:web 的层叠与传送通道,RN 走 Modal 全屏层,没有 z-index;
 *  - `Arrow`(Radix TooltipPrimitive.Arrow + `fill-popover`):仅 web,RN 端无箭头件 ——
 *    这也是 RN 原先把 gap 抬到 8 的来历(无箭头时用距离代替视觉补位),裁定见 spec 的 GAP_PX;
 *  - `animate-in` / `data-[state=closed]:` / `data-[side=…]:`:仅 web,RN 进出场走 Animated(JS 通道);
 *  - hover/focus 触发:web 通道,RN 是长按 300ms(触发机制按规则6 不下沉);
 *  - `overflow-hidden` / 裸 `border`:web 的裁剪与边框承载(RN 需显式 `border-border` 给边框色);
 *  - 类名字面量:必须留在本文件 —— Tailwind 只扫本仓 ui-react 源,spec 文件不在扫描面内,
 *    拼串产不出规则;且必须是标准类,调用方的 className 覆盖才能经 cn 正常生效。
 *  ⇒ 取值档一律取自 tooltip-spec,本文件只做"档 → 本端承载类"的映射。
 */
const RADIUS_CLASS: Record<typeof TOOLTIP_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 12: 'px-3' }
const PADDING_Y_CLASS: Record<number, string> = { 6: 'py-1.5' }
const TEXT_CLASS: Record<typeof TOOLTIP_TEXT_TIER, string> = { xs: 'text-xs' }
const SHADOW_CLASS: Record<typeof TOOLTIP_SHADOW_TIER, string> = { md: 'shadow-md' }

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = TOOLTIP_GAP_PX, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-popover overflow-hidden border bg-popover text-popover-foreground',
        RADIUS_CLASS[TOOLTIP_RADIUS_TIER],
        PADDING_X_CLASS[TOOLTIP_PADDING_X_PX],
        PADDING_Y_CLASS[TOOLTIP_PADDING_Y_PX],
        TEXT_CLASS[TOOLTIP_TEXT_TIER],
        SHADOW_CLASS[TOOLTIP_SHADOW_TIER],
        'animate-in fade-in-0 zoom-in-95 duration-(--duration-unified) ease-unified data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-popover" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
