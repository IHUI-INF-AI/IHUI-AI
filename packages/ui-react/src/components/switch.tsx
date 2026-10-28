// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '../lib/utils'
import {
  SWITCH_DEFAULT_SIZE,
  SWITCH_THUMB_RADIUS_TIER,
  SWITCH_THUMB_SIZE_PX,
  SWITCH_THUMB_TRANSLATE_X_PX,
  SWITCH_TRACK_BORDER_W_PX,
  SWITCH_TRACK_H_PX,
  SWITCH_TRACK_PADDING_PX,
  SWITCH_TRACK_RADIUS_TIER,
  SWITCH_TRACK_W_PX,
  type SwitchSizeTier,
} from '@ihui/shared/ui/switch-spec'

/**
 * Switch 组件 (2026-08-01 四次重设:粗野方块 Neo-Brutalist)
 *
 * 设计语言 (后现代粗野主义,符合 AGENTS.md §4 圆角守门):
 *   - 轨道: rounded-md (6px) — 方形圆角,非圆形/椭圆/胶囊
 *   - 拇指: rounded-sm (3px) — 方形微圆角
 *   - 边框: 1.5px foreground (黑/白自适应明暗) — 粗野硬边
 *   - 投影: 3px 3px 0 foreground — 硬阴影偏移,非柔光弥散
 *   - 按下: 阴影收缩至 1px + 2px 位移 — 实体按键反馈
 *
 * ON 配色: var(--color-brand-accent) (#8fb8cc 亮 / #a3c4d6 暗)
 *   - 采用项目高级灰蓝,冷色高识别度,与黑投影对比强烈
 *   - 明暗主题自动适配 (tokens.css .dark 覆盖 brand-accent)
 *
 * 状态色:
 *   - OFF: bg-background + border-foreground + thumb bg-foreground
 *   - ON:  bg-brand-accent + border-foreground + thumb bg-background
 *
 * 尺寸: sm (20×36 / thumb 12×12) / md (24×44 / thumb 16×16) / lg (28×52 / thumb 20×20)
 * 位移经精确计算: W - 2×1.5(border) - 2×3(padding) - T
 */
const TRACK_W_CLASS: Record<number, string> = { 36: 'w-9', 44: 'w-11', 52: 'w-[52px]' }
const TRACK_H_CLASS: Record<number, string> = { 20: 'h-5', 24: 'h-6', 28: 'h-7' }
const THUMB_SIZE_CLASS: Record<number, string> = { 12: 'h-3 w-3', 16: 'h-4 w-4', 20: 'h-5 w-5' }
const THUMB_CHECKED_CLASS: Record<number, string> = {
  15: 'data-[state=checked]:translate-x-[15px]',
  19: 'data-[state=checked]:translate-x-[19px]',
  23: 'data-[state=checked]:translate-x-[23px]',
}
const TRACK_RADIUS_CLASS: Record<typeof SWITCH_TRACK_RADIUS_TIER, string> = { md: 'rounded-md' }
const THUMB_RADIUS_CLASS: Record<typeof SWITCH_THUMB_RADIUS_TIER, string> = { sm: 'rounded-sm' }
const BORDER_CLASS: Record<number, string> = { 1.5: 'border-[1.5px]' }
const PADDING_CLASS: Record<number, string> = { 3: 'p-[3px]' }

type SwitchSize = SwitchSizeTier

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: SwitchSize
}

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(
  ({ className, size = SWITCH_DEFAULT_SIZE, ...props }, ref) => {
    const w = SWITCH_TRACK_W_PX[size]
    const h = SWITCH_TRACK_H_PX[size]
    const thumb = SWITCH_THUMB_SIZE_PX[size]
    return (
      <SwitchPrimitives.Root
        className={cn(
          'peer group inline-flex shrink-0 cursor-pointer items-center',
          TRACK_RADIUS_CLASS[SWITCH_TRACK_RADIUS_TIER],
          PADDING_CLASS[SWITCH_TRACK_PADDING_PX],
          BORDER_CLASS[SWITCH_TRACK_BORDER_W_PX],
          'border-foreground bg-background', // border-ink-exempt: Switch 新拟态定稿 —— 框与 3px 硬投影同色才成立体感,扩判据后暴露的既有定稿而非新增违规 until 2027-09-26
          'shadow-[3px_3px_0_var(--color-foreground)]',
          'transition-[background,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // ON: 高级灰蓝背景 + 保持同一框色(与硬投影同色才不出现双层描边)
          'data-[state=checked]:bg-[var(--color-brand-accent)] data-[state=checked]:border-foreground', // border-ink-exempt: ON 态沿用同一新拟态框色,与 3px 硬投影同色才不出现双层描边;属同一定稿,理由同上行 until 2027-09-26
          // 按下: 阴影收缩 + 2px 位移,实体按键反馈
          'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--color-foreground)]',
          // 无障碍: prefers-reduced-motion 停用过渡与位移,保留阴影设计
          'motion-reduce:transition-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0',
          TRACK_W_CLASS[w],
          TRACK_H_CLASS[h],
          className,
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            'pointer-events-none block bg-foreground transition-[transform,background] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
            THUMB_RADIUS_CLASS[SWITCH_THUMB_RADIUS_TIER],
            'data-[state=unchecked]:translate-x-0',
            // ON: 拇指变白
            'data-[state=checked]:bg-background',
            // 无障碍: 停用过渡
            'motion-reduce:transition-none',
            THUMB_SIZE_CLASS[thumb],
            THUMB_CHECKED_CLASS[SWITCH_THUMB_TRANSLATE_X_PX[size]],
          )}
        />
      </SwitchPrimitives.Root>
    )
  },
)
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
