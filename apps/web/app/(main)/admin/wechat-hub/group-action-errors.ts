// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群写动作 errorCode → 中文结论映射（纯函数，无 React 依赖，便于单测直连）。
 *
 * 后端失败形状 { code, message, errorCode }；面板优先按稳定错误码分流中文标题，
 * 原始 message 只作副文案；未知错误码不编造结论，直接回退原始 message。
 */
import { ApiError } from '@ihui/api-client'

/** 群写动作错误码中文标题，与后端 WECHAT_GROUP_* / WECHAT_ACCOUNT_NOT_FOUND 取值一一对应。 */
export const GROUP_ACTION_ERROR_TITLES: Record<string, string> = {
  WECHAT_GROUP_WRITES_DISABLED: '群写动作未开启，请先在群管理面板打开',
  WECHAT_GROUP_CONFIRM_REQUIRED: '缺少确认令牌，请先重新预览影响面',
  WECHAT_GROUP_CONFIRM_EXPIRED: '预览已过期，请重新预览后再执行',
  WECHAT_GROUP_TARGETS_EXCEEDED: '本次操作人数超过单次上限，请减少目标成员后重试',
  WECHAT_GROUP_RATE_LIMITED: '操作过于频繁，每小时次数已达上限，请稍后再试',
  WECHAT_GROUP_CONVERSATION_REQUIRED: '缺少目标群，请先选择要操作的群',
  WECHAT_ACCOUNT_NOT_FOUND: '账号不存在或已离线，请刷新账号列表后重试',
}

export interface GroupActionErrorView {
  title: string
  detail: string
}

/** 从异常提取错误码与文案；errorCode 无对应中文时回退到原始 message。 */
export function describeGroupActionError(e: unknown): GroupActionErrorView {
  const errorCode = e instanceof ApiError ? e.errorCode : undefined
  const rawMessage = e instanceof Error ? e.message : ''
  const mappedTitle = errorCode ? GROUP_ACTION_ERROR_TITLES[errorCode] : undefined
  if (mappedTitle) {
    return {
      title: mappedTitle,
      detail: rawMessage && rawMessage !== mappedTitle ? rawMessage : '',
    }
  }
  return { title: rawMessage || '群动作失败', detail: '' }
}
