'use client'

import * as React from 'react'
import { Loader2, Brain, Clock, Database, Workflow } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

type MemoryLayerName = 'working' | 'episodic' | 'semantic' | 'procedural'

export interface MemoryEntry {
  id: string
  content: string
  createdAt: string
  importance: number
}

export interface LayerData {
  layer: MemoryLayerName
  count: number
  entries: MemoryEntry[]
}

interface MemoryStatusResp {
  layers: LayerData[]
}

interface MemoryPanelProps {
  agentId: string
  timeRange: string
  refreshKey: number
}

const LAYER_META: Record<
  MemoryLayerName,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  working: { label: '工作记忆', icon: Brain },
  episodic: { label: '情景记忆', icon: Clock },
  semantic: { label: '语义记忆', icon: Database },
  procedural: { label: '程序记忆', icon: Workflow },
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function truncate(s: string, max = 50): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function importanceColor(v: number): string {
  if (v > 70) return 'bg-green-500'
  if (v >= 30) return 'bg-yellow-500'
  return 'bg-red-500'
}

function LayerCard({ data }: { data: LayerData }) {
  const meta = LAYER_META[data.layer]
  const Icon = meta.icon
  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {meta.label}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {data.count} 条
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {data.entries.slice(0, 3).map((e) => (
          <div key={e.id} className="space-y-1">
            <p className="text-xs leading-relaxed">{truncate(e.content)}</p>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className={`h-full ${importanceColor(e.importance)}`}
                  style={{ width: `${e.importance}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {timeFmt.format(new Date(e.createdAt))}
              </span>
            </div>
          </div>
        ))}
        {data.entries.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">暂无条目</p>
        )}
      </CardContent>
    </Card>
  )
}

export function MemoryPanel({ agentId, timeRange, refreshKey }: MemoryPanelProps) {
  const [layers, setLayers] = React.useState<LayerData[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setLoading(true)
    fetchApi<MemoryStatusResp>(`/api/memory/status?user_id=${agentId}&range=${timeRange}`)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setLayers(r.data.layers ?? [])
        else {
          setLayers([])
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLayers([])
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentId, timeRange, refreshKey])

  const full: LayerData[] = (
    ['working', 'episodic', 'semantic', 'procedural'] as MemoryLayerName[]
  ).map((name) => {
    const found = layers.find((l) => l.layer === name)
    return found ?? { layer: name, count: 0, entries: [] }
  })

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">记忆状态</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {full.map((l) => (
                <LayerCard key={l.layer} data={l} />
              ))}
            </div>
            {error && layers.length === 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                接口暂不可用,数据显示为 0
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
