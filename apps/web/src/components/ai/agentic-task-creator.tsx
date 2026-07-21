'use client'

import * as React from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'
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
import { Textarea, Checkbox } from '@/components/form'

/** 任务表单状态(对应 Vue 版 + 任务规格扩展字段) */
export interface TaskFormState {
  name: string
  description: string
  coordination: 'hierarchical' | 'peer-to-peer' | 'market-based'
  maxIterations: number
  autoOptimize: boolean
  agents: Array<{ type: string; name: string; model: string }>
  workspacePath: string
  modelId: string
}

export interface AgenticTaskCreatorProps {
  /** 创建成功后回调,等价 Vue 版 emit('created', swarmId) */
  onCreated?: (swarmId: string) => void
}

/** 协调模式选项,文案借用 agenticAI 命名空间 */
const COORDINATION_OPTIONS: Array<{
  value: TaskFormState['coordination']
  labelKey: 'coordinationHierarchical' | 'coordinationPeerToPeer' | 'coordinationMarketBased'
}> = [
  { value: 'hierarchical', labelKey: 'coordinationHierarchical' },
  { value: 'peer-to-peer', labelKey: 'coordinationPeerToPeer' },
  { value: 'market-based', labelKey: 'coordinationMarketBased' },
]

const DEFAULT_AGENT: { type: string; name: string; model: string } = {
  type: '',
  name: '',
  model: '',
}

const INITIAL_STATE: TaskFormState = {
  name: '',
  description: '',
  coordination: 'hierarchical',
  maxIterations: 10,
  autoOptimize: false,
  agents: [{ ...DEFAULT_AGENT }],
  workspacePath: '',
  modelId: 'default',
}

/**
 * AgenticTaskCreator - 任务创建器子组件
 * 1:1 复刻自 Vue 版 AgenticTaskCreator,并按任务规格补充
 * agents 动态数组 / workspacePath / modelId 字段
 */
export function AgenticTaskCreator({ onCreated }: AgenticTaskCreatorProps) {
  const ta = useTranslations('agenticAI')
  const [form, setForm] = useState<TaskFormState>(INITIAL_STATE)
  const [isLoading, setIsLoading] = useState(false)

  const update = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateAgent = (idx: number, key: 'type' | 'name' | 'model', value: string) => {
    setForm((prev) => ({
      ...prev,
      agents: prev.agents.map((agent, i) =>
        i === idx
          ? ({
              type: key === 'type' ? value : agent.type,
              name: key === 'name' ? value : agent.name,
              model: key === 'model' ? value : agent.model,
            })
          : agent,
      ),
    }))
  }

  const addAgent = () => {
    setForm((prev) => ({ ...prev, agents: [...prev.agents, { ...DEFAULT_AGENT }] }))
  }

  const removeAgent = (idx: number) => {
    setForm((prev) =>
      prev.agents.length > 1
        ? { ...prev, agents: prev.agents.filter((_, i) => i !== idx) }
        : prev,
    )
  }

  const handleReset = () => setForm(INITIAL_STATE)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) return
    setIsLoading(true)
    try {
      // mock:实际应调用 createAndExecuteSwarm(task, options)
      await new Promise((resolve) => setTimeout(resolve, 500))
      const swarmId = `swarm-${Date.now()}`
      toast.success(`任务 "${form.name || '未命名'}" 已创建并执行`)
      onCreated?.(swarmId)
    } catch {
      toast.error('创建任务失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">任务创建</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="agentic-task-name">任务名</Label>
            <Input
              id="agentic-task-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="输入任务名称"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agentic-task-desc">{ta('taskDescription')}</Label>
            <Textarea
              id="agentic-task-desc"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={ta('taskDescriptionPlaceholder')}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ta('coordinationMode')}</Label>
              <Select
                value={form.coordination}
                onValueChange={(v) => update('coordination', v as TaskFormState['coordination'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COORDINATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {ta(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agentic-max-iter">{ta('maxIterations')}</Label>
              <Input
                id="agentic-max-iter"
                type="number"
                min={1}
                max={20}
                value={form.maxIterations}
                onChange={(e) =>
                  update(
                    'maxIterations',
                    Math.max(1, Math.min(20, Number(e.target.value) || 10)),
                  )
                }
                placeholder="10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{ta('autoOptimize')}</Label>
            <Checkbox
              checked={form.autoOptimize}
              onChange={(checked) => update('autoOptimize', checked)}
              label={ta('autoOptimize')}
            />
          </div>

          {/* Agent 规格(动态数组,可增删) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Agent 规格</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAgent}>
                <Plus className="h-3.5 w-3.5" />
                添加
              </Button>
            </div>
            <div className="space-y-2">
              {form.agents.map((agent, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="类型"
                    value={agent.type}
                    onChange={(e) => updateAgent(idx, 'type', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="名称"
                    value={agent.name}
                    onChange={(e) => updateAgent(idx, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="模型"
                    value={agent.model}
                    onChange={(e) => updateAgent(idx, 'model', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAgent(idx)}
                    disabled={form.agents.length <= 1}
                    aria-label="删除 Agent"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agentic-workspace">工作空间路径</Label>
            <Input
              id="agentic-workspace"
              value={form.workspacePath}
              onChange={(e) => update('workspacePath', e.target.value)}
              placeholder="/path/to/workspace"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agentic-model">模型 ID</Label>
            <Input
              id="agentic-model"
              value={form.modelId}
              onChange={(e) => update('modelId', e.target.value)}
              placeholder="default"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={!form.description.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                ta('createAndExecute')
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isLoading}
            >
              重置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default AgenticTaskCreator
