export const API_BASE_URL = 'http://localhost:3001'
export const TOKEN_STORAGE_KEY = 'ihui_token'
export const REFRESH_TOKEN_STORAGE_KEY = 'ihui_refresh_token'

/**
 * SSO 配置(移动端作为 SSO client 接入 web 登录中心)
 *
 * 流程:
 * 1. 用户点"使用网页账号登录" → openAuthSession 打开 web /sso/login?redirect=ihui://sso/callback&client_id=mobile-rn
 * 2. 用户在 web 登录后,web 生成 30s sso_code,跳 ihui://sso/callback?sso_code=xxx
 * 3. 系统拦截 deep link,拿 sso_code 调 /api/auth/sso/exchange 换 token → 自动登录
 */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3001'
export const SSO_CLIENT_ID = 'mobile-rn'
export const SSO_REDIRECT_URI = 'ihui://sso/callback'
