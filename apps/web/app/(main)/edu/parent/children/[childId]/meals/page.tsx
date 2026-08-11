'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { UtensilsCrossed, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface MealItem {
  id: string
  date: string
  mealType: string
  dishName: string
  ingredients: string | null
  nutrition: string | null
  imageUrl: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export default function ChildMealsPage() {
  const t = useTranslations('parentPortal')
  const tc = useTranslations('common')
  const params = useParams()
  const childId = params.childId as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'meals'],
    queryFn: () => api<{ list: MealItem[] }>(`/api/edu-ai-management/parent/children/${childId}/meals`),
  })

  const meals = data?.list ?? []
  const grouped = meals.reduce<Record<string, MealItem[]>>((acc, m) => {
    ;(acc[m.mealType] ??= []).push(m)
    return acc
  }, {})

  const typeOrder = ['breakfast', 'lunch', 'dinner', 'snack']

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('child.meals')}</h1>
        <p className="text-xs text-muted-foreground">{t('child.mealsHint')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={tc('loadFailed')} />
      ) : meals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('child.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
          {typeOrder.map((type) => {
            const items = grouped[type]
            if (!items) return null
            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {MEAL_TYPE_LABELS[type] ?? type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((m) => (
                    <div key={m.id} className="rounded-lg border bg-card px-3 py-2">
                      <p className="text-sm font-medium">{m.dishName}</p>
                      {m.ingredients && (
                        <p className="mt-1 text-xs text-muted-foreground">{m.ingredients}</p>
                      )}
                      {m.nutrition && (
                        <p className="mt-0.5 text-xs text-emerald-600">{m.nutrition}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}