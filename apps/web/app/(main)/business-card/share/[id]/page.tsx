'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  QrCode,
  Copy,
  Check,
  Download,
  Star,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
} from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent } from '@ihui/ui'
import { getInitials } from '@/components/data/Avatar'

interface BusinessCard {
  id: string
  name: string
  title?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  wechat?: string | null
  address?: string | null
  avatar?: string | null
  bio?: string | null
  template?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const TPL_STYLES: Record<string, string> = {
  minimal: 'bg-card',
  business: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white',
  creative: 'bg-gradient-to-br from-purple-500 to-pink-500 text-white',
}

export default function CardSharePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const t = useTranslations('businessCardSharePage')
  const [copied, setCopied] = React.useState(false)

  const {
    data: card,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['business-card', 'share', id],
    queryFn: () => api<BusinessCard>(`/api/business-card/${id}`),
  })

  const favMut = useMutation({
    mutationFn: () => api(`/api/business-card/${id}/favorite`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-card'] }),
  })

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  function downloadCard() {
    if (!card) return
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.name}`,
      card.company && `ORG:${card.company}`,
      card.title && `TITLE:${card.title}`,
      card.phone && `TEL:${card.phone}`,
      card.email && `EMAIL:${card.email}`,
      card.address && `ADR:;;${card.address}`,
      card.wechat && `X-WECHAT:${card.wechat}`,
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\r\n')
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${card.name}.vcf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !card)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/business-card"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )

  const tpl = card.template ?? 'minimal'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/business-card"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <div className={cn('rounded-xl p-6 shadow-sm', TPL_STYLES[tpl] ?? TPL_STYLES.minimal)}>
        <div className="flex items-start gap-4">
          {card.avatar ? (
            <Image
              src={card.avatar}
              alt={card.name}
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-white/30"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold">
              {getInitials(card.name)}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xl font-bold">{card.name}</h2>
            {card.title && <p className="text-sm opacity-80">{card.title}</p>}
            {card.company && <p className="text-sm opacity-80">{card.company}</p>}
            {card.bio && <p className="pt-1 text-sm opacity-70">{card.bio}</p>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {card.phone && (
            <a
              href={`tel:${card.phone}`}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
            >
              <Phone className="h-4 w-4" />
              {card.phone}
            </a>
          )}
          {card.email && (
            <a
              href={`mailto:${card.email}`}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
            >
              <Mail className="h-4 w-4" />
              <span className="truncate">{card.email}</span>
            </a>
          )}
          {card.wechat && (
            <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5">
              <MessageCircle className="h-4 w-4" />
              {card.wechat}
            </span>
          )}
          {card.address && (
            <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{card.address}</span>
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg border p-2">
              <Image
                src={qrUrl}
                alt={t('qrAlt')}
                width={128}
                height={128}
                className="h-32 w-32"
                unoptimized
              />
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <QrCode className="h-3 w-3" />
              {t('scanTip')}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={copyLink} className="justify-start">
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? t('copied') : t('copyLink')}
            </Button>
            <Button variant="outline" onClick={downloadCard} className="justify-start">
              <Download className="mr-2 h-4 w-4" />
              {t('downloadVcard')}
            </Button>
            <Button
              variant="outline"
              onClick={() => favMut.mutate()}
              disabled={favMut.isPending}
              className="justify-start"
            >
              <Star className="mr-2 h-4 w-4" />
              {favMut.isPending ? t('processing') : t('favoriteCard')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
