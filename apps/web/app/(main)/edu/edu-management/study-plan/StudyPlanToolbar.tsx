// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Plus, School, Users, Calendar, ListChecks } from 'lucide-react'

import {
  Card,
  CardContent,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { type Term, type EduClass, type PlanType, type PlanStatus } from './types'

export function StudyPlanToolbar({
  terms,
  classes,
  classesLoading,
  selectedTermId,
  selectedClassId,
  planFilter,
  statusFilter,
  onTermChange,
  onClassChange,
  onPlanFilterChange,
  onStatusFilterChange,
  onAddPlan,
  onOpenTermDialog,
  onOpenClassDialog,
}: {
  terms: Term[]
  classes: EduClass[]
  classesLoading: boolean
  selectedTermId: string
  selectedClassId: string
  planFilter: PlanType | 'all'
  statusFilter: PlanStatus | 'all'
  onTermChange: (v: string) => void
  onClassChange: (v: string) => void
  onPlanFilterChange: (v: PlanType | 'all') => void
  onStatusFilterChange: (v: PlanStatus | 'all') => void
  onAddPlan: () => void
  onOpenTermDialog: () => void
  onOpenClassDialog: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        {/* Term selector */}
        <div className="flex items-center gap-2">
          <School className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedTermId} onValueChange={onTermChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="选择学期" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.isCurrent ? ' (当前)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onOpenTermDialog}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Class selector */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedClassId}
            onValueChange={onClassChange}
            disabled={!selectedTermId || classes.length === 0}
          >
            <SelectTrigger className="w-44">
              <SelectValue
                placeholder={
                  classesLoading ? '加载中...' : selectedTermId ? '选择班级' : '请先选择学期'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.grade ? ` (${c.grade})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenClassDialog}
            disabled={!selectedTermId}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Plan type filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={planFilter}
            onValueChange={onPlanFilterChange}
            disabled={!selectedTermId || !selectedClassId}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="类型筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="monthly">月计划</SelectItem>
              <SelectItem value="weekly">周计划</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={onStatusFilterChange}
            disabled={!selectedTermId || !selectedClassId}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="状态筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="active">进行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add button */}
        <div className="ml-auto">
          <Button size="sm" onClick={onAddPlan} disabled={!selectedTermId || !selectedClassId}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            创建月计划
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
