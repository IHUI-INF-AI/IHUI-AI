'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface Tab {
  key: string
  label: string
  disabled?: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
}

export function TabBar({ tabs, activeTab, onChange, className }: TabBarProps) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0 })

  React.useLayoutEffect(() => {
    const el = refs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, tabs])

  return (
    <div className={cn('relative flex border-b', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          ref={(el) => { refs.current[tab.key] = el }}
          onClick={() => !tab.disabled && onChange(tab.key)}
          disabled={tab.disabled}
          className={cn(
            'relative px-4 py-2 text-sm font-medium transition-colors',
            tab.disabled && 'cursor-not-allowed opacity-50',
            activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
      <span
        className="absolute bottom-0 h-0.5 bg-primary transition-all duration-300"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  )
}
