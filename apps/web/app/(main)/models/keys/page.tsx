import { getTranslations } from 'next-intl/server'
import { Copy, Key, Plus, Trash2 } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

export default async function KeysPage() {
  const t = await getTranslations('models')

  const keys = [
    {
      id: 1,
      name: '生产环境',
      key: 'sk-ihui-prod-9f3a2b1c8d7e6f5a4b3c2d1e0f9a8b7c',
      used: 68.5,
      total: 100,
      createdAt: '2026-07-01',
      status: 'active',
    },
    {
      id: 2,
      name: '测试环境',
      key: 'sk-ihui-test-2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
      used: 12.3,
      total: 50,
      createdAt: '2026-07-08',
      status: 'active',
    },
    {
      id: 3,
      name: '内部工具',
      key: 'sk-ihui-tool-8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e',
      used: 35.2,
      total: 50,
      createdAt: '2026-06-15',
      status: 'active',
    },
    {
      id: 4,
      name: '演示账号',
      key: 'sk-ihui-demo-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
      used: 50,
      total: 50,
      createdAt: '2026-05-20',
      status: 'expired',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('keys.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('keys.subtitle')}</p>
        </div>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('keys.create')}
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4 text-primary" />
            {t('keys.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('keys.table.name')}</th>
                  <th className="px-4 py-2 font-medium">{t('keys.table.key')}</th>
                  <th className="px-4 py-2 font-medium">{t('keys.table.usage')}</th>
                  <th className="px-4 py-2 font-medium">{t('keys.table.createdAt')}</th>
                  <th className="px-4 py-2 font-medium">{t('keys.table.status')}</th>
                  <th className="px-4 py-2 font-medium text-right">{t('keys.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const pct = Math.min(100, (k.used / k.total) * 100)
                  const isExpired = k.status === 'expired'
                  return (
                    <tr
                      key={k.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{k.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {k.key.slice(0, 12)}••••{k.key.slice(-4)}
                          </code>
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={t('keys.copy')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-muted">
                            <div
                              className={
                                isExpired
                                  ? 'h-full bg-rose-500'
                                  : pct > 80
                                    ? 'h-full bg-amber-500'
                                    : 'h-full bg-emerald-500'
                              }
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ¥{k.used.toFixed(1)} / ¥{k.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{k.createdAt}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            isExpired
                              ? 'inline-flex items-center rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400'
                              : 'inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {t(`keys.statusLabels.${k.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-muted-foreground transition-colors hover:text-rose-500"
                          aria-label={t('keys.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
