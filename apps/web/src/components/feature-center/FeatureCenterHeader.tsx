'use client'

import * as React from 'react'

export interface FeatureCenterHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

/** Feature Center 头部组件，展示页面标题与可选操作区 */
export function FeatureCenterHeader({ title, description, actions }: FeatureCenterHeaderProps) {
  return (
    <header className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </header>
  )
}
