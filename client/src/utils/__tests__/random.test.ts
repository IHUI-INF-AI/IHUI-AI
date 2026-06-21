import { describe, it, expect } from 'vitest'
import {
  randomInt,
  randomFloat,
  randomBoolean,
  randomElement,
  randomElements,
  shuffle,
  randomString,
  randomNumericString,
  randomAlphaString,
  randomAlphanumeric,
  randomHex,
  uuid,
  uuidShort,
  nanoid,
  randomColor,
  randomRgb,
  randomRgba,
  randomHsl,
  randomDate,
  randomTimestamp,
  randomIp,
  randomMac,
  randomPort,
  randomUrl,
  randomEmail,
  randomPhone,
  weightedRandom,
  randomRange,
  useRandom,
} from '../random'

describe('random', () => {
  describe('randomInt', () => {
    it('应该返回范围内的整数', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomInt(1, 10)
        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBeLessThanOrEqual(10)
        expect(Number.isInteger(result)).toBe(true)
      }
    })

    it('应该返回相同的值当min等于max', () => {
      expect(randomInt(5, 5)).toBe(5)
    })
  })

  describe('randomFloat', () => {
    it('应该返回范围内的浮点数', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomFloat(1, 10)
        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBeLessThanOrEqual(10)
      }
    })

    it('应该有指定的小数位数', () => {
      const result = randomFloat(1, 10, 3)
      const decimals = String(result).split('.')[1]?.length ?? 0
      expect(decimals).toBeLessThanOrEqual(3)
    })
  })

  describe('randomBoolean', () => {
    it('应该返回布尔值', () => {
      const result = randomBoolean()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('randomElement', () => {
    it('应该返回数组中的元素', () => {
      const arr = [1, 2, 3, 4, 5]
      for (let i = 0; i < 100; i++) {
        const result = randomElement(arr)
        expect(arr).toContain(result)
      }
    })

    it('应该返回undefined当数组为空', () => {
      expect(randomElement([])).toBeUndefined()
    })
  })

  describe('randomElements', () => {
    it('应该返回指定数量的元素', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = randomElements(arr, 3)
      expect(result).toHaveLength(3)
    })

    it('应该返回不重复的元素', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = randomElements(arr, 5)
      expect(new Set(result).size).toBe(5)
    })
  })

  describe('shuffle', () => {
    it('应该返回打乱后的数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = shuffle(arr)
      expect(result).toHaveLength(5)
      expect(result.sort()).toEqual(arr)
    })

    it('不应该修改原数组', () => {
      const arr = [1, 2, 3]
      shuffle(arr)
      expect(arr).toEqual([1, 2, 3])
    })
  })

  describe('randomString', () => {
    it('应该返回指定长度的字符串', () => {
      expect(randomString(10)).toHaveLength(10)
    })

    it('应该使用自定义字符集', () => {
      const result = randomString(10, 'abc')
      expect(result).toMatch(/^[abc]{10}$/)
    })
  })

  describe('randomNumericString', () => {
    it('应该返回数字字符串', () => {
      const result = randomNumericString(10)
      expect(result).toMatch(/^\d{10}$/)
    })
  })

  describe('randomAlphaString', () => {
    it('应该返回小写字母字符串', () => {
      const result = randomAlphaString(10)
      expect(result).toMatch(/^[a-z]{10}$/)
    })

    it('应该返回大写字母字符串', () => {
      const result = randomAlphaString(10, true)
      expect(result).toMatch(/^[A-Z]{10}$/)
    })
  })

  describe('randomAlphanumeric', () => {
    it('应该返回字母数字字符串', () => {
      const result = randomAlphanumeric(10)
      expect(result).toMatch(/^[a-zA-Z0-9]{10}$/)
    })
  })

  describe('randomHex', () => {
    it('应该返回十六进制字符串', () => {
      const result = randomHex(10)
      expect(result).toMatch(/^[0-9a-f]{10}$/)
    })
  })

  describe('uuid', () => {
    it('应该返回有效的UUID格式', () => {
      const result = uuid()
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
  })

  describe('uuidShort', () => {
    it('应该返回8字符的短UUID', () => {
      const result = uuidShort()
      expect(result).toHaveLength(8)
      expect(result).toMatch(/^[0-9a-f]{8}$/)
    })
  })

  describe('nanoid', () => {
    it('应该返回默认21字符的nanoid', () => {
      const result = nanoid()
      expect(result).toHaveLength(21)
    })

    it('应该返回指定长度的nanoid', () => {
      expect(nanoid(10)).toHaveLength(10)
    })
  })

  describe('randomColor', () => {
    it('应该返回有效的十六进制颜色', () => {
      const result = randomColor()
      expect(result).toMatch(/^#[0-9a-f]{6}$/)
    })
  })

  describe('randomRgb', () => {
    it('应该返回有效的RGB颜色', () => {
      const result = randomRgb()
      expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
    })
  })

  describe('randomRgba', () => {
    it('应该返回有效的RGBA颜色', () => {
      const result = randomRgba(0.5)
      expect(result).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/)
    })
  })

  describe('randomHsl', () => {
    it('应该返回有效的HSL颜色', () => {
      const result = randomHsl()
      expect(result).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
    })
  })

  describe('randomDate', () => {
    it('应该返回范围内的日期', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2020-12-31')
      const result = randomDate(start, end)
      expect(result.getTime()).toBeGreaterThanOrEqual(start.getTime())
      expect(result.getTime()).toBeLessThanOrEqual(end.getTime())
    })
  })

  describe('randomTimestamp', () => {
    it('应该返回范围内的时间戳', () => {
      const start = 1000000
      const end = 2000000
      const result = randomTimestamp(start, end)
      expect(result).toBeGreaterThanOrEqual(start)
      expect(result).toBeLessThanOrEqual(end)
    })
  })

  describe('randomIp', () => {
    it('应该返回有效的IP地址', () => {
      const result = randomIp()
      expect(result).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
    })
  })

  describe('randomMac', () => {
    it('应该返回有效的MAC地址', () => {
      const result = randomMac()
      expect(result).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)
    })
  })

  describe('randomPort', () => {
    it('应该返回有效的端口号', () => {
      const result = randomPort()
      expect(result).toBeGreaterThanOrEqual(1024)
      expect(result).toBeLessThanOrEqual(65535)
    })
  })

  describe('randomUrl', () => {
    it('应该返回有效的URL', () => {
      const result = randomUrl()
      expect(result).toMatch(/^https?:\/\/.+\..+/)
    })

    it('应该使用指定的协议', () => {
      const result = randomUrl('http')
      expect(result).toMatch(/^http:\/\//)
    })
  })

  describe('randomEmail', () => {
    it('应该返回有效的邮箱地址', () => {
      const result = randomEmail()
      expect(result).toMatch(/^[a-z0-9]+@[a-z]+\.[a-z]+$/)
    })

    it('应该使用指定的域名', () => {
      const result = randomEmail('example.com')
      expect(result).toMatch(/^[a-z0-9]+@example\.com$/)
    })
  })

  describe('randomPhone', () => {
    it('应该返回有效的手机号', () => {
      const result = randomPhone()
      expect(result).toMatch(/^1[3-9]\d{9}$/)
    })
  })

  describe('weightedRandom', () => {
    it('应该根据权重返回元素', () => {
      const items = ['a', 'b', 'c']
      const weights = [1, 1, 1]
      const result = weightedRandom(items, weights)
      expect(items).toContain(result)
    })

    it('应该返回undefined当数组为空', () => {
      expect(weightedRandom([], [])).toBeUndefined()
    })

    it('应该返回undefined当长度不匹配', () => {
      expect(weightedRandom(['a', 'b'], [1])).toBeUndefined()
    })
  })

  describe('randomRange', () => {
    it('应该返回指定数量的随机数', () => {
      const result = randomRange(5, 1, 10)
      expect(result).toHaveLength(5)
      result.forEach(n => {
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(10)
      })
    })

    it('应该返回唯一的随机数', () => {
      const result = randomRange(5, 1, 10, true)
      expect(new Set(result).size).toBe(5)
    })

    it('应该抛出错误当范围太小', () => {
      expect(() => randomRange(5, 1, 3, true)).toThrow()
    })
  })

  describe('useRandom', () => {
    it('应该返回所有随机函数', () => {
      const utils = useRandom()
      expect(typeof utils.randomInt).toBe('function')
      expect(typeof utils.randomString).toBe('function')
      expect(typeof utils.uuid).toBe('function')
      expect(typeof utils.randomColor).toBe('function')
    })
  })
})
