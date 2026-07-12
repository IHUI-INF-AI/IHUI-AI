'use client'

import type * as React from 'react'
import { Loader2, Star } from 'lucide-react'

type IconType = React.ComponentType<{ className?: string }>

export function PointsState({
  kind,
  text,
  icon: Icon,
}: {
  kind: 'loading' | 'error' | 'empty'
  text: string
  icon?: IconType
}) {
  if (kind === 'error')
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {text}
      </div>
    )
  if (kind === 'loading') {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {text}
      </div>
    )
  }
  const I = Icon ?? Star
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <I className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
