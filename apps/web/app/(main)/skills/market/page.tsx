'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search, Star, Loader2, ChevronLeft, ChevronRight, Download, Check, Upload, Bell, BellRing } from 'lucide-react'
import { Card, CardContent, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { SkillMarketEntry, SkillNotification } from '@ihui/shared/skills/market'
import {
  fetchSkillsMarket,
  fetchSkillRatings,
  installSkill,
  rateSkill,
  publishSkill,
  subscribeSkill,
  unsubscribeSkill,
  fetchSkillSubscription,
  fetchSkillNotifications,
  markSkillNotificationsRead,
  SKILL_MARKET_PAGE_SIZE,
} from '@/lib/skills-market-api'

const TAGS = ['code', 'content', 'devops', 'design', 'media', 'video', 'ai', 'docs']

export default function SkillsMarketPage() {
  const t = useTranslations('skills.market')
  const qc = useQueryClient()
  const [q, setQ] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [installed, setInstalled] = React.useState<Set<string>>(new Set())
  const [ratingFor, setRatingFor] = React.useState<SkillMarketEntry | null>(null)
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [notifOpen, setNotifOpen] = React.useState(false)

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(q); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [q])

  const { data, isLoading } = useQuery({
    queryKey: ['skills', 'market', debounced, tag, page],
    queryFn: () => fetchSkillsMarket({ q: debounced, tag, page }),
  })

  const { data: notifications } = useQuery({
    queryKey: ['skills', 'notifications'],
    queryFn: fetchSkillNotifications,
    staleTime: 10_000,
  })

  const installMut = useMutation({
    mutationFn: installSkill,
    onSuccess: (_r, name) => {
      setInstalled((s) => new Set(s).add(name))
      toast.success(t('installSuccess'))
      qc.invalidateQueries({ queryKey: ['skills', 'market'] })
    },
    onError: () => toast.error(t('installFailed')),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize ?? SKILL_MARKET_PAGE_SIZE)))
  const unreadCount = notifications?.length ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setNotifOpen(true)} className="relative">
              <Bell className="h-4 w-4" />
              <span>{t('notifications')}</span>
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Button>
            <Button onClick={() => setPublishOpen(true)}>
              <Upload className="h-4 w-4" /><span>{t('publishButton')}</span>
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="h-9 pl-8" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <TagChip active={tag === ''} onClick={() => { setTag(''); setPage(1) }} label={t('tagAll')} />
          {TAGS.map((tg) => (
            <TagChip key={tg} active={tag === tg} onClick={() => { setTag(tg); setPage(1) }} label={tg} />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-20 text-center">
          <Star className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <SkillCard
              key={s.name}
              skill={s}
              installed={installed.has(s.name)}
              installing={installMut.isPending && installMut.variables === s.name}
              onInstall={() => installMut.mutate(s.name)}
              onRate={() => setRatingFor(s)}
            />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /><span>{t('prev')}</span>
            </Button>
            <span className="text-sm text-muted-foreground">{t('page', { page, total: totalPages })}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <span>{t('next')}</span><ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <RatingDialog skill={ratingFor} onClose={() => setRatingFor(null)} />
      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
      <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}

function TagChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function Stars({ value, size = 'h-3.5 w-3.5' }: { value: number; size?: string }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(size, i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  )
}

function SkillCard({ skill, installed, installing, onInstall, onRate }: {
  skill: SkillMarketEntry
  installed: boolean
  installing: boolean
  onInstall: () => void
  onRate: () => void
}) {
  const t = useTranslations('skills.market')
  const qc = useQueryClient()

  const { data: sub } = useQuery({
    queryKey: ['skills', 'subscription', skill.name],
    queryFn: () => fetchSkillSubscription(skill.name),
    staleTime: 30_000,
  })
  const isSubscribed = sub?.subscribed ?? false
  const subscriberCount = sub?.subscriberCount ?? 0

  const subscribeMut = useMutation({
    mutationFn: async (on: boolean) => (on ? subscribeSkill(skill.name) : unsubscribeSkill(skill.name)),
    onSuccess: (_r, on) => {
      toast.success(on ? t('subscribeSuccess') : t('unsubscribeSuccess'))
      qc.invalidateQueries({ queryKey: ['skills', 'subscription', skill.name] })
    },
    onError: () => toast.error(t('subscribeFailed')),
  })

  return (
    <Card className="flex h-full flex-col transition-colors hover:bg-accent">
      <CardContent className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">{skill.name}</h3>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">v{skill.version}</span>
        </div>
        <p className="flex-1 text-sm text-muted-foreground">{skill.description || '—'}</p>
        {skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.tags.map((tg) => <span key={tg} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tg}</span>)}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{skill.author}</span>
          <span>{t('subscribers', { count: subscriberCount })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Stars value={skill.rating} />
          <span className="text-xs text-muted-foreground">{skill.rating.toFixed(1)} ({skill.ratingCount})</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" className="flex-1" disabled={installed || installing} onClick={onInstall}>
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : installed ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            <span>{installed ? t('installed') : t('install')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onRate}>
            <Star className="h-4 w-4" /><span>{t('rate')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={subscribeMut.isPending}
            onClick={() => subscribeMut.mutate(!isSubscribed)}
            className={cn(isSubscribed && 'bg-muted text-foreground')}
            title={isSubscribed ? t('unsubscribe') : t('subscribe')}
          >
            {subscribeMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RatingDialog({ skill, onClose }: { skill: SkillMarketEntry | null; onClose: () => void }) {
  const t = useTranslations('skills.market')
  const qc = useQueryClient()
  const [score, setScore] = React.useState(5)
  const [comment, setComment] = React.useState('')

  const { data: ratings } = useQuery({
    queryKey: ['skills', 'ratings', skill?.name],
    queryFn: () => fetchSkillRatings(skill!.name),
    enabled: !!skill,
  })

  const rateMut = useMutation({
    mutationFn: () => rateSkill(skill!.name, { score, comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast.success(t('rateSuccess'))
      qc.invalidateQueries({ queryKey: ['skills', 'market'] })
      qc.invalidateQueries({ queryKey: ['skills', 'ratings', skill!.name] })
      onClose()
    },
    onError: () => toast.error(t('rateFailed')),
  })

  React.useEffect(() => {
    if (skill) { setScore(5); setComment('') }
  }, [skill])

  return (
    <Dialog open={!!skill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rate')} — {skill?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} type="button" onClick={() => setScore(i + 1)} className="p-0.5"><Star className={cn('h-6 w-6', i < score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} /></button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={3}
          />
          {ratings && ratings.length > 0 && (
            <div className="space-y-2">
              {ratings.slice(0, 3).map((r) => (
                <div key={r.id} className="rounded-md bg-muted/60 p-2 text-sm">
                  <div className="flex items-center justify-between"><span className="font-medium">{r.userName}</span><Stars value={r.score} size="h-3 w-3" /></div>
                  {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><span>{t('cancel')}</span></Button>
          <Button disabled={rateMut.isPending} onClick={() => rateMut.mutate()}>{rateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}<span>{t('submit')}</span></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('skills.market')
  const qc = useQueryClient()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [author, setAuthor] = React.useState('')
  const [version, setVersion] = React.useState('1.0.0')
  const [license, setLicense] = React.useState('MIT')
  const [content, setContent] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setName(''); setDescription(''); setTags(''); setAuthor(''); setVersion('1.0.0'); setLicense('MIT'); setContent('')
    }
  }, [open])

  const publishMut = useMutation({
    mutationFn: () =>
      publishSkill({
        name: name.trim(),
        description: description.trim(),
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        author: author.trim() || 'anonymous',
        version: version.trim() || '1.0.0',
        license: license.trim() || 'MIT',
        content: content.trim(),
      }),
    onSuccess: () => {
      toast.success(t('publishSuccess'))
      qc.invalidateQueries({ queryKey: ['skills', 'market'] })
      onClose()
    },
    onError: (e: Error) => toast.error(t('publishFailed'), { description: e.message }),
  })

  const canSubmit = name.trim() && description.trim() && content.trim() && !publishMut.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('publishTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('publishName')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-skill" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('publishDescription')}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('publishDescription')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('publishTags')}</label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="code, ai" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('publishAuthor')}</label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="your-name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('publishVersion')}</label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('publishLicense')}</label>
              <Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="MIT" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('publishContent')}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('publishContentPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><span>{t('cancel')}</span></Button>
          <Button disabled={!canSubmit} onClick={() => publishMut.mutate()}>
            {publishMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{t('publishSubmit')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NotificationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('skills.market')
  const qc = useQueryClient()
  const { data: items, isLoading } = useQuery({
    queryKey: ['skills', 'notifications'],
    queryFn: fetchSkillNotifications,
    enabled: open,
  })

  const markReadMut = useMutation({
    mutationFn: markSkillNotificationsRead,
    onSuccess: () => {
      toast.success(t('markedRead'))
      qc.invalidateQueries({ queryKey: ['skills', 'notifications'] })
      onClose()
    },
    onError: () => toast.error(t('subscribeFailed')),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('notifications')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : !items || items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('noNotifications')}</div>
          ) : (
            items.map((n: SkillNotification) => (
              <div key={n.id} className="rounded-md bg-muted/60 p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <BellRing className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{n.skillName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(n.timestamp))}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{n.message}</p>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><span>{t('cancel')}</span></Button>
          <Button disabled={!items?.length || markReadMut.isPending} onClick={() => markReadMut.mutate()}>
            {markReadMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{t('markRead')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
