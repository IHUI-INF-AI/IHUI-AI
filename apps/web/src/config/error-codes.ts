/**
 * Error codes migrated to @ihui/shared/constants (packages/shared/src/constants/error-codes.ts).
 * This file re-exports for backward compat with existing `@/config/error-codes` imports.
 * Other apps (mobile-rn/extension/miniapp-taro) should import from @ihui/shared/constants.
 */
export {
  ERROR_CODES,
  type ErrorCode,
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
} from '@ihui/shared/constants'
