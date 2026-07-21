import { getTranslations } from 'next-intl/server'
import { Plus, UsersRound } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface GroupItem {
  id: number
  members: number
  ratio: number
  models: number
  todayCalls: number
}

const GROUPS: GroupItem[] = [
  { id: 1, members: 1280, ratio: 1.0, models: 8, todayCalls: 8432 },
  { id: 2, members: 86, ratio: 0.8, models: 6, todayCalls: 1245 },
  { id: 3, members: 124, ratio: 0.85, models: 6, todayCalls: 2103 },
  { id: 4, members: 32, ratio: 0.5, models: 12, todayCalls: 5621 },
  { id: 5, members: 5, ratio: 0.0, models: 24, todayCalls: 312 },
]

export default async function GroupsPage() {
  const t = await getTranslations('models')
  const tPage = await getTranslations('modelsGroupsPage')

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('groupsMgmt.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('groupsMgmt.subtitle')}</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('groupsMgmt.create')}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <UsersRound className="h-3.5 w-3.5" />
                </div>
                {tPage(`group.${g.id}.name`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{tPage(`group.${g.id}.desc`)}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-muted-foreground">{t('groupsMgmt.members')}</div>
                  <div className="mt-0.5 text-base font-semibold">{g.members.toLocaleString()}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-muted-foreground">{t('groupsMgmt.ratio')}</div>
                  <div className="mt-0.5 text-base font-semibold">
                    {(g.ratio * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-muted-foreground">{t('groupsMgmt.models')}</div>
                  <div className="mt-0.5 text-base font-semibold">{g.models}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-muted-foreground">{t('groupsMgmt.todayCalls')}</div>
                  <div className="mt-0.5 text-base font-semibold">
                    {g.todayCalls.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
