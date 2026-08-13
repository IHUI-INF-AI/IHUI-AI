'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../lib/utils'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // 2026-08-13 立:与共享 AgreementCheckbox 视觉统一(全局 Checkbox 默认规范)
      // - 尺寸 h-4 w-4(16x16),内勾 h-3 w-3 strokeWidth=3
      // - 未选 border-input + bg-background,选中 border-primary + bg-primary
      // - hover 描边加深至 foreground/60
      // - 移除 shadow(项目 UI 规范禁止冗余阴影),focus-visible:ring-2 与项目其它控件一致
      // 2026-08-13 修订:勾选态改为 border-transparent
      // 根因:Radix Checkbox 渲染为 <button>,即使 border-primary 与 bg-primary 同色,
      // <button> 原生 border 仍会产生 1px 描边感。改为 transparent 后,
      // 完全靠 bg-primary 填充提供视觉边界,勾选态无残留描边。
      'peer h-4 w-4 shrink-0 rounded-[4px] border border-input bg-background text-current transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground hover:border-foreground/60',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
