// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-843 + G-844 的唯一判据 —— "这次 keydown 该不该被输入组件内部当作提交消费"。
//
// 判定住在纯函数里(范式同 packages/shared 的 element-pack.ts"判定住在能被 vitest 直接问到的地方";
// 票面写的 apps/web/.../message-list/element-pack.ts 是不存在的路径,且该判定依赖 DOM 概念
// (defaultPrevented / isComposing),属 web 端特有,不得进跨端共享面),
// web-input-core.tsx 只做装配 —— 键序与 IME 双腿判据因此可被单测逐输入穷尽,
// 不必靠渲染整个组件才能问到。

/** 判据的全部输入(原语化,与 React 事件类型解耦) */
export interface EnterSubmitInputs {
  key: string
  shiftKey: boolean
  /** 外部处理器被透传调用后是否已 preventDefault —— 外部握有否决权(G-843 的判序核心) */
  defaultPrevented: boolean
  /** IME 本地腿:compositionstart 已到、compositionend 未到的窗口期(G-844 腿一) */
  localComposing: boolean
  /** IME 事件腿:e.nativeEvent.isComposing(G-844 腿二) */
  nativeComposing: boolean
}

/**
 * 该吃这一下 Enter 吗?三条短路判序逐条对应一次真实事故:
 *  1. defaultPrevented ⇒ 不吃。修掉"内部先吃 Enter、外部只在 else 分支被调用"的旧序 ——
 *     `#` 上下文选择器开着且有匹配项时 Enter 是"选中"(use-context-selector.ts 的 Enter 分支
 *     preventDefault+select),若内部仍然抢发,用户看到半截 `#文件` 被当正文发出去。
 *  2. 非 Enter 或 Shift+Enter ⇒ 不吃(换行语义,与既有行为逐字相同,本函数不改判序语义)。
 *  3. 两条 IME 腿取或 ⇒ 任一成立都不发送。单靠事件腿是单腿:部分引擎里"候选窗已关但
 *     compositionend 尚未落地"那一次 keydown 的 isComposing 已是 false,拼音/假名打字
 *     按 Enter 会把半成品发出去;本地腿由组件的 compositionstart/end 标志补住这一窗口。
 */
export function shouldSubmitOnEnter(e: EnterSubmitInputs): boolean {
  if (e.defaultPrevented) return false
  if (e.key !== 'Enter' || e.shiftKey) return false
  return !(e.localComposing || e.nativeComposing)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
