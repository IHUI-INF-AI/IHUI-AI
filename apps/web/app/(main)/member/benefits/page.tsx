'use client'

import { useQuery } from '@tanstack/react-query'
import { Award, Loader2, Check, Crown } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Benefit {
  id: string
  levelName: string
  levelValue: number
  benefits: string[]
  current?: boolean
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberBenefitsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'benefits'],
    queryFn: () =>
      api<{ items: Benefit[] } | Benefit[]>('/api/member/benefits')
        .then((d) => ('items' in d ? d.items : d))
        .catch(() => [] as Benefit[]),
  })

  const items = data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Award className="h-5 w-5 text-primary" />
          会员权益
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">不同等级会员可享受的专属权益</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Award className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无权益数据</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((b) => {
            const benefits = Array.isArray(b.benefits) ? b.benefits : []
            return (
              <Card
                key={b.id}
                className={cn(
                  'transition-colors',
                  b.current && 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10',
                )}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <span className="text-base font-semibold">{b.levelName}</span>
                    </div>
                    {b.current && (
                      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        当前等级
                      </span>
                    )}
                  </div>
                  {benefits.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {benefits.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无具体权益说明</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
