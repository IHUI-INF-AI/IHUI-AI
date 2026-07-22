'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '../lib/utils.js'

/**
 * Switch 组件 (2026-07-22 重设 + 二次重设 3D 感)
 *
 * 视觉规范 (符合 AGENTS.md §4 圆角守门):
 *   - Track: rounded (4px) 替代 capsule rounded-md/pill
 *   - Thumb: rounded-sm (2px) — 方形微圆角
 *   - Thumb 颜色: bg-primary-foreground (恒白)
 *   - 内边距: p-[2px] 替代 border-2
 *
 * 3D 立体感 (2026-07-22 二次重设,用户要求"别太扁平"):
 *   - Track 凹陷: unchecked inset 阴影 0 1px 2px rgba(0,0,0,0.08) 营造凹槽
 *   - Track 凸起: checked 双层 inset 阴影(顶部白光 + 底部深光)模拟按键
 *   - Thumb 立体: 1px 顶部白色高光(inset) + 双层 drop shadow(0 1px 2 + 0 1px 3) 营造悬浮
 *   - Thumb 边缘: 0.5px 黑色描边 (6% 透明) 增强定义锐度
 *
 * 尺寸: sm (16×28 / thumb 12×12) / md (20×36 / thumb 16×16) / lg (24×44 / thumb 20×20)
 */
const sizeMap = {
  sm: { root: 'h-4 w-7', thumb: 'h-3 w-3', checked: 'data-[state=checked]:translate-x-3' },
  md: { root: 'h-5 w-9', thumb: 'h-4 w-4', checked: 'data-[state=checked]:translate-x-4' },
  lg: { root: 'h-6 w-11', thumb: 'h-5 w-5', checked: 'data-[state=checked]:translate-x-5' },
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
        'peer inline-flex shrink-0 cursor-pointer items-center rounded p-[2px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // 3D 凹陷: unchecked 灰色凹槽
        'data-[state=unchecked]:bg-input data-[state=unchecked]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]',
        // 3D 凸起: checked 绿色带顶部白光 + 底部深光
        'data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_-1px_0_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)]',
        s.root,
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block rounded-sm bg-primary-foreground ring-0 transition-transform data-[state=unchecked]:translate-x-0',
          // 3D 拇指: 1px 顶部白色高光(模拟顶部光源) + 双层 drop shadow(0 1px 2 + 0 1px 3) + 0.5px 黑边
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.06)]',
          s.thumb,
          s.checked,
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
