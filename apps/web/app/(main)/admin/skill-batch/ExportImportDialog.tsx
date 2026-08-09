'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Download, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import type { UserSkill, ImportResult } from './types'
import { exportSkillsAsJson, importSkillsFromJson } from './helpers'

interface ExportImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skills: UserSkill[]
  onImported: () => void
}

export function ExportImportDialog({ open, onOpenChange, skills, onImported }: ExportImportDialogProps) {
  const t = useTranslations('admin.skillBatch')
  const [tab, setTab] = React.useState<'export' | 'import'>('export')
  const [importing, setImporting] = React.useState(false)
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null)
  const [progress, setProgress] = React.useState({ current: 0, total: 0 })
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleExport = () => {
    exportSkillsAsJson(skills)
    toast.success(t('exportSuccess'))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setProgress({ current: 0, total: 0 })
    try {
      const result = await importSkillsFromJson(file, (current, total) => {
        setProgress({ current, total })
      })
      setImportResult(result)
      if (result.failed === 0) {
        toast.success(t('importSuccess', { count: result.success }))
        onImported()
      } else {
        toast.error(t('importPartial', { success: result.success, failed: result.failed }))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('exportImportTitle')}</DialogTitle>
          <DialogDescription>{t('exportImportDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-md bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab('export')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'export' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Download className="h-4 w-4" />
            {t('exportTab')}
          </button>
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'import' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="h-4 w-4" />
            {t('importTab')}
          </button>
        </div>

        {tab === 'export' ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('exportHint', { count: skills.length })}</p>
            <Button onClick={handleExport} disabled={skills.length === 0} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {t('exportButton')} ({skills.length})
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('importHint')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              disabled={importing}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            />
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('importingProgress', { current: progress.current, total: progress.total })}
              </div>
            )}
            {importResult && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  {t('importSuccess', { count: importResult.success })}
                </div>
                {importResult.failed > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      {t('importFailed', { count: importResult.failed })}
                    </div>
                    <ul className="mt-1 max-h-24 overflow-y-auto space-y-0.5 pl-6 text-xs text-muted-foreground list-disc">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}