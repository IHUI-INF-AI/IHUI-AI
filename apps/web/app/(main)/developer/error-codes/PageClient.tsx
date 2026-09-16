// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, BookOpen, KeyRound } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { ErrorCodeTable } from '@/components/api-docs/ErrorCodeTable'

export default function ErrorCodesPageClient() {
  const t = useTranslations('developer')
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <AlertTriangle className="h-5 w-5 text-primary" aria-hidden />
          {t('errorCodes.title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('errorCodes.subtitle')}</p>
      </div>

      <ErrorCodeTable />

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">{t('errorCodes.relatedDocs')}</p>
          <div className="space-y-2">
            <Link
              href="/developer/api-docs"
              className="group flex items-center justify-between gap-2 rounded-md border bg-card p-3 transition-colors hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm">{t('errorCodes.apiDocsDesc')}</span>
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </Link>
            <Link
              href="/developer/relay/keys"
              className="group flex items-center justify-between gap-2 rounded-md border bg-card p-3 transition-colors hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm">{t('errorCodes.apiKeysDesc')}</span>
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
