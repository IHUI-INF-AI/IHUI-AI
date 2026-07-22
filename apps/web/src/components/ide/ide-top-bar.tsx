'use client'
import * as React from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { ViewSwitcher } from './view-switcher'
import { Code2, GitCompare, FileText, Terminal, Globe, Figma, Bot, Plug, Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IDETabType } from '@ihui/types'

const TAB_LABELS: Record<IDETabType, { icon: typeof Code2; label: string }> = {
  editor: { icon: Code2, label: '编辑器' },
  'code-changes': { icon: GitCompare, label: '代码变更' },
  document: { icon: FileText, label: '文档' },
  terminal: { icon: Terminal, label: '终端' },
  browser: { icon: Globe, label: '浏览器' },
  figma: { icon: Figma, label: 'Figma' },
  agent: { icon: Bot, label: '智能体' },
  mcp: { icon: Plug, label: 'MCP' },
  settings: { icon: Settings, label: '设置' },
}

function Clock() {
  const [time, setTime] = React.useState('')
  React.useEffect(() => {
    const fmt = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const update = () => setTime(fmt.format(new Date()))
    update()
    const id = setInterval(update, 30 * 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular-nums text-[11px] text-muted-foreground">{time}</span>
}

export function IDETopBar() {
  const { activeTopTab, setActiveTopTab } = useIDEWorkspace()
  const config = TAB_LABELS[activeTopTab]
  const Icon = config.icon

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
        <span>编辑器</span>
      </button>
      <ViewSwitcher />
      {activeTopTab !== 'editor' && (
        <div className="group flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-xs font-medium text-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{config.label}</span>
          <button
            onClick={() => setActiveTopTab('editor')}
            aria-label="关闭"
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
