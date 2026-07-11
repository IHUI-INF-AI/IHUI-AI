'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Settings, Mail, HardDrive, Shield, Check } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

type TabKey = 'site' | 'email' | 'storage' | 'security'

interface TabDef {
  key: TabKey
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabDef[] = [
  { key: 'site', icon: Settings },
  { key: 'email', icon: Mail },
  { key: 'storage', icon: HardDrive },
  { key: 'security', icon: Shield },
]

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export default function AdminSettingsPage() {
  const t = useTranslations('admin.settings')
  const [tab, setTab] = React.useState<TabKey>('site')
  const [saved, setSaved] = React.useState(false)

  const [site, setSite] = React.useState({ name: 'IHUI AI', description: '', logo: '', icp: '' })
  const [email, setEmail] = React.useState({ host: '', port: '465', user: '', pass: '', from: '' })
  const [storage, setStorage] = React.useState({
    type: 'local' as 'local' | 'oss' | 's3',
    bucket: '',
    endpoint: '',
    accessKey: '',
    secretKey: '',
  })
  const [security, setSecurity] = React.useState({
    allowRegister: true,
    maxLoginAttempts: '5',
    jwtExpires: '7d',
  })

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
            {tab === 'site' && (
              <>
                <Field label={t('site_name')}>
                  <Input
                    value={site.name}
                    onChange={(e) => setSite({ ...site, name: e.target.value })}
                  />
                </Field>
                <Field label={t('site_description')}>
                  <Input
                    value={site.description}
                    onChange={(e) => setSite({ ...site, description: e.target.value })}
                  />
                </Field>
                <Field label={t('site_logo')}>
                  <Input
                    value={site.logo}
                    onChange={(e) => setSite({ ...site, logo: e.target.value })}
                    placeholder="https://"
                  />
                </Field>
                <Field label={t('site_icp')}>
                  <Input
                    value={site.icp}
                    onChange={(e) => setSite({ ...site, icp: e.target.value })}
                  />
                </Field>
              </>
            )}

            {tab === 'email' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('email_host')}>
                  <Input
                    value={email.host}
                    onChange={(e) => setEmail({ ...email, host: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </Field>
                <Field label={t('email_port')}>
                  <Input
                    value={email.port}
                    onChange={(e) => setEmail({ ...email, port: e.target.value })}
                  />
                </Field>
                <Field label={t('email_user')}>
                  <Input
                    value={email.user}
                    onChange={(e) => setEmail({ ...email, user: e.target.value })}
                  />
                </Field>
                <Field label={t('email_pass')}>
                  <Input
                    type="password"
                    value={email.pass}
                    onChange={(e) => setEmail({ ...email, pass: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('email_from')}>
                    <Input
                      value={email.from}
                      onChange={(e) => setEmail({ ...email, from: e.target.value })}
                      placeholder="noreply@example.com"
                    />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'storage' && (
              <>
                <Field label={t('storage_type')}>
                  <Select
                    value={storage.type}
                    onValueChange={(v) =>
                      setStorage({ ...storage, type: v as typeof storage.type })
                    }
                  >
                    <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">{t('storage_local')}</SelectItem>
                      <SelectItem value="oss">{t('storage_oss')}</SelectItem>
                      <SelectItem value="s3">{t('storage_s3')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {storage.type !== 'local' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('storage_bucket')}>
                      <Input
                        value={storage.bucket}
                        onChange={(e) => setStorage({ ...storage, bucket: e.target.value })}
                      />
                    </Field>
                    <Field label={t('storage_endpoint')}>
                      <Input
                        value={storage.endpoint}
                        onChange={(e) => setStorage({ ...storage, endpoint: e.target.value })}
                      />
                    </Field>
                    <Field label={t('storage_accessKey')}>
                      <Input
                        value={storage.accessKey}
                        onChange={(e) => setStorage({ ...storage, accessKey: e.target.value })}
                      />
                    </Field>
                    <Field label={t('storage_secretKey')}>
                      <Input
                        type="password"
                        value={storage.secretKey}
                        onChange={(e) => setStorage({ ...storage, secretKey: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </>
            )}

            {tab === 'security' && (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">{t('security_allowRegister')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('security_allowRegisterHint')}
                    </div>
                  </div>
                  <Switch
                    checked={security.allowRegister}
                    onChange={(v) => setSecurity({ ...security, allowRegister: v })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('security_maxLoginAttempts')}>
                    <Input
                      value={security.maxLoginAttempts}
                      onChange={(e) =>
                        setSecurity({ ...security, maxLoginAttempts: e.target.value })
                      }
                      type="number"
                      min={1}
                    />
                  </Field>
                  <Field label={t('security_jwtExpires')}>
                    <Input
                      value={security.jwtExpires}
                      onChange={(e) => setSecurity({ ...security, jwtExpires: e.target.value })}
                      placeholder="7d"
                    />
                  </Field>
                </div>
              </>
            )}
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
