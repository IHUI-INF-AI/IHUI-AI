'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  PackagePlus,
  Pencil,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@ihui/ui-react'
import { fetchUserSkills, fetchMarketSkills, batchInstallSkills, batchDeleteSkills, batchUpdateSkills } from './helpers'
import { ExportImportDialog } from './ExportImportDialog'
import type { UserSkill, SkillMarketEntry, BatchUpdateForm } from './types'

type Tab = 'market' | 'user'

export function BatchOperations() {
  const t = useTranslations('admin.skillBatch')
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<Tab>('market')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [showExportImport, setShowExportImport] = React.useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = React.useState(false)
  const [updateForm, setUpdateForm] = React.useState<BatchUpdateForm>({ version: '', tags: '' })
  const [batchRunning, setBatchRunning] = React.useState(false)
  const [batchResult, setBatchResult] = React.useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const [progress, setProgress] = React.useState({ current: 0, total: 0 })

  const { data: userSkillsData, isLoading: userLoading } = useQuery({
    queryKey: ['admin', 'skills', 'user'],
    queryFn: fetchUserSkills,
  })

  const { data: marketSkillsData, isLoading: marketLoading } = useQuery({
    queryKey: ['admin', 'skills', 'market'],
    queryFn: fetchMarketSkills,
  })

  const userSkills = React.useMemo(() => userSkillsData?.skills ?? [], [userSkillsData])
  const marketSkills = marketSkillsData?.items ?? []

  const userSkillNames = React.useMemo(() => new Set(userSkills.map((s) => s.name)), [userSkills])
  const currentItems = tab === 'market' ? marketSkills : userSkills
  const isLoading = tab === 'market' ? marketLoading : userLoading

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === currentItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(currentItems.map((item) => item.name)))
    }
  }

  const resetBatch = () => {
    setBatchResult(null)
    setProgress({ current: 0, total: 0 })
    setSelected(new Set())
    setBatchRunning(false)
  }

  const handleBatchInstall = async () => {
    const names = [...selected]
    if (names.length === 0) return
    setBatchRunning(true)
    setBatchResult(null)
    setProgress({ current: 0, total: names.length })
    const result = await batchInstallSkills(names, (current, _total) => {
      setProgress({ current, total: names.length })
    })
    setBatchResult(result)
    if (result.failed === 0) {
      toast.success(t('batchInstallSuccess', { count: result.success }))
    } else {
      toast.error(t('batchInstallPartial', { success: result.success, failed: result.failed }))
    }
    qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
  }

  const handleBatchDelete = async () => {
    const names = [...selected]
    if (names.length === 0) return
    setBatchRunning(true)
    setBatchResult(null)
    setProgress({ current: 0, total: names.length })
    const result = await batchDeleteSkills(names, (current, _total) => {
      setProgress({ current, total: names.length })
    })
    setBatchResult(result)
    if (result.failed === 0) {
      toast.success(t('batchDeleteSuccess', { count: result.success }))
    } else {
      toast.error(t('batchDeletePartial', { success: result.success, failed: result.failed }))
    }
    qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
  }

  const handleBatchUpdate = async () => {
    const names = [...selected]
    if (names.length === 0) return
    setShowUpdateDialog(false)
    setBatchRunning(true)
    setBatchResult(null)
    setProgress({ current: 0, total: names.length })
    const result = await batchUpdateSkills(names, updateForm, userSkills, (current, _total) => {
      setProgress({ current, total: names.length })
    })
    setBatchResult(result)
    if (result.failed === 0) {
      toast.success(t('batchUpdateSuccess', { count: result.success }))
    } else {
      toast.error(t('batchUpdatePartial', { success: result.success, failed: result.failed }))
    }
    qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md bg-muted p-1">
          <button
            type="button"
            onClick={() => { setTab('market'); setSelected(new Set()); setBatchResult(null) }}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'market' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('marketTab')}
          </button>
          <button
            type="button"
            onClick={() => { setTab('user'); setSelected(new Set()); setBatchResult(null) }}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'user' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('userTab')}
          </button>
        </div>

        <div className="flex-1" />

        {tab === 'market' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleBatchInstall}
                    disabled={selected.size === 0 || batchRunning}
                  >
                    {batchRunning ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {t('batchInstall')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('batchInstallTooltip')}</TooltipContent>
            </Tooltip>
          )}
          {tab === 'user' && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBatchDelete}
                      disabled={selected.size === 0 || batchRunning}
                    >
                      {batchRunning ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {t('batchDelete')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('batchDeleteTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowUpdateDialog(true)}
                      disabled={selected.size === 0 || batchRunning}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      {t('batchUpdate')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('batchUpdateTooltip')}</TooltipContent>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowExportImport(true)}
                  disabled={batchRunning}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('exportImport')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('exportImportTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
                    toast.success(t('refreshed'))
                  }}
                  disabled={batchRunning}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('refreshTooltip')}</TooltipContent>
          </Tooltip>
        </div>

      {batchRunning && (
        <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('progress', { current: progress.current, total: progress.total })}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                backgroundColor:
                  progress.total > 0 && progress.current / progress.total <= 0.3
                    ? 'var(--color-destructive)'
                    : progress.total > 0 && progress.current / progress.total <= 0.7
                      ? 'var(--color-warning)'
                      : 'var(--color-primary)',
              }}
            />
          </div>
        </div>
      )}

      {batchResult && !batchRunning && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            {t('batchSuccess', { count: batchResult.success })}
          </span>
          {batchResult.failed > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-4 w-4" />
              {t('batchFailed', { count: batchResult.failed })}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={resetBatch} className="ml-auto text-xs">
            {t('dismiss')}
          </Button>
        </div>
      )}

      {batchResult && !batchRunning && batchResult.errors.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-md border bg-destructive/5 p-2 text-xs text-destructive">
          {batchResult.errors.map((err, i) => (
            <div key={i} className="py-0.5">{err}</div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tab === 'market' ? t('marketTitle') : t('userTitle')}
          </CardTitle>
          <CardDescription>
            {t('selectedCount', { count: selected.size })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : currentItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {tab === 'market' ? t('noMarketSkills') : t('noUserSkills')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === currentItems.length && currentItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label={t('selectAll')}
                    />
                  </TableHead>
                  <TableHead>{t('nameColumn')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('descriptionColumn')}</TableHead>
                  <TableHead className="hidden md:table-cell w-24">{t('versionColumn')}</TableHead>
                  {tab === 'market' && (
                    <TableHead className="hidden md:table-cell w-20">{t('installsColumn')}</TableHead>
                  )}
                  {tab === 'user' && (
                    <TableHead className="hidden md:table-cell w-20">{t('sourceColumn')}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tab === 'market' ? marketSkills : userSkills).map((item) => {
                  const name = item.name
                  const isInstalled = userSkillNames.has(name)
                  return (
                    <TableRow
                      key={name}
                      className={selected.has(name) ? 'bg-primary/5' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(name)}
                          onCheckedChange={() => toggleSelect(name)}
                          disabled={tab === 'market' && isInstalled}
                          aria-label={name}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[160px]">{name}</span>
                          {tab === 'market' && isInstalled && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {t('installed')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[240px] truncate">
                        {'description' in item ? (item as SkillMarketEntry).description : (item as UserSkill).description}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {item.version}
                      </TableCell>
                      {tab === 'market' && (
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {(item as SkillMarketEntry).installCount}
                        </TableCell>
                      )}
                      {tab === 'user' && (
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {(item as UserSkill).source}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('updateDialogTitle')}</DialogTitle>
            <DialogDescription>{t('updateDialogDesc', { count: selected.size })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-version">{t('versionLabel')}</Label>
              <Input
                id="batch-version"
                value={updateForm.version}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, version: e.target.value }))}
                placeholder={t('versionPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-tags">{t('tagsLabel')}</Label>
              <Input
                id="batch-tags"
                value={updateForm.tags}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder={t('tagsPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleBatchUpdate} disabled={!updateForm.version && !updateForm.tags}>
              {t('confirmUpdate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportImportDialog
        open={showExportImport}
        onOpenChange={setShowExportImport}
        skills={userSkills}
        onImported={() => qc.invalidateQueries({ queryKey: ['admin', 'skills'] })}
      />
    </div>
  )
}