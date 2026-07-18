'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Mail, Phone, MapPin, Globe, MessageCircle, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

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
  const { data, isLoading } = useQuery({
    queryKey: ['contact'],
    queryFn: fetchContacts,
    retry: false,
  })

  const contacts = data?.contacts?.length ? data.contacts : fallbackContacts
  const company = data?.company ?? fallbackCompany

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          联系我们
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">与我们取得联系</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          商务合作、课程咨询、企业服务定制,欢迎随时联系我们。我们的团队会在 24 小时内回复。
        </p>
      </section>

      {/* 联系方式 */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2">
        {isLoading && (
          <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        )}
        {!isLoading &&
          contacts.map(({ icon, label, value, href }) => {
            const Icon = ICON_MAP[icon as keyof typeof ICON_MAP] ?? Mail
            return (
              <a
                key={label}
                href={href}
                className="group flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
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
      <section className="mt-12 rounded-2xl border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">公司地址</h2>
            <p className="text-sm text-muted-foreground">{company.name}</p>
            {company.merchantId && (
              <p className="text-sm text-muted-foreground">微信支付商户号:{company.merchantId}</p>
            )}
            {company.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">立即加入智汇 AI 社区</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          早鸟价 ¥6000/人/年,限 18 席。一对一 AI 顾问咨询,不满意全额退款。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/support?source=contact">立即加入</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/about">了解更多</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
