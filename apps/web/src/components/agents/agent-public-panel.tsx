// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import type { ReactNode } from 'react'
import { BookOpen, Command, MessageSquare, Sparkles, Workflow } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AgentPublicCapabilities } from '@ihui/types'
import { cn } from '@/lib/utils'

interface AgentPublicPanelProps {
  capabilities?: AgentPublicCapabilities | null
  className?: string
}

export function AgentPublicPanel({ capabilities, className }: AgentPublicPanelProps) {
  const t = useTranslations('agent.agentPlatform')
  if (!capabilities) return null

  const plugins = capabilities.plugins ?? []
  const workflows = capabilities.workflows ?? []
  const knowledge = capabilities.knowledge ?? []
  const shortcuts = capabilities.shortcutCommands ?? []
  const suggested = capabilities.suggestedQuestions ?? []
  const hasAny =
    Boolean(capabilities.prologue) ||
    suggested.length > 0 ||
    plugins.length > 0 ||
    workflows.length > 0 ||
    knowledge.length > 0 ||
    shortcuts.length > 0 ||
    capabilities.botMode != null ||
    capabilities.defaultUserInputType != null

  if (!hasAny) return null

  return (
    <section className={cn('space-y-3 rounded-lg border bg-muted/10 p-3', className)}>
      <h2 className="flex items-center gap-2 text-body font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        {t('title')}
        {capabilities.botMode === 1 ? (
          <span className="rounded bg-primary/10 px-2 py-0.5 text-label text-primary">
            {t('multiAgent')}
          </span>
        ) : null}
        {capabilities.defaultUserInputType ? (
          <span className="rounded bg-muted px-2 py-0.5 text-label text-muted-foreground">
            {capabilities.defaultUserInputType}
          </span>
        ) : null}
      </h2>

      {capabilities.prologue ? (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-label text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {t('prologue')}
          </p>
          <p className="whitespace-pre-wrap rounded-md border bg-background p-2 text-body leading-relaxed">
            {capabilities.prologue}
          </p>
        </div>
      ) : null}

      {suggested.length > 0 ? (
        <div className="space-y-1">
          <p className="text-label text-muted-foreground">{t('suggested')}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((q) => (
              <span key={q} className="rounded-md border bg-background px-2 py-1 text-label">
                {q}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {plugins.length > 0 ? (
          <CapabilityList
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title={t('plugins')}
            items={plugins.map((p) => ({
              name: p.name || '—',
              description: p.tools.length > 0 ? `${p.description ?? ''} · ${p.tools.map((x) => x.name).filter(Boolean).join(', ')}` : p.description,
            }))}
          />
        ) : null}
        {workflows.length > 0 ? (
          <CapabilityList
            icon={<Workflow className="h-3.5 w-3.5" />}
            title={t('workflows')}
            items={workflows.map((w) => ({ name: w.name || '—', description: w.description }))}
          />
        ) : null}
        {knowledge.length > 0 ? (
          <CapabilityList
            icon={<BookOpen className="h-3.5 w-3.5" />}
            title={t('knowledge')}
            items={knowledge.map((k) => ({ name: k.name || '—' }))}
          />
        ) : null}
        {shortcuts.length > 0 ? (
          <CapabilityList
            icon={<Command className="h-3.5 w-3.5" />}
            title={t('shortcuts')}
            items={shortcuts.map((s) => ({
              name: s.command ? `/${s.command}` : s.name || '—',
              description: s.description || s.name,
            }))}
          />
        ) : null}
      </div>
    </section>
  )
}

function CapabilityList({
  icon,
  title,
  items,
}: {
  icon: ReactNode
  title: string
  items: Array<{ name: string; description?: string | null }>
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-label text-muted-foreground">
        {icon}
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li key={`${item.name}-${idx}`} className="rounded-md border bg-background px-2 py-1 text-label">
            <span className="font-medium">{item.name}</span>
            {item.description ? <span className="ml-1 text-muted-foreground">{item.description}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
