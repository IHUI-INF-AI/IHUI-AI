'use client'

import * as React from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Badge } from '@/components/data'
import { AgentSwarmMonitor } from './agent-swarm-monitor'
import { AgenticTaskCreator } from './agentic-task-creator'
import { AgenticComponentGenerator } from './agentic-component-generator'

export type SwarmStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SwarmItem {
  swarmId: string
  task: string
  coordination: string
  currentIteration?: number
  maxIterations?: number
  status: SwarmStatus
}

// mock 数据:5 个 Swarm
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
  {
    swarmId: 'swarm-004',
    task: '搭建 CI/CD 流水线,集成代码扫描、单元测试、E2E 测试和自动部署',
    coordination: 'hierarchical',
    currentIteration: 2,
    maxIterations: 15,
    status: 'running',
  },
  {
    swarmId: 'swarm-005',
    task: '数据库迁移 PostgreSQL 14 到 16,验证兼容性、性能基准测试',
    coordination: 'peer-to-peer',
    currentIteration: 5,
    maxIterations: 5,
    status: 'failed',
  },
]

// pending 灰 / running 黄 / completed 绿 / failed 红
const STATUS_VARIANT: Record<SwarmStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  pending: 'default',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
}

/**
 * AgenticDashboardPanel - Agentic AI 控制台主框架
 * 1:1 复刻自 Vue 版 AgenticDashboard 主框架
 * 4 区块:任务创建 / Swarm 监控 / 组件生成器 / 活跃 Swarm 列表
 */
export function AgenticDashboardPanel() {
  const t = useTranslations('agenticDashboard')
  const ts = useTranslations('agenticDashboard.status')
  const [currentSwarmId, setCurrentSwarmId] = useState<string | null>(null)

  // 任务创建成功回调,等价 Vue 版 handleTaskCreated(swarmId)
  const handleTaskCreated = (swarmId: string) => setCurrentSwarmId(swarmId)

  // 点击切换 currentSwarmId,active 态用 border-primary(无蓝色发光)
  const handleSelectSwarm = (swarmId: string) =>
    setCurrentSwarmId(swarmId === currentSwarmId ? null : swarmId)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* 页面头部 */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 4 区块 grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 1. 任务创建 */}
        <AgenticTaskCreator onCreated={handleTaskCreated} />

        {/* 2. Swarm 监控(仅当 currentSwarmId 有值时显示) */}
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
        <AgenticComponentGenerator />

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
                      {swarm.currentIteration !== undefined &&
                        swarm.maxIterations !== undefined && (
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
