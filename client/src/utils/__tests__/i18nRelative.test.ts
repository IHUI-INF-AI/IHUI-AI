import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { formatRelative } from '../i18nRelative'

// 9 语言 + 边界用例
const LANGS = ['zh-CN', 'zh-TW', 'en-US', 'ja', 'ko', 'ar', 'he', 'fr', 'es'] as const

// 冻结当前时间为固定基准, 避免 Date.now() 漂移
const NOW = Date.parse('2026-06-24T12:00:00.000Z')
const offset = (sec: number) => new Date(NOW + sec * 1000)

describe('i18nRelative.formatRelative', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  describe('输入类型支持', () => {
    it('应接受 Date 对象', () => {
      const result = formatRelative(offset(-30), 'en-US')
      expect(result).toBe('30 sec ago')
    })

    it('应接受数字时间戳', () => {
      const result = formatRelative(NOW - 30 * 1000, 'en-US')
      expect(result).toBe('30 sec ago')
    })

    it('应接受 ISO 字符串', () => {
      const iso = new Date(NOW - 60 * 1000).toISOString()
      const result = formatRelative(iso, 'en-US')
      expect(result).toBe('1 min ago')
    })
  })

  describe('时间粒度（英文基准）', () => {
    it('小于 5 秒应返回 just', () => {
      expect(formatRelative(offset(0), 'en-US')).toBe('just now')
      expect(formatRelative(offset(-2), 'en-US')).toBe('just now')
      expect(formatRelative(offset(-4.9), 'en-US')).toBe('just now')
    })

    it('5~59 秒应使用 seconds 短语 (past)', () => {
      expect(formatRelative(offset(-5), 'en-US')).toBe('5 sec ago')
      expect(formatRelative(offset(-30), 'en-US')).toBe('30 sec ago')
      expect(formatRelative(offset(-59), 'en-US')).toBe('59 sec ago')
    })

    it('1~59 分钟应使用 minutes 短语 (past)', () => {
      expect(formatRelative(offset(-60), 'en-US')).toBe('1 min ago')
      expect(formatRelative(offset(-5 * 60), 'en-US')).toBe('5 min ago')
      expect(formatRelative(offset(-59 * 60), 'en-US')).toBe('59 min ago')
    })

    it('1~23 小时应使用 hours 短语 (past)', () => {
      expect(formatRelative(offset(-3600), 'en-US')).toBe('1 hr ago')
      expect(formatRelative(offset(-5 * 3600), 'en-US')).toBe('5 hr ago')
      expect(formatRelative(offset(-23 * 3600), 'en-US')).toBe('23 hr ago')
    })

    it('1 天及以上应使用 days 短语 (past)', () => {
      expect(formatRelative(offset(-86400), 'en-US')).toBe('1 d ago')
      expect(formatRelative(offset(-3 * 86400), 'en-US')).toBe('3 d ago')
      expect(formatRelative(offset(-365 * 86400), 'en-US')).toBe('365 d ago')
    })
  })

  describe('未来时间 (future 分支)', () => {
    it('应使用 future 短语包裹单位', () => {
      expect(formatRelative(offset(30), 'en-US')).toBe('in 30 sec')
      expect(formatRelative(offset(2 * 60), 'en-US')).toBe('in 2 min')
      expect(formatRelative(offset(2 * 3600), 'en-US')).toBe('in 2 hr')
      expect(formatRelative(offset(2 * 86400), 'en-US')).toBe('in 2 d')
    })

    it('5 秒边界：未来 4.9 秒应返回 just', () => {
      expect(formatRelative(offset(4.9), 'en-US')).toBe('just now')
    })
  })

  describe('9 语言全覆盖 (5 分钟前 基准)', () => {
    // 5 分钟前 ＝ minutes 单位, 过去
    const expectMap: Record<typeof LANGS[number], string> = {
      'zh-CN': '5 分钟前',
      'zh-TW': '5 分鐘前',
      'en-US': '5 min ago',
      ja: '5 分前',
      ko: '5분 전',
      ar: 'منذ 5 د',
      he: 'לפני 5 דקות',
      fr: 'il y a 5 min',
      es: 'hace 5 min',
    }
    for (const lang of LANGS) {
      it(`${lang}: 5 分钟前`, () => {
        const result = formatRelative(offset(-5 * 60), lang)
        expect(result).toBe(expectMap[lang])
      })
    }
  })

  describe('9 语言全覆盖 (2 小时后 基准)', () => {
    const expectMap: Record<typeof LANGS[number], string> = {
      'zh-CN': '2 小时后',
      'zh-TW': '2 小時後',
      'en-US': 'in 2 hr',
      ja: '2 時間後',
      ko: '2시간 후',
      ar: 'خلال 2 س',
      he: 'בעוד 2 שעות',
      fr: 'dans 2 h',
      es: 'en 2 h',
    }
    for (const lang of LANGS) {
      it(`${lang}: 2 小时后`, () => {
        const result = formatRelative(offset(2 * 3600), lang)
        expect(result).toBe(expectMap[lang])
      })
    }
  })

  describe('9 语言全覆盖 (3 天前 基准)', () => {
    const expectMap: Record<typeof LANGS[number], string> = {
      'zh-CN': '3 天前',
      'zh-TW': '3 天前',
      'en-US': '3 d ago',
      ja: '3 日前',
      ko: '3일 전',
      ar: 'منذ 3 ي',
      he: 'לפני 3 ימים',
      fr: 'il y a 3 j',
      es: 'hace 3 d',
    }
    for (const lang of LANGS) {
      it(`${lang}: 3 天前`, () => {
        const result = formatRelative(offset(-3 * 86400), lang)
        expect(result).toBe(expectMap[lang])
      })
    }
  })

  describe('9 语言全覆盖 (just 基准, 2 秒前)', () => {
    const expectMap: Record<typeof LANGS[number], string> = {
      'zh-CN': '刚刚',
      'zh-TW': '剛剛',
      'en-US': 'just now',
      ja: '今',
      ko: '방금',
      ar: 'الآن',
      he: 'עכשיו',
      fr: "à l'instant",
      es: 'ahora',
    }
    for (const lang of LANGS) {
      it(`${lang}: 2 秒前 → just`, () => {
        const result = formatRelative(offset(-2), lang)
        expect(result).toBe(expectMap[lang])
      })
    }
  })

  describe('语言回退', () => {
    it('未支持的语言应回退到 en-US', () => {
      expect(formatRelative(offset(-30), 'xx-XX')).toBe('30 sec ago')
      expect(formatRelative(offset(30), 'xx-XX')).toBe('in 30 sec')
      expect(formatRelative(offset(-2), 'xx-XX')).toBe('just now')
    })

    it('默认 lang 缺省应使用 zh-CN', () => {
      expect(formatRelative(offset(-5 * 60))).toBe('5 分钟前')
    })
  })

  describe('边界与数值正确性', () => {
    it('5 秒是 just 与 seconds 的临界点', () => {
      expect(formatRelative(offset(-5), 'en-US')).toBe('5 sec ago')
      expect(formatRelative(offset(-4.999), 'en-US')).toBe('just now')
    })

    it('60 秒是 seconds 与 minutes 的临界点', () => {
      expect(formatRelative(offset(-60), 'en-US')).toBe('1 min ago')
      expect(formatRelative(offset(-59), 'en-US')).toBe('59 sec ago')
    })

    it('3600 秒是 minutes 与 hours 的临界点', () => {
      expect(formatRelative(offset(-3600), 'en-US')).toBe('1 hr ago')
      expect(formatRelative(offset(-3599), 'en-US')).toBe('59 min ago')
    })

    it('86400 秒是 hours 与 days 的临界点', () => {
      expect(formatRelative(offset(-86400), 'en-US')).toBe('1 d ago')
      expect(formatRelative(offset(-86399), 'en-US')).toBe('23 hr ago')
    })
  })
})
