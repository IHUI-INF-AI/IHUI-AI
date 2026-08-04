import { Platform } from 'react-native'
import { SSO_CLIENT_IDS } from '@ihui/shared/constants'

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8802'

// 10.0.2.2 是 Android 模拟器访问宿主机的专用 IP,web 平台浏览器无法访问,替换为 localhost。
// 生产环境配置的真实域名(如 https://api.example.com)不受影响。
export const API_BASE_URL =
  Platform.OS === 'web' && ENV_API_BASE_URL.includes('10.0.2.2')
    ? ENV_API_BASE_URL.replace('10.0.2.2', 'localhost')
    : ENV_API_BASE_URL
export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '@ihui/shared/constants'

/**
 * SSO 配置(移动端作为 SSO client 接入 web 登录中心)
 *
 * 流程:
 * 1. 用户点"使用网页账号登录" → openAuthSession 打开 web /sso/login?redirect=ihui://sso/callback&client_id=mobile-rn
 * 2. 用户在 web 登录后,web 生成 30s sso_code,跳 ihui://sso/callback?sso_code=xxx
 * 3. 系统拦截 deep link,拿 sso_code 调 /api/auth/sso/exchange 换 token → 自动登录
 */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8801'
export const SSO_CLIENT_ID = SSO_CLIENT_IDS.MOBILE_RN
export const SSO_REDIRECT_URI = 'ihui://sso/callback'
