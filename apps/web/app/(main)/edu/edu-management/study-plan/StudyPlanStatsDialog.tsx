// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { type UseQueryResult } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import { type CompletionStatsResponse, PLAN_STATUS_KEYS, type PlanStatus } from './types'

export function StudyPlanStatsDialog({
  open,
  onOpenChange,
  query,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  query: UseQueryResult<CompletionStatsResponse>
}) {
  const t = useTranslations('eduStudyPlan')
  /** 未知状态码回退原码(后端可能新增枚举) */
  const statusLabel = (code: string): string => {
    const key = PLAN_STATUS_KEYS[code as PlanStatus]
    return key ? t(key) : code
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('completionStats')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {query.isFetching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : query.data ? (
            <>
              {/* Overall stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="min-[640px]:p-3 flex flex-col items-center justify-center p-3">
                    <span className="text-2xl font-bold text-primary">
                      {query.data.overallRate}%
                    </span>
                    <span className="text-xs text-muted-foreground">{t('overallRate')}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="min-[640px]:p-3 flex flex-col items-center justify-center p-3">
                    <span className="text-2xl font-bold text-green-600">
                      {query.data.totalCompleted}
                    </span>
                    <span className="text-xs text-muted-foreground">{t('statusCompleted')}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="min-[640px]:p-3 flex flex-col items-center justify-center p-3">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {query.data.totalItems}
                    </span>
                    <span className="text-xs text-muted-foreground">{t('totalItems')}</span>
                  </CardContent>
                </Card>
              </div>

              {/* Per-plan breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('planDetails')}</h4>
                {query.data.plans.length === 0 ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    {t('noPlanData')}
                  </p>
                ) : (
                  <div className="space-y-1 rounded-md border">
                    {query.data.plans.map((plan) => (
                      <div
                        key={plan.planId}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{plan.planTitle}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">
                              {plan.planType === 'monthly'
                                ? t('planTypeMonthly')
                                : t('planTypeWeekly')}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {statusLabel(plan.status)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {plan.completedItems}/{plan.totalItems}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              plan.completionRate >= 80
                                ? 'text-green-600'
                                : plan.completionRate >= 50
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {plan.completionRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('noStatsData')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
