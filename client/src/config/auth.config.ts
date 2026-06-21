export const REMEMBER_ME_CONFIG = {
  REFRESH_TOKEN_KEY: 'refresh_token_persistent',
  USER_PREFERENCE_KEY: 'remember_me_preference',
  CREDENTIALS_KEY: 'remember_me_credentials',
  AUTO_LOGIN_KEY: 'remember_me_auto_login',
  MAX_CREDENTIALS_AGE_MS: 30 * 24 * 60 * 60 * 1000,
  MAX_FAILURE_COUNT: 5,
  LOCK_DURATION_MS: 24 * 60 * 60 * 1000,
} as const

export const NETWORK_CONFIG = {
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY_MS: 1000,
} as const

export const AUTH_CONFIG = {
  TOKEN_REFRESH_THRESHOLD: 0.8,
} as const
