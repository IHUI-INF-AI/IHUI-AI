'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Mail, Phone, MapPin, Globe, MessageCircle, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'

export interface ContactItem {
  icon: 'wechat' | 'phone' | 'mail' | 'globe' | string
  label: string
  value: string
  href: string
}

export interface CompanyInfo {
  name: string
  merchantId?: string
  address?: string
}

interface ContactSettingsResponse {
  list: Array<{
    key: string
    value?: string | null
  }>
}

const ICON_MAP = {
  wechat: MessageCircle,
  phone: Phone,
  mail: Mail,
  globe: Globe,
} as const

async function fetchContacts(): Promise<{
  contacts: ContactItem[]
  company: CompanyInfo | null
}> {
  const r = await fetchApi<ContactSettingsResponse>(`/api/settings/contact`)
  if (!r.success || !r.data?.list?.length) {
    throw new Error('contact settings not configured')
  }
  const contacts: ContactItem[] = []
  let company: CompanyInfo | null = null
  for (const item of r.data.list) {
    if (!item.value) continue
    try {
      const parsed = JSON.parse(item.value) as Record<string, unknown>
      if (item.key === 'company' && parsed.name) {
        company = {
          name: String(parsed.name),
          merchantId: parsed.merchantId ? String(parsed.merchantId) : undefined,
          address: parsed.address ? String(parsed.address) : undefined,
        }
      } else if (parsed.label && parsed.value && parsed.href) {
        contacts.push({
          icon: String(parsed.icon ?? 'mail'),
          label: String(parsed.label),
          value: String(parsed.value),
          href: String(parsed.href),
        })
      }
    } catch {
      // 非 JSON value,跳过
    }
  }
  return { contacts, company }
}

export function ContactContent({
  fallbackContacts,
  fallbackCompany,
}: {
  fallbackContacts: ContactItem[]
  fallbackCompany: CompanyInfo
}): React.JSX.Element {
  const t = useTranslations('contactPage')
  const { data, isLoading } = useQuery({
    queryKey: ['contact'],
    queryFn: fetchContacts,
    retry: false,
  })

  const contacts = data?.contacts?.length ? data.contacts : fallbackContacts
  const company = data?.company ?? fallbackCompany

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <BackButton />
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('badge')}
        </div>
        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-5xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground min-[768px]:text-lg">
          {t('subtitle')}
        </p>
      </section>

      {/* 联系方式 */}
      <section className="mt-16 grid grid-cols-1 gap-6 min-[640px]:grid-cols-2">
        {isLoading && (
          <div className="col-span-full flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        )}
        {!isLoading &&
          contacts.map((item: { icon: string; label: string; value: string; href: string }) => {
            const { icon, label, value, href } = item
            const Icon = ICON_MAP[icon as keyof typeof ICON_MAP] ?? Mail
            return (
              <a
                key={label}
                href={href}
                className="group flex items-center gap-4 rounded-2xl border bg-card p-4 min-[768px]:p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 truncate text-sm font-medium">{value}</div>
                </div>
              </a>
            )
          })}
      </section>

      {/* 公司地址 */}
      <section className="mt-12 rounded-2xl border bg-card p-4 min-[768px]:p-6 min-[1024px]:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{t('addressTitle')}</h2>
            <p className="text-sm text-muted-foreground">{company.name}</p>
            {company.merchantId && (
              <p className="text-sm text-muted-foreground">
                {t('merchantIdLabel')}:{company.merchantId}
              </p>
            )}
            {company.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-5 text-center min-[768px]:p-8 min-[1024px]:p-12">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('ctaTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('ctaSubtitle')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/support?source=contact">{t('ctaJoin')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/about">{t('ctaLearnMore')}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
