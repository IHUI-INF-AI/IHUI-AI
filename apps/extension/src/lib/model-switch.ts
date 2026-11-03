// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账票 G-53 / 票 68(web、小程序、RN 三腿已装车并有同名端内件,本文件是扩展腿):
// 「流式中切换模型 → 终止后自动带入新模型」在本端的唯一出口。
//
// 判据表与参照件逐条同值(`apps/web/src/hooks/use-chat/model-switch.ts`、
// `apps/miniapp-taro/src/pkg-ai/ai/model-switch.ts`、`apps/mobile-rn/src/lib/model-switch.ts`),
// 四端只许同一套**判据**:
//  ①模型没变(挂载首帧 / fetchModels 回填)⇒ 不终止;
//  ②没有在途流 ⇒ 不终止(纯换档不该打断任何东西,也不该打扰用户);
//  ③变了且有流 ⇒ 终止。
//
// ③的**结果**本端按机主定档只取"终止"这一半(与 web/RN 不同,差异是裁定的,不是漏的):
// 换档终止在途轮后,本端不自动用新模型重发这一轮 —— 用户下一条消息自然走新档位。
// 因此本端**不**接 `resolveRoundModel`(见文件尾注),也**不**需要 web/RN 那个"最新档" ref 出口。
//
// 为什么不住在 packages/shared:三端各有一份同名端内实现,而
// `scripts/check-shared-layer-duplication.mjs`(守门 40,blocking)把「shared 有名、端内同名」直接判红;
// 在那三端把 import 指回 shared 之前先把同名模块搬进 shared,只会造出一道与提交内容无关的恒红门(AGENTS §12e)。
//
// 平台差异(照 RN 腿同一条口径写清,不照搬 web 的多余出口):web 的终止出口还带「标记 #21 中断态」
// 「通知网关 /api/ai/chat/abort」「回收压缩预告」,这三样扩展端没有对应链路(侧栏既没有 interrupted-message
// 态,api-client 的 streamChat 也只有本地 signal)。而本端的在途旗是 ChatPage 的 `streaming`,它一处驱动
// 三样东西:发送表单的「入队 vs 发送」分叉、QueueBar 的许可门、TaskStatusBar 的转圈 —— 不回收就是停不下来。
// 面向用户的理由复用本页既有 `notice` 状态条(与 onCompaction / onPartialDone 同一出口,不新立 UI);
// 理由文本取本端**已有**键 `chat.partialDoneTitle` —— 三端参照件用的 `chat.modelSwitchStopped` 在本端
// 词包里不存在,补键不在本腿射程内,而取不到键时 t() 会把原始键名直接打到屏幕上(破窗)。
// **终止动作与既有 stop 路径同源**:本端已有的两条停流把手(D38「打断并执行」的 stopFirst、
// 15s 首字超时的 setTimeout abort)用的都是 ChatPage 的同一个 `abortRef` 句柄;本模块接的也是
// 这一个 ref,不再新开第三种停流语义、不新建第二条 abort 通道。

/** 终止一条在途流所需的依赖(全部显式注入,便于断言"到底调了哪几条出口",本模块不 import React/chrome/i18n)。 */
export interface ExtTerminateStreamDeps {
  /** 在途流的控制器;「打断并执行」与「流式中切换模型」共用同一个 ref。 */
  abortRef: { current: AbortController | null }
  /** 回收本端在途旗(= ChatPage 的 `setStreaming(false)`);不回收则队列条与状态条永远亮着。 */
  reclaimStreaming: () => void
  /**
   * 面向用户的终止原因(本端现取「回答被中断,以下内容可能不完整」)。
   * 缺省 = 静默,即用户自己点「停止」的既有行为 —— 那条路径不需要额外解释。
   */
  notice?: string
  /** 呈现 notice 的出口(注入而非在模块里调 setNotice/i18n,保持本模块可纯测)。 */
  showNotice?: (message: string) => void
}

/**
 * 终止当前在途的流式回答,与改造前 ChatPage 的 abort 动作逐动作等值(abort → 回收在途旗),
 * notice 只在本轮**确实终止了一条流**且调用方给了理由时才呈现。
 *
 * 刻意不把 `abortRef` 置 null:控制器由该流自己的 `finally`(ChatPage 的代际守卫
 * `if (abortRef.current === controller) abortRef.current = null`)回收,在这里置空会让那条清理
 * 条件失真,下一轮流又被上一轮的句柄顶掉。
 *
 * @returns 是否真的终止了一条流。`false` = 当前没有控制器(纯换档,不该打扰用户)。
 */
export function terminateActiveStream(deps: ExtTerminateStreamDeps): boolean {
  const controller = deps.abortRef.current
  if (!controller) return false

  controller.abort()
  deps.reclaimStreaming()
  if (deps.notice && deps.showNotice) deps.showNotice(deps.notice)
  return true
}

/**
 * 切换模型时是否该终止在途流(判据表与 web / 小程序 / RN 逐条同值)。
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
 * 本轮真正该用的模型(判据表与 web / 小程序 / RN 同值的一条**纯函数**)。
 *
 * ⚠ 本端**不调用它**(2026-10-21 机主定档):票面「换档 ⇒ 终止在途流」,故 ChatPage 在 await 窗内
 * 换档时的正确结果是**终止那一轮**(abort 句柄已先于 await 登记,见 ChatPage),而不是"静默把
 * 这一轮改投到新档位上"。web / RN 接它是因为那两端定档为"本轮直接跟到新档继续发",与票面读法不同。
 *
 * 留在本文件里的理由只有一个:四端判据表必须逐条同值、可比对(AGENTS §22c 单一真相源的对照面),
 * 少一条就是"四份同名文件其实判的不是同一件事"。**不得**因为"暂时不接"就删掉它,也不得在本端
 * 接进 ChatPage —— 机主已定档不接(接入=静默跟新档,与票面终止语义冲突)。
 * web 那份的注释("成因:入口取到的是发起那一刻的快照 ……")描述的是 web 自己的接线,不是本端事实。
 */
export function resolveRoundModel(capturedModel: string, latestModel: string): string {
  return latestModel || capturedModel
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
