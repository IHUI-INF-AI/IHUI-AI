'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

import { DynamicsFilter } from './DynamicsFilter'
import { DynamicsTable } from './DynamicsTable'
import { PAGE_SIZE, deleteDynamic, fetchDynamics } from './helpers'
import { EMPTY_FILTER, type CirclePost, type PostFilter } from './types'

export default function AdminCirclesDynamicsPage() {
  const t = useTranslations('admin.circlesDynamics')
  const qc = useQueryClient()

  const [filter, setFilter] = React.useState<PostFilter>(EMPTY_FILTER)
  const [applied, setApplied] = React.useState<PostFilter>(EMPTY_FILTER)
  const [deleteTarget, setDeleteTarget] = React.useState<CirclePost | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'circlesDynamics', applied],
    queryFn: () => fetchDynamics(applied),
    retry: false,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDynamic(id),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'circlesDynamics'] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleSearch() {
    setApplied({ ...filter, page: 1 })
  }
  function handleReset() {
    const reset = { ...EMPTY_FILTER }
    setFilter(reset)
    setApplied(reset)
  }
  function handleComments() {
    toast.info(t('commentsPending'))
  }
  function confirmDelete() {
    if (deleteTarget) deleteMut.mutate(deleteTarget.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <DynamicsFilter
        filter={filter}
        onFilterChange={setFilter}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <DynamicsTable
        list={list}
        isLoading={isLoading}
        deletePending={deleteMut.isPending}
        onComments={handleComments}
        onDelete={setDeleteTarget}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={applied.page <= 1}
            onClick={() => setApplied({ ...applied, page: Math.max(1, applied.page - 1) })}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { page: applied.page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={applied.page >= totalPages}
            onClick={() => setApplied({ ...applied, page: applied.page + 1 })}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => (o ? null : setDeleteTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
