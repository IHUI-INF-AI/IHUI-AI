'use client'

import * as React from 'react'
import { Loader2, RefreshCw, Zap } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'

import { ToolCallTree } from './components/ToolCallTree'
import { MemoryPanel } from './components/MemoryPanel'
import { SessionTree } from './components/SessionTree'
import { TokenUsageChart } from './components/TokenUsageChart'
import { ErrorHeatmap } from './components/ErrorHeatmap'

interface Agent {
  id: string
  name: string
}

const TIME_RANGES = [
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
]

export default function AgentRuntimePage() {
  const [agents, setAgents] = React.useState<Agent[]>([])
  const [agentId, setAgentId] = React.useState('')
  const [timeRange, setTimeRange] = React.useState('24h')
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<Agent[]>('/api/agents?limit=50')
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) {
          setAgents(r.data)
          if (r.data.length > 0 && !agentId) setAgentId(r.data[0]?.id ?? '')
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => setRefreshKey((k) => k + 1), 5000)
    return () => clearInterval(timer)
  }, [autoRefresh])

  const handleRefresh = React.useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Zap className="h-6 w-6 text-primary" />
          运行时可视化中心
        </h1>
        <p className="text-sm text-muted-foreground">
          实时监控 Agent 运行状态、工具调用、记忆和会话
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Agent</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择 Agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">时间范围</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-muted-foreground">自动刷新(5s)</label>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
        </CardContent>
      </Card>

      {!agentId ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在加载 Agent 列表...
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ToolCallTree agentId={agentId} timeRange={timeRange} refreshKey={refreshKey} />
          <MemoryPanel agentId={agentId} timeRange={timeRange} refreshKey={refreshKey} />
          <SessionTree agentId={agentId} timeRange={timeRange} refreshKey={refreshKey} />
          <Tabs defaultValue="token">
            <TabsList className="mb-1">
              <TabsTrigger value="token">Token 消耗</TabsTrigger>
              <TabsTrigger value="error">错误热力图</TabsTrigger>
            </TabsList>
            <TabsContent value="token" className="mt-0">
              <TokenUsageChart agentId={agentId} timeRange={timeRange} refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="error" className="mt-0">
              <ErrorHeatmap agentId={agentId} timeRange={timeRange} refreshKey={refreshKey} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
