// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账票 68(2026-10-15 web 腿已装车,2026-10-16 小程序腿,本文件是 RN 腿):
// 「流式中切换模型 → 终止后自动带入新模型」在 RN 端的唯一出口。
//
// 判据表与参照件逐条同值(`apps/web/src/hooks/use-chat/model-switch.ts`、
// `apps/miniapp-taro/src/pkg-ai/ai/model-switch.ts`),三端只许同一套语义:
//  ①模型没变(挂载首帧 / fetchModels 回填)⇒ 不终止;
//  ②没有在途流 ⇒ 不终止(纯换档不该打断任何东西,也不该打扰用户);
//  ③变了且有流 ⇒ 终止,本轮档位取「最新非空值」,不让用户重发。
//
// 为什么不住在 packages/shared:web 与小程序各有一份同名端内实现,而
// `scripts/check-shared-layer-duplication.mjs`(守门 40,blocking)把「shared 有名、端内同名」直接判红;
// 在那两端把 import 指回 shared 之前先把同名模块搬进 shared,只会造出一道与提交内容无关的恒红门(AGENTS §12e)。
//
// 平台差异(照小程序腿同一条口径写清,不照搬 web 的多余出口):web 的终止出口还带「标记 #21 中断态」
// 「通知网关 /api/ai/chat/abort」「回收压缩预告」,这三样 RN 端没有对应链路;而小程序端的
// `stopThinkingProgress` 浮层在 RN 也**不存在**(本端流式中只有 `isStreaming` 一个旗驱动
// MessageInput 的停止钮与 TaskStatusBar)。故本端的回收动作就是「把 isStreaming 落回 false」。

/** 终止一条在途流所需的依赖(全部显式注入,便于断言"到底调了哪几条出口",本模块不 import React/Taro/i18n)。 */
export interface RnTerminateStreamDeps {
  /** 在途流的控制器;「停止」按钮与「流式中切换模型」共用同一个 ref。 */
  abortRef: { current: AbortController | null }
  /** 回收本端在途旗(= ChatScreen 的 `setIsStreaming(false)`);不回收则停止钮永远亮着。 */
  reclaimStreaming: () => void
  /**
   * 面向用户的终止原因(例:「已切换到 X,本轮回答已终止」)。
   * 缺省 = 静默,即用户自己点「停止」的既有行为 —— 那条路径不需要额外解释。
   */
  notice?: string
  /** 呈现 notice 的出口(注入而非在模块里调 FloatBox,保持本模块可纯测)。 */
  showNotice?: (message: string) => void
}

/**
 * 终止当前在途的流式回答,与改造前 ChatScreen 的 `stop()` 逐动作等值(abort → 回收在途旗),
 * notice 只在本轮**确实终止了一条流**且调用方给了理由时才呈现。
 *
 * 刻意不把 `abortRef` 置 null:控制器由该流自己的 onError/onDone 回收(ChatScreen.tsx 两处都写
 * `abortRef.current = null`),在这里置空会让那两个回调的清理条件失真。
 *
 * @returns 是否真的终止了一条流。`false` = 当前没有控制器(纯换档,不该打扰用户)。
 */
export function terminateActiveStream(deps: RnTerminateStreamDeps): boolean {
  const controller = deps.abortRef.current
  if (!controller) return false

  controller.abort()
  deps.reclaimStreaming()
  if (deps.notice && deps.showNotice) deps.showNotice(deps.notice)
  return true
}

/**
 * 切换模型时是否该终止在途流(判据表与 web / 小程序逐条同值)。
 *
 * 两条都要成立,缺一条就是"凭空打断"或"界面看着卡住":
 *  - 模型确实变了(挂载首帧 / fetchModels 回填不算);
 *  - 有在途流。
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
 * 本轮真正该用的模型(票 68 的竞态收口,与 web / 小程序同一条)。
 *
 * 成因:入口取到的档位是**发起那一刻的渲染闭包快照**,而 `streamChat` 在真正触达网关前还有 await。
 * 这段时间里用户改了模型,旧值就会带着上一个档位进入 provider —— 即票面禁止的"用旧模型发新一轮"。
 * 故在最后一个同步点(把 payload 交出去之前)复核一次,以最新档位为准;刻意取「最新非空值」而不是
 * "值变了就终止本轮":用户已经按了发送,让他重发一次就是票面说的"还得手动再发一遍"。
 * 最新档为空(回填中间态)时退回入口档,不把空串送进 provider。
 */
export function resolveRoundModel(capturedModel: string, latestModel: string): string {
  return latestModel || capturedModel
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
