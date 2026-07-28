'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Calculator, FileText, Info } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'

export function BillingRules(): React.JSX.Element {
  const t = useTranslations('developerPricingPage')

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('rulesTitle')}</p>
        </div>

        <p className="text-xs text-muted-foreground">{t('rulesSubtitle')}</p>

        {/* 公式卡片 */}
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('formula')}
          </p>
          <p className="mt-1.5 font-mono text-sm font-semibold">
            {t('formulaBody')}
          </p>
        </div>

        {/* 公式参数说明 */}
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">{t('paramCol')}</th>
                <th className="px-3 py-1.5 font-medium">{t('paramDesc')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-1.5 font-mono">{t('paramInputPrice')}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {t('paramInputPriceDesc')}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-1.5 font-mono">{t('paramOutputPrice')}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {t('paramOutputPriceDesc')}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-1.5 font-mono">{t('paramInputTokens')}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {t('paramInputTokensDesc')}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-1.5 font-mono">{t('paramOutputTokens')}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {t('paramOutputTokensDesc')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 示例 */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <FileText className="h-3.5 w-3.5" />
            {t('exampleTitle')}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('exampleIntro')}
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed">
            {t('exampleStep1')}
            <br />
            {t('exampleStep2')}
            <br />
            <span className="text-primary">{t('exampleResult')}</span>
          </p>
        </div>

        {/* 计费说明 */}
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{t('noteRegion')}</p>
            <p>{t('noteSettlement')}</p>
            <p>{t('noteRound')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
