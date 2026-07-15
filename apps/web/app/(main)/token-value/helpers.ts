export type Range = 'today' | '7d' | '30d' | 'custom'

export const PAGE_SIZE = 10

export const RANGES: { key: Range; labelKey: string }[] = [
  { key: 'today', labelKey: 'rangeToday' },
  { key: '7d', labelKey: 'range7d' },
  { key: '30d', labelKey: 'range30d' },
  { key: 'custom', labelKey: 'rangeCustom' },
]
