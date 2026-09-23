// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('eduStudyPlan')

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
        {/* Term selector */}
        <div className="flex items-center gap-2">
          <School className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedTermId} onValueChange={onTermChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('selectTerm')} />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.name}
                  {term.isCurrent ? t('currentTermSuffix') : ''}
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
                  classesLoading
                    ? t('loading')
                    : selectedTermId
                      ? t('selectClass')
                      : t('selectTermFirst')
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
              <SelectValue placeholder={t('typeFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              <SelectItem value="monthly">{t('planTypeMonthly')}</SelectItem>
              <SelectItem value="weekly">{t('planTypeWeekly')}</SelectItem>
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
              <SelectValue placeholder={t('statusFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="draft">{t('statusDraft')}</SelectItem>
              <SelectItem value="active">{t('statusActive')}</SelectItem>
              <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
              <SelectItem value="archived">{t('statusArchived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add button */}
        <div className="ml-auto">
          <Button size="sm" onClick={onAddPlan} disabled={!selectedTermId || !selectedClassId}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('createMonthlyPlan')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
