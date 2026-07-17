'use client'

import * as React from 'react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui'

export interface FeatureCardProps {
  title: string
  description: string
  badge?: string
  footer?: React.ReactNode
  onClick?: () => void
}

/** 功能卡片组件，用于 Feature Center 各集市条目展示 */
export function FeatureCard({ title, description, badge, footer, onClick }: FeatureCardProps) {
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={
        'flex h-full flex-col transition-shadow ' +
        (onClick ? 'cursor-pointer hover:shadow-md' : '')
      }
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {badge && (
            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        <CardDescription className="break-words">{description}</CardDescription>
      </CardHeader>
      {footer && <CardContent className="mt-auto text-sm">{footer}</CardContent>}
    </Card>
  )
}
