'use client'

import { useTranslations } from 'next-intl'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

const SUPPORTED_REGIONS: readonly string[] = [
  'regionChinaMainland',
  'regionHongKong',
  'regionMacau',
  'regionTaiwan',
  'regionUS',
  'regionCanada',
  'regionEU',
  'regionUK',
  'regionJapan',
  'regionKorea',
  'regionSEA',
  'regionIndia',
  'regionAustralia',
  'regionBrazil',
  'regionRussia',
]

const RESTRICTED_REGIONS: readonly string[] = [
  'restrictedKorea',
  'restrictedIran',
  'restrictedSyria',
  'restrictedCuba',
  'restrictedCrimea',
  'restrictedDonetsk',
  'restrictedLuhansk',
]

const PAYMENTS: readonly string[] = [
  'paymentWechat',
  'paymentAlipay',
  'paymentStripe',
  'paymentPaypal',
]

const LANGUAGES: readonly string[] = ['languageZhCN', 'languageZhTW', 'languageEN', 'languageJA', 'languageKO']

export default function SupportedRegionsPage() {
  const t = useTranslations('legal.supportedRegions')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{t('lastUpdated')}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('supportedTitle')}</h2>
          <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3">
            {SUPPORTED_REGIONS.map((key) => (
              <div
                key={key}
                className="rounded-md border bg-card px-3 py-2 text-sm text-foreground"
              >
                {t(key)}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('restrictedTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('restrictedIntro')}</p>
          <div className="flex flex-wrap gap-2">
            {RESTRICTED_REGIONS.map((key) => (
              <div
                key={key}
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-sm text-destructive"
              >
                {t(key)}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('paymentTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('paymentIntro')}</p>
          <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2">
            {PAYMENTS.map((key) => (
              <div
                key={key}
                className="rounded-md border bg-card px-3 py-2 text-sm text-foreground"
              >
                {t(key)}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('languageTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('languageIntro')}</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((key) => (
              <div
                key={key}
                className="rounded-md border bg-card px-3 py-1.5 text-sm text-foreground"
              >
                {t(key)}
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
