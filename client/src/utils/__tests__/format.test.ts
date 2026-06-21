import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'time.never': '从未',
      'text.format.无效时间': '无效时间',
    }
    return map[key] || key
  },
}))

describe('format utils', () => {
  describe('formatNumber', () => {
    it('应该返回原始数字当小于1000', async () => {
      const { formatNumber } = await import('../format')
      expect(formatNumber(999)).toBe('999')
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(500)).toBe('500')
    })

    it('应该返回k格式当在1000-9999之间', async () => {
      const { formatNumber } = await import('../format')
      expect(formatNumber(1000)).toBe('1.0k')
      expect(formatNumber(5000)).toBe('5.0k')
      expect(formatNumber(9999)).toBe('10.0k')
    })

    it('应该返回w格式当大于等于10000', async () => {
      const { formatNumber } = await import('../format')
      expect(formatNumber(10000)).toBe('1.0w')
      expect(formatNumber(50000)).toBe('5.0w')
    })
  })

  describe('formatDateTime', () => {
    it('应该返回"从未"当日期为空', async () => {
      const { formatDateTime } = await import('../format')
      expect(formatDateTime(null)).toBe('从未')
      expect(formatDateTime(undefined)).toBe('从未')
      expect(formatDateTime('')).toBe('从未')
    })

    it('应该返回"无效时间"当日期无效', async () => {
      const { formatDateTime } = await import('../format')
      expect(formatDateTime('invalid')).toBe('无效时间')
    })

    it('应该格式化日期时间', async () => {
      const { formatDateTime } = await import('../format')
      const date = new Date('2024-01-15T10:30:00')
      expect(formatDateTime(date)).toBe('2024/01/15 10:30')
    })

    it('应该支持字符串日期', async () => {
      const { formatDateTime } = await import('../format')
      expect(formatDateTime('2024-06-20T14:45:00')).toBe('2024/06/20 14:45')
    })

    it('应该支持时间戳', async () => {
      const { formatDateTime } = await import('../format')
      const timestamp = new Date('2024-03-10T08:15:00').getTime()
      expect(formatDateTime(timestamp)).toBe('2024/03/10 08:15')
    })
  })

  describe('formatSize', () => {
    it('应该返回0B当bytes为0', async () => {
      const { formatSize } = await import('../format')
      expect(formatSize(0)).toBe('0B')
    })

    it('应该返回B格式当小于1024', async () => {
      const { formatSize } = await import('../format')
      expect(formatSize(512)).toBe('512.00B')
    })

    it('应该返回KB格式当在1024-1048575之间', async () => {
      const { formatSize } = await import('../format')
      expect(formatSize(1024)).toBe('1.00KB')
      expect(formatSize(2048)).toBe('2.00KB')
    })

    it('应该返回MB格式当在1048576-1073741823之间', async () => {
      const { formatSize } = await import('../format')
      expect(formatSize(1048576)).toBe('1.00MB')
    })

    it('应该返回GB格式当大于等于1073741824', async () => {
      const { formatSize } = await import('../format')
      expect(formatSize(1073741824)).toBe('1.00GB')
    })
  })

  describe('formatPercent', () => {
    it('应该返回0%当total为0', async () => {
      const { formatPercent } = await import('../format')
      expect(formatPercent(50, 0)).toBe('0%')
    })

    it('应该计算百分比', async () => {
      const { formatPercent } = await import('../format')
      expect(formatPercent(50, 100)).toBe('50.0%')
      expect(formatPercent(1, 3)).toBe('33.3%')
    })
  })

  describe('formatDuration', () => {
    it('应该返回ms格式当小于1000', async () => {
      const { formatDuration } = await import('../format')
      expect(formatDuration(500)).toBe('500ms')
    })

    it('应该返回s格式当在1000-59999之间', async () => {
      const { formatDuration } = await import('../format')
      expect(formatDuration(1000)).toBe('1.0s')
      expect(formatDuration(30000)).toBe('30.0s')
    })

    it('应该返回min格式当在60000-3599999之间', async () => {
      const { formatDuration } = await import('../format')
      expect(formatDuration(60000)).toBe('1.0min')
      expect(formatDuration(1800000)).toBe('30.0min')
    })

    it('应该返回h格式当大于等于3600000', async () => {
      const { formatDuration } = await import('../format')
      expect(formatDuration(3600000)).toBe('1.0h')
    })
  })

  describe('formatTime', () => {
    it('应该返回空字符串当日期为空', async () => {
      const { formatTime } = await import('../format')
      expect(formatTime(null)).toBe('')
      expect(formatTime(undefined)).toBe('')
    })

    it('应该返回空字符串当日期无效', async () => {
      const { formatTime } = await import('../format')
      expect(formatTime('invalid')).toBe('')
    })

    it('应该使用默认格式', async () => {
      const { formatTime } = await import('../format')
      const date = new Date('2024-01-15T10:30:45')
      expect(formatTime(date)).toBe('2024-01-15 10:30:45')
    })

    it('应该支持自定义格式', async () => {
      const { formatTime } = await import('../format')
      const date = new Date('2024-01-15T10:30:45')
      expect(formatTime(date, 'YYYY/MM/DD')).toBe('2024/01/15')
      expect(formatTime(date, 'HH:mm')).toBe('10:30')
    })
  })

  describe('formatTokenValue', () => {
    it('应该返回0当值为空', async () => {
      const { formatTokenValue } = await import('../format')
      expect(formatTokenValue(null)).toBe('0')
      expect(formatTokenValue(undefined)).toBe('0')
      expect(formatTokenValue(0)).toBe('0')
    })

    it('应该返回原始值当小于10000', async () => {
      const { formatTokenValue } = await import('../format')
      expect(formatTokenValue(9999)).toBe('9999')
      expect(formatTokenValue(100)).toBe('100')
    })

    it('应该返回万格式当大于等于10000', async () => {
      const { formatTokenValue } = await import('../format')
      expect(formatTokenValue(10000)).toBe('1万')
      expect(formatTokenValue(15000)).toBe('1.5万')
      expect(formatTokenValue(123456)).toBe('12.34万')
    })
  })

  describe('debounce', () => {
    it('应该延迟执行函数', async () => {
      const { debounce } = await import('../format')
      vi.useFakeTimers()
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('应该取消之前的调用', async () => {
      const { debounce } = await import('../format')
      vi.useFakeTimers()
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('first')
      vi.advanceTimersByTime(50)
      debouncedFn('second')
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('second')
      vi.useRealTimers()
    })
  })

  describe('throttle', () => {
    it('应该限制函数执行频率', async () => {
      const { throttle } = await import('../format')
      vi.useFakeTimers()
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn('first')
      vi.advanceTimersByTime(50)
      throttledFn('second')
      vi.advanceTimersByTime(50)
      throttledFn('third')

      expect(fn).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe('formatMoney', () => {
    it('应该格式化金额', async () => {
      const { formatMoney } = await import('../format')
      expect(formatMoney(123.456)).toBe('123.46')
      expect(formatMoney(100)).toBe('100.00')
    })

    it('应该支持自定义小数位数', async () => {
      const { formatMoney } = await import('../format')
      expect(formatMoney(123.456, 1)).toBe('123.5')
      expect(formatMoney(123.456, 0)).toBe('123')
    })

    it('应该支持字符串输入', async () => {
      const { formatMoney } = await import('../format')
      expect(formatMoney('123.456')).toBe('123.46')
    })
  })

  describe('formatPhone', () => {
    it('应该隐藏手机号中间四位', async () => {
      const { formatPhone } = await import('../format')
      expect(formatPhone('13812345678')).toBe('138****5678')
    })
  })

  describe('formatFileSize', () => {
    it('应该返回0 B当bytes为0', async () => {
      const { formatFileSize } = await import('../format')
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('应该格式化文件大小', async () => {
      const { formatFileSize } = await import('../format')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })
  })

  describe('isEmpty', () => {
    it('应该返回true当值为空', async () => {
      const { isEmpty } = await import('../format')
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
      expect(isEmpty('')).toBe(true)
      expect(isEmpty('  ')).toBe(true)
      expect(isEmpty([])).toBe(true)
      expect(isEmpty({})).toBe(true)
    })

    it('应该返回false当值不为空', async () => {
      const { isEmpty } = await import('../format')
      expect(isEmpty('text')).toBe(false)
      expect(isEmpty([1])).toBe(false)
      expect(isEmpty({ a: 1 })).toBe(false)
      expect(isEmpty(0)).toBe(false)
      expect(isEmpty(false)).toBe(false)
    })
  })
})
