'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Switch, Field } from './SettingsPrimitives'
import type { SiteConfig, EmailConfig, StorageConfig, SecurityConfig } from './types'

interface SiteTabProps {
  site: SiteConfig
  setSite: React.Dispatch<React.SetStateAction<SiteConfig>>
}

export function SiteTab({ site, setSite }: SiteTabProps) {
  const t = useTranslations('admin.settings')
  return (
    <>
      <Field label={t('site_name')}>
        <Input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
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
        <Input value={site.icp} onChange={(e) => setSite({ ...site, icp: e.target.value })} />
      </Field>
    </>
  )
}

interface EmailTabProps {
  email: EmailConfig
  setEmail: React.Dispatch<React.SetStateAction<EmailConfig>>
}

export function EmailTab({ email, setEmail }: EmailTabProps) {
  const t = useTranslations('admin.settings')
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('email_host')}>
        <Input
          value={email.host}
          onChange={(e) => setEmail({ ...email, host: e.target.value })}
          placeholder="smtp.example.com"
        />
      </Field>
      <Field label={t('email_port')}>
        <Input value={email.port} onChange={(e) => setEmail({ ...email, port: e.target.value })} />
      </Field>
      <Field label={t('email_user')}>
        <Input value={email.user} onChange={(e) => setEmail({ ...email, user: e.target.value })} />
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
  )
}

interface StorageTabProps {
  storage: StorageConfig
  setStorage: React.Dispatch<React.SetStateAction<StorageConfig>>
}

export function StorageTab({ storage, setStorage }: StorageTabProps) {
  const t = useTranslations('admin.settings')
  return (
    <>
      <Field label={t('storage_type')}>
        <Select
          value={storage.type}
          onValueChange={(v) => setStorage({ ...storage, type: v as typeof storage.type })}
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
  )
}

interface SecurityTabProps {
  security: SecurityConfig
  setSecurity: React.Dispatch<React.SetStateAction<SecurityConfig>>
}

export function SecurityTab({ security, setSecurity }: SecurityTabProps) {
  const t = useTranslations('admin.settings')
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">{t('security_allowRegister')}</div>
          <div className="text-xs text-muted-foreground">{t('security_allowRegisterHint')}</div>
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
            onChange={(e) => setSecurity({ ...security, maxLoginAttempts: e.target.value })}
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
  )
}
