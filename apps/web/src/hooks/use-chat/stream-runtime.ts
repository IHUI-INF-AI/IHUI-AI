// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票60(2026-10-18,步序三):流式运行时域按 chat store 实例隔离。
 *
 * 改造前的单例形态(多窗格下的缺陷面):
 * - abort 控制器槽是 useChat() 里的一次性 React.useRef(单挂载 ⇒ 全局仅一份),
 *   send-message / send-answer 经 ctx.abortRef 写入 —— 两窗格的流会互相顶掉
 *   对方的 abort 控制器,「停止」只能停到后写的那一份;
 * - sendMessageInstance / sendActionCtx 是 send-message.ts 的模块级 let 变量
 *   (CustomEvent 触发面:MessageList 经 ihui:regenerate-message 等触发),
 *   多窗格下同样会被最后一次渲染的实例覆盖。
 *
 * 改造后:上述三件套收进按 **store 实例**(WeakMap 键)隔离的运行时记录。
 * 单例场景 `getStreamRuntime(useChatStore)` 恒同一份 ⇒ 行为零变化;窗格场景
 * 每个实例各取各的记录,中断域与 CustomEvent 注册面互不串扰(每窗格独立中断)。
 *
 * abortRef 保持 `{ current }` 的 ref 形状:ChatActionContext.abortRef 及
 * model-switch.ts 的消费面按 ref 读写,零签名改动。
 */

import type { ChatActionContext } from './types'
// 票59(3/3,2026-10-22):opts 形状改引 SendMessageOptions —— 原内联 { regenerate? } 是
// SendMessageOptions 的手抄副本,version 坐标加进 Options 后这里编译面断裂(regenerateMessage
// 经 runtime.sendInstance 调用,签名必须同源)。type-only 回环,运行期零依赖。
import type { SendMessageOptions } from './send-message'

/** CustomEvent 触发面注册的发送函数(send-message.ts createSendMessage 产物) */
type SendMessageFn = (content: string, opts?: SendMessageOptions) => Promise<boolean>

/** 按 store 实例隔离的流式运行时记录(非响应式,不入 zustand 状态) */
export interface ChatStreamRuntime {
  /** 每实例独立的 abort 控制器槽(ref 形状,ctx.abortRef 直接挂这一份) */
  abortRef: { current: AbortController | null }
  /** CustomEvent 触发面的最新发送函数注册槽(原 send-message.ts 模块级 sendMessageInstance) */
  sendInstance: SendMessageFn | null
  /** CustomEvent 触发面的动作上下文(原 send-message.ts 模块级 sendActionCtx) */
  actionCtx: ChatActionContext | null
}

const runtimes = new WeakMap<object, ChatStreamRuntime>()

/**
 * 取某 store 实例的运行时记录(懒建:第一次取时创建,之后恒同一份)。
 * 键是 store 对象本身 —— 单例 useChatStore 与窗格实例在各自的记录里互不可见。
 */
export function getStreamRuntime(store: object): ChatStreamRuntime {
  const existing = runtimes.get(store)
  if (existing) return existing
  const created: ChatStreamRuntime = {
    abortRef: { current: null },
    sendInstance: null,
    actionCtx: null,
  }
  runtimes.set(store, created)
  return created
}
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
