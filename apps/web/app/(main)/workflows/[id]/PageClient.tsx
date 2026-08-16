'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Workflow,
  Zap,
  Edit3,
  Save,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { TRIGGER_KEYS, INSTANCE_STATUS_KEYS, DETAIL_TAB_KEYS } from '../helpers'
import { WorkflowEditor } from '../editor/WorkflowEditor'
import type { WorkflowStep } from '../editor/types'

type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook'
type InstStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
interface Workflow {
  id: string
  name: string
  description?: string
  triggerType: TriggerType
  steps?: unknown[]
  isActive: boolean
  createdAt: string
}
interface Instance {
  id: string
  status: InstStatus
  startedAt?: string
  completedAt?: string
  error?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_BADGE: Record<InstStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

const TRIGGER_OPTIONS: TriggerType[] = ['manual', 'schedule', 'event', 'webhook']

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('workflows')
  const locale = useLocale()
  const qc = useQueryClient()

  const [instPage, setInstPage] = React.useState(1)
  const INST_PAGE_SIZE = 10

  const wfQ = useQuery({
    queryKey: ['workflows', id],
    queryFn: () => api<{ workflow: Workflow }>(`/api/workflows/${id}`).then((d) => d.workflow),
  })

  const instQ = useQuery({
    queryKey: ['workflows', id, 'instances', instPage],
    queryFn: () =>
      api<{ list: Instance[]; total: number }>(
        `/api/workflows/instances?workflowId=${id}&page=${instPage}&pageSize=${INST_PAGE_SIZE}`,
      ).then((d) => d),
  })

  const insts = instQ.data?.list ?? []
  const instTotal = instQ.data?.total ?? 0
  const instTotalPages = Math.ceil(instTotal / INST_PAGE_SIZE)

  const triggerMut = useMutation({
    mutationFn: () => api(`/api/workflows/${id}/trigger`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', id, 'instances'] }),
  })
  const cancelMut = useMutation({
    mutationFn: (iId: string) => api(`/api/workflows/instances/${iId}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', id, 'instances'] }),
  })
  const retryMut = useMutation({
    mutationFn: (iId: string) => api(`/api/workflows/instances/${iId}/retry`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', id, 'instances'] }),
  })

  const saveStepsMut = useMutation({
    mutationFn: (steps: WorkflowStep[]) =>
      api(`/api/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ steps }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows', id] })
      setEditStepsMode(false)
    },
  })

  const toggleActiveMut = useMutation({
    mutationFn: (isActive: boolean) =>
      api(`/api/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows', id] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => api(`/api/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      router.push('/workflows')
    },
  })

  const saveInfoMut = useMutation({
    mutationFn: (data: { name: string; description: string; triggerType: TriggerType }) =>
      api(`/api/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows', id] })
      setEditInfoMode(false)
    },
  })

  const [tab, setTab] = React.useState<'instances' | 'definition'>('instances')
  const [editStepsMode, setEditStepsMode] = React.useState(false)
  const [editorSteps, setEditorSteps] = React.useState<WorkflowStep[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [editInfoMode, setEditInfoMode] = React.useState(false)
  const [editName, setEditName] = React.useState('')
  const [editDesc, setEditDesc] = React.useState('')
  const [editTrigger, setEditTrigger] = React.useState<TriggerType>('manual')

  const handleStartEditSteps = () => {
    const raw = wfQ.data?.steps ?? []
    const steps: WorkflowStep[] = Array.isArray(raw) ? (raw as WorkflowStep[]) : []
    setEditorSteps(steps)
    setEditStepsMode(true)
  }

  const handleStartEditInfo = () => {
    const wf = wfQ.data
    if (!wf) return
    setEditName(wf.name)
    setEditDesc(wf.description ?? '')
    setEditTrigger(wf.triggerType)
    setEditInfoMode(true)
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (wfQ.isLoading)
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  if (wfQ.error || !wfQ.data)
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(wfQ.error as Error)?.message ?? t('notFound')}
      </div>
    )

  const wf = wfQ.data

  return (
    <div className="space-y-4 px-4 py-6">
      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.confirmDelete')}</DialogTitle>
            <DialogDescription>{t('detail.deleteConfirm', { name: wf.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteMut.isPending}
            >
              {t('editor.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMut.mutate(undefined, {
                  onSuccess: () => setDeleteConfirmOpen(false),
                })
              }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t('detail.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑基本信息对话框 */}
      <Dialog open={editInfoMode} onOpenChange={setEditInfoMode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.editInfo')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('detail.name')}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">{t('detail.description')}</Label>
              <textarea
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('detail.triggerType')}</Label>
              <Select value={editTrigger} onValueChange={(v) => setEditTrigger(v as TriggerType)}>
                <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`triggers.${opt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditInfoMode(false)}
              disabled={saveInfoMut.isPending}
            >
              {t('editor.cancel')}
            </Button>
            <Button
              onClick={() =>
                saveInfoMut.mutate({
                  name: editName,
                  description: editDesc,
                  triggerType: editTrigger,
                })
              }
              disabled={saveInfoMut.isPending || !editName.trim()}
            >
              {saveInfoMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('detail.saveInfo')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 返回按钮 */}
      <button
        type="button"
        onClick={() => router.push('/workflows')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </button>

      {/* 头部信息 */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Workflow className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{wf.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{wf.description || '-'}</p>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              {t(TRIGGER_KEYS[wf.triggerType] ?? 'triggers.unknown')}
              <span
                className={cn(
                  'ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                  wf.isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {wf.isActive ? t('status.active') : t('status.inactive')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleStartEditInfo}>
            <Info className="h-4 w-4" />
            {t('detail.editInfo')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleActiveMut.mutate(!wf.isActive)}
            disabled={toggleActiveMut.isPending}
          >
            {wf.isActive ? (
              <ToggleLeft className="h-4 w-4 text-amber-500" />
            ) : (
              <ToggleRight className="h-4 w-4 text-emerald-500" />
            )}
            {wf.isActive ? t('detail.deactivate') : t('detail.activate')}
          </Button>
          <Button
            size="sm"
            onClick={() => triggerMut.mutate()}
            disabled={triggerMut.isPending || !wf.isActive}
          >
            <Play className="h-4 w-4" />
            {t('detail.trigger')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleteMut.isPending}
          >
            <Trash2 className="h-4 w-4" />
            {t('detail.delete')}
          </Button>
        </div>
        {triggerMut.isError && (
          <div className="w-full text-xs text-destructive">
            {(triggerMut.error as Error).message}
          </div>
        )}
        {toggleActiveMut.isError && (
          <div className="w-full text-xs text-destructive">
            {(toggleActiveMut.error as Error).message}
          </div>
        )}
        {saveInfoMut.isError && (
          <div className="w-full text-xs text-destructive">
            {(saveInfoMut.error as Error).message}
          </div>
        )}
      </div>

      {/* Tab 导航 */}
      <div className="border-b">
        <nav className="flex gap-1">
          {(['instances', 'definition'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k)
                if (k !== 'definition') setEditStepsMode(false)
              }}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === k
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(DETAIL_TAB_KEYS[k] ?? 'detail.tab_unknown')}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 内容 */}
      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'instances' ? (
          instQ.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : insts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              {t('detail.noInstances')}
            </div>
          ) : (
            <div className="space-y-2">
              {insts.map((i: Instance) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3"
                >
                  <span
                    className={cn(
                      'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                      STATUS_BADGE[i.status],
                    )}
                  >
                    {t(INSTANCE_STATUS_KEYS[i.status] ?? 'instanceStatus.unknown')}
                  </span>
                  <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                    <div>
                      {t('detail.startedAt')}: {fmt(i.startedAt)}
                    </div>
                    <div>
                      {t('detail.completedAt')}: {fmt(i.completedAt)}
                    </div>
                    {i.error && (
                      <div className="mt-1 text-destructive">
                        {t('instanceDetail.error')}: {i.error}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/workflows/instances/${i.id}`)}
                    >
                      {t('detail.viewInstance')}
                    </Button>
                    {(i.status === 'running' || i.status === 'pending') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-orange-600 hover:bg-orange-500/10"
                        onClick={() => cancelMut.mutate(i.id)}
                        disabled={cancelMut.isPending}
                      >
                        <Square className="h-4 w-4" />
                        {t('detail.cancel')}
                      </Button>
                    )}
                    {(i.status === 'failed' || i.status === 'cancelled') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => retryMut.mutate(i.id)}
                        disabled={retryMut.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('detail.retry')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {/* 分页 */}
              {instTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={instPage <= 1}
                    onClick={() => setInstPage((p) => Math.max(1, p - 1))}
                  >
                    {t('prev') ?? '上一页'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {instPage} / {instTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={instPage >= instTotalPages}
                    onClick={() => setInstPage((p) => p + 1)}
                  >
                    {t('next') ?? '下一页'}
                  </Button>
                </div>
              )}
            </div>
          )
        ) : editStepsMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {t('editor.editSteps')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditStepsMode(false)}
                  disabled={saveStepsMut.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                  {t('editor.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveStepsMut.mutate(editorSteps)}
                  disabled={saveStepsMut.isPending}
                >
                  {saveStepsMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {t('editor.save')}
                </Button>
              </div>
            </div>
            {saveStepsMut.isError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(saveStepsMut.error as Error).message}
              </div>
            )}
            <WorkflowEditor steps={editorSteps} onChange={setEditorSteps} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {t('detail.definition')}
              </span>
              <Button size="sm" variant="outline" onClick={handleStartEditSteps}>
                <Edit3 className="h-3.5 w-3.5" />
                {t('editor.edit')}
              </Button>
            </div>
            <WorkflowEditor
              steps={Array.isArray(wf.steps) ? (wf.steps as WorkflowStep[]) : []}
              onChange={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  )
}
