'use client'

import * as React from 'react'
import { Bot, Plus, CheckCircle2, Loader2, AlertCircle, Circle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export interface AgentItem {
  id: string
  name: string
  role: string
  status: 'idle' | 'running' | 'done' | 'error'
  model?: string
}

interface AgentManagerProps {
  agents: AgentItem[]
  onSelect?: (id: string) => void
  onCreate?: () => void
  selectedId?: string
}

const STATUS_META: Record<
  AgentItem['status'],
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  idle: { icon: Circle, cls: 'text-muted-foreground' },
  running: { icon: Loader2, cls: 'text-primary' },
  done: { icon: CheckCircle2, cls: 'text-emerald-500' },
  error: { icon: AlertCircle, cls: 'text-destructive' },
}

export function AgentManager({ agents, onSelect, onCreate, selectedId }: AgentManagerProps) {
  const t = useTranslations('ai.agentManager')
  const active = agents.filter((a) => a.status === 'running').length

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">{t('title')}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>
      <div className="flex items-center gap-4 bg-muted/30 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          {t('active')} <span className="font-semibold text-primary">{active}</span>
        </span>
        <span className="text-muted-foreground">
          {t('total')} <span className="font-semibold text-foreground">{agents.length}</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="space-y-1">
            {agents.map((agent) => {
              const meta = STATUS_META[agent.status]
              const Icon = meta.icon
              const isSel = agent.id === selectedId
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(agent.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isSel ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        meta.cls,
                        agent.status === 'running' && 'animate-spin',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{agent.name}</p>
                      <p className="break-words text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                    {agent.model && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {agent.model}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AgentManager
