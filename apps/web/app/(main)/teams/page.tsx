'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, Users, UserPlus, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ihui/ui'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'

interface TeamItem {
  id: string
  name: string
  slug: string
  description: string
  memberCount: number
  createdAt: string
}

async function fetchTeams(): Promise<TeamItem[]> {
  const res = await fetchApi<{ teams: TeamItem[] }>('/api/teams')
  if (!res.success) throw new Error(res.error)
  return res.data.teams
}

async function createTeam(input: {
  name: string
  slug: string
  description?: string
}): Promise<TeamItem> {
  const res = await fetchApi<{ team: TeamItem }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.team
}

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export default function TeamsPage() {
  const t = useTranslations('teams')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setSlug('')
    setDescription('')
    setFormError(null)
  }

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError(t('nameRequired'))
      return
    }
    if (!slug.trim()) {
      setFormError(t('slugRequired'))
      return
    }
    createMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
    })
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && createMutation.isPending) return
    setDialogOpen(open)
    if (!open) resetForm()
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              {t('newTeam')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('newTeam')}</DialogTitle>
                <DialogDescription>{t('createTeamDesc')}</DialogDescription>
              </DialogHeader>

              {formError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="team-name">{t('name')}</Label>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  autoFocus
                  maxLength={64}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-slug">{t('slug')}</Label>
                <Input
                  id="team-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t('slugPlaceholder')}
                  maxLength={64}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-description">{t('description')}</Label>
                <textarea
                  id="team-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  maxLength={500}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={createMutation.isPending}
                >
                  {tc('cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {createMutation.isPending ? t('creating') : t('create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((team) => (
            <Card
              key={team.id}
              className="flex h-full flex-col transition-colors hover:border-primary/40 hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{team.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                  {team.description || team.slug}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UserPlus className="h-4 w-4" />
                  <span>{t('memberCount', { count: team.memberCount })}</span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatDate(team.createdAt)}</span>
                <Button asChild size="sm">
                  <Link href={`/teams/${team.id}`}>
                    {t('enter')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      )}
    </div>
  )
}
