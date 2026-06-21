import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LOGIN_DURATION_OPTIONS,
  DEFAULT_LOGIN_DURATION,
  getDefaultLoginDuration,
  getLoginDurationLabel,
  initLoginDuration,
  isLoginExpired,
  calculateExpiryTime,
} from '../login-duration'

describe('login-duration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('LOGIN_DURATION_OPTIONS', () => {
    it('应该包含4个选项', () => {
      expect(LOGIN_DURATION_OPTIONS).toHaveLength(4)
    })

    it('应该包含正确的天数', () => {
      const days = LOGIN_DURATION_OPTIONS.map(opt => opt.days)
      expect(days).toEqual([1, 7, 30, 90])
    })
  })

  describe('DEFAULT_LOGIN_DURATION', () => {
    it('应该是7天的毫秒数', () => {
      expect(DEFAULT_LOGIN_DURATION).toBe(7 * 24 * 60 * 60 * 1000)
    })
  })

  describe('getDefaultLoginDuration', () => {
    it('应该返回默认登录时长', () => {
      expect(getDefaultLoginDuration()).toBe(DEFAULT_LOGIN_DURATION)
    })
  })

  describe('getLoginDurationLabel', () => {
    it('应该返回正确的标签', () => {
      expect(getLoginDurationLabel(1)).toBe('1天')
      expect(getLoginDurationLabel(7)).toBe('7天')
      expect(getLoginDurationLabel(30)).toBe('30天')
      expect(getLoginDurationLabel(90)).toBe('90天')
    })

    it('应该为未知天数返回自定义标签', () => {
      expect(getLoginDurationLabel(15)).toBe('15天')
    })
  })

  describe('initLoginDuration', () => {
    it('应该在localStorage为空时设置默认值', () => {
      initLoginDuration()
      expect(localStorage.getItem('login_duration')).toBe(String(DEFAULT_LOGIN_DURATION))
    })

    it('应该在localStorage有值时不覆盖', () => {
      localStorage.setItem('login_duration', '12345')
      initLoginDuration()
      expect(localStorage.getItem('login_duration')).toBe('12345')
    })
  })

  describe('isLoginExpired', () => {
    it('应该在loginTime为空时返回true', () => {
      expect(isLoginExpired()).toBe(true)
      expect(isLoginExpired(undefined)).toBe(true)
    })

    it('应该在未过期时返回false', () => {
      const loginTime = Date.now() - 1000
      expect(isLoginExpired(loginTime)).toBe(false)
    })

    it('应该在过期时返回true', () => {
      const loginTime = Date.now() - DEFAULT_LOGIN_DURATION - 1000
      expect(isLoginExpired(loginTime)).toBe(true)
    })

    it('应该支持自定义duration', () => {
      const loginTime = Date.now() - 2000
      expect(isLoginExpired(loginTime, 1000)).toBe(true)
      expect(isLoginExpired(loginTime, 5000)).toBe(false)
    })
  })

  describe('calculateExpiryTime', () => {
    it('应该计算正确的过期时间', () => {
      const duration = 1000
      const expiry = calculateExpiryTime(duration)
      expect(expiry).toBeGreaterThan(Date.now())
    })
  })
})
