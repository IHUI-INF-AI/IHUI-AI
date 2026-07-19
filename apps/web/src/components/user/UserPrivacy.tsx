'use client'

import * as React from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PrivacyOption {
  key: string
  label: string
  desc?: string
  enabled: boolean
  onChange?: (enabled: boolean) => void
}

export interface UserPrivacyProps {
  options?: PrivacyOption[]
  className?: string
}

const DEFAULT_OPTIONS: PrivacyOption[] = [
  { key: 'profile_visible', label: '资料公开', desc: '他人可查看资料', enabled: true },
  { key: 'show_online', label: '显示在线状态', desc: '是否显示在线', enabled: false },
  { key: 'allow_search', label: '允许搜索', desc: '可通过手机/昵称搜索', enabled: true },
]

export default function UserPrivacy({
  options = DEFAULT_OPTIONS,
  className,
}: UserPrivacyProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Lock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">隐私设置</h3>
      </div>
      <ul className="divide-y">
        {options.map((opt) => (
          <PrivacyRow key={opt.key} option={opt} />
        ))}
      </ul>
    </div>
  )
}

function PrivacyRow({ option }: { option: PrivacyOption }) {
  const [enabled, setEnabled] = React.useState(option.enabled)
  React.useEffect(() => setEnabled(option.enabled), [option.enabled])
  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    option.onChange?.(next)
  }
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{option.label}</div>
        {option.desc && <div className="truncate text-xs text-muted-foreground">{option.desc}</div>}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-md transition-colors',
          enabled ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-md bg-white transition-all',
            enabled ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </li>
  )
}
