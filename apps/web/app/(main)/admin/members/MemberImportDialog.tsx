'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, UploadCloud, FileText, CheckCircle2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui-react'
import { type ImportResult, batchImportMembers } from './types'

export function MemberImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const t = useTranslations('admin.members.import')
  const qc = useQueryClient()
  const [file, setFile] = React.useState<File | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setFile(null)
      setErr(null)
      setResult(null)
    }
  }, [open])

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t('fileRequired'))
      return batchImportMembers(file)
    },
    onSuccess: (res) => {
      if (!res.success) {
        setErr(res.error)
        toast.error(res.error)
        return
      }
      setResult(res.data)
      toast.success(t('importSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
      onSuccess?.()
    },
    onError: (e: Error) => {
      setErr(e.message)
      toast.error(e.message)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setErr(null)
    setResult(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setResult(null)
    if (!file) {
      setErr(t('fileRequired'))
      return
    }
    uploadMut.mutate()
  }

  function close() {
    if (uploadMut.isPending) return
    onOpenChange(false)
  }

  const total = result ? result.successCount + result.failureCount : 0

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : null)}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('desc')}</p>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">{t('formatTitle')}</div>
            <code className="block whitespace-pre-wrap">{t('formatExample')}</code>
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-import-file">{t('fileLabel')}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploadMut.isPending}
              >
                <UploadCloud className="h-4 w-4" />
                {t('selectFile')}
              </Button>
              <input
                id="m-import-file"
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadMut.isPending}
              />
              {file && (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {file.name}
                </span>
              )}
            </div>
          </div>

          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span>
                  {t('total')}: <strong>{total}</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('successCount')}: <strong>{result.successCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-500">
                  <XCircle className="h-4 w-4" />
                  {t('failureCount')}: <strong>{result.failureCount}</strong>
                </span>
              </div>
              {result.resultItemList.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="px-3 py-2">{t('colSerial')}</TableHead>
                        <TableHead className="px-3 py-2">{t('colRow')}</TableHead>
                        <TableHead className="px-3 py-2">{t('colResult')}</TableHead>
                        <TableHead className="px-3 py-2">{t('colMessage')}</TableHead>
                        <TableHead className="px-3 py-2">{t('colMemberName')}</TableHead>
                        <TableHead className="px-3 py-2">{t('colMemberMobile')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                      {result.resultItemList.map((item) => (
                        <TableRow key={item.serialNum}>
                          <TableCell className="px-3 py-2">{item.serialNum}</TableCell>
                          <TableCell className="px-3 py-2">{item.rowNum}</TableCell>
                          <TableCell className="px-3 py-2">
                            {item.success ? (
                              <span className="text-emerald-600 dark:text-emerald-500">
                                {t('rowSuccess')}
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-500">
                                {t('rowFailure')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2">{item.message || '—'}</TableCell>
                          <TableCell className="px-3 py-2">{item.memberName || '—'}</TableCell>
                          <TableCell className="px-3 py-2">{item.memberMobile || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('noDetails')}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={uploadMut.isPending}>
              {t('close')}
            </Button>
            <Button type="submit" disabled={uploadMut.isPending || !file}>
              {uploadMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
