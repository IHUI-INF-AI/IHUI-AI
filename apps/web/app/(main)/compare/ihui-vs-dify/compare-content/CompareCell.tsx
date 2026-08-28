import * as React from 'react'
import { Check, X } from 'lucide-react'

import type { CellValue } from './types'

export function Cell({
  value,
  isIhui,
  dimension,
}: {
  value: CellValue
  dimension: string
  isIhui: boolean
}) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check
        className="mx-auto h-5 w-5 text-primary"
        aria-label={`${isIhui ? 'IHUI AI' : '竞品'}支持 ${dimension}`}
      />
    ) : (
      <X
        className="mx-auto h-5 w-5 text-muted-foreground/40"
        aria-label={`${isIhui ? 'IHUI AI' : '竞品'}不支持 ${dimension}`}
      />
    )
  }
  return <span className="text-sm font-medium">{value}</span>
}
