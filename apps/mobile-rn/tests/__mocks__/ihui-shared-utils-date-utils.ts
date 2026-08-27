// Stub for @ihui/shared/utils/date-utils - vitest mock
// Provides date formatting functions used by date-utils.ts and related screens.

export function formatDate(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}

export function formatDateByTemplate(_date: string | Date, _template: string): string {
  return new Date(_date).toLocaleDateString()
}

export function formatDateOnly(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}

export function formatShortDateTime(_date: string | Date): string {
  return new Date(_date).toLocaleString()
}

export function formatShortDate(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}

export function formatShortDateWithYear(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}

export function formatTimeOnly(_date: string | Date): string {
  return new Date(_date).toLocaleTimeString()
}

export function formatRelativeTime(_date: string | Date): string {
  return 'just now'
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US')
}

export function formatCurrency(value: number | null | undefined, prefix = '¥'): string {
  if (value === null || value === undefined) return '—'
  return `${prefix} ${value.toFixed(2)}`
}
