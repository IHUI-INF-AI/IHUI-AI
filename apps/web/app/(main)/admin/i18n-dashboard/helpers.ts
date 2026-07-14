import type { I18nOverview } from './types'

export const MOCK: I18nOverview = {
  languages: [
    {
      locale: 'zh-CN',
      name: '简体中文',
      total: 3600,
      translated: 3600,
      missing: 0,
      completion: 100,
    },
    { locale: 'en', name: 'English', total: 3600, translated: 3420, missing: 180, completion: 95 },
    { locale: 'ja', name: '日本語', total: 3600, translated: 3168, missing: 432, completion: 88 },
    { locale: 'ko', name: '한국어', total: 3600, translated: 3060, missing: 540, completion: 85 },
    {
      locale: 'zh-TW',
      name: '繁體中文',
      total: 3600,
      translated: 3312,
      missing: 288,
      completion: 92,
    },
  ],
  totalMissing: 1440,
  recentUpdates: [
    {
      id: '1',
      locale: 'en',
      key: 'common.save',
      namespace: 'common',
      updatedAt: '2026-07-14T10:30:00Z',
      author: 'admin',
    },
    {
      id: '2',
      locale: 'ja',
      key: 'menu.settings',
      namespace: 'menu',
      updatedAt: '2026-07-14T09:15:00Z',
      author: 'translator1',
    },
    {
      id: '3',
      locale: 'ko',
      key: 'home.welcome',
      namespace: 'home',
      updatedAt: '2026-07-13T18:45:00Z',
    },
    {
      id: '4',
      locale: 'zh-TW',
      key: 'user.profile',
      namespace: 'user',
      updatedAt: '2026-07-13T14:20:00Z',
      author: 'admin',
    },
    {
      id: '5',
      locale: 'en',
      key: 'articles.title',
      namespace: 'articles',
      updatedAt: '2026-07-13T11:00:00Z',
    },
  ],
}

export const LOCALE_COLORS: Record<string, string> = {
  'zh-CN': '#10b981',
  en: '#3b82f6',
  ja: '#f59e0b',
  ko: '#8b5cf6',
  'zh-TW': '#ec4899',
}

export function fmtTime(v: string) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}
