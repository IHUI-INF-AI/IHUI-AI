import { getTranslations } from 'next-intl/server'
import { Cable, Plus } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

export default async function ChannelsPage() {
  const t = await getTranslations('models')

  const channels = Array.from({ length: 6 }).map((_, i) => {
    const providers = ['OpenAI', 'Anthropic', 'Azure', 'Google', 'DeepSeek', 'Moonshot']
    const models = [
      'gpt-4o',
      'claude-3.5-sonnet',
      'gpt-4-turbo',
      'gemini-2.0-flash',
      'deepseek-v3',
      'moonshot-v1-128k',
    ]
    const statuses = ['enabled', 'enabled', 'enabled', 'disabled']
    const p = i % providers.length
    return {
      id: i + 1,
      name: `${providers[p]}-渠道 ${i + 1}`,
      provider: providers[p],
      model: models[p],
      baseUrl: `https://api.${providers[p]!.toLowerCase()}.com/v1`,
      priority: i + 1,
      weight: 10 - (i % 5),
      status: statuses[i % statuses.length],
      qps: 60 - i * 5,
      todayCalls: 1230 - i * 87,
    }
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('channels.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('channels.subtitle')}</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('channels.create')}
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="h-4 w-4 text-primary" />
            {t('channels.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('channels.table.name')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.provider')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.model')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.priority')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.weight')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.qps')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.todayCalls')}</th>
                  <th className="px-4 py-2 font-medium">{t('channels.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.provider}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.model}</td>
                    <td className="px-4 py-2.5">{c.priority}</td>
                    <td className="px-4 py-2.5">{c.weight}</td>
                    <td className="px-4 py-2.5">{c.qps}</td>
                    <td className="px-4 py-2.5">{c.todayCalls}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          c.status === 'enabled'
                            ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                        }
                      >
                        {t(`channels.statusLabels.${c.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
