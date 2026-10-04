// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815941 —— "IME(输入法)合成期按 Enter 不得提交"的**跨端共享出口**。
//
// 为什么从apps/web 提到共享层(本文件存在的理由,不是"整理代码"):
//  1. 该判据是**纯键盘语义**,不依赖任何平台对象 —— web 端原实现自己也写着"属web 端特有,
//     不得进跨端共享面",而那条理由只对 defaultPrevented / React 事件类型成立;判据本体
//     (两条 IME 腿的并集 + 收尾闩锁 + 空内容)只是一次布尔运算,**任何有键盘的端都适用**。
//     把它按"某个端的特有逻辑"关在 web 目录里,第二个端要提交消息时就只能重写一遍 ——
//     而重写的那一遍几乎必然只抄走一条腿(实测:本仓 5 处Enter 提交点有 3 处是单腿
//     `!e.nativeEvent.isComposing`),缺陷就这样复发。
//  2. 判据住在能被 vitest 直接问到的地方(范式同 element-pack.ts),不必渲染整个组件
//     才能穷尽输入;web-input-core.tsx 只做装配。
//
// 三条腿的并集,以及为什么必须是三条(拆成任何一条都会漏真实浏览器):
//   腿一 localComposing     —— 组件自己 compositionstart/end 维护的本地标志。
//   腿二 nativeComposing    —— 事件自带的 `isComposing`(React: e.nativeEvent.isComposing,
//                              原生: e.isComposing)。部分引擎的合成事件不带该标志 ⇒ 单腿失效。
//   腿三 justEndedComposing —— compositionend 落地后、**还没有任何 keydown 消费过**的那一段。
//                              这是最常见的漏点:部分引擎里"确认候选词"的那一次 Enter 排在
//                              compositionend **之后**,此刻腿一已被置回false、腿二也已是 false,
//                              两腿并集放行 ⇒ 把半截中文当正文发出去。腿三由 noteKeyDown
//                              **消费一次**即失效,所以它只挡那一次,不会把后续真提交也吃掉。
//
// 为什么"空内容"要进判据而不是留在调用方:空命令 + 无输入时 Enter 语义上属于
// "落回 awaiting/空态",不是"发送空消息"。留在调用方就等于每端各判一次,又是一处
// 可能只抄一半的地方。

/** 判据的全部输入(原语化,与任何框架的事件类型解耦) */
export interface EnterSubmitSignals {
  key: string
  shiftKey: boolean
  /** 外部处理器被透传调用后是否已 preventDefault —— 外部握有否决权 */
  defaultPrevented: boolean
  /** 腿一 · 本地标志:compositionstart 已到、compositionend 未到的窗口期 */
  localComposing: boolean
  /** 腿二 · 事件标志:事件自带的 isComposing */
  nativeComposing: boolean
  /** 腿三 · 收尾闩锁:compositionend 之后的第一条 keydown(= 确认候选词那一次) */
  justEndedComposing: boolean
  /** 是否有可提交内容(空命令 + 无输入 ⇒ 不提交,应落回 awaiting/空态) */
  hasContent: boolean
}

/**
 * 该吃这一下 Enter 吗?短路判序逐条对应一次真实事故:
 *  1. defaultPrevented ⇒ 不吃。外部处理器握有否决权(例如 `#` 上下文选择器开着且有匹配项时
 *     Enter 是"选中"而非"发送")。
 *  2. 非 Enter 或 Shift+Enter ⇒ 不吃(换行语义)。
 *  3. 三条 IME 腿取或 ⇒ 任一成立都不提交(见文件头"为什么必须是三条")。
 *  4. 无内容 ⇒ 不提交(空命令走 awaiting/空态,不发空消息)。
 */
export function shouldSubmitOnEnter(s: EnterSubmitSignals): boolean {
  if (s.defaultPrevented) return false
  if (s.key !== 'Enter' || s.shiftKey) return false
  if (s.localComposing || s.nativeComposing || s.justEndedComposing) return false
  if (!s.hasContent) return false
  return true
}

// ── 腿三的闩锁本体 ────────────────────────────────────────────────────────────
// 为什么把闩锁也做成纯函数:腿三的"消费一次"语义必须**在纯函数里可被单测问到**。
// 若只留shouldSubmitOnEnter 而把闩锁散回各端组件,各端就要自己写"记时间戳/置 ref/
// 下一个 keydown 记得清掉"——三种写法里必有一种漏清,漏清的那一端从此再也发不出消息。
// 纯 reducer ⇒ 各端只做"把事件喂进来",状态转移只有这一处定义。

/** 闩锁状态。`justEnded` 必须被消费一次即失效,理由见文件头腿三。 */
export interface CompositionLatch {
  /** compositionstart 已到、compositionend 未到 */
  active: boolean
  /** compositionend 刚落地、尚无任何 keydown 消费过 */
  justEnded: boolean
}

export const INITIAL_COMPOSITION_LATCH: CompositionLatch = { active: false, justEnded: false }

/**
 * compositionstart:进入组合期,并清掉上一次组合可能残留的收尾闩锁。
 * 刻意**不取**当前闩锁 —— 这两个转移的入参在语义上是"当前值",但目标状态与它无关
 * (进组合期必然清闩锁)。写成零参而不是塞一个 `_latch` 假引用,是为了让"这里忽略了旧状态"
 * 出现在签名里而不是藏在函数体中;调用方按`() => setLatch(noteCompositionStart())` 接线。
 */
export function noteCompositionStart(): CompositionLatch {
  return { active: true, justEnded: false }
}

/**
 * compositionend:离开组合期,并置起收尾闩锁(随后那一次 keydown 即"确认候选词")。
 * 同上,零参:出组合期必然置闩锁,与旧值无关。
 */
export function noteCompositionEnd(): CompositionLatch {
  return { active: false, justEnded: true }
}

/**
 * 任意一次 keydown:消费收尾闩锁。
 * 消费只发生一次 —— 第二次起 justEnded 恒false,故不会连带吃掉用户随后真正想发送的 Enter。
 * 注意它对**所有**键生效而不是只对 Enter:若只让 Enter 消费,合成收尾后先按了别的键
 * (Shift/方向键/退格)时闩锁会一直挂着,挡住下一次本该生效的提交。
 */
export function noteKeyDown(latch: CompositionLatch): CompositionLatch {
  if (!latch.justEnded) return latch
  return { active: latch.active, justEnded: false }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
