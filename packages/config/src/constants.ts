export const APP_NAME = 'IHUI AI';

export const API_VERSION = 'v1';

export const DEFAULT_LOCALE = 'zh-CN';

export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 100;

export const JWT_ISSUER = 'ihui-ai';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 30;

export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MAX_LENGTH = 128;
