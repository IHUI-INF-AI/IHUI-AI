// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 跨端分享 URL 参数约定
 * 消除 miniapp-taro 本地 shareConfig 硬编码
 */
export const SHARE_PARAM = {
  SOURCE_PARAM: 'source',
  SOURCE_VALUE: 'share',
  INVITE_CODE_PARAM: 'inviteCode',
} as const
