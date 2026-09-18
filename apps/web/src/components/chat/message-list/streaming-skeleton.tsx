// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import type { ChatMessage } from '@/stores/chat'

/** 判断流式中是否应显示骨架屏占位:该轮尚未出现任何 AI 首帧。
 *  - 用户刚发出消息(isStreaming 且最后一条是 user)→ AI 还没回 → 显示
 *  - 助手消息已创建但仍是空壳(无正文 / 无推理 / 无工具事件)→ 首帧未到 → 显示
 *  - 助手消息已有任意增量(content / reasoning / toolCalls)→ 首帧已到 → 卸载
 *  - AI 推理过程(reasoning)在此语境中等价于"thinking 事件",故 reasoning 非空即视为首帧。
 *  注意:仅对"当前流式轮"生效(以 messages 最后一条角色判断),不影响历史已完成的轮次。 */
export function shouldShowStreamingSkeleton(
  messages: ChatMessage[],
  isStreaming: boolean,
): boolean {
  if (!isStreaming || messages.length === 0) return false
  const last = messages[messages.length - 1]
  if (!last) return false
  // 用户刚发完消息,AI 尚未产出助手消息(SSE 还没回来)
  if (last.role === 'user') return true
  // 助手消息已占位但仍是空壳 → 首帧未到
  if (last.role === 'assistant') {
    const hasFirstFrame =
      (last.content?.trim().length ?? 0) > 0 ||
      (last.reasoning?.trim().length ?? 0) > 0 ||
      (last.toolCalls?.length ?? 0) > 0
    return !hasFirstFrame
  }
  return false
}

/** 流式骨架屏:用户发消息后、AI 首帧到达前的结构化占位。
 *  3 行 shimmer 骨架:短标题条 + 两条正文条 + 一个代码块条。
 *  用 Tailwind animate-pulse 实现(不新增依赖),muted 色系,无文字(守门:禁 emoji/硬编码文案)。 */
export function StreamingSkeleton() {
  return (
    <div
      data-testid="streaming-skeleton"
      aria-hidden
      className="mx-auto flex w-full max-w-3xl flex-col gap-3"
    >
      {/* 短标题条 */}
      <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
      {/* 两条正文条 */}
      <div className="h-3 w-full rounded-md bg-muted animate-pulse" />
      <div className="h-3 w-5/6 rounded-md bg-muted animate-pulse" />
      {/* 代码块条 */}
      <div className="mt-1 h-20 w-full rounded-md bg-muted animate-pulse" />
    </div>
  )
}

export default StreamingSkeleton
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
