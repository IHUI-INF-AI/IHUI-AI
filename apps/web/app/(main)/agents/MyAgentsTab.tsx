'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { AgentManager, type AgentItem } from '@/components/ai/agent-manager'
import { AgentPill } from '@/components/ai/agent-pill'
import { useAgent } from '@/hooks/use-agent'

export function MyAgentsTab() {
  const router = useRouter()
  const t = useTranslations('agents')
  const { agents, loading, fetchAgents } = useAgent()
  const [selectedId, setSelectedId] = React.useState<string | undefined>()

  React.useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  const items: AgentItem[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.description || a.systemPrompt || '—',
    status: 'idle',
    model: a.model,
  }))

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.slice(0, 8).map((a) => (
            <AgentPill
              key={a.id}
              name={a.name}
              status={a.status}
              active={a.id === selectedId}
              onClick={() => {
                setSelectedId(a.id)
                router.push(`/agents/${a.id}`)
              }}
            />
          ))}
        </div>
      )}
      <AgentManager
        agents={items}
        selectedId={selectedId}
        onCreate={() => router.push('/agents/create')}
        onSelect={(id) => {
          setSelectedId(id)
          router.push(`/agents/${id}`)
        }}
      />
    </div>
  )
}
