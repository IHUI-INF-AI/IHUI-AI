'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type CellStatus = 'yes' | 'no' | 'partial'

interface ComparisonRow {
  labelKey: string
  cells: CellStatus[]
}

const COMPETITORS = ['IHUI AI', 'ChatGPT Plus', 'Claude Pro', 'Dify', 'LangSmith']

const ROWS: ComparisonRow[] = [
  { labelKey: 'comparison.price', cells: ['yes', 'no', 'no', 'yes', 'no'] },
  { labelKey: 'comparison.llmCount', cells: ['yes', 'no', 'no', 'partial', 'partial'] },
  { labelKey: 'comparison.multiTenant', cells: ['yes', 'no', 'no', 'yes', 'no'] },
  { labelKey: 'comparison.rag', cells: ['yes', 'partial', 'no', 'yes', 'yes'] },
  { labelKey: 'comparison.agentMarket', cells: ['yes', 'no', 'no', 'yes', 'no'] },
  { labelKey: 'comparison.eightEnds', cells: ['yes', 'no', 'no', 'no', 'no'] },
  { labelKey: 'comparison.openSource', cells: ['yes', 'no', 'no', 'yes', 'no'] },
  { labelKey: 'comparison.selfHost', cells: ['yes', 'no', 'no', 'yes', 'yes'] },
  { labelKey: 'comparison.apache2', cells: ['yes', 'no', 'no', 'yes', 'no'] },
  { labelKey: 'comparison.privateDeploy', cells: ['yes', 'no', 'no', 'yes', 'partial'] },
]

function StatusCell({ status }: { status: CellStatus }): React.JSX.Element {
  if (status === 'yes') {
    return <Check className="mx-auto h-4 w-4 text-emerald-500" />
  }
  if (status === 'no') {
    return <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
  }
  return <Minus className="mx-auto h-4 w-4 text-amber-500" />
}

export function ComparisonTable(): React.JSX.Element {
  const t = useTranslations('pricingPage')

  return (
    <section className="mx-auto mt-14 max-w-5xl">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
          {t('comparison.title')}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('comparison.subtitle')}
        </p>
      </div>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-muted/40 p-3 text-left font-medium text-muted-foreground">
                {t('comparison.feature')}
              </th>
              {COMPETITORS.map((name, idx) => (
                <th
                  key={name}
                  className={cn(
                    'border border-border p-3 text-center font-medium',
                    idx === 0 ? 'bg-primary/5 text-primary' : 'bg-muted/40 text-foreground',
                  )}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.labelKey}>
                <td className="border border-border p-3 text-left text-muted-foreground">
                  {t(row.labelKey)}
                </td>
                {row.cells.map((status, idx) => (
                  <td
                    key={idx}
                    className={cn('border border-border p-3', idx === 0 && 'bg-primary/5')}
                  >
                    <StatusCell status={status} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
