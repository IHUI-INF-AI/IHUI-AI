import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isValidRedirect,
  getSafeRedirect,
} from '../redirectUtils'

describe('redirectUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isValidRedirect', () => {
    it('应该识别有效的重定向URL', () => {
      expect(isValidRedirect('/path')).toBe(true)
      expect(isValidRedirect('/path?query=1')).toBe(true)
    })

    it('应该拒绝javascript协议', () => {
      expect(isValidRedirect('javascript:alert(1)')).toBe(false)
    })

    it('应该拒绝data协议', () => {
      expect(isValidRedirect('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('应该拒绝null和undefined', () => {
      expect(isValidRedirect(null)).toBe(false)
      expect(isValidRedirect(undefined)).toBe(false)
    })
  })

  describe('getSafeRedirect', () => {
    it('应该返回安全的重定向URL', () => {
      expect(getSafeRedirect('/dashboard')).toBe('/dashboard')
    })

    it('应该返回默认URL当URL不安全', () => {
      expect(getSafeRedirect('javascript:alert(1)', '/home')).toBe('/home')
    })

    it('应该返回默认URL当URL为null', () => {
      expect(getSafeRedirect(null, '/home')).toBe('/home')
    })
  })
})
