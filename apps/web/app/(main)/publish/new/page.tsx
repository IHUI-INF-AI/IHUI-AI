'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Upload, Send, Clock, Zap } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui'

interface Account {
  id: string
  platform: string
  nickname: string
  status: 'active' | 'disabled' | 'expired'
}

const FORMATS = ['md', 'docx', 'html', 'pdf', 'image', 'video'] as const
type Format = (typeof FORMATS)[number]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function NewPublishPage() {
  const t = useTranslations('publish')
  const toast = useToast()
  const router = useRouter()
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [title, setTitle] = React.useState('')
  const [format, setFormat] = React.useState<Format>('md')
  const [textContent, setTextContent] = React.useState('')
  const [filePath, setFilePath] = React.useState('')
  const [coverPath, setCoverPath] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [scheduleMode, setScheduleMode] = React.useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ items?: Account[]; list?: Account[] } | Account[]>(
          '/api/publish/accounts/me',
        )
        const list = Array.isArray(data) ? data : (data.items ?? data.list ?? [])
        setAccounts(list.filter((a) => a.status === 'active'))
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
  }, [toast])

  const platformMap = React.useMemo(() => {
    const m = new Map<string, Account[]>()
    accounts.forEach((a) => {
      const arr = m.get(a.platform) ?? []
      arr.push(a)
      m.set(a.platform, arr)
    })
    return m
  }, [accounts])

  function togglePlatform(p: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(platformMap.keys()))
  }
  function clearAll() {
    setSelected(new Set())
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const file = e.target.files?.[0]
    if (!file) return
    setter(file.name)
    e.target.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error(t('new.titlePlaceholder'))
      return
    }
    if (selected.size === 0) {
      toast.error(t('new.selectPlatformsHint'))
      return
    }
    if (scheduleMode === 'schedule' && !scheduledAt) {
      toast.error(t('new.scheduleAt'))
      return
    }

    setSubmitting(true)
    try {
      const content: Record<string, unknown> = {}
      if (format === 'md' || format === 'html') content.text = textContent
      else content.file_path = filePath || ''
      if (coverPath) content.cover_path = coverPath

      const targets = Array.from(selected).flatMap((p) =>
        (platformMap.get(p) ?? []).map((a) => ({ platform: p, account_id: a.id, config: {} })),
      )

      const body = JSON.stringify({
        title: title.trim(),
        format,
        content,
        targets,
        scheduled_at: scheduleMode === 'schedule' ? new Date(scheduledAt).toISOString() : undefined,
      })
      await api('/api/publish/tasks', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })
      toast.success(t('new.submitSuccess'))
      router.push('/publish/history')
    } catch (e) {
      toast.error(t('new.submitFailed'), (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const isTextFormat = format === 'md' || format === 'html'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('new.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('new.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>{t('new.titleField')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('new.titlePlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('new.contentFormat')}</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`new.contentFormat${f.charAt(0).toUpperCase()}${f.slice(1)}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isTextFormat ? t('new.contentText') : t('new.uploadFile')}</Label>
            {isTextFormat ? (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                placeholder={t('new.contentTextPlaceholder')}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground transition-colors hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>{filePath || t('new.uploadFileHint')}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFile(e, setFilePath)}
                  />
                </label>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t('new.uploadFileHint')}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('new.coverImage')}</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span>{coverPath || t('new.coverImage')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e, setCoverPath)}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Label>{t('new.selectPlatforms')}</Label>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={selectAll} className="text-primary hover:underline">
                {t('new.selectAll')}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-muted-foreground hover:underline"
              >
                {t('new.clearAll')}
              </button>
            </div>
          </div>
          {platformMap.size === 0 ? (
            <p className="text-xs text-muted-foreground">{t('accounts.noAccounts')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from(platformMap.keys()).map((p) => {
                const checked = selected.has(p)
                return (
                  <label
                    key={p}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      checked
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => togglePlatform(p)} />
                    <span>{t(`platforms.${p}`)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      ×{platformMap.get(p)?.length}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Label>{t('new.schedule')}</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode('now')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
                scheduleMode === 'now'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              <Zap className="h-4 w-4" />
              {t('new.submitNow')}
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('schedule')}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
                scheduleMode === 'schedule'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              <Clock className="h-4 w-4" />
              {t('new.submitSchedule')}
            </button>
          </div>
          {scheduleMode === 'schedule' && (
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting
            ? t('new.submitting')
            : scheduleMode === 'now'
              ? t('new.submitNow')
              : t('new.submitSchedule')}
        </Button>
      </div>
    </form>
  )
}
