/**
 * 9 语言相对时间短语工具（V1 本地方案）
 *
 * 用途: 替代 useI18nV2 中 formatRelative 函数,
 * 9 种语言（zh-CN/zh-TW/en-US/ja/ko/ar/he/fr/es）都内置短语表,
 * 任何时候无需后端即可工作。
 *
 * 数据源: 直接搬自 useI18nV2.formatRelative, 保持 API 一致。
 */

interface RelativePhrases {
  just: string
  seconds: string
  minutes: string
  hours: string
  days: string
  future: string
  past: string
}

const RELATIVE_PHRASES: Record<string, RelativePhrases> = {
  'zh-CN': { just: '刚刚', seconds: '{n} 秒', minutes: '{n} 分钟', hours: '{n} 小时', days: '{n} 天', future: '{n}后', past: '{n}前' },
  'zh-TW': { just: '剛剛', seconds: '{n} 秒', minutes: '{n} 分鐘', hours: '{n} 小時', days: '{n} 天', future: '{n}後', past: '{n}前' },
  'en-US': { just: 'just now', seconds: '{n} sec', minutes: '{n} min', hours: '{n} hr', days: '{n} d', future: 'in {n}', past: '{n} ago' },
  ja: { just: '今', seconds: '{n} 秒', minutes: '{n} 分', hours: '{n} 時間', days: '{n} 日', future: '{n}後', past: '{n}前' },
  ko: { just: '방금', seconds: '{n}초', minutes: '{n}분', hours: '{n}시간', days: '{n}일', future: '{n} 후', past: '{n} 전' },
  ar: { just: 'الآن', seconds: '{n} ث', minutes: '{n} د', hours: '{n} س', days: '{n} ي', future: 'خلال {n}', past: 'منذ {n}' },
  he: { just: 'עכשיו', seconds: '{n} שניות', minutes: '{n} דקות', hours: '{n} שעות', days: '{n} ימים', future: 'בעוד {n}', past: 'לפני {n}' },
  fr: { just: "à l'instant", seconds: '{n} s', minutes: '{n} min', hours: '{n} h', days: '{n} j', future: 'dans {n}', past: 'il y a {n}' },
  es: { just: 'ahora', seconds: '{n} s', minutes: '{n} min', hours: '{n} h', days: '{n} d', future: 'en {n}', past: 'hace {n}' },
}

/**
 * 格式化相对时间（静态本地化版本）
 * @param value Date/时间戳/ISO 字符串
 * @param lang 语言 code, 未知语言回退 en-US
 */
export function formatRelative(value: Date | number | string, lang = 'zh-CN'): string {
  const date = value instanceof Date ? value : new Date(value)
  const diff = (Date.now() - date.getTime()) / 1000
  const absDiff = Math.abs(diff)
  const isPast = diff >= 0
  const p = RELATIVE_PHRASES[lang] || RELATIVE_PHRASES['en-US']
  if (absDiff < 5) return p.just
  let n = 0
  let unit = ''
  if (absDiff < 60) {
    n = Math.floor(absDiff)
    unit = p.seconds.replace('{n}', String(n))
  } else if (absDiff < 3600) {
    n = Math.floor(absDiff / 60)
    unit = p.minutes.replace('{n}', String(n))
  } else if (absDiff < 86400) {
    n = Math.floor(absDiff / 3600)
    unit = p.hours.replace('{n}', String(n))
  } else {
    n = Math.floor(absDiff / 86400)
    unit = p.days.replace('{n}', String(n))
  }
  return isPast ? p.past.replace('{n}', unit) : p.future.replace('{n}', unit)
}
