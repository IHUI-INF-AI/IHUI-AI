/**
 * 支付宝登录：点击后直接跳转的官方授权页 URL
 * 配置从环境变量读取, 未配置时返回空字符串
 */
import { getEnv } from '@/utils/envUtils'

const ALIPAY_APP_ID = getEnv('VITE_ALIPAY_APP_ID', '')
const ALIPAY_REDIRECT_URI = getEnv('VITE_ALIPAY_REDIRECT_URI', '')
const ALIPAY_SCOPE = getEnv('VITE_ALIPAY_SCOPE', 'auth_user')

export const ALIPAY_AUTH_URL = ALIPAY_APP_ID && ALIPAY_REDIRECT_URI
  ? `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${ALIPAY_APP_ID}&scope=${ALIPAY_SCOPE}&redirect_uri=${encodeURIComponent(ALIPAY_REDIRECT_URI)}`
  : ''
