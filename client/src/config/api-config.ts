/**
 * API 配置 — 多端共享层 re-export
 * 单一数据源：packages/shared-api
 * 官网特有扩展请放在 backend-paths.ts / swagger-endpoints.ts
 */

export {
  API_BASE_URLS,
  API_ENDPOINTS,
  API_WHITE_LIST,
  COZE_API_PREFIX,
  COZE_DEV_PROXY_PREFIX,
  ERROR_CODES,
  REQUEST_TIMEOUT,
  getBaseUrl,
  isWhiteListUrl,
  isTokenExpiredError,
  isSuccessCode,
} from '@aizhs/shared-api'
