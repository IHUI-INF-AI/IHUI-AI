'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Container } from '@/components/layout'

interface Authorization {
  id: string
  app: string
  authorizedAt: number
}

const INITIAL_AUTHORIZATIONS: Authorization[] = [
  { id: 'google', app: 'Google', authorizedAt: new Date('2025-03-12').getTime() },
  { id: 'apple', app: 'Apple', authorizedAt: new Date('2025-05-08').getTime() },
  { id: 'feishu', app: 'Feishu', authorizedAt: new Date('2025-06-21').getTime() },
]

export default function AuthorizationsPage() {
  const t = useTranslations('settings')
  const [authorizations, setAuthorizations] =
    React.useState<Authorization[]>(INITIAL_AUTHORIZATIONS)

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const handleRevoke = (id: string) => {
    setAuthorizations((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('authorizationsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authorizationsDesc')}</p>
      </div>

      {authorizations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('noAuthorizations')}
          </CardContent>
        </Card>
      ) : (
        authorizations.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                {item.app}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('authorizedAt')}: {dateFormatter.format(item.authorizedAt)}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleRevoke(item.id)}>
                  {t('revokeAuth')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </Container>
  )
}
