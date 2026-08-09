'use client'

import * as React from 'react'
import { Loader2, Search, Download, Star, X, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Badge,
} from '@ihui/ui-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { searchMarketSkills, api } from './helpers'
import type { MarketSkill } from './types'

interface Props {
  open: boolean
  onClose: () => void
}

const PAGE_SIZE = 20

export function SkillMarketDialog({ open, onClose }: Props) {
  const t = useTranslations('admin.skills')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const [searchQ, setSearchQ] = React.useState('')
  const [searchTag] = React.useState('')
  const [page, setPage] = React.useState(1)

  const marketQ = useQuery({
    queryKey: ['admin', 'skills', 'market', searchQ, searchTag, page],
    queryFn: () => searchMarketSkills(searchQ, searchTag, page, PAGE_SIZE),
    enabled: open,
  })

  const installMut = useMutation({
    mutationFn: (name: string) => api(`/api/skills/${encodeURIComponent(name)}/install`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skills', 'market'] })
      qc.invalidateQueries({ queryKey: ['admin', 'skills'] })
    },
  })

  const unlistMut = useMutation({
    mutationFn: (name: string) => api(`/api/skills/${encodeURIComponent(name)}/unlist`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skills', 'market'] })
    },
  })

  const marketData = marketQ.data
  const list = marketData?.list ?? []
  const total = marketData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleSearch() {
    setPage(1)
    marketQ.refetch()
  }

  function handleInstall(skill: MarketSkill) {
    installMut.mutate(skill.name)
  }

  function handleUnlist(skill: MarketSkill) {
    unlistMut.mutate(skill.name)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('marketTitle')}</DialogTitle>
          <DialogDescription>{t('marketDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={t('searchMarketPlaceholder')}
              className="pl-8"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch}>
            <Search className="mr-1.5 h-3.5 w-3.5" />
            {t('search')}
          </Button>
        </div>

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {marketQ.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : marketQ.error ? (
            <div className="py-8 text-center text-destructive">{marketQ.error.message}</div>
          ) : list.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('noMarketData')}</div>
          ) : (
            list.map((skill) => (
              <div
                key={skill.id}
                className="flex items-start justify-between rounded-md border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{skill.name}</span>
                    <Link
                      href={`/ai-skills/${skill.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t('viewDetail')}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    {skill.version ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {skill.version}
                      </code>
                    ) : null}
                    {skill.rating !== null && skill.rating !== undefined ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        {skill.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  {skill.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{skill.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {skill.author ? <span>{t('author')}: {skill.author}</span> : null}
                    {skill.installCount !== null && skill.installCount !== undefined ? (
                      <span>{t('installCount', { count: skill.installCount })}</span>
                    ) : null}
                    {skill.createdAt ? (
                      <span>{dateFmt.format(new Date(skill.createdAt))}</span>
                    ) : null}
                    {Array.isArray(skill.tags) && skill.tags.length > 0
                      ? skill.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))
                      : null}
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-1">
                  {skill.isInstalled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="text-xs"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      {t('installed')}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleInstall(skill)}
                      disabled={installMut.isPending}
                      className="text-xs"
                    >
                      {installMut.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-3 w-3" />
                      )}
                      {t('install')}
                    </Button>
                  )}
                  {skill.isOwner ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlist(skill)}
                      disabled={unlistMut.isPending}
                      className="text-xs text-destructive hover:text-destructive"
                    >
                      {unlistMut.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <X className="mr-1 h-3 w-3" />
                      )}
                      {t('unlist')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('pageInfo', { page, total: totalPages })}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || marketQ.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('prevPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || marketQ.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('nextPage')}
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}