'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '../lib/utils.js'

/**
 * Switch 组件 (2026-07-22 重设)
 *
 * 视觉规范 (符合 AGENTS.md §4 圆角守门):
 *   - Track: rounded (4px) 替代 capsule rounded-md/pill,体量更紧凑
 *   - Thumb: rounded-sm (2px) — 方形微圆角,符合"圆按钮改为正方形"用户要求
 *   - Thumb 颜色: bg-primary-foreground (hsl(0 0% 100%)) 亮/暗模式恒白,
 *     解决暗色模式下 bg-background = hsl(0 0% 14%) 导致 thumb 几乎与背景同色问题
 *   - Thumb 阴影: shadow-sm 替代 shadow-lg,更克制优雅
 *   - 内边距: p-[2px] 替代 border-2 border-transparent,角部干净不漏边
 *
 * 尺寸: 20px × 36px (Radix 标准),thumb 16×16,translate 16px (3 状态平滑)
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded p-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-sm bg-primary-foreground shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
