import type { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function relativeTime(iso: string, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return t('justNow')
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('minutesAgo', { min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('hoursAgo', { hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return t('daysAgo', { day })
  return new Date(iso).toLocaleDateString('zh-CN')
}
