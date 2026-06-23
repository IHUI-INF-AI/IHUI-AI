/**
 * 企业微信登录：点击后跳转企业微信官方授权页 URL
 * 使用已有的 VITE_WORKWECHAT_* 环境变量
 */
import { getEnv } from '@/utils/envUtils'

const WORKWECHAT_ENABLED = getEnv('VITE_WORKWECHAT_ENABLED', 'false') === 'true'
const WORKWECHAT_REDIRECT_URI = getEnv('VITE_WORKWECHAT_REDIRECT_URI', '')
const WORKWECHAT_SCOPE = getEnv('VITE_WORKWECHAT_SCOPE', 'snsapi_login')

// corp_id 从加密变量解密获取，这里使用运行时获取的方式
// 如果加密变量不可用，则使用非加密的 VITE_WECOM_CORP_ID 作为后备
const WECOM_CORP_ID = getEnv('VITE_WECOM_CORP_ID', '')

export const WECOM_AUTH_URL = (WORKWECHAT_ENABLED || WECOM_CORP_ID) && WORKWECHAT_REDIRECT_URI
  ? `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${WECOM_CORP_ID}&redirect_uri=${encodeURIComponent(WORKWECHAT_REDIRECT_URI)}&response_type=code&scope=${WORKWECHAT_SCOPE}&state=wecom#wechat_redirect`
  : ''
