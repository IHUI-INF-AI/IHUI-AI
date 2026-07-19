import { getTranslations } from 'next-intl/server'
import { Search, UserPlus, Users } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui'

export default async function UsersPage() {
  const t = await getTranslations('models')

  const users = Array.from({ length: 10 }).map((_, i) => {
    const emails = [
      'alice@ihui.ai',
      'bob@ihui.ai',
      'carol@ihui.ai',
      'david@ihui.ai',
      'eric@ihui.ai',
      'frank@ihui.ai',
      'grace@ihui.ai',
      'henry@ihui.ai',
      'ivy@ihui.ai',
      'jack@ihui.ai',
    ]
    const roles = ['admin', 'user', 'user', 'user', 'vip']
    const groups = ['默认分组', '龙岗区数学组', '高中英语组', 'AI 教研组', '管理员']
    const statuses = ['active', 'active', 'active', 'disabled']
    return {
      id: i + 1,
      email: emails[i]!,
      name: emails[i]!.split('@')[0],
      role: roles[i % roles.length],
      group: groups[i % groups.length],
      balance: (Math.random() * 200 + 10).toFixed(2),
      totalCalls: 1500 - i * 87,
      status: statuses[i % statuses.length],
      createdAt: `2026-${(7 - (i % 4)).toString().padStart(2, '0')}-${(10 + i).toString().padStart(2, '0')}`,
    }
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('users.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          {t('users.create')}
        </Button>
      </header>

      <Card>
        <CardContent className="flex items-center gap-2 p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('users.searchPlaceholder')} className="h-9 flex-1 text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {t('users.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('users.table.email')}</th>
                  <th className="px-4 py-2 font-medium">{t('users.table.group')}</th>
                  <th className="px-4 py-2 font-medium">{t('users.table.role')}</th>
                  <th className="px-4 py-2 font-medium">{t('users.table.balance')}</th>
                  <th className="px-4 py-2 font-medium">{t('users.table.totalCalls')}</th>
                  <th className="px-4 py-2 font-medium">{t('users.table.status')}</th>
                  <th className="px-4 py-2 font-medium">{t('users.table.createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{u.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.group}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          u.role === 'admin'
                            ? 'inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary'
                            : u.role === 'vip'
                              ? 'inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400'
                              : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                        }
                      >
                        {t(`users.roleLabels.${u.role}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">¥ {u.balance}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {u.totalCalls.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          u.status === 'active'
                            ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                        }
                      >
                        {t(`users.statusLabels.${u.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{u.createdAt}</td>
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
