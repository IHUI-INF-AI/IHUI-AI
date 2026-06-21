/**
 * 飞书登录：点击后固定跳转的官方授权页 URL
 * 配置从环境变量读取, 未配置时返回空字符串
 */
import { getEnv } from '@/utils/envUtils'

const FEISHU_APP_ID = getEnv('VITE_FEISHU_APP_ID', '')
const FEISHU_REDIRECT_URI = getEnv('VITE_FEISHU_REDIRECT_URI', '')
const FEISHU_SCOPE = getEnv('VITE_FEISHU_SCOPE', 'contact:user.id:readonly')

export const FEISHU_AUTH_URL = FEISHU_APP_ID && FEISHU_REDIRECT_URI
  ? `https://accounts.feishu.cn/open-apis/authen/v1/authorize?app_id=${FEISHU_APP_ID}&redirect_uri=${encodeURIComponent(FEISHU_REDIRECT_URI)}&scope=${encodeURIComponent(FEISHU_SCOPE)}`
  : ''
