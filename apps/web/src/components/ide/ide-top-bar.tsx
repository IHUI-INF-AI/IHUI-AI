'use client'
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { ViewSwitcher } from './view-switcher'
import { Code2, GitCompare, FileText, Terminal, Globe, Figma, Bot, Plug, Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IDETabType } from '@ihui/types'

const TAB_LABELS: Record<IDETabType, { icon: typeof Code2; labelKey?: string; label?: string }> = {
  editor: { icon: Code2, labelKey: 'topBar.editor' },
  'code-changes': { icon: GitCompare, labelKey: 'topBar.codeChanges' },
  document: { icon: FileText, labelKey: 'topBar.document' },
  terminal: { icon: Terminal, labelKey: 'topBar.terminal' },
  browser: { icon: Globe, labelKey: 'topBar.browser' },
  figma: { icon: Figma, label: 'Figma' },
  agent: { icon: Bot, labelKey: 'topBar.agent' },
  mcp: { icon: Plug, label: 'MCP' },
  settings: { icon: Settings, labelKey: 'topBar.settings' },
}

function Clock() {
  const locale = useLocale()
  const [time, setTime] = React.useState('')
  React.useEffect(() => {
    const fmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
    const update = () => setTime(fmt.format(new Date()))
    update()
    const id = setInterval(update, 30 * 1000)
    return () => clearInterval(id)
  }, [locale])
  return <span className="tabular-nums text-[11px] text-muted-foreground">{time}</span>
}

export function IDETopBar() {
  const t = useTranslations('ide')
  const { activeTopTab, setActiveTopTab } = useIDEWorkspace()
  const config = TAB_LABELS[activeTopTab]
  const Icon = config.icon
  const configLabel = config.labelKey ? t(config.labelKey) : config.label

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 bg-muted/30 px-2">
      <button
        onClick={() => setActiveTopTab('editor')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
          activeTopTab === 'editor'
            ? 'bg-background text-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
      >
        <Code2 className="h-3.5 w-3.5" />
        <span>{t('topBar.editor')}</span>
      </button>
      <ViewSwitcher />
      {activeTopTab !== 'editor' && (
        <div className="group flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-xs font-medium text-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{configLabel}</span>
          <button
            onClick={() => setActiveTopTab('editor')}
            aria-label={t('topBar.close')}
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3 pr-1">
        <Clock />
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/80" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/80" />
          <span className="h-2 w-2 rounded-full bg-green-500/80" />
        </div>
      </div>
    </div>
  )
}
