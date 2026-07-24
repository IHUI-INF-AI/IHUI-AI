'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Upload, FileText, AlertCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, Input } from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { cn } from '@/lib/utils'

type Mode = 'file' | 'text'

export function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations('knowledgeRag.upload')
  const tCommon = useTranslations('common')
  const qc = useQueryClient()
  const [mode, setMode] = React.useState<Mode>('file')
  const [title, setTitle] = React.useState('')
  const [text, setText] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const reset = () => {
    setTitle('')
    setText('')
    setFile(null)
    setFeedback(null)
    setMode('file')
  }

  const fileMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t('noFile'))
      const fd = new FormData()
      fd.append('file', file)
      fd.append('ownerUuid', '')
      if (title.trim()) fd.append('title', title.trim())
      const r = await fetchApi<{ chunkCount: number; docId: number }>('/api/knowledge/upload', {
        method: 'POST',
        body: fd,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['knowledgeRag', 'docs'] })
      setFeedback({ type: 'success', msg: t('success', { count: data.chunkCount }) })
      setTimeout(() => { onOpenChange(false); reset() }, 1200)
    },
    onError: (e) => setFeedback({ type: 'error', msg: e instanceof Error ? e.message : String(e) }),
  })

  const textMut = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error(t('noText'))
      const r = await fetchApi<{ chunkCount: number }>('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerUuid: '', title: title.trim() || t('defaultTitle'), text: text.trim() }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['knowledgeRag', 'docs'] })
      setFeedback({ type: 'success', msg: t('success', { count: data.chunkCount }) })
      setTimeout(() => { onOpenChange(false); reset() }, 1200)
    },
    onError: (e) => setFeedback({ type: 'error', msg: e instanceof Error ? e.message : String(e) }),
  })

  const pending = fileMut.isPending || textMut.isPending
  const canSubmit = mode === 'file' ? !!file : !!text.trim()

  const onSubmit = () => {
    if (mode === 'file') fileMut.mutate()
    else textMut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-md bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMode('file')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
              mode === 'file' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            {t('modeFile')}
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
              mode === 'text' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            {t('modeText')}
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('titleLabel')}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            className="h-9"
          />
        </div>

        {mode === 'file' ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('fileLabel')}</label>
            <div className="rounded-md border border-dashed p-4">
              <input
                type="file"
                accept=".pdf,.docx,.md,.txt,.html,.htm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground hover:file:bg-primary/90"
              />
              {file && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">{t('fileHint')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('textLabel')}</label>
            <Textarea
              value={text}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
              placeholder={t('textPlaceholder')}
              rows={6}
              maxLength={32000}
            />
            <p className="text-xs text-muted-foreground">
              {t('charCount', { count: text.length })}
            </p>
          </div>
        )}

        {feedback && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              feedback.type === 'success'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-destructive/50 bg-destructive/10 text-destructive',
            )}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{feedback.msg}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={pending || !canSubmit}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
