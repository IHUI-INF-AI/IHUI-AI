import { getTranslations } from 'next-intl/server'
import { CheckCircle2, FileText, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default async function LogsPage() {
  const t = await getTranslations('models')

  const logs = [
    {
      id: 'log-001',
      time: '2026-07-19 14:32:05',
      model: 'gpt-4o',
      key: 'sk-ihui-****1a2b',
      tokens: '2,453',
      cost: '¥ 0.061',
      duration: '1.24s',
      status: 'success',
    },
    {
      id: 'log-002',
      time: '2026-07-19 14:28:51',
      model: 'claude-3.5-sonnet',
      key: 'sk-ihui-****3c4d',
      tokens: '1,872',
      cost: '¥ 0.056',
      duration: '2.01s',
      status: 'success',
    },
    {
      id: 'log-003',
      time: '2026-07-19 14:25:33',
      model: 'gemini-2.0-flash',
      key: 'sk-ihui-****5e6f',
      tokens: '3,201',
      cost: '¥ 0.032',
      duration: '0.88s',
      status: 'success',
    },
    {
      id: 'log-004',
      time: '2026-07-19 14:21:08',
      model: 'deepseek-v3',
      key: 'sk-ihui-****7g8h',
      tokens: '1,205',
      cost: '¥ 0.003',
      duration: '1.55s',
      status: 'success',
    },
    {
      id: 'log-005',
      time: '2026-07-19 14:18:42',
      model: 'qwen-max',
      key: 'sk-ihui-****9i0j',
      tokens: '985',
      cost: '¥ 0.016',
      duration: '0.92s',
      status: 'success',
    },
    {
      id: 'log-006',
      time: '2026-07-19 14:15:27',
      model: 'gpt-4o-mini',
      key: 'sk-ihui-****1k2l',
      tokens: '654',
      cost: '¥ 0.001',
      duration: '0.42s',
      status: 'success',
    },
    {
      id: 'log-007',
      time: '2026-07-19 14:12:11',
      model: 'grok-3',
      key: 'sk-ihui-****3m4n',
      tokens: '1,532',
      cost: '¥ 0.046',
      duration: '5.30s',
      status: 'failed',
    },
    {
      id: 'log-008',
      time: '2026-07-19 14:08:54',
      model: 'glm-4.5',
      key: 'sk-ihui-****5o6p',
      tokens: '892',
      cost: '¥ 0.005',
      duration: '1.10s',
      status: 'success',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('logs.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('logs.subtitle')}</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            {t('logs.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('logs.table.time')}</th>
                  <th className="px-4 py-2 font-medium">{t('logs.table.model')}</th>
                  <th className="px-4 py-2 font-medium">{t('logs.table.key')}</th>
                  <th className="px-4 py-2 font-medium">{t('logs.table.tokens')}</th>
                  <th className="px-4 py-2 font-medium">{t('logs.table.cost')}</th>
                  <th className="px-4 py-2 font-medium">{t('logs.table.duration')}</th>
                  <th className="px-4 py-2 font-medium">{t('logs.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.time}</td>
                    <td className="px-4 py-2.5 font-medium">{l.model}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.key}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.tokens}</td>
                    <td className="px-4 py-2.5">{l.cost}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.duration}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          l.status === 'success'
                            ? 'inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400'
                        }
                      >
                        {l.status === 'success' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {t(`logs.statusLabels.${l.status}`)}
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
