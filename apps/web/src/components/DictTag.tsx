import * as React from 'react'
import { cn } from '@/lib/utils'

/** 字典标签的语义色类型(6 色)。 */
export type ListClass = 'default' | 'primary' | 'success' | 'info' | 'warning' | 'danger'

interface DictTagProps {
  value: string
  listClass?: ListClass
  className?: string
}

const classMap: Record<ListClass, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  info: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-500',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

/**
 * 通用字典标签组件 — 根据 listClass 渲染 6 色徽章。
 * 可在 admin 端(字典管理)和 C 端(订单状态/支付状态等)复用。
 */
export function DictTag({ value, listClass = 'default', className }: DictTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        classMap[listClass],
        className,
      )}
    >
      {value}
    </span>
  )
}
