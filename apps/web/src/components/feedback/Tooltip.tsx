'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  className?: string
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration,
  className,
}: TooltipProps) {
  const tipId = React.useId()
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      {/* suppressHydrationWarning(2026-07-19 根因修复):
          Radix UI 内部 TooltipPrimitive.Trigger 会再生成一个自己的 useId 作为 aria-describedby 指向 TooltipContent。
          当同一个 Sidebar 在桌面/移动两个 aside 树内各渲染一次 TooltipProvider 时,useId 的 SSR/CSR 序号会发生漂移:
            SSR: 桌面 aside 树先调用 useId → _R_8vbabmiplb_,移动 aside 后调用 → _R_13td9eqplb_
            CSR (hydration): React 调和器按组件实例顺序重新算 useId → 序号可能反转
          结果就是 Radix 注入的 aria-describedby 在 SSR/CSR 字节级不一致,React 报 hydration mismatch warning。
          该属性是 Radix 内部 a11y 增强,不影响功能,只在这一行压制 hydration 检查即可彻底根除 warning。 */}
      <TooltipPrimitive.Trigger asChild aria-describedby={tipId}>
        {React.cloneElement(children, {
          // @ts-expect-error: 将 suppressHydrationWarning 透传到 Radix Slot 上的具体子元素
          suppressHydrationWarning: true,
        })}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          id={tipId}
          role="tooltip"
          side={side}
          align={align}
          sideOffset={4}
          className={cn(
            'z-popover overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md',
            'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
