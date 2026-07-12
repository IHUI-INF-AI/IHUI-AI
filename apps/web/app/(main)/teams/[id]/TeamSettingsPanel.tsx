'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Trash2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@ihui/ui'

interface Props {
  editName: string
  setEditName: (v: string) => void
  editDesc: string
  setEditDesc: (v: string) => void
  editErr: string | null
  updatePending: boolean
  onSubmit: (e: React.FormEvent) => void
  deletePending: boolean
  onDelete: () => void
}

export function TeamSettingsPanel({
  editName,
  setEditName,
  editDesc,
  setEditDesc,
  editErr,
  updatePending,
  onSubmit,
  deletePending,
  onDelete,
}: Props) {
  const t = useTranslations('teams')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('editTeam')}</CardTitle>
        <CardDescription>{t('editTeamDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {editErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {editErr}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t('name')}</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={64}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">{t('description')}</Label>
            <textarea
              id="edit-desc"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              maxLength={500}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button type="submit" disabled={updatePending}>
            {updatePending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </form>
        <div className="mt-8 border-t pt-6">
          <h3 className="text-sm font-semibold text-destructive">{t('dangerZone')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('deleteTeamDesc')}</p>
          <Button
            variant="outline"
            className="mt-3 border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            disabled={deletePending}
          >
            {deletePending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Trash2 className="h-4 w-4" />
            {t('deleteTeam')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
