'use client'

import { useTranslations } from 'next-intl'
import { Monitor, Loader2, Check } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import type { Device } from './types'

interface Props {
  devicesList: Device[]
  devicesLoading: boolean
  dateFmt: Intl.DateTimeFormat
}

export function DevicesSection({ devicesList, devicesLoading, dateFmt }: Props) {
  const t = useTranslations('user.security')
  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t('devices')}</h2>
      </div>
      {devicesLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : devicesList.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {devicesList.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{d.name}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {d.ip} · {dateFmt.format(new Date(d.lastActive))}
                </p>
              </div>
              {d.current ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                  <Check className="h-3 w-3" />
                  {t('currentDevice')}
                </span>
              ) : (
                <Button variant="ghost" size="sm">
                  {t('logout')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
