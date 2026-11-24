// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chat 同步消息面 → 页面消息行的投影判据(**四端唯一实现**,纯函数、零平台依赖)。
 *
 * 此前 RN(`apps/mobile-rn/src/stores/chat-sync.ts`)、小程序
 * (`apps/miniapp-taro/src/lib/chat-sync-surface.ts`)、扩展
 * (`apps/extension/entrypoints/sidepanel/pages/chat-send-utils.ts`)各写一份,
 * 同一份"哪里变了"的判据抄三遍必然漂移(终端粘性 / 回声去重这类边界最容易分叉)。
 * 端内只保留字段映射(薄适配),合并在本文件一处:
 *  ① 同 id 命中 ⇒ 就地覆盖 content/reasoning/terminal,其余字段原样保留;
 *  ② 同 id 但关键维度都没变 ⇒ 零变化,plan 返回 null(调用方不得发布/重渲染);
 *  ③ 匹配不到 ⇒ 追加;但若页面已有同角色且逐字同文的行 ⇒ 判服务端回声,不追加;
 *  ④ terminal 是独立状态位(契约 §4 粘性):来帧缺 terminal 时不清掉页面已有终态。
 *
 * 与 `@ihui/shared/chat/chat-sync-store` 的分工:幂等 / 四态 / 待 resync 全在 store,
 * 本文件只回答"内核面相对页面已有行,到底哪里变了"。
 */

import type { ChatSyncMessageSurface, ChatSyncTerminalState } from '@ihui/types'

/**
 * 参与判据的页面行最小面。三端消息行结构兼容即可,其余展示字段由 apply 原样保留。
 *
 * `flagTargetId` 是 RN ChatScreen 历史回放行的既有运行时约定(服务端 id 挂在行上,
 * 显示 id 是 `serverId-序号`);类型层未声明也不影响本层读取。
 */
export interface ChatSyncSurfaceRow {
  id: string
  role: string
  content: string
  reasoning?: string
  terminal?: ChatSyncTerminalState
  flagTargetId?: unknown
}

/** 同 id 行需要就地覆盖的字段;未列出的维度 = 无变化。 */
export interface ChatSyncSurfaceUpdate {
  index: number
  content?: string
  reasoning?: string
  terminal?: ChatSyncTerminalState
}

/** 一次投影的全部变更;updates/appends 都为空时 plan 返回 null。 */
export interface ChatSyncSurfaceMergePlan {
  updates: ChatSyncSurfaceUpdate[]
  appends: ChatSyncMessageSurface[]
}

function serverIdOfRow(row: ChatSyncSurfaceRow): string | null {
  return typeof row.flagTargetId === 'string' && row.flagTargetId.length > 0
    ? row.flagTargetId
    : null
}

/**
 * 服务端消息在本地消息列表里的位置。
 *
 * 三种约定都要认,缺一种就会把"已显示的这条"当成新消息再追加一条:
 *  ① 本端追加行 / 流式行:id 就是服务端 messageId(或本地生成的 `msg-N`);
 *  ② 历史回放行:服务端 id 挂在 `flagTargetId`,显示 id 是 `serverId-序号`;
 *  ③ 兜底:`serverId-序号` 前缀(分隔符必须在,否则短 id 会吞长 id)。
 */
function indexOfSurface(local: readonly ChatSyncSurfaceRow[], surfaceId: string): number {
  const exact = local.findIndex((row) => row.id === surfaceId)
  if (exact >= 0) return exact
  const flagged = local.findIndex((row) => serverIdOfRow(row) === surfaceId)
  if (flagged >= 0) return flagged
  return local.findIndex((row) => row.id.startsWith(`${surfaceId}-`))
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

function sameTerminal(
  a: ChatSyncTerminalState | undefined,
  b: ChatSyncTerminalState | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.rev === b.rev && a.reason === b.reason
}

/**
 * 计算"把共享消息面投影进本地列表"的最小变更集。返回 null = 零变化(调用方不得发布)。
 */
export function planChatSyncSurfaceMerge(
  local: readonly ChatSyncSurfaceRow[],
  surfaces: readonly ChatSyncMessageSurface[],
): ChatSyncSurfaceMergePlan | null {
  const updates: ChatSyncSurfaceUpdate[] = []
  const appends: ChatSyncMessageSurface[] = []
  const updated = new Set<number>()

  for (const surface of surfaces) {
    const index = indexOfSurface(local, surface.id)
    if (index >= 0) {
      if (updated.has(index)) continue
      const row = local[index]!
      const contentChanged = row.content !== surface.content
      // reasoning 缺省 = 该帧没带思考面(不是"清空");只有带值且不同才算变化。
      const reasoningChanged =
        surface.reasoning !== undefined && !sameText(row.reasoning, surface.reasoning)
      // terminal 缺省 = 尚无终态(粘性,见文件头注);只有带值且不同才算变化。
      const terminalChanged =
        surface.terminal !== undefined && !sameTerminal(row.terminal, surface.terminal)
      if (!contentChanged && !reasoningChanged && !terminalChanged) continue
      updated.add(index)
      updates.push({
        index,
        ...(contentChanged ? { content: surface.content } : {}),
        ...(reasoningChanged ? { reasoning: surface.reasoning } : {}),
        ...(terminalChanged ? { terminal: surface.terminal } : {}),
      })
      continue
    }
    // 回声:本端刚写完的那条没有服务端 id,但同角色内容逐字相同 ⇒ 不是"另一端的新消息"。
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

/**
 * 把 plan 落到页面行上(不改入参;未变更行保持原引用,局部更新保留行上其它字段)。
 *
 * 追加行只带最小面;调用方类型 T 上的额外字段在新增行上本就没有值,运行时与各端
 * 既有"新增消息只带 id/role/content/reasoning/terminal"的行为一致。
 */
export function applyChatSyncSurfaceMerge<T extends ChatSyncSurfaceRow>(
  local: readonly T[],
  plan: ChatSyncSurfaceMergePlan,
): T[] {
  const next = local.slice()

  for (const update of plan.updates) {
    const row = next[update.index]
    if (!row) continue
    next[update.index] = {
      ...row,
      ...(update.content === undefined ? {} : { content: update.content }),
      ...(update.reasoning === undefined ? {} : { reasoning: update.reasoning }),
      ...(update.terminal === undefined ? {} : { terminal: update.terminal }),
    }
  }

  for (const surface of plan.appends) {
    next.push({
      id: surface.id,
      role: surface.role,
      content: surface.content,
      ...(surface.reasoning === undefined ? {} : { reasoning: surface.reasoning }),
      ...(surface.terminal === undefined ? {} : { terminal: surface.terminal }),
    } as unknown as T)
  }

  return next
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
