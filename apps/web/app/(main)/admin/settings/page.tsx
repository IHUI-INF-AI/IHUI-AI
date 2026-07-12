'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

import { SiteTab, EmailTab, StorageTab, SecurityTab } from './SettingsTabs'
import { TABS, INITIAL_SITE, INITIAL_EMAIL, INITIAL_STORAGE, INITIAL_SECURITY } from './helpers'
import type { TabKey, SiteConfig, EmailConfig, StorageConfig, SecurityConfig } from './types'

export default function AdminSettingsPage() {
  const t = useTranslations('admin.settings')
  const [tab, setTab] = React.useState<TabKey>('site')
  const [saved, setSaved] = React.useState(false)
  const [site, setSite] = React.useState<SiteConfig>(INITIAL_SITE)
  const [email, setEmail] = React.useState<EmailConfig>(INITIAL_EMAIL)
  const [storage, setStorage] = React.useState<StorageConfig>(INITIAL_STORAGE)
  const [security, setSecurity] = React.useState<SecurityConfig>(INITIAL_SECURITY)

  const onSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tb) => {
          const Icon = tb.icon
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === tb.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`tab_${tb.key}`)}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t(`tab_${tab}`)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div key={tab} className="animate-in fade-in-0 duration-200">
            {tab === 'site' && <SiteTab site={site} setSite={setSite} />}
            {tab === 'email' && <EmailTab email={email} setEmail={setEmail} />}
            {tab === 'storage' && <StorageTab storage={storage} setStorage={setStorage} />}
            {tab === 'security' && <SecurityTab security={security} setSecurity={setSecurity} />}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saved}>
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              {t('saved')}
            </>
          ) : (
            t('save')
          )}
        </Button>
      </div>
    </div>
  )
}
