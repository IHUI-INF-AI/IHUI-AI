'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '../lib/utils'

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
 * ON 配色: var(--color-brand-orange) (#ff6b35 亮 / #ff8e53 暗)
 *   - 避开蓝色,采用项目品牌橙,暖色高识别度,与黑投影对比强烈
 *   - 明暗主题自动适配 (tokens.css .dark 覆盖 brand-orange)
 *
 * 状态色:
 *   - OFF: bg-background + border-foreground + thumb bg-foreground
 *   - ON:  bg-brand-orange + border-foreground + thumb bg-background
 *
 * 尺寸: sm (20×36 / thumb 12×12) / md (24×44 / thumb 16×16) / lg (28×52 / thumb 20×20)
 * 位移经精确计算: W - 2×1.5(border) - 2×3(padding) - T
 */
const sizeMap = {
  sm: { root: 'h-5 w-9', thumb: 'h-3 w-3', checked: 'data-[state=checked]:translate-x-[15px]' },
  md: { root: 'h-6 w-11', thumb: 'h-4 w-4', checked: 'data-[state=checked]:translate-x-[19px]' },
  lg: { root: 'h-7 w-[52px]', thumb: 'h-5 w-5', checked: 'data-[state=checked]:translate-x-[23px]' },
} as const

type SwitchSize = keyof typeof sizeMap

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: SwitchSize
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'md', ...props }, ref) => {
  const s = sizeMap[size]
  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer group inline-flex shrink-0 cursor-pointer items-center rounded-md p-[3px]',
        'border-[1.5px] border-foreground bg-background',
        'shadow-[3px_3px_0_var(--color-foreground)]',
        'transition-[background,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // ON: 品牌橙背景 + 保持黑边
        'data-[state=checked]:bg-[var(--color-brand-orange)] data-[state=checked]:border-foreground',
        // 按下: 阴影收缩 + 2px 位移,实体按键反馈
        'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--color-foreground)]',
        // 无障碍: prefers-reduced-motion 停用过渡与位移,保留阴影设计
        'motion-reduce:transition-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0',
        s.root,
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block rounded-sm bg-foreground transition-[transform,background] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'data-[state=unchecked]:translate-x-0',
          // ON: 拇指变白
          'data-[state=checked]:bg-background',
          // 无障碍: 停用过渡
          'motion-reduce:transition-none',
          s.thumb,
          s.checked,
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
