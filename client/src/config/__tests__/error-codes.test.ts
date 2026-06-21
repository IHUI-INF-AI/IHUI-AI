import { describe, it, expect } from 'vitest'
import {
  ERROR_CODES,
  isTokenExpired,
  isSuccess,
  isBadRequest,
  isForbidden,
  isNotFound,
  isInternalServerError,
  isServiceUnavailable,
  isAccountLocked,
  isAccountDisabled,
  isAccountDeleted,
  isPasswordExpired,
  isPasswordWrong,
  isCaptchaExpired,
  isCaptchaWrong,
  isPhoneNotVerified,
  isTooManyRequests,
  getErrorMessage,
} from '../error-codes'

describe('error-codes', () => {
  describe('ERROR_CODES常量', () => {
    it('应该定义所有错误码', () => {
      expect(ERROR_CODES.TOKEN_EXPIRED).toBeDefined()
      expect(ERROR_CODES.SUCCESS).toBeDefined()
      expect(ERROR_CODES.BAD_REQUEST).toBeDefined()
      expect(ERROR_CODES.FORBIDDEN).toBeDefined()
      expect(ERROR_CODES.NOT_FOUND).toBeDefined()
      expect(ERROR_CODES.INTERNAL_SERVER_ERROR).toBeDefined()
      expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBeDefined()
      expect(ERROR_CODES.ACCOUNT_LOCKED).toBeDefined()
      expect(ERROR_CODES.ACCOUNT_DISABLED).toBeDefined()
      expect(ERROR_CODES.ACCOUNT_DELETED).toBeDefined()
      expect(ERROR_CODES.PASSWORD_EXPIRED).toBeDefined()
      expect(ERROR_CODES.PASSWORD_WRONG).toBeDefined()
      expect(ERROR_CODES.CAPTCHA_EXPIRED).toBeDefined()
      expect(ERROR_CODES.CAPTCHA_WRONG).toBeDefined()
      expect(ERROR_CODES.PHONE_NOT_VERIFIED).toBeDefined()
      expect(ERROR_CODES.TOO_MANY_REQUESTS).toBeDefined()
    })
  })

  describe('isTokenExpired', () => {
    it('应该识别数字类型的过期码', () => {
      expect(isTokenExpired(40101)).toBe(true)
      expect(isTokenExpired(499)).toBe(true)
      expect(isTokenExpired(401)).toBe(true)
      expect(isTokenExpired(200)).toBe(false)
    })

    it('应该识别字符串类型的过期码', () => {
      expect(isTokenExpired('40101')).toBe(true)
      expect(isTokenExpired('A40101')).toBe(true)
      expect(isTokenExpired('test40101')).toBe(true)
      expect(isTokenExpired('200')).toBe(false)
    })
  })

  describe('isSuccess', () => {
    it('应该识别成功码', () => {
      expect(isSuccess(200)).toBe(true)
      expect(isSuccess(201)).toBe(true)
      expect(isSuccess(400)).toBe(false)
      expect(isSuccess('200')).toBe(true)
    })
  })

  describe('isBadRequest', () => {
    it('应该识别错误请求码', () => {
      expect(isBadRequest(400)).toBe(true)
      expect(isBadRequest(200)).toBe(false)
    })
  })

  describe('isForbidden', () => {
    it('应该识别禁止访问码', () => {
      expect(isForbidden(403)).toBe(true)
      expect(isForbidden(200)).toBe(false)
    })
  })

  describe('isNotFound', () => {
    it('应该识别未找到码', () => {
      expect(isNotFound(404)).toBe(true)
      expect(isNotFound(200)).toBe(false)
    })
  })

  describe('isInternalServerError', () => {
    it('应该识别服务器错误码', () => {
      expect(isInternalServerError(500)).toBe(true)
      expect(isInternalServerError(200)).toBe(false)
    })
  })

  describe('isServiceUnavailable', () => {
    it('应该识别服务不可用码', () => {
      expect(isServiceUnavailable(503)).toBe(true)
      expect(isServiceUnavailable(200)).toBe(false)
    })
  })

  describe('isAccountLocked', () => {
    it('应该识别账户锁定码', () => {
      expect(isAccountLocked(40301)).toBe(true)
      expect(isAccountLocked(40302)).toBe(true)
      expect(isAccountLocked(200)).toBe(false)
    })
  })

  describe('isAccountDisabled', () => {
    it('应该识别账户禁用码', () => {
      expect(isAccountDisabled(40303)).toBe(true)
      expect(isAccountDisabled(40304)).toBe(true)
      expect(isAccountDisabled(200)).toBe(false)
    })
  })

  describe('isAccountDeleted', () => {
    it('应该识别账户删除码', () => {
      expect(isAccountDeleted(40305)).toBe(true)
      expect(isAccountDeleted(200)).toBe(false)
    })
  })

  describe('isPasswordExpired', () => {
    it('应该识别密码过期码', () => {
      expect(isPasswordExpired(40310)).toBe(true)
      expect(isPasswordExpired(200)).toBe(false)
    })
  })

  describe('isPasswordWrong', () => {
    it('应该识别密码错误码', () => {
      expect(isPasswordWrong(40102)).toBe(true)
      expect(isPasswordWrong(40103)).toBe(true)
      expect(isPasswordWrong(200)).toBe(false)
    })
  })

  describe('isCaptchaExpired', () => {
    it('应该识别验证码过期码', () => {
      expect(isCaptchaExpired(40001)).toBe(true)
      expect(isCaptchaExpired(200)).toBe(false)
    })
  })

  describe('isCaptchaWrong', () => {
    it('应该识别验证码错误码', () => {
      expect(isCaptchaWrong(40002)).toBe(true)
      expect(isCaptchaWrong(200)).toBe(false)
    })
  })

  describe('isPhoneNotVerified', () => {
    it('应该识别手机未验证码', () => {
      expect(isPhoneNotVerified(40320)).toBe(true)
      expect(isPhoneNotVerified(200)).toBe(false)
    })
  })

  describe('isTooManyRequests', () => {
    it('应该识别请求过多码', () => {
      expect(isTooManyRequests(429)).toBe(true)
      expect(isTooManyRequests(200)).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('应该返回正确的错误消息', () => {
      expect(getErrorMessage(40301)).toBe('errors.accountLocked')
      expect(getErrorMessage(40303)).toBe('errors.accountDisabled')
      expect(getErrorMessage(40305)).toBe('errors.accountDeleted')
      expect(getErrorMessage(40310)).toBe('errors.passwordExpired')
      expect(getErrorMessage(40102)).toBe('errors.passwordWrong')
      expect(getErrorMessage(40001)).toBe('errors.captchaExpired')
      expect(getErrorMessage(40002)).toBe('errors.captchaWrong')
      expect(getErrorMessage(40320)).toBe('errors.phoneNotVerified')
      expect(getErrorMessage(429)).toBe('errors.tooManyRequests')
      expect(getErrorMessage(40101)).toBe('errors.tokenExpired')
      expect(getErrorMessage(403)).toBe('errors.forbidden')
      expect(getErrorMessage(404)).toBe('errors.notFound')
      expect(getErrorMessage(500)).toBe('errors.serverError')
      expect(getErrorMessage(503)).toBe('errors.serviceUnavailable')
      expect(getErrorMessage(999)).toBe('errors.unknown')
    })
  })
})
