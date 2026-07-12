'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  setName: (v: string) => void
  slug: string
  setSlug: (v: string) => void
  description: string
  setDescription: (v: string) => void
  formError: string | null
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
}

export function TeamDialog({
  open,
  onOpenChange,
  name,
  setName,
  slug,
  setSlug,
  description,
  setDescription,
  formError,
  onSubmit,
  isPending,
}: Props) {
  const t = useTranslations('teams')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {t('newTeam')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
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
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
