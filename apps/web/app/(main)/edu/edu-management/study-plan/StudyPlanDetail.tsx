// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  Plus,
  Shield,
  User,
  BarChart3,
  Timeline,
  Clock,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Checkbox } from '@ihui/ui-react'
import {
  type StudyPlan,
  type PlanItem,
  type PlanStatus,
  PLAN_STATUS_VARIANTS,
  PLAN_STATUS_LABELS,
  PLAN_TYPE_LABELS,
  STATUS_ORDER,
  formatDate,
  formatDateDisplay,
} from './types'

export function StudyPlanDetail({
  selectedPlan,
  isStudentMode,
  childPlansByParent,
  completedCount,
  totalCount,
  completionRate,
  itemsLoading,
  parentItems,
  childItemsByParent,
  weekDays,
  today,
  itemsByDay,
  weekOffset,
  onSetStudentMode,
  onAutoSplit,
  onEditPlan,
  onOpenStats,
  onOpenTimeline,
  onUpdateStatus,
  onAddItem,
  onEditItem,
  onAddSubItem,
  onToggleCompleted,
  onDeleteParentItem,
  onDeleteChildItem,
  onEditChildItem,
  onWeekOffset,
}: {
  selectedPlan: StudyPlan | null
  isStudentMode: boolean
  childPlansByParent: Map<string, StudyPlan[]>
  completedCount: number
  totalCount: number
  completionRate: number
  itemsLoading: boolean
  parentItems: PlanItem[]
  childItemsByParent: Map<string, PlanItem[]>
  weekDays: Date[]
  today: Date
  itemsByDay: Map<string, PlanItem[]>
  weekOffset: number
  onSetStudentMode: (v: boolean) => void
  onAutoSplit: (planId: string) => void
  onEditPlan: (plan: StudyPlan) => void
  onOpenStats: () => void
  onOpenTimeline: () => void
  onUpdateStatus: (id: string, status: PlanStatus) => void
  onAddItem: () => void
  onEditItem: (item: PlanItem) => void
  onAddSubItem: (parentItemId: string) => void
  onToggleCompleted: (item: PlanItem) => void
  onDeleteParentItem: (item: PlanItem) => void
  onDeleteChildItem: (id: string) => void
  onEditChildItem: (child: PlanItem) => void
  onWeekOffset: React.Dispatch<React.SetStateAction<number>>
}) {
  const isToday = (d: Date): boolean => {
    return formatDate(d) === formatDate(today)
  }

  if (!selectedPlan) {
    return (
      <Card className="lg:col-span-2">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle className="mb-2 h-8 w-8" />
          <p className="text-sm">请从左侧选择一个学习计划查看详情</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-medium">{selectedPlan.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={cn('px-1.5', PLAN_STATUS_VARIANTS[selectedPlan.status])}>
                {PLAN_STATUS_LABELS[selectedPlan.status]}
              </Badge>
              <Badge variant="outline">{PLAN_TYPE_LABELS[selectedPlan.planType]}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateDisplay(selectedPlan.startDate)} ~{' '}
                {formatDateDisplay(selectedPlan.endDate)}
              </span>
            </div>
            {selectedPlan.description && (
              <p className="mt-2 text-sm text-muted-foreground">{selectedPlan.description}</p>
            )}
            {totalCount > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                <span className="text-muted-foreground">
                  完成进度: {completedCount}/{totalCount} ({completionRate}%)
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button
                variant={!isStudentMode ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSetStudentMode(false)}
              >
                <Shield className="mr-1 h-3 w-3" />
                管理员
              </Button>
              <Button
                variant={isStudentMode ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSetStudentMode(true)}
              >
                <User className="mr-1 h-3 w-3" />
                学生
              </Button>
            </div>
            {/* Action buttons */}
            <div className="flex gap-1.5">
              {selectedPlan.planType === 'monthly' &&
                !childPlansByParent.has(selectedPlan.id) &&
                !isStudentMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onAutoSplit(selectedPlan.id)}
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    自动拆解
                  </Button>
                )}
              {!isStudentMode && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onEditPlan(selectedPlan)}
                >
                  编辑
                </Button>
              )}
              {/* Completion stats & Progress timeline */}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenStats}>
                <BarChart3 className="mr-1 h-3 w-3" />
                完成率统计
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={onOpenTimeline}
                disabled={!selectedPlan}
              >
                <Timeline className="mr-1 h-3 w-3" />
                进度时间线
              </Button>
              {/* Status transition buttons */}
              {!isStudentMode && (
                <div className="flex gap-1">
                  {STATUS_ORDER.map((status) => {
                    const isCurrent = selectedPlan.status === status
                    const isNext =
                      STATUS_ORDER.indexOf(status) ===
                      (STATUS_ORDER.indexOf(selectedPlan.status) + 1) % STATUS_ORDER.length
                    if (!isCurrent && !isNext) return null
                    return (
                      <Button
                        key={status}
                        size="sm"
                        variant={isCurrent ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        disabled={isCurrent}
                        onClick={() => {
                          if (!isCurrent) {
                            onUpdateStatus(selectedPlan.id, status)
                          }
                        }}
                      >
                        {PLAN_STATUS_LABELS[status]}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add item button */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {isStudentMode ? '学习任务' : '计划条目'}
            {totalCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">({totalCount})</span>
            )}
          </h3>
          {!isStudentMode && (
            <Button size="sm" onClick={onAddItem}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              添加条目
            </Button>
          )}
        </div>

        {/* Week view for weekly plans */}
        {selectedPlan.planType === 'weekly' && (
          <div>
            {/* Week navigation */}
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">
                {weekDays[0] && weekDays[6]
                  ? `${formatDate(weekDays[0])} ~ ${formatDate(weekDays[6])}`
                  : ''}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => onWeekOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onWeekOffset(0)}
                  disabled={weekOffset === 0}
                >
                  本周
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onWeekOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Week grid */}
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载中...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dateStr = formatDate(day)
                  const dayItems = itemsByDay.get(dateStr) ?? []
                  const dayCompleted = dayItems.filter((i) => i.completed).length
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        'min-h-[120px] rounded-md border p-2',
                        isToday(day) && 'bg-primary/5 border-primary/30',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-2 text-xs font-medium',
                          isToday(day) ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {['日', '一', '二', '三', '四', '五', '六'][day.getDay()]} {day.getDate()}
                        {dayCompleted > 0 && dayCompleted === dayItems.length && (
                          <CheckCircle2 className="inline-block ml-1 h-3 w-3 text-green-600" />
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              'group flex cursor-pointer items-start gap-1 rounded-sm px-2 py-1 text-xs transition-colors hover:bg-accent',
                              item.completed && 'opacity-50',
                            )}
                            onClick={() => onEditItem(item)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') onEditItem(item)
                            }}
                          >
                            <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-50" />
                            <div className="flex-1 min-w-0">
                              <p className={cn('truncate', item.completed && 'line-through')}>
                                {item.content}
                              </p>
                            </div>
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={() => onToggleCompleted(item)}
                              className="h-3 w-3"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* List view for items */}
        {itemsLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : parentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">暂无计划条目</p>
            {!isStudentMode && (
              <Button size="sm" variant="outline" className="mt-3" onClick={onAddItem}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加第一个条目
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {parentItems.map((item) => {
              const childItems = childItemsByParent.get(item.id) ?? []
              return (
                <div key={item.id}>
                  {/* Parent item */}
                  <div
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 transition-colors hover:border-accent-foreground/20',
                      item.completed && 'bg-muted/30',
                    )}
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => onToggleCompleted(item)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            item.completed && 'line-through text-muted-foreground',
                          )}
                        >
                          {item.content}
                        </p>
                        {item.dueDate && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            {formatDateDisplay(item.dueDate)}
                          </Badge>
                        )}
                      </div>
                      {item.objective && (
                        <p className="mt-1 text-sm text-muted-foreground">目标: {item.objective}</p>
                      )}
                      {item.notes && isStudentMode && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          备注: {item.notes}
                        </p>
                      )}
                      {/* Action buttons */}
                      <div className="mt-2 flex items-center gap-2">
                        {!isStudentMode && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => onEditItem(item)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-destructive hover:text-destructive"
                              onClick={() => onDeleteParentItem(item)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                        {isStudentMode && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => onEditItem(item)}
                            >
                              添加备注
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => onAddSubItem(item.id)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              添加子任务
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Child items (sub-tasks) */}
                  {childItems.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 pl-4">
                      {childItems.map((child) => (
                        <div
                          key={child.id}
                          className={cn(
                            'flex items-start gap-2 rounded-md border p-2',
                            child.completed && 'bg-muted/20',
                          )}
                        >
                          <Checkbox
                            checked={child.completed}
                            onCheckedChange={() => onToggleCompleted(child)}
                            className="mt-0.5 h-3.5 w-3.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                'text-xs',
                                child.completed && 'line-through text-muted-foreground',
                              )}
                            >
                              {child.content}
                            </p>
                            {child.notes && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                备注: {child.notes}
                              </p>
                            )}
                          </div>
                          {isStudentMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-[10px]"
                              onClick={() => onEditChildItem(child)}
                            >
                              备注
                            </Button>
                          )}
                          {!isStudentMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-destructive"
                              onClick={() => onDeleteChildItem(child.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
