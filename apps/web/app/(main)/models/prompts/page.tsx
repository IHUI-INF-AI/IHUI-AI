'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  History,
  RotateCcw,
  Trash2,
  Eye,
  Edit3,
  Search,
  Loader2,
  X,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Badge,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'

interface PromptSummary {
  name: string
  description: string | null
  latest_version: number
  updated_at: string
  created_at: string
}

interface PromptVersion {
  version: number
  content: string
  description: string | null
  created_at: string
}

interface PromptDetail {
  name: string
  description: string | null
  latest_version: number
  versions: PromptVersion[]
  created_at: string
  updated_at: string
}

interface PromptContent {
  name: string
  version: number
  content: string
}

const textareaCls =
  'flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export default function PromptsPage() {
  const t = useTranslations('models')

  const [prompts, setPrompts] = React.useState<PromptSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')

  // Create / Edit dialog
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingName, setEditingName] = React.useState<string | null>(null)
  const [formName, setFormName] = React.useState('')
  const [formContent, setFormContent] = React.useState('')
  const [formDesc, setFormDesc] = React.useState('')
  const [formErr, setFormErr] = React.useState<string | null>(null)
  const [formSaving, setFormSaving] = React.useState(false)

  // View detail dialog
  const [viewOpen, setViewOpen] = React.useState(false)
  const [viewName, setViewName] = React.useState('')
  const [viewVersions, setViewVersions] = React.useState<PromptVersion[]>([])
  const [viewVersion, setViewVersion] = React.useState(1)
  const [viewContent, setViewContent] = React.useState('')
  const [viewLoading, setViewLoading] = React.useState(false)

  // Version history sheet
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyName, setHistoryName] = React.useState('')
  const [historyVersions, setHistoryVersions] = React.useState<PromptVersion[]>([])
  const [historyLatest, setHistoryLatest] = React.useState(1)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [rollbackTarget, setRollbackTarget] = React.useState<number | null>(null)
  const [rollbackPending, setRollbackPending] = React.useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)

  const filtered = React.useMemo(
    () =>
      search.trim()
        ? prompts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        : prompts,
    [prompts, search],
  )

  React.useEffect(() => {
    loadPrompts()
  }, [])

  async function loadPrompts() {
    setLoading(true)
    setError(null)
    const res = await fetchApi<PromptSummary[]>('/api/prompts')
    if (res.success) {
      setPrompts(res.data)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  async function loadDetail(name: string) {
    const res = await fetchApi<PromptDetail>(`/api/prompts/${encodeURIComponent(name)}`)
    if (res.success) {
      return res.data
    }
    throw new Error(res.error)
  }

  async function loadContent(name: string, version: number): Promise<string> {
    const res = await fetchApi<PromptContent>(
      `/api/prompts/${encodeURIComponent(name)}/content?version=${version}`,
    )
    if (res.success) {
      return res.data.content
    }
    throw new Error(res.error)
  }

  function openCreate() {
    setEditingName(null)
    setFormName('')
    setFormContent('')
    setFormDesc('')
    setFormErr(null)
    setFormOpen(true)
  }

  async function openEdit(p: PromptSummary) {
    try {
      const detail = await loadDetail(p.name)
      setEditingName(p.name)
      setFormName(p.name)
      setFormContent(detail.versions[detail.versions.length - 1]?.content ?? '')
      setFormDesc(detail.versions[detail.versions.length - 1]?.description ?? '')
      setFormErr(null)
      setFormOpen(true)
    } catch {
      toast.error(t('prompts.messages.loadFailed'))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!formName.trim()) {
      setFormErr(t('prompts.form.nameRequired'))
      return
    }
    if (!formContent.trim()) {
      setFormErr(t('prompts.form.contentRequired'))
      return
    }
    setFormSaving(true)
    try {
      if (editingName) {
        const res = await fetchApi(`/api/prompts/${encodeURIComponent(editingName)}`, {
          method: 'PUT',
          body: JSON.stringify({ content: formContent.trim(), description: formDesc.trim() || undefined }),
        })
        if (res.success) {
          toast.success(t('prompts.messages.updateSuccess'))
          setFormOpen(false)
          loadPrompts()
        } else {
          setFormErr(res.error)
        }
      } else {
        const res = await fetchApi('/api/prompts', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            content: formContent.trim(),
            description: formDesc.trim() || undefined,
          }),
        })
        if (res.success) {
          toast.success(t('prompts.messages.createSuccess'))
          setFormOpen(false)
          loadPrompts()
        } else {
          setFormErr(res.error)
        }
      }
    } catch {
      setFormErr(t('prompts.messages.createFailed'))
    }
    setFormSaving(false)
  }

  async function openView(name: string) {
    setViewName(name)
    setViewOpen(true)
    setViewLoading(true)
    try {
      const detail = await loadDetail(name)
      setViewVersions(detail.versions)
      const latest = detail.versions[detail.versions.length - 1]
      const ver = latest?.version ?? 1
      setViewVersion(ver)
      const content = await loadContent(name, ver)
      setViewContent(content)
    } catch {
      toast.error(t('prompts.messages.loadFailed'))
    }
    setViewLoading(false)
  }

  async function handleViewVersionChange(ver: number) {
    setViewVersion(ver)
    setViewLoading(true)
    try {
      const content = await loadContent(viewName, ver)
      setViewContent(content)
    } catch {
      toast.error(t('prompts.messages.loadFailed'))
    }
    setViewLoading(false)
  }

  async function openHistory(name: string) {
    setHistoryName(name)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const detail = await loadDetail(name)
      setHistoryVersions(detail.versions)
      setHistoryLatest(detail.latest_version)
    } catch {
      toast.error(t('prompts.messages.loadFailed'))
    }
    setHistoryLoading(false)
  }

  async function handleRollback(version: number) {
    setRollbackTarget(version)
  }

  async function confirmRollback() {
    if (rollbackTarget === null) return
    setRollbackPending(true)
    try {
      const res = await fetchApi(
        `/api/prompts/${encodeURIComponent(historyName)}/rollback`,
        { method: 'POST', body: JSON.stringify({ target_version: rollbackTarget }) },
      )
      if (res.success) {
        toast.success(t('prompts.history.rollbackSuccess'))
        setHistoryOpen(false)
        setRollbackTarget(null)
        loadPrompts()
      } else {
        toast.error(t('prompts.history.rollbackFailed'))
      }
    } catch {
      toast.error(t('prompts.history.rollbackFailed'))
    }
    setRollbackPending(false)
  }

  function handleDelete(name: string) {
    setDeleteTarget(name)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeletePending(true)
    const res = await fetchApi(`/api/prompts/${encodeURIComponent(deleteTarget)}`, {
      method: 'DELETE',
    })
    if (res.success) {
      toast.success(t('prompts.messages.deleteSuccess'))
      setDeleteTarget(null)
      loadPrompts()
    } else {
      toast.error(t('prompts.messages.deleteFailed'))
    }
    setDeletePending(false)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 px-4 py-6">
        <BackButton />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('prompts.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('prompts.subtitle')}</p>
          </div>
          <Button className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('prompts.create')}
          </Button>
        </div>

        <Card>
          <CardContent className="flex items-center gap-2 p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('prompts.searchPlaceholder')}
              className="h-9 flex-1 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              {t('prompts.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">{t('prompts.loading')}</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <p className="text-sm text-destructive">{t('prompts.messages.loadFailed')}</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={loadPrompts}>
                  {t('prompts.create')}
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('prompts.empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">{t('prompts.table.name')}</th>
                      <th className="px-4 py-2 font-medium">{t('prompts.table.description')}</th>
                      <th className="px-4 py-2 font-medium">{t('prompts.table.latestVersion')}</th>
                      <th className="px-4 py-2 font-medium">{t('prompts.table.updatedAt')}</th>
                      <th className="px-4 py-2 font-medium text-right">{t('prompts.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.name} className="text-xs hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                          {p.description ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px]">
                            v{p.latest_version}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {new Date(p.updated_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                  onClick={() => openView(p.name)}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t('prompts.view')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                  onClick={() => openEdit(p)}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t('prompts.edit')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                  onClick={() => openHistory(p.name)}
                                >
                                  <History className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t('prompts.history')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:text-rose-500"
                                  onClick={() => handleDelete(p.name)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t('prompts.delete')}</TooltipContent>
                            </Tooltip>
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
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(o: boolean) => !o && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editingName ? t('prompts.edit') : t('prompts.create')}
              </DialogTitle>
            </DialogHeader>
            {formErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formErr}
              </div>
            )}
            {!editingName && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('prompts.form.name')}</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('prompts.form.namePlaceholder')}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('prompts.form.content')}</label>
              <textarea
                className={textareaCls}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={t('prompts.form.contentPlaceholder')}
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('prompts.form.description')}</label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder={t('prompts.form.descriptionPlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={formSaving}
              >
                {t('prompts.form.cancel')}
              </Button>
              <Button type="submit" disabled={formSaving}>
                {formSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('prompts.form.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={viewOpen} onOpenChange={(o: boolean) => !o && setViewOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('prompts.detail.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{viewName}</span>
              {viewVersions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('prompts.detail.version', { version: '' })}
                  </span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    value={viewVersion}
                    onChange={(e) => handleViewVersionChange(Number(e.target.value))}
                  >
                    {viewVersions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <span className="text-sm font-medium">{t('prompts.detail.content')}</span>
              {viewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                  <code>{viewContent}</code>
                </pre>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              {t('prompts.detail.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Sheet */}
      <Sheet open={historyOpen} onOpenChange={(o: boolean) => !o && setHistoryOpen(false)}>
        <SheetContent className="w-[90vw] max-w-md sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('prompts.history.title')}
              <span className="text-sm font-normal text-muted-foreground">- {historyName}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-3 py-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyVersions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('prompts.empty')}</p>
            ) : (
              [...historyVersions].reverse().map((v) => {
                const isCurrent = v.version === historyLatest
                return (
                  <Card key={v.version} className={isCurrent ? 'border-primary/30' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {t('prompts.history.version', { version: v.version })}
                            </span>
                            {isCurrent && (
                              <Badge variant="default" className="text-[10px]">
                                {t('prompts.history.current')}
                              </Badge>
                            )}
                          </div>
                          {v.description && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {v.description}
                            </p>
                          )}
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {new Date(v.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!isCurrent && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 gap-1 text-xs"
                                onClick={() => handleRollback(v.version)}
                              >
                                <RotateCcw className="h-3 w-3" />
                                {t('prompts.rollback')}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('prompts.history.rollbackConfirm', { version: v.version })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Rollback Confirm Dialog */}
      <Dialog
        open={rollbackTarget !== null}
        onOpenChange={(o: boolean) => !o && setRollbackTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('prompts.history.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('prompts.history.rollbackConfirm', { version: rollbackTarget ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)} disabled={rollbackPending}>
              {t('prompts.form.cancel')}
            </Button>
            <Button onClick={confirmRollback} disabled={rollbackPending}>
              {rollbackPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('prompts.rollback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o: boolean) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('prompts.delete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('prompts.messages.deleteConfirm', { name: deleteTarget ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>
              {t('prompts.form.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePending}>
              {deletePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('prompts.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}