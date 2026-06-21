import { COZE_API_PREFIX } from './endpoints'

/** 不需要 Token 的接口白名单 */
export const API_WHITE_LIST: readonly string[] = [
  '/login/wechat/getOpenId',
  '/resource/getHomePageResources',
  '/login/wechat/getPhoneNumber',
  '/general/remote/third/group/list',
  '/information/list',
  '/coze/agents',
  '/remote/get/true',
  `${COZE_API_PREFIX}/agents/list`,
  '/agent/rule/search/bylink',
  '/ali/audio/sys',
  `${COZE_API_PREFIX}/ai-model-info/list`,
  '/resource/first/share/show',
  '/remote/agent/task/need/task',
] as const

export const ERROR_CODES = {
  TOKEN_EXPIRED: [40101, 499, 401],
  SUCCESS: [200, 201],
} as const

export const REQUEST_TIMEOUT = 500_000

/** 微信小程序原始 ID（gh_ 开头），用于 APP 跳转小程序 */
export const WECHAT_MINI_PROGRAM_ID = 'gh_7e8ca1f80135'
