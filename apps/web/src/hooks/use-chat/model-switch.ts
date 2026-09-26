// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #68(2026-09-27 立):「流式中切换模型 → 终止后自动带入新模型」的唯一出口。
//
// 为什么住在这里,而不是直接写在 use-chat.ts 的 effect 里:
// `stop()`(用户点停止)与"流式中换模型"要做的是**同一件事** —— 标记中断消息 + 通知网关中止
// 上游流 + abort 本地控制器 + 回收"压缩中"预告态。本仓最高频缺陷是"两份实现各写一半"
// (见 AGENTS §3 / 守门 64 的适配器接线),所以终止动作只允许有一份实现,由本模块承载;
// use-chat.ts 的两条入口(stop 按钮、模型切换 effect)都调它,差别只在"要不要给用户看得见的理由"。
//
// 依赖全部注入(DI),因此本模块不 import React / toast / store ⇒ 可直接被单测驱动,
// 不必渲染整条 useChat(它牵 20+ 个模块),也不必在测试里复制实现(AGENTS §22c)。

/** 终止一条在途流所需的依赖。全部显式注入,便于断言"到底调了哪几条出口"。 */
export interface TerminateStreamDeps {
  /** 在途流的控制器;`stop()` 与切换 effect 共用同一个 ref。 */
  abortRef: { current: AbortController | null }
  /** 当前会话 id;为空时不发服务端中止通知(沿用 stop() 既有条件)。 */
  conversationId: string | null
  /** 找出"仍在流式中的 assistant 消息"id(无则 null)。惰性:没有流时不该算。 */
  findInterruptedAssistantId: () => string | null
  /** 写入 #21「追加指令继续」中断态。 */
  setInterruptedMessage: (id: string | null) => void
  /** 服务端闭环:通知网关中止该会话上游流(fire-and-forget,失败静默降级)。 */
  notifyServerAbort: (payload: { conversationId: string; messageId?: string }) => void
  /** 回收全局"压缩中"灰条(主动终止不触发 onResponse,不清则全站常驻)。 */
  clearCompactionPreview: () => void
  /**
   * 面向用户的终止原因(例:「已切换到 X,本轮回答已终止」)。
   * 缺省 = 静默,即用户自己点「停止」的既有行为 —— 那条路径不需要额外解释。
   */
  notice?: string
  /** 呈现 notice 的出口(注入而非直接 import toast,保持本模块可纯测)。 */
  showNotice?: (message: string) => void
}

/**
 * 终止当前在途的流式回答。与改造前的 `stop()` 逐动作等值:
 * 标记中断 → 通知网关 → abort 控制器 → 回收压缩预告;notice 只在本轮**确实终止了一条流**时才呈现。
 *
 * @returns 是否真的终止了一条流。`false` = 当前没有控制器(纯换档,不该打扰用户)。
 */
export function terminateActiveStream(deps: TerminateStreamDeps): boolean {
  const controller = deps.abortRef.current
  if (!controller) return false

  const interruptedId = deps.findInterruptedAssistantId()
  deps.setInterruptedMessage(interruptedId)
  if (deps.conversationId) {
    deps.notifyServerAbort({
      conversationId: deps.conversationId,
      ...(interruptedId ? { messageId: interruptedId } : {}),
    })
  }
  // 刻意不把 abortRef 置 null:控制器由该流自己的 finally(代际守卫内)回收,
  // 在这里置空会让 finally 的清理条件失真,残留 isStreaming。
  controller.abort()
  deps.clearCompactionPreview()
  if (deps.notice && deps.showNotice) deps.showNotice(deps.notice)
  return true
}

/**
 * 切换模型时是否该终止在途流。
 *
 * 三条都要成立,缺一条就是"界面看起来卡住"或"凭空发一次服务端中止":
 *  - 模型确实变了(首次渲染 / 持久化回填不算);
 *  - 有在途控制器;
 *  - 不是同一件事被重复触发(prev 与 current 已被上一轮记过账)。
 */
export function shouldTerminateForModelSwitch(args: {
  previousModel: string
  currentModel: string
  hasLiveStream: boolean
}): boolean {
  if (args.previousModel === args.currentModel) return false
  return args.hasLiveStream
}

/**
 * 本轮真正该用的模型(V3 #68 的竞态收口)。
 *
 * 成因:`sendMessage` 在入口就把 `store.currentModel` 取成了局部值,而它到真正发起流之间
 * 隔着多个 await(建会话、成本预检,其中「成本协商」还会**等用户点确认**)。这段时间里
 * 用户改了模型,旧值就会带着上一个档位进入 provider —— 即票面禁止的"用旧模型发新一轮"。
 * 因此在最后一个 await 之后、写消息与发起流之前复核一次:以**最新**档位为准。
 * 刻意取"最新非空值"而不是"值变了就终止本轮":用户已经按了发送,让他重发一次
 * 就是票面说的"还得手动再发一遍";而这一轮尚未触达 provider,终止反而只会留下一条空气泡。
 */
export function resolveRoundModel(capturedModel: string, latestModel: string): string {
  return latestModel || capturedModel
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
