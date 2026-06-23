/**
 * 钉钉登录：点击后跳转钉钉官方授权页 URL
 * 配置从环境变量读取, 未配置时返回空字符串
 */
import { getEnv } from '@/utils/envUtils'

const DINGTALK_CORP_ID = getEnv('VITE_DINGTALK_CORP_ID', '')
const DINGTALK_LOGIN_APP_ID = getEnv('VITE_DINGTALK_LOGIN_APP_ID', '')
const DINGTALK_REDIRECT_URI = getEnv('VITE_DINGTALK_REDIRECT_URI', '')

export const DINGTALK_AUTH_URL = DINGTALK_LOGIN_APP_ID && DINGTALK_REDIRECT_URI
  ? `https://login.dingtalk.com/oauth2/auth?redirect_uri=${encodeURIComponent(DINGTALK_REDIRECT_URI)}&response_type=code&client_id=${DINGTALK_LOGIN_APP_ID}&scope=openid&state=dingtalk_login&prompt=consent`
  : ''

export const DINGTALK_CONFIG = {
  corpId: DINGTALK_CORP_ID,
  appId: DINGTALK_LOGIN_APP_ID,
  redirectUri: DINGTALK_REDIRECT_URI,
}
