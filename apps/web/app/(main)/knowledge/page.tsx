'use client'

import * as React from 'react'
import { Brain } from 'lucide-react'

import { KnowledgeList } from '@/components/knowledge/KnowledgeList'

interface MemorySearchResult {
  id: string
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

export default function KnowledgePage() {
  const [items, setItems] = React.useState<MemorySearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searched, setSearched] = React.useState(false)

  const handleSearch = async (query: string) => {
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch('/api/agents/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 10 }),
      })
      const json = await res.json()
      setItems(json.results ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">知识库</h1>
      </div>
      <p className="text-sm text-muted-foreground">通过语义搜索检索记忆库中的知识内容</p>

      {!searched ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Brain className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">输入关键词搜索知识库内容</p>
        </div>
      ) : (
        <KnowledgeList items={items} onSearch={handleSearch} loading={loading} />
      )}
    </div>
  )
}
