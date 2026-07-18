'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserSettingsItem {
  key: string
  label: string
  description?: string
  icon?: React.ReactNode
  onClick?: () => void
}

export interface UserSettingsProps {
  items?: UserSettingsItem[]
  className?: string
}

const DEFAULT_ITEMS: UserSettingsItem[] = [
  { key: 'profile', label: '个人资料', description: '头像、昵称、简介' },
  { key: 'account', label: '账号绑定', description: '手机、邮箱、第三方' },
  { key: 'notification', label: '消息通知', description: '推送、提醒设置' },
  { key: 'privacy', label: '隐私设置', description: '可见范围、权限' },
]

export default function UserSettings({
  items = DEFAULT_ITEMS,
  className,
}: UserSettingsProps): React.JSX.Element {
  return (
    <div className={cn('divide-y rounded-xl border bg-card', className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
        >
          {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{item.label}</div>
            {item.description && (
              <div className="truncate text-xs text-muted-foreground">{item.description}</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}
