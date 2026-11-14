// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-152:失败后给"重试"动作 —— 纯函数取回最后一条**非空用户消息**原文。
 * 没有可重发的用户消息(比如首轮就失败在输入前)时返回空串,界面据此不给按钮。
 */
import type { ChatSyncTerminalState } from '@ihui/types'

export function pickRetryTarget(
  messages: readonly { role: string; content: string }[],
  hasError: boolean,
): string {
  if (!hasError) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === 'user' && m.content.trim() !== '') return m.content
  }
  return ''
}

// ── G-20261114 多端实时同步:chat-sync 消息面 → 本页 messages 的投影判据 ──
// 与 web / RN / taro 同一套纪律:幂等四态/gap/终态粘性全在 @ihui/shared 的
// chatSyncStore + @ihui/types 契约内核,这里只算"把 store 面并进页级列表"的
// 最小变更集,零复算、零平台依赖(node 下可直接测)。

export interface ChatSyncSurfaceView {
  id: string
  role: string
  content: string
  reasoning?: string
  terminal?: ChatSyncTerminalState
}

export interface ChatSyncLocalRow {
  id?: string
  role: string
  content: string
  reasoning?: string
  terminal?: ChatSyncTerminalState
}

export interface ChatSyncMergePlan {
  updates: Array<{
    index: number
    content: string
    reasoning?: string
    terminal?: ChatSyncTerminalState
  }>
  appends: readonly ChatSyncSurfaceView[]
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

function sameTerminal(
  a: ChatSyncTerminalState | undefined,
  b: ChatSyncTerminalState | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.rev === b.rev && a.reason === b.reason
}

/**
 * 返回 null = 零变化(调用方不得 setMessages,否则每帧重渲染)。
 * - 本地已有同 id 行 ⇒ 就地更新,保留工具卡/附件等其它字段;
 * - 本地无该行且内容逐字等于本端某条同角色行 ⇒ 判回声跳过(广播会回到生成端自己);
 * - 终态粘性:不带 terminal 的 snapshot 不得把已有终态清掉(契约 §4)。
 */
export function planChatSyncSurfaceMerge(
  local: readonly ChatSyncLocalRow[],
  surfaces: readonly ChatSyncSurfaceView[],
): ChatSyncMergePlan | null {
  const updates: ChatSyncMergePlan['updates'] = []
  const appends: ChatSyncSurfaceView[] = []
  const touched = new Set<number>()

  for (const surface of surfaces) {
    const index = local.findIndex((row) => row.id === surface.id)
    if (index >= 0) {
      if (touched.has(index)) continue
      const row = local[index]!
      const contentChanged = row.content !== surface.content
      const reasoningChanged =
        surface.reasoning !== undefined && !sameText(row.reasoning, surface.reasoning)
      const terminalChanged =
        surface.terminal !== undefined && !sameTerminal(row.terminal, surface.terminal)
      if (!contentChanged && !reasoningChanged && !terminalChanged) continue
      touched.add(index)
      updates.push({
        index,
        content: surface.content,
        ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
        ...(surface.terminal !== undefined ? { terminal: surface.terminal } : {}),
      })
      continue
    }
    const echo = local.some(
      (row) =>
        row.role === surface.role && row.content.length > 0 && row.content === surface.content,
    )
    if (echo) continue
    appends.push(surface)
  }

  if (updates.length === 0 && appends.length === 0) return null
  return { updates, appends }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
