'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { ViewPanelType } from '@ihui/types'
import { cn } from '@/lib/utils'
import { FileSearch, Search, GitBranch, Bug, AppWindow, Settings } from 'lucide-react'

type Item = { id: ViewPanelType; icon: typeof FileSearch; labelKey: string; shortcut: string }

const ITEMS: Item[] = [
  { id: 'files', icon: FileSearch, labelKey: 'activityBar.files', shortcut: 'Ctrl+Shift+E' },
  { id: 'search', icon: Search, labelKey: 'activityBar.search', shortcut: 'Ctrl+Shift+F' },
  { id: 'source-control', icon: GitBranch, labelKey: 'activityBar.sourceControl', shortcut: 'Ctrl+Shift+G' },
  { id: 'debug', icon: Bug, labelKey: 'activityBar.debug', shortcut: 'Ctrl+Shift+D' },
  { id: 'applications', icon: AppWindow, labelKey: 'activityBar.applications', shortcut: 'Ctrl+Shift+A' },
]

function Tooltip({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 translate-x-1 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span>{label}</span>
        <span className="text-[10px] text-muted-foreground">{shortcut}</span>
      </div>
    </div>
  )
}

export function ActivityBar() {
  const t = useTranslations('ide')
  const { activeView, setActiveView, setActiveTopTab, diffFiles } = useIDEWorkspace()
  const badgeCount = diffFiles.length

  return (
    <div className="flex w-12 shrink-0 flex-col items-center py-2">
      <div className="flex flex-1 flex-col items-center gap-1">
        {ITEMS.map((item) => {
          const isActive = activeView === item.id
          const showBadge = item.id === 'source-control' && badgeCount > 0
          return (
            <div key={item.id} className="group relative">
              <button
                onClick={() => setActiveView(item.id)}
                className={cn(
                  'relative rounded-md p-2 transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-sm bg-primary" />
                )}
                <item.icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-sm bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
              <Tooltip label={t(item.labelKey)} shortcut={item.shortcut} />
            </div>
          )
        })}
      </div>
      <div className="group relative mt-auto">
        <button
          onClick={() => setActiveTopTab('settings')}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </button>
        <Tooltip label={t('activityBar.settings')} shortcut="Ctrl+," />
      </div>
    </div>
  )
}
