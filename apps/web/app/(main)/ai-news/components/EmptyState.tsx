'use client'

import * as React from 'react'

interface Props {
  icon?: React.ReactNode
  message: string
  hint?: string
  action?: React.ReactNode
}

/**
 * 空状态统一组件:图标 + 文案 + 可选提示 + 可选操作按钮。
 * 替换各组件 `return null` 的空状态处理,保持视觉一致性。
 */
export function EmptyState({ icon, message, hint, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
      {icon ? <div className="text-muted-foreground/40">{icon}</div> : null}
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {hint ? <p className="text-[10px] text-muted-foreground/60">{hint}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
