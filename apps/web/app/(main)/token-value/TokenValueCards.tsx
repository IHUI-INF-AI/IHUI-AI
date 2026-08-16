'use client'

import { Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TruncatedText } from '@/components/common'

interface Card {
  label: string
  val: React.ReactNode
  tone: string
  big: boolean
}

interface Props {
  cards: Card[]
  isLoading: boolean
}

export function TokenValueCards({ cards, isLoading }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="flex items-center justify-between gap-2">
            <TruncatedText
              value={c.label}
              className="min-w-0 flex-1 text-sm text-muted-foreground"
            />
            {c.big && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Coins className="h-4 w-4" />
              </div>
            )}
          </div>
          <div
            className={cn(
              'mt-2 font-bold tabular-nums tracking-tight',
              c.big ? 'text-2xl min-[768px]:text-3xl' : 'text-lg min-[768px]:text-xl',
              c.tone,
            )}
          >
            {isLoading ? (
              <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" />
            ) : (
              c.val
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
