'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Cpu, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { listOpenclawModels, type OpenclawModelItem } from '@/lib/openclaw-api'

export function ModelsPanel() {
  const t = useTranslations('floatingChat.openclaw')

  const { data, isLoading } = useQuery({
    queryKey: ['openclaw', 'models'],
    queryFn: listOpenclawModels,
  })

  const models: OpenclawModelItem[] = data ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            {t('modelsHint')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noModels')}
            </p>
          ) : (
            <ul className="space-y-2">
              {models.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Cpu className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{m.name}</p>
                    {m.provider && (
                      <p className="break-words text-xs text-muted-foreground">{m.provider}</p>
                    )}
                  </div>
                  {m.context_length !== undefined && (
                    <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {m.context_length}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ModelsPanel
