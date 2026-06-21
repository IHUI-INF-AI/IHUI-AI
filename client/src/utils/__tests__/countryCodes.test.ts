import { describe, it, expect } from 'vitest'
import {
  countryCodes,
  getCountryByCode,
  getCountryByDialCode,
  getDefaultCountryCode,
  searchCountries,
  formatPhoneNumber,
  validatePhoneFormat,
} from '../countryCodes'

describe('countryCodes', () => {
  describe('国家代码列表', () => {
    it('应该包含主要国家', () => {
      const codes = countryCodes.map(c => c.code)
      expect(codes).toContain('CN')
      expect(codes).toContain('US')
      expect(codes).toContain('JP')
      expect(codes).toContain('GB')
    })

    it('每个国家都应该有完整字段', () => {
      countryCodes.forEach(c => {
        expect(c.code).toBeTruthy()
        expect(c.name).toBeTruthy()
        expect(c.nameEn).toBeTruthy()
        expect(c.dialCode).toMatch(/^\+\d+$/)
        expect(c.flag).toBeTruthy()
      })
    })
  })

  describe('getCountryByCode', () => {
    it('应该根据国家代码返回国家信息', () => {
      const cn = getCountryByCode('CN')
      expect(cn).toBeDefined()
      expect(cn?.name).toBe('中国')
      expect(cn?.dialCode).toBe('+86')
    })

    it('应该对未知代码返回undefined', () => {
      expect(getCountryByCode('XX')).toBeUndefined()
    })
  })

  describe('getCountryByDialCode', () => {
    it('应该根据带+的区号返回国家', () => {
      const cn = getCountryByDialCode('+86')
      expect(cn).toBeDefined()
      expect(cn?.code).toBe('CN')
    })

    it('应该根据不带+的区号返回国家', () => {
      const us = getCountryByDialCode('1')
      expect(us).toBeDefined()
      expect(us?.code).toBe('US')
    })

    it('应该对未知区号返回undefined', () => {
      expect(getCountryByDialCode('+999')).toBeUndefined()
    })
  })

  describe('getDefaultCountryCode', () => {
    it('应该返回中国作为默认', () => {
      const def = getDefaultCountryCode()
      expect(def.code).toBe('CN')
    })
  })

  describe('searchCountries', () => {
    it('空查询应该返回所有国家', () => {
      expect(searchCountries('').length).toBe(countryCodes.length)
    })

    it('应该按中文名搜索', () => {
      const results = searchCountries('中国')
      expect(results.some(c => c.code === 'CN')).toBe(true)
    })

    it('应该按英文名搜索', () => {
      const results = searchCountries('Japan')
      expect(results.some(c => c.code === 'JP')).toBe(true)
    })

    it('应该按区号搜索', () => {
      const results = searchCountries('+86')
      expect(results.some(c => c.code === 'CN')).toBe(true)
    })

    it('应该按国家代码搜索', () => {
      const results = searchCountries('CN')
      expect(results.some(c => c.code === 'CN')).toBe(true)
    })

    it('搜索不区分大小写', () => {
      const results = searchCountries('china')
      expect(results.some(c => c.code === 'CN')).toBe(true)
    })
  })

  describe('formatPhoneNumber', () => {
    it('应该格式化中国手机号', () => {
      const cn = getCountryByCode('CN')!
      expect(formatPhoneNumber('13800138000', cn)).toBe('138 0013 8000')
    })

    it('应该格式化美国号码', () => {
      const us = getCountryByCode('US')!
      expect(formatPhoneNumber('5551234567', us)).toBe('(555) 123-4567')
    })

    it('应该格式化加拿大号码', () => {
      const ca = getCountryByCode('CA')!
      expect(formatPhoneNumber('5551234567', ca)).toBe('(555) 123-4567')
    })

    it('应该处理空号码', () => {
      const cn = getCountryByCode('CN')!
      expect(formatPhoneNumber('', cn)).toBe('')
    })

    it('应该去除非数字字符', () => {
      const cn = getCountryByCode('CN')!
      expect(formatPhoneNumber('138-0013-8000', cn)).toBe('138 0013 8000')
    })

    it('应该对其他国家使用默认格式', () => {
      const de = getCountryByCode('DE')!
      const result = formatPhoneNumber('1234567890', de)
      expect(result).toMatch(/\d/)
    })
  })

  describe('validatePhoneFormat', () => {
    it('应该验证中国手机号', () => {
      const cn = getCountryByCode('CN')!
      expect(validatePhoneFormat('13800138000', cn)).toBe(true)
      expect(validatePhoneFormat('19900199000', cn)).toBe(true)
      expect(validatePhoneFormat('12800138000', cn)).toBe(false) // 12开头不是有效手机号
      expect(validatePhoneFormat('11000000000', cn)).toBe(false)
      expect(validatePhoneFormat('12345', cn)).toBe(false)
    })

    it('应该验证美国号码', () => {
      const us = getCountryByCode('US')!
      expect(validatePhoneFormat('5551234567', us)).toBe(true)
      expect(validatePhoneFormat('12345', us)).toBe(false)
    })

    it('应该验证香港号码', () => {
      const hk = getCountryByCode('HK')!
      expect(validatePhoneFormat('91234567', hk)).toBe(true)
      expect(validatePhoneFormat('12345', hk)).toBe(false)
    })

    it('应该对未知国家使用通用验证', () => {
      const unknown = { code: 'XX', name: '未知', nameEn: 'Unknown', dialCode: '+999', flag: '🏳️' }
      expect(validatePhoneFormat('123456', unknown)).toBe(true)
      expect(validatePhoneFormat('12345', unknown)).toBe(false)
    })
  })
})
