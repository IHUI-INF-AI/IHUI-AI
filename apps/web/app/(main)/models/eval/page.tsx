'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  FlaskConical,
  Database,
  Play,
  BarChart3,
  Plus,
  Trash2,
  Eye,
  Loader2,
  Clock,
  X,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Label,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'

/* ---------- types ---------- */

interface DatasetItem {
  input: string
  expected_output?: string | null
}

interface Dataset {
  name: string
  description?: string | null
  items: DatasetItem[]
  /** list 接口仅返回计数,详情接口才带 items */
  item_count?: number
  created_at?: string | null
}

interface EvalRunResult {
  input: string
  expected_output?: string | null
  actual_output?: string | null
  score: number
  error?: string | null
  duration_ms: number
}

interface EvalRun {
  id: string
  dataset_name: string
  model: string
  prompt_name: string
  avg_score: number
  total_duration_ms: number
  created_at: string
  results?: EvalRunResult[]
}

/* ---------- api helpers ---------- */

async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetchApi<Dataset[]>('/api/v1/ai/eval/datasets')
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function fetchRuns(): Promise<EvalRun[]> {
  const res = await fetchApi<EvalRun[]>('/api/v1/ai/eval/runs')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/* ---------- helpers ---------- */

function timeFmt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function durationFmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function scoreCls(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (score >= 0.5) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-red-500/10 text-red-600 dark:text-red-400'
}

/* ---------- page ---------- */

export default function EvalPage() {
  const t = useTranslations('models')
  const qc = useQueryClient()

  const [tab, setTab] = React.useState('datasets')

  /* datasets */
  const [createOpen, setCreateOpen] = React.useState(false)
  const [viewDataset, setViewDataset] = React.useState<Dataset | null>(null)
  const [deleteName, setDeleteName] = React.useState<string | null>(null)

  /* runs */
  const [createRunOpen, setCreateRunOpen] = React.useState(false)
  const [viewRun, setViewRun] = React.useState<EvalRun | null>(null)

  /* ---------- queries ---------- */

  const datasetsQ = useQuery({
    queryKey: ['eval', 'datasets'],
    queryFn: fetchDatasets,
  })

  const runsQ = useQuery({
    queryKey: ['eval', 'runs'],
    queryFn: fetchRuns,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['eval', 'datasets'] })
    qc.invalidateQueries({ queryKey: ['eval', 'runs'] })
  }

  /* ---------- mutations ---------- */

  const deleteMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetchApi<{ deleted: boolean }>(
        `/api/v1/ai/eval/datasets/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      )
      if (!res.success) throw new Error(res.error || t('eval.datasets.messages.deleteFailed'))
      return res.data
    },
    onSuccess: () => {
      toast.success(t('eval.datasets.messages.deleteSuccess'))
      setDeleteName(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const datasets = datasetsQ.data ?? []
  const runs = runsQ.data ?? []

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('eval.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('eval.subtitle')}</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="datasets" className="gap-1.5">
            <Database className="h-4 w-4" />
            {t('eval.tabs.datasets')}
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5">
            <FlaskConical className="h-4 w-4" />
            {t('eval.tabs.runs')}
          </TabsTrigger>
        </TabsList>

        {/* ========== DATASETS TAB ========== */}
        <TabsContent value="datasets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('eval.datasets.title')}</h2>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t('eval.datasets.create')}
            </Button>
          </div>

          <Card>
            <CardContent className="px-0">
              {datasetsQ.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('eval.datasets.loading')}
                </div>
              ) : datasetsQ.isError ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-sm text-destructive">
                    {datasetsQ.error instanceof Error
                      ? datasetsQ.error.message
                      : t('eval.datasets.messages.createFailed')}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => datasetsQ.refetch()}>
                    {t('retry')}
                  </Button>
                </div>
              ) : datasets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Database className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('eval.datasets.empty')}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('eval.datasets.create')}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">{t('eval.datasets.table.name')}</th>
                        <th className="px-4 py-2 font-medium">
                          {t('eval.datasets.table.description')}
                        </th>
                        <th className="px-4 py-2 font-medium">{t('eval.datasets.table.items')}</th>
                        <th className="px-4 py-2 font-medium">
                          {t('eval.datasets.table.createdAt')}
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          {t('eval.datasets.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets.map((ds: Dataset) => (
                        <tr key={ds.name} className="text-xs hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{ds.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {ds.description || '—'}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {ds.item_count ?? ds.items.length}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {ds.created_at ? timeFmt(ds.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setViewDataset(ds)}
                                aria-label={t('eval.datasets.view')}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteName(ds.name)}
                                aria-label={t('eval.datasets.delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== RUNS TAB ========== */}
        <TabsContent value="runs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('eval.runs.title')}</h2>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateRunOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              {t('eval.runs.create')}
            </Button>
          </div>

          <Card>
            <CardContent className="px-0">
              {runsQ.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('eval.runs.loading')}
                </div>
              ) : runsQ.isError ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-sm text-destructive">
                    {runsQ.error instanceof Error
                      ? runsQ.error.message
                      : t('eval.runs.messages.loadFailed')}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => runsQ.refetch()}>
                    {t('retry')}
                  </Button>
                </div>
              ) : runs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('eval.runs.empty')}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setCreateRunOpen(true)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {t('eval.runs.create')}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.id')}</th>
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.dataset')}</th>
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.model')}</th>
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.prompt')}</th>
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.avgScore')}</th>
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.duration')}</th>
                        <th className="px-4 py-2 font-medium">{t('eval.runs.table.createdAt')}</th>
                        <th className="px-4 py-2 text-right font-medium">
                          {t('eval.runs.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run: EvalRun) => (
                        <tr key={run.id} className="text-xs hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">
                            {run.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{run.dataset_name}</td>
                          <td className="px-4 py-2.5">{run.model}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{run.prompt_name}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${scoreCls(run.avg_score)}`}
                            >
                              {(run.avg_score * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                            {durationFmt(run.total_duration_ms)}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {timeFmt(run.created_at)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setViewRun(run)}
                                aria-label={t('eval.runs.view')}
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== CREATE DATASET DIALOG ========== */}
      <CreateDatasetDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={invalidate} />

      {/* ========== VIEW DATASET DIALOG ========== */}
      <Dialog open={viewDataset !== null} onOpenChange={(v) => !v && setViewDataset(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              {t('eval.datasets.detail.title')}
            </DialogTitle>
          </DialogHeader>
          {viewDataset && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{viewDataset.name}</p>
                {viewDataset.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{viewDataset.description}</p>
                )}
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {viewDataset.items.map((item: DatasetItem, i: number) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3 text-xs">
                    <p className="mb-1 font-medium text-muted-foreground">
                      {t('eval.datasets.detail.item', { index: i + 1 })}
                    </p>
                    <p className="mb-1">
                      <span className="text-muted-foreground">
                        {t('eval.datasets.detail.input')}:
                      </span>{' '}
                      {item.input}
                    </p>
                    {item.expected_output && (
                      <p>
                        <span className="text-muted-foreground">
                          {t('eval.datasets.detail.expectedOutput')}:
                        </span>{' '}
                        {item.expected_output}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setViewDataset(null)}>
              {t('eval.datasets.detail.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== DELETE CONFIRM DIALOG ========== */}
      <Dialog open={deleteName !== null} onOpenChange={(v) => !v && setDeleteName(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('eval.datasets.delete')}</DialogTitle>
            <DialogDescription>
              {deleteName ? t('eval.datasets.messages.deleteConfirm', { name: deleteName }) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteName(null)}
              disabled={deleteMut.isPending}
            >
              {t('eval.datasets.form.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() => deleteName && deleteMut.mutate(deleteName)}
            >
              {deleteMut.isPending ? t('eval.datasets.loading') : t('eval.datasets.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CREATE RUN DIALOG ========== */}
      <CreateRunDialog
        open={createRunOpen}
        onOpenChange={setCreateRunOpen}
        onSuccess={invalidate}
        datasets={datasets.map((d: Dataset) => d.name)}
      />

      {/* ========== VIEW RUN DETAIL DIALOG ========== */}
      <RunDetailDialog run={viewRun} onClose={() => setViewRun(null)} />
    </div>
  )
}

/* ======================================================================
   CreateDatasetDialog
   ====================================================================== */

interface CreateDatasetDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

interface FormItem {
  input: string
  expectedOutput: string
}

function CreateDatasetDialog({ open, onOpenChange, onSuccess }: CreateDatasetDialogProps) {
  const t = useTranslations('models')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [items, setItems] = React.useState<FormItem[]>([{ input: '', expectedOutput: '' }])
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setName('')
    setDescription('')
    setItems([{ input: '', expectedOutput: '' }])
  }, [open])

  const updateItem = (i: number, field: keyof FormItem, value: string) => {
    setItems((prev) => {
      const next = prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it))
      return next
    })
  }

  const addItem = () => {
    setItems((prev) => [...prev, { input: '', expectedOutput: '' }])
  }

  const removeItem = (i: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(t('eval.datasets.messages.createFailed'))
      return
    }
    const validItems = items
      .map((it) => ({
        input: it.input.trim(),
        expected_output: it.expectedOutput.trim() || undefined,
      }))
      .filter((it) => it.input)
    if (validItems.length === 0) {
      toast.error(t('eval.datasets.messages.createFailed'))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetchApi<{ name: string }>('/api/v1/ai/eval/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          items: validItems,
        }),
      })
      if (!res.success) {
        throw new Error(res.error || t('eval.datasets.messages.createFailed'))
      }
      toast.success(t('eval.datasets.messages.createSuccess'))
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('eval.datasets.messages.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            {t('eval.datasets.create')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ds-name" className="text-xs">
              {t('eval.datasets.form.name')}
            </Label>
            <Input
              id="ds-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('eval.datasets.form.namePlaceholder')}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-desc" className="text-xs">
              {t('eval.datasets.form.description')}
            </Label>
            <Input
              id="ds-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('eval.datasets.form.descriptionPlaceholder')}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t('eval.datasets.form.items')}</Label>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {items.map((item, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {t('eval.datasets.detail.item', { index: i + 1 })}
                    </span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(i)}
                        aria-label={t('eval.datasets.delete')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <textarea
                    value={item.input}
                    onChange={(e) => updateItem(i, 'input', e.target.value)}
                    placeholder={t('eval.datasets.form.inputPlaceholder')}
                    className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                    rows={2}
                  />
                  <textarea
                    value={item.expectedOutput}
                    onChange={(e) => updateItem(i, 'expectedOutput', e.target.value)}
                    placeholder={t('eval.datasets.form.expectedOutputPlaceholder')}
                    className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                    rows={2}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={addItem}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('eval.datasets.form.addItem')}
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('eval.datasets.form.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? t('eval.datasets.loading') : t('eval.datasets.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ======================================================================
   CreateRunDialog
   ====================================================================== */

interface CreateRunDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
  datasets: string[]
}

function CreateRunDialog({ open, onOpenChange, onSuccess, datasets }: CreateRunDialogProps) {
  const t = useTranslations('models')
  const [datasetName, setDatasetName] = React.useState('')
  const [model, setModel] = React.useState('')
  const [promptName, setPromptName] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setDatasetName(datasets[0] ?? '')
    setModel('')
    setPromptName('')
  }, [open, datasets])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!datasetName.trim() || !model.trim() || !promptName.trim()) {
      toast.error(t('eval.runs.messages.createFailed'))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetchApi<EvalRun>('/api/v1/ai/eval/runs', {
        method: 'POST',
        body: JSON.stringify({
          dataset_name: datasetName.trim(),
          model: model.trim(),
          prompt_name: promptName.trim(),
        }),
      })
      if (!res.success) {
        throw new Error(res.error || t('eval.runs.messages.createFailed'))
      }
      toast.success(t('eval.runs.messages.createSuccess'))
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('eval.runs.messages.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            {t('eval.runs.create')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="run-dataset" className="text-xs">
              {t('eval.runs.form.datasetName')}
            </Label>
            <Input
              id="run-dataset"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder={t('eval.runs.form.datasetNamePlaceholder')}
              className="h-9"
            />
            {datasets.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {t('eval.runs.form.datasetName')}: {datasets.join(', ')}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="run-model" className="text-xs">
              {t('eval.runs.form.model')}
            </Label>
            <Input
              id="run-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('eval.runs.form.modelPlaceholder')}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="run-prompt" className="text-xs">
              {t('eval.runs.form.promptName')}
            </Label>
            <Input
              id="run-prompt"
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              placeholder={t('eval.runs.form.promptNamePlaceholder')}
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('eval.runs.form.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  {t('eval.runs.form.running')}
                </>
              ) : (
                t('eval.runs.form.submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ======================================================================
   RunDetailDialog
   ====================================================================== */

interface RunDetailDialogProps {
  run: EvalRun | null
  onClose: () => void
}

function RunDetailDialog({ run, onClose }: RunDetailDialogProps) {
  const t = useTranslations('models')
  const [detail, setDetail] = React.useState<EvalRun | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!run) {
      setDetail(null)
      return
    }
    setLoading(true)
    fetchApi<EvalRun>(`/api/v1/ai/eval/runs/${run.id}`)
      .then((res) => {
        if (res.success && res.data) {
          setDetail(res.data)
        } else {
          setDetail(null)
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [run])

  return (
    <Dialog
      open={run !== null}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('eval.runs.detail.title')}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('eval.runs.loading')}
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {/* summary */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                {t('eval.runs.detail.summary')}
              </h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    {t('eval.runs.detail.avgScore')}
                  </p>
                  <p className="mt-0.5 text-lg font-bold">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${scoreCls(detail.avg_score)}`}
                    >
                      {(detail.avg_score * 100).toFixed(0)}%
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    {t('eval.runs.detail.totalDuration')}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-lg font-bold">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {durationFmt(detail.total_duration_ms)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('eval.runs.table.model')}</p>
                  <p className="mt-0.5 text-sm font-medium">{detail.model}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    {t('eval.runs.table.dataset')}
                  </p>
                  <p className="mt-0.5 text-sm font-medium">{detail.dataset_name}</p>
                </div>
              </div>
            </div>

            {/* items */}
            <div>
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                {t('eval.runs.detail.items')} ({detail.results?.length ?? 0})
              </h4>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {(detail.results ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {t('eval.runs.empty')}
                  </p>
                ) : (
                  (detail.results ?? []).map((result: EvalRunResult, i: number) => (
                    <div key={i} className="rounded-lg border border-border/60 p-3 text-xs">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-medium text-muted-foreground">
                          {t('eval.runs.detail.item', { index: i + 1 })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${scoreCls(result.score)}`}
                          >
                            {(result.score * 100).toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {durationFmt(result.duration_ms)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p>
                          <span className="text-muted-foreground">
                            {t('eval.runs.detail.input')}:
                          </span>{' '}
                          {result.input}
                        </p>
                        {result.expected_output && (
                          <p>
                            <span className="text-muted-foreground">
                              {t('eval.runs.detail.expectedOutput')}:
                            </span>{' '}
                            {result.expected_output}
                          </p>
                        )}
                        {result.actual_output && (
                          <p>
                            <span className="text-muted-foreground">
                              {t('eval.runs.detail.actualOutput')}:
                            </span>{' '}
                            {result.actual_output}
                          </p>
                        )}
                        {result.error && (
                          <p className="text-destructive">
                            <span className="text-muted-foreground">
                              {t('eval.runs.detail.error')}:
                            </span>{' '}
                            {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('eval.runs.messages.loadFailed')}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('eval.runs.detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
