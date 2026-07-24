import { getTranslations } from 'next-intl/server'
import { MessagesSquare, Search } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui-react'

export default async function ChatsPage() {
  const t = await getTranslations('models')

  const chats = Array.from({ length: 12 }).map((_, i) => {
    const users = ['alice@ihui.ai', 'bob@ihui.ai', 'carol@ihui.ai', 'david@ihui.ai', 'eric@ihui.ai']
    const models = ['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 2.0 Flash', 'DeepSeek V3']
    const msgs = [4, 12, 28, 6, 18, 32, 8, 22, 14, 26, 10, 38]
    const tokens = [1230, 4520, 8970, 2340, 6720, 12340, 3870, 8920, 5210, 9870, 4350, 11240]
    return {
      id: `chat-${(i + 1).toString().padStart(3, '0')}`,
      user: users[i % users.length],
      title: ['龙岗区数学辅导', 'AI 助教问答', '论文润色', '代码 review', '英语口语练习'][i % 5],
      model: models[i % models.length],
      messages: msgs[i],
      tokens: tokens[i],
      createdAt:
        `2026-07-${(19 - (i % 5)).toString().padStart(2, '0')} ${10 + (i % 8)}:${(i * 7) % 60}`.replace(
          /(.{14})\d{2}$/,
          '$100',
        ),
    }
  })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('chats.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('chats.subtitle')}</p>
      </header>

      <Card>
        <CardContent className="flex items-center gap-2 p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('chats.searchPlaceholder')} className="h-9 flex-1 text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="h-4 w-4 text-primary" />
            {t('chats.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('chats.table.id')}</th>
                  <th className="px-4 py-2 font-medium">{t('chats.table.user')}</th>
                  <th className="px-4 py-2 font-medium">{t('chats.table.title')}</th>
                  <th className="px-4 py-2 font-medium">{t('chats.table.model')}</th>
                  <th className="px-4 py-2 font-medium">{t('chats.table.messages')}</th>
                  <th className="px-4 py-2 font-medium">{t('chats.table.tokens')}</th>
                  <th className="px-4 py-2 font-medium">{t('chats.table.createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.id}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.user}</td>
                    <td className="px-4 py-2.5 font-medium">{c.title}</td>
                    <td className="px-4 py-2.5">{c.model}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.messages}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.tokens!.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.createdAt}</td>
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
