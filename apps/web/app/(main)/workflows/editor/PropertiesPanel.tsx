'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import {
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import type { Node } from '@xyflow/react'
import type { StepNodeData, WorkflowStep } from './types'

interface Props {
  node: Node<StepNodeData> | null
  onUpdate: (nodeId: string, step: WorkflowStep) => void
  onClose: () => void
}

const SKILL_OPTIONS = [
  { value: 'text-summary', label: '文本总结' },
  { value: 'text-translate', label: '文本翻译' },
  { value: 'text-explain', label: '文本解释' },
  { value: 'text-code', label: '代码生成' },
  { value: 'text-polish', label: '文本润色' },
  { value: 'wechat-article', label: '公众号文章' },
  { value: 'koubo-script', label: '口播脚本' },
]

export function PropertiesPanel({ node, onUpdate, onClose }: Props) {
  const t = useTranslations('workflows')

  if (!node) {
    return (
      <div className="w-64 shrink-0 border-l bg-card">
        <div className="border-b px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          {t('editor.properties')}
        </div>
        <div className="p-4 text-center text-xs text-muted-foreground">
          {t('editor.selectNode')}
        </div>
      </div>
    )
  }

  const data = node.data
  const step = data.step
  const isTrigger = data.stepType === 'trigger'

  const update = (patch: Partial<WorkflowStep>) => {
    onUpdate(node.id, { ...step, ...patch })
  }

  // 注入变更
  const setStr = (key: keyof WorkflowStep, value: string) => {
    if (key === 'duration' || key === 'count') {
      const num = Number(value)
      update({ [key]: Number.isNaN(num) ? 0 : num })
    } else {
      update({ [key]: value })
    }
  }

  return (
    <div className="w-64 shrink-0 border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {t('editor.properties')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-3 p-3">
        {/* 名称(所有非 trigger 节点) */}
        {!isTrigger && (
          <div className="space-y-1">
            <Label htmlFor="prop-name">{t('editor.name')}</Label>
            <Input
              id="prop-name"
              value={step.name}
              onChange={(e) => update({ name: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        )}

        {/* 输入(echo / llm) */}
        {(data.stepType === 'echo' || data.stepType === 'llm') && (
          <div className="space-y-1">
            <Label htmlFor="prop-input">{t('editor.input')}</Label>
            <textarea
              id="prop-input"
              value={step.input ?? ''}
              onChange={(e) => setStr('input', e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}

        {/* 技能选择(skill 类型) */}
        {data.stepType === 'skill' && (
          <>
            <div className="space-y-1">
              <Label>{t('editor.skill')}</Label>
              <Select
                value={step.skill ?? 'text-summary'}
                onValueChange={(v) => setStr('skill', v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prop-input">{t('editor.input')}</Label>
              <textarea
                id="prop-input"
                value={step.input ?? ''}
                onChange={(e) => setStr('input', e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </>
        )}

        {/* 条件(condition 类型) */}
        {data.stepType === 'condition' && (
          <div className="space-y-1">
            <Label htmlFor="prop-condition">{t('editor.condition')}</Label>
            <Input
              id="prop-condition"
              value={step.condition ?? ''}
              onChange={(e) => setStr('condition', e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder='例如: status == "success"'
            />
            <p className="text-[10px] text-muted-foreground">支持: true / false / field==value</p>
          </div>
        )}

        {/* 延迟时长 */}
        {data.stepType === 'delay' && (
          <div className="space-y-1">
            <Label htmlFor="prop-duration">{t('editor.duration')} (ms)</Label>
            <Input
              id="prop-duration"
              type="number"
              min={0}
              step={100}
              value={step.duration ?? 1000}
              onChange={(e) => setStr('duration', e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}

        {/* 循环次数 */}
        {data.stepType === 'loop' && (
          <div className="space-y-1">
            <Label htmlFor="prop-count">{t('editor.count')}</Label>
            <Input
              id="prop-count"
              type="number"
              min={1}
              max={100}
              value={step.count ?? 3}
              onChange={(e) => setStr('count', e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}

        {/* 继续失败配置 */}
        {!isTrigger && (
          <div className="flex items-center gap-2">
            <input
              id="prop-continue"
              type="checkbox"
              checked={step.continueOnFail ?? false}
              onChange={(e) => update({ continueOnFail: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-input"
            />
            <Label htmlFor="prop-continue" className="text-xs">
              {t('editor.continueOnFail')}
            </Label>
          </div>
        )}
      </div>
    </div>
  )
}
