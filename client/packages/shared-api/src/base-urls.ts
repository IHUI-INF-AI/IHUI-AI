/** API 基础 URL（官网与小程序共用） */
// 2026-06-20 全部迁移到 Python 后端, 无 Java 依赖
// 开发环境通过 Vite 代理, 生产环境通过 Nginx 反向代理, 均走相对路径
export const API_BASE_URLS = {
  BASE_URL_1: '/api-kou',
  BASE_URL_2: '/prod-api/ai',
  BASE_URL_3: '/coze',
  BASE_URL_4: '/prod-api',
  BASE_URL_5: '/api-kou',
} as const

export type ApiBaseUrlKey = keyof typeof API_BASE_URLS
