'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Boxes } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { McpManager } from '@/components/mcp/mcp-manager'
import { McpQuickCall } from '@/components/mcp/mcp-quick-call'
import { McpUseManager } from '@/components/mcp/mcp-use-manager'
import { McpPromptManager } from '@/components/mcp/mcp-prompt-manager'
import { McpResourceViewer, type McpResource } from '@/components/mcp/mcp-resource-viewer'
import { McpDataStructure } from '@/components/mcp/mcp-data-structure'

export default function McpProjectsPage() {
  const t = useTranslations('common.mcp')
  const tm = useTranslations('mcp')
  const tc = useTranslations('common')

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Boxes className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Tabs defaultValue="servers">
        <TabsList>
          <TabsTrigger value="servers">{tm('managerTitle')}</TabsTrigger>
          <TabsTrigger value="tools">{tm('quickCallTitle')}</TabsTrigger>
          <TabsTrigger value="resources">{tc('resources')}</TabsTrigger>
          <TabsTrigger value="prompts">{tm('promptTitle')}</TabsTrigger>
          <TabsTrigger value="usage">{tm('useTitle')}</TabsTrigger>
        </TabsList>
        <TabsContent value="servers">
          <McpManager />
        </TabsContent>
        <TabsContent value="tools">
          <McpQuickCall />
        </TabsContent>
        <TabsContent value="resources">
          <McpResourceBrowser />
        </TabsContent>
        <TabsContent value="prompts">
          <McpPromptManager />
        </TabsContent>
        <TabsContent value="usage">
          <McpUseManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function McpResourceBrowser() {
  const tm = useTranslations('mcp')
  const [selectedUri, setSelectedUri] = useState('')

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['mcp', 'resources'],
    queryFn: async () => {
      const res = await fetchApi<McpResource[]>('/api/ai/mcp/resources')
      if (res.success && res.data) return res.data
      return []
    },
  })

  const selected = resources.find((r) => r.uri === selectedUri)

  let jsonData: unknown = undefined
  if (selected?.content) {
    try {
      jsonData = JSON.parse(selected.content)
    } catch {
      jsonData = undefined
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (resources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        {tm('noContent')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Select value={selectedUri} onValueChange={setSelectedUri}>
        <SelectTrigger>
          <SelectValue placeholder={tm('selectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {resources.map((r) => (
            <SelectItem key={r.uri} value={r.uri}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <div className="space-y-4">
          <McpResourceViewer resource={selected} />
          {jsonData !== undefined && <McpDataStructure data={jsonData} name={selected.name} />}
        </div>
      )}
    </div>
  )
}
