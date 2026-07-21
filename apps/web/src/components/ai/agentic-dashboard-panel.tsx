'use client'

import * as React from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { Textarea } from '@/components/form'
import { Badge } from '@/components/data'
import { AgentSwarmMonitor } from './agent-swarm-monitor'

export type SwarmStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SwarmItem {
  swarmId: string
  task: string
  coordination: string
  currentIteration?: number
  maxIterations?: number
  status: SwarmStatus
}

// mock 数据:3 个 Swarm
const MOCK_SWARMS: SwarmItem[] = [
  {
    swarmId: 'swarm-001',
    task: '实现用户管理模块的 CRUD 接口和前端表单组件,需要包含权限校验和审计日志功能',
    coordination: 'hierarchical',
    currentIteration: 3,
    maxIterations: 10,
    status: 'running',
  },
  {
    swarmId: 'swarm-002',
    task: '优化首页加载性能,压缩资源、懒加载图片、合并 API 请求,目标 LCP < 2s',
    coordination: 'peer-to-peer',
    currentIteration: 8,
    maxIterations: 8,
    status: 'completed',
  },
  {
    swarmId: 'swarm-003',
    task: '修复支付回调中偶发的并发竞态问题,需要加分布式锁和重试机制',
    coordination: 'market-based',
    status: 'pending',
  },
]

const STATUS_VARIANT: Record<SwarmStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  pending: 'default',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
}

const COMPONENT_TYPES = ['Button', 'Card', 'Form', 'Layout'] as const
type ComponentType = (typeof COMPONENT_TYPES)[number]

/**
 * AgenticDashboardPanel - Agentic AI 控制台(精简版)
 * 4 区块:任务创建 / Swarm 监控 / 组件生成器 / 活跃 Swarm 列表
 */
export function AgenticDashboardPanel() {
  const t = useTranslations('agenticDashboard')
  const ts = useTranslations('agenticDashboard.status')

  const [taskName, setTaskName] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [currentSwarmId, setCurrentSwarmId] = useState<string | null>(null)
  const [componentDesc, setComponentDesc] = useState('')
  const [componentType, setComponentType] = useState<ComponentType>('Button')

  const handleCreateTask = () => {
    if (!taskName.trim()) return
    console.log('[AgenticDashboard] 创建任务:', { name: taskName, description: taskDesc })
    toast.success(`任务 "${taskName}" 已创建`)
    setTaskName('')
    setTaskDesc('')
  }

  const handleGenerate = () => {
    if (!componentDesc.trim()) return
    console.log('[AgenticDashboard] 生成组件:', { type: componentType, description: componentDesc })
    toast.success(`已生成 ${componentType} 组件`)
    setComponentDesc('')
  }

  const handleSelectSwarm = (swarmId: string) => {
    setCurrentSwarmId(swarmId === currentSwarmId ? null : swarmId)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* 页面头部 */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 4 区块 grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 1. 任务创建区 */}
        <Card className="rounded-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">任务创建</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="agentic-task-name">任务名</Label>
              <Input
                id="agentic-task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="输入任务名称"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentic-task-desc">任务描述</Label>
              <Textarea
                id="agentic-task-desc"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="描述任务目标和要求"
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={handleCreateTask} disabled={!taskName.trim()}>
              创建任务
            </Button>
          </CardContent>
        </Card>

        {/* 2. Swarm 监控 */}
        <Card className="rounded-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Swarm 监控</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {currentSwarmId ? (
              <AgentSwarmMonitor swarmId={currentSwarmId} swarmData={null} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                未选择 Swarm,请从下方列表点击一个
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. 组件生成器 */}
        <Card className="rounded-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">组件生成器</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="agentic-comp-desc">组件描述</Label>
              <Input
                id="agentic-comp-desc"
                value={componentDesc}
                onChange={(e) => setComponentDesc(e.target.value)}
                placeholder="描述要生成的组件"
              />
            </div>
            <div className="space-y-1.5">
              <Label>组件类型</Label>
              <Select
                value={componentType}
                onValueChange={(v) => setComponentType(v as ComponentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleGenerate} disabled={!componentDesc.trim()}>
              生成组件
            </Button>
          </CardContent>
        </Card>

        {/* 4. 活跃 Swarm 列表 */}
        <Card className="rounded-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">{t('activeSwarms')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-2">
            {MOCK_SWARMS.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('noActiveSwarms')}
              </p>
            ) : (
              MOCK_SWARMS.map((swarm) => {
                const isActive = swarm.swarmId === currentSwarmId
                return (
                  <div
                    key={swarm.swarmId}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectSwarm(swarm.swarmId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectSwarm(swarm.swarmId)
                      }
                    }}
                    className={
                      'cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted ' +
                      (isActive ? 'border-primary bg-muted' : 'border-border bg-background')
                    }
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        {swarm.swarmId}
                      </span>
                      <Badge variant={STATUS_VARIANT[swarm.status]}>{ts(swarm.status)}</Badge>
                    </div>
                    <div className="mb-1.5 break-words text-sm">
                      {swarm.task.length > 50 ? swarm.task.slice(0, 50) + '...' : swarm.task}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        {t('coordination')}: {swarm.coordination}
                      </span>
                      {swarm.currentIteration !== undefined && swarm.maxIterations !== undefined && (
                        <span>
                          {t('iteration')}: {swarm.currentIteration}/{swarm.maxIterations}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AgenticDashboardPanel
