'use client'

import * as React from 'react'
import { Shield, Smartphone, KeyRound, History } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserSecurityItem {
  key: string
  label: string
  desc: string
  icon: React.ReactNode
  onClick?: () => void
}

export interface UserSecurityProps {
  items?: UserSecurityItem[]
  className?: string
}

const DEFAULT_ITEMS: UserSecurityItem[] = [
  {
    key: 'password',
    label: '登录密码',
    desc: '建议定期更换',
    icon: <KeyRound className="h-5 w-5" />,
  },
  {
    key: 'phone',
    label: '手机绑定',
    desc: '用于身份验证',
    icon: <Smartphone className="h-5 w-5" />,
  },
  { key: '2fa', label: '两步验证', desc: '提升账号安全', icon: <Shield className="h-5 w-5" /> },
  {
    key: 'history',
    label: '登录历史',
    desc: '查看登录设备',
    icon: <History className="h-5 w-5" />,
  },
]

export default function UserSecurity({
  items = DEFAULT_ITEMS,
  className,
}: UserSecurityProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">安全设置</h3>
      </div>
      <div className="divide-y">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
          >
            <span className="text-muted-foreground">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="truncate text-xs text-muted-foreground">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
