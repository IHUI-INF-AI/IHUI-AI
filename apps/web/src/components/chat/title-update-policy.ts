// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 任务标题实时更新开关(2026-11-16 立)。
 *
 * 语义:开启(默认)时,第 3 轮回复后由前端 fire-and-forget 调 auto-title 的
 * `conversation` 策略,按最近真实对话重估标题;关闭时标题固定为创建时生成的名称。
 * 首轮命名(默认「新对话」→ 依据首条用户消息生成)不受本开关影响 —— 否则关闭后
 * 侧栏会永远挂着「新对话」。
 *
 * 存储与广播口径对齐 chat/message-list/fold-policy:localStorage + 自定义事件,
 * 设置页写入、发送链路读取,避免跨组件状态源。
 */

export const TITLE_UPDATE_POLICY_EVENT = 'ihui-title-update-policy-changed'

const STORAGE_KEY = 'ihui-chat-title-auto-update'

/** 读取开关:未设置/非法值/SSR 一律按开启(保持上线前的既有行为) */
export function readTitleAutoUpdate(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

/** 写入开关并广播,设置页卡片监听同一事件保持同步 */
export function writeTitleAutoUpdate(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // localStorage 不可用(隐私模式)时静默降级:本次会话仍按默认开启
  }
  window.dispatchEvent(new Event(TITLE_UPDATE_POLICY_EVENT))
}
