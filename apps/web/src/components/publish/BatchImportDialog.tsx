'use client'

/**
 * 批量账号导入弹窗(2026-08-01 新增)。
 *
 * 功能:
 * - 下载 CSV 模板(含 38 平台示例行)
 * - 上传 CSV 文件解析预览
 * - 批量导入账号(调 batchImportAccounts)
 * - 导入结果报告(成功/失败计数 + 错误明细)
 * - 导出所有账号为 CSV(不含凭证)
 *
 * CSV 格式:platform,nickname,credential_field1,credential_field2,credential_field3
 * AGENTS.md §4:rounded-lg / 无分割线 / subtle 配色 / 禁渐变遮罩
 */

import * as React from 'react'
import { Upload, Download, FileText, Loader2, CheckCircle2, AlertCircle, FileDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@ihui/ui-react'
import {
  batchImportAccounts,
  batchExportAccounts,
  getBatchImportTemplate,
  type BatchImportRow,
  type BatchImportResult,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'

export interface BatchImportDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSuccess?: () => void
}

type Phase = 'idle' | 'preview' | 'importing' | 'done'

function parseCsv(text: string): BatchImportRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  // 跳过表头
  const rows: BatchImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue
    // 简单 CSV 解析(支持逗号分隔,不支持引号转义)
    const cols = line.split(',').map((c) => c.trim())
    if (cols.length < 1 || !cols[0]) continue
    const platform = cols[0]!
    const nickname = cols[1] ?? ''
    const credentials: Record<string, string> = {}
    // 第 3+ 列作为凭证字段,键名用 field1/field2/field3
    for (let j = 2; j < cols.length; j++) {
      const val = cols[j]
      if (val) credentials[`field${j - 1}`] = val
    }
    rows.push({ platform, nickname, credentials })
  }
  return rows
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function BatchImportDialog({ open, onOpenChange, onSuccess }: BatchImportDialogProps) {
  const t = useTranslations('publish')
  const tCommon = useTranslations('common')
  const toast = useToast()
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [rows, setRows] = React.useState<BatchImportRow[]>([])
  const [result, setResult] = React.useState<BatchImportResult | null>(null)
  const [exporting, setExporting] = React.useState(false)

  function reset() {
    setPhase('idle')
    setRows([])
    setResult(null)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        toast.error(t('batchImport.parseError'))
        return
      }
      setRows(parsed)
      setPhase('preview')
      setResult(null)
    }
    reader.onerror = () => toast.error(t('batchImport.readError'))
    reader.readAsText(file, 'utf-8')
    // 重置 input 以便重复选择同一文件
    e.target.value = ''
  }

  async function handleDownloadTemplate() {
    try {
      const r = await getBatchImportTemplate()
      if (r.success && r.data) {
        downloadCsv('publish-accounts-template.csv', r.data.csv)
        toast.success(t('batchImport.templateDownloaded'))
      } else {
        toast.error(r.error || t('batchImport.templateFailed'))
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const r = await batchExportAccounts()
      if (r.success && r.data) {
        downloadCsv('publish-accounts-export.csv', r.data.csv)
        toast.success(t('batchImport.exportSuccess', { count: r.data.count }))
      } else {
        toast.error(r.error || t('batchImport.exportFailed'))
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  async function handleImport() {
    setPhase('importing')
    try {
      const r = await batchImportAccounts(rows)
      if (r.success && r.data) {
        setResult(r.data)
        setPhase('done')
        if (r.data.success_count > 0) {
          toast.success(t('batchImport.importSuccess', { count: r.data.success_count }))
          onSuccess?.()
        }
      } else {
        toast.error(r.error || t('batchImport.importFailed'))
        setPhase('preview')
      }
    } catch (e) {
      toast.error((e as Error).message)
      setPhase('preview')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="min-[640px]:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />{t('batchImport.title')}
          </DialogTitle>
          <DialogDescription>{t('batchImport.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {phase === 'idle' && (
            <>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4" />{t('batchImport.downloadTemplate')}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  {t('batchImport.export')}
                </Button>
              </div>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-muted/20 p-6 hover:bg-muted/40">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">{t('batchImport.selectFile')}</span>
                <span className="text-xs text-muted-foreground">CSV 格式,支持 38 平台</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
              </label>
            </>
          )}

          {phase === 'preview' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{t('batchImport.previewCount', { count: rows.length })}</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 pr-2 font-medium">#</th>
                      <th className="pb-1 pr-2 font-medium">{t('batchImport.colPlatform')}</th>
                      <th className="pb-1 pr-2 font-medium">{t('batchImport.colNickname')}</th>
                      <th className="pb-1 font-medium">{t('batchImport.colCreds')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-border/50">
                        <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-1 pr-2 font-mono">{r.platform}</td>
                        <td className="py-1 pr-2">{r.nickname || '-'}</td>
                        <td className="py-1 text-muted-foreground">{Object.keys(r.credentials).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    {t('batchImport.moreRows', { count: rows.length - 20 })}
                  </p>
                )}
              </div>
            </div>
          )}

          {phase === 'importing' && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('batchImport.importing')}</p>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {t('batchImport.successCount', { count: result.success_count })}
                  </span>
                  <span className="mx-2 text-muted-foreground">/</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {t('batchImport.failedCount', { count: result.failed_count })}
                  </span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border border-rose-500/20 bg-rose-500/5 p-2">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>第 {e.row + 1} 行:{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 min-[640px]:flex-nowrap">
          {phase === 'idle' && (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="shrink-0">
              <span className="whitespace-nowrap">{tCommon('cancel')}</span>
            </Button>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setPhase('idle'); setRows([]) }} className="shrink-0">
                <span className="whitespace-nowrap">{tCommon('back')}</span>
              </Button>
              <Button onClick={handleImport} className="shrink-0 min-w-0">
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('batchImport.confirmImport', { count: rows.length })}</span>
              </Button>
            </>
          )}
          {phase === 'done' && (
            <Button onClick={() => { reset(); onOpenChange(false) }} className="shrink-0">
              <span className="whitespace-nowrap">{tCommon('close')}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
