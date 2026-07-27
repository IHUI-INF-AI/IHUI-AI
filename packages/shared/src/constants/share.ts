/**
 * 跨端分享 URL 参数约定
 * 消除 miniapp-taro 本地 shareConfig 硬编码
 */
export const SHARE_PARAM = {
  SOURCE_PARAM: 'source',
  SOURCE_VALUE: 'share',
  INVITE_CODE_PARAM: 'inviteCode',
} as const
