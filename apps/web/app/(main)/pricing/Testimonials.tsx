'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'

interface Testimonial {
  name: string
  role: string
  company: string
  text: string
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
}

export function Testimonials(): React.JSX.Element {
  const t = useTranslations('pricingPage')
  const items = t.raw('testimonials.items') as Testimonial[]

  return (
    <section className="mx-auto mt-14 max-w-5xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t('testimonials.title')}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          {t('testimonials.subtitle')}
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((item, idx) => (
          <Card key={idx} className="border-border">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground">{item.text}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(item.name)}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.role} @ {item.company}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
