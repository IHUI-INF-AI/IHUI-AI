'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Download, Trash2, Loader2, Package, CheckCircle2 } from 'lucide-react'

import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import {
  listAvailableSkills,
  listInstalledSkills,
  installSkill,
  uninstallSkill,
  type SkillItem,
} from '@/lib/openclaw-api'

export function SkillsPanel() {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = React.useState('')

  const availableQuery = useQuery({
    queryKey: ['openclaw', 'skills', 'available'],
    queryFn: listAvailableSkills,
  })

  const installedQuery = useQuery({
    queryKey: ['openclaw', 'skills', 'installed'],
    queryFn: listInstalledSkills,
  })

  const installMutation = useMutation({
    mutationFn: (id: string) => installSkill(id),
    onSuccess: () => {
      toast.success(t('installed'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'skills'] })
    },
    onError: () => toast.error(t('install')),
  })

  const uninstallMutation = useMutation({
    mutationFn: (id: string) => uninstallSkill(id),
    onSuccess: () => {
      toast.success(t('uninstalled'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'skills'] })
    },
    onError: () => toast.error(t('uninstall')),
  })

  const installedIds = React.useMemo(
    () => new Set((installedQuery.data ?? []).map((s) => s.id)),
    [installedQuery.data],
  )

  const filtered = React.useMemo(() => {
    const list = availableQuery.data ?? []
    if (!keyword.trim()) return list
    const k = keyword.trim().toLowerCase()
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(k) || (s.description?.toLowerCase().includes(k) ?? false),
    )
  }, [availableQuery.data, keyword])

  const installedList: SkillItem[] = installedQuery.data ?? []
  const noMatch = keyword.trim() && filtered.length === 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" />
            {t('installedSkills')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {installedQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : installedList.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noInstalledSkills')}
            </p>
          ) : (
            <ul className="space-y-2">
              {installedList.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Package className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{s.name}</p>
                    {s.description && (
                      <p className="break-words text-xs text-muted-foreground">{s.description}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => uninstallMutation.mutate(s.id)}
                    disabled={uninstallMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('uninstall')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            {t('availableSkills')}
          </CardTitle>
          <div className="flex gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('searchSkills')}
            />
          </div>
        </CardHeader>
        <CardContent>
          {availableQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : noMatch ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noMatchSkills')}
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noSkills')}
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((s) => {
                const isInstalled = installedIds.has(s.id)
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <Package className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{s.name}</p>
                      {s.description && (
                        <p className="break-words text-xs text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                    <Button
                      variant={isInstalled ? 'outline' : 'default'}
                      size="sm"
                      onClick={() =>
                        isInstalled ? uninstallMutation.mutate(s.id) : installMutation.mutate(s.id)
                      }
                      disabled={installMutation.isPending || uninstallMutation.isPending}
                    >
                      {isInstalled ? (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('uninstall')}
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          {t('install')}
                        </>
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SkillsPanel
