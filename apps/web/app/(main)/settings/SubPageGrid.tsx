'use client'

import Link from 'next/link'
import { Card, CardContent } from '@ihui/ui'
import { SUB_PAGES } from './helpers'

interface Props {
  t: (k: string) => string
}

export function SubPageGrid({ t }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SUB_PAGES.map((item) => {
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t(item.titleKey)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(item.descKey)}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
