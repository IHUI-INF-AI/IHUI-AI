'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search, Star, Loader2, ChevronLeft, ChevronRight, Download, Check } from 'lucide-react'
import { Card, CardContent, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'
import { fetchSkillsMarket, fetchSkillRatings, installSkill, rateSkill, SKILL_MARKET_PAGE_SIZE } from '@/lib/skills-market-api'

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

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(q); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [q])

  const { data, isLoading } = useQuery({
    queryKey: ['skills', 'market', debounced, tag, page],
    queryFn: () => fetchSkillsMarket({ q: debounced, tag, page }),
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
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
          <span>{t('installs', { count: skill.installCount })}</span>
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
