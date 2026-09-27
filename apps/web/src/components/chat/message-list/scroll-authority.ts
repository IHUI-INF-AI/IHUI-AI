// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 滚动权账目(scroll authority)—— 唯一判据源,纯函数、零 DOM 依赖。
 *
 * 立因(2026-09-27,从开源竞品 ZCode 的 `timelineScrollAnchor.ts` 机制落下来的一票):
 * 此前的贴底 effect 在 React commit 时刻读一份**瞬时几何快照**(以及一枚只在 scroll 事件里
 * 更新的 ref),于是同一条链上有三处必然出错:
 *
 * ① ref 只由 scroll 事件更新,而 scroll 事件在滚动发生后的**下一渲染帧**才派发 ⇒ commit
 *    时刻读到的是过期值,用户的上滚被 effect 拿旧值拽回底部(回弹落点又把"跟随"判回 true,
 *    于是这一次上滚被整体吞掉)。
 * ② 新消息**无条件**强制滚底 ⇒ 用户正在上翻读历史时同样被拉走。
 * ③ 程序化 `scrollIntoView` 自己产生的中间帧 scroll 事件与用户滚动**不可区分**(无来源标记)
 *    ⇒ 布局/程序化位移被当成"用户上滚"记账,或反过来夺走用户的滚动权。
 *
 * 现在的模型:滚动权 = **用户意图账目** `following`。
 * - 只有真实用户输入(wheel / touch / 会触发原生滚动的按键,以及归因不上的 scroll 事件)
 *   能改变它;`source: 'programmatic' | 'layout'` 的事件一律只更新几何账目。
 * - commit 时刻的对账(`reconcileAuthorityAtCommit`)不用瞬时几何当用户意图的证据 ——
 *   流式撑高会让"距底"变大而 scrollTop 一动没动,那不是用户意图。
 *
 * 行为后果(如实登记,这是**有意变更**、不是回归,用户可感知):
 * ▶ 已解除跟随(用户上翻)时,**新消息不再把用户拉回底部**;要回底部改用「跳到最新」。
 * ▶ 用户本来就在底部时,新消息照常跟随 —— 这一主路径由单测钉住,不受本次改动影响。
 * ▶ 前插历史改为确定性锚点(`prependScrollAdjustment`),不再轮询 scrollHeight;
 *   触发阈值由固定 60px 改为按视口高推(`historyPrefetchTriggerPx`)。
 */

/** scroll 事件的来源。三类必须显式带上 —— 无来源标记就是本次要修的缺陷本身。 */
export type ScrollEventSource = 'user' | 'programmatic' | 'layout'

/**
 * 用户输入的方向意图,由事件层(wheel / touch / keydown)提前记账。
 * - `'none'`:记账读到了输入但不构成滚动(deltaY=0、非滚动键)。
 * - `'unknown'`:有一枚 scroll 事件但拿不到用户输入凭据(滚动条拖动、浏览器 scroll anchoring)。
 */
export type UserScrollIntent = 'none' | 'awayFromBottom' | 'towardBottom' | 'unknown'

/** 滚动容器的瞬时几何量(由调用方从 DOM 读好后喂进来,本模块不碰 DOM)。 */
export interface ScrollMetrics {
  readonly scrollTop: number
  readonly viewportHeight: number
  readonly contentHeight: number
}

/** 滚动权状态。`following` 表达的是用户意图,不是"当前离底多远"。 */
export interface ScrollAuthority {
  readonly following: boolean
}

/**
 * 离底滞回档(沿用改动前的 UPPER/LOWER 两档,数值一字未改):
 * - 跟随中:距底超过 `BOTTOM_DETACH_PX` 才解除。
 * - 已解除:距底回到 `BOTTOM_REATTACH_PX` 内才恢复。
 * 滞回带的存在理由与旧注释相同:边界附近的微小滚动不得让「跳到最新」按钮频繁显隐。
 */
export const BOTTOM_DETACH_PX = 120
export const BOTTOM_REATTACH_PX = 70

/** 未记账位移的判定容差:小于该值的 scrollTop 回退视为亚像素抖动,不算用户上滚。 */
export const UNOBSERVED_SCROLL_EPSILON_PX = 2

/** 前插历史触发阈值的下限(旧实现是固定 60px,量级沿用,只做亚像素余量归整)。 */
export const HISTORY_PREFETCH_MIN_TRIGGER_PX = 64
/** 提前两个视口补页:网络与渲染应在用户抵达窗口边界前完成(旧值 60px 必然让用户先撞到边界)。 */
export const HISTORY_PREFETCH_VIEWPORTS = 2

/** 贴底动作的类型。`'hold'` = 保持用户当前阅读位置,一律不动 scrollTop。 */
export type ContentAnchorAction = 'stickToBottom' | 'hold'

/** 距底的剩余可滚动距离(内容不足一屏时为 0,故取 max)。 */
export function distanceToBottom(metrics: ScrollMetrics): number {
  return Math.max(0, metrics.contentHeight - metrics.viewportHeight - metrics.scrollTop)
}

/** 是否落在底部档位内(默认按"恢复跟随"那一档,即更严格的 `BOTTOM_REATTACH_PX`)。 */
export function isAtBottom(metrics: ScrollMetrics, epsilonPx: number = BOTTOM_REATTACH_PX): boolean {
  return distanceToBottom(metrics) <= epsilonPx
}

/** 会话切换 / 首次挂载:打开会话定位到最新消息 ⇒ 从跟随态起算。 */
export function followingAtSessionStart(): ScrollAuthority {
  return { following: true }
}

/** 落点判定(带滞回):跟随与已解除两档各用自己的阈值。 */
function followingAfterLanding(current: ScrollAuthority, metrics: ScrollMetrics): boolean {
  const distance = distanceToBottom(metrics)
  return current.following ? distance <= BOTTOM_DETACH_PX : distance <= BOTTOM_REATTACH_PX
}

/** scrollTop 是否相对上次记账值明显回退(布局撑高不会造成回退,只有滚动位置会变)。 */
function regressedBelowObservation(metrics: ScrollMetrics, lastObservedScrollTop: number): boolean {
  return metrics.scrollTop < lastObservedScrollTop - UNOBSERVED_SCROLL_EPSILON_PX
}

export interface ScrollAuthorityEvent {
  readonly source: ScrollEventSource
  readonly metrics: ScrollMetrics
  /** 事件层提前记账到的用户方向意图;缺省按 `'unknown'` 处理。 */
  readonly intent?: UserScrollIntent
  /** 上一次记账读到的 scrollTop(几何账目)。 */
  readonly lastObservedScrollTop: number
}

export interface AuthorityReconciliation {
  readonly authority: ScrollAuthority
  /**
   * 几何账目:**任何**来源的 scroll 事件都要更新它(包括不改 following 的那两类)。
   * 把它与 authority 一起返回,是为了让"只更新几何、不改滚动权"这件事在类型上可见、可断言。
   */
  readonly observedScrollTop: number
}

/**
 * scroll 事件后的滚动权裁决。
 *
 * 规则:`source !== 'user'` ⇒ following 原样返回(程序化贴底的中间帧、测高修正导致的位移
 * 都不得夺权);用户来源再按意图裁决 —— 明确上翻立即解除,明确下翻要落回底部档位才恢复,
 * 归因不上的事件按落点判定(保留滞回),但 scrollTop 明显回退一律判为上翻。
 */
export function reconcileAuthority(input: {
  readonly current: ScrollAuthority
  readonly event: ScrollAuthorityEvent
}): AuthorityReconciliation {
  const { current, event } = input
  const observedScrollTop = event.metrics.scrollTop
  if (event.source !== 'user') {
    return { authority: current, observedScrollTop }
  }
  const intent = event.intent ?? 'unknown'
  if (intent === 'none') {
    return { authority: current, observedScrollTop }
  }
  if (intent === 'awayFromBottom') {
    return { authority: { following: false }, observedScrollTop }
  }
  if (intent === 'towardBottom') {
    return { authority: { following: isAtBottom(event.metrics) }, observedScrollTop }
  }
  if (regressedBelowObservation(event.metrics, event.lastObservedScrollTop)) {
    return { authority: { following: false }, observedScrollTop }
  }
  return { authority: { following: followingAfterLanding(current, event.metrics) }, observedScrollTop }
}

/**
 * commit 时刻(贴底动作之前)的对账 —— 本次修复的核心一格。
 *
 * 与 `reconcileAuthority` 的差别只有一处、但必须是两处:**贴底动作之前不存在"落点证据"**。
 * 此刻的距底变大有两种成因:用户真的滚离了底部(那会有 scrollTop 回退或事件层记账),
 * 或者只是流式内容把 scrollHeight 撑高了(scrollTop 一动没动)。按落点判定就会把后者
 * 误读成前者,于是"内容一变就夺权"。故:
 * - 没有用户输入凭据 ⇒ following 原样保持;
 * - 明确上翻 ⇒ 立即解除(同一 commit 里的布局/测量提交也必须让位);
 * - `'unknown'` ⇒ 只承认 scrollTop 回退这一种证据。
 */
export function reconcileAuthorityAtCommit(input: {
  readonly current: ScrollAuthority
  readonly metrics: ScrollMetrics
  /** 事件层记账的方向;没有记录时传 `null`(而不是 `'unknown'`,后者表示"有位移但归因不明")。 */
  readonly intent: UserScrollIntent | null
  readonly lastObservedScrollTop: number
}): AuthorityReconciliation {
  const { current, metrics, intent } = input
  const observedScrollTop = metrics.scrollTop
  if (intent === null || intent === 'none') {
    return { authority: current, observedScrollTop }
  }
  if (intent === 'awayFromBottom') {
    return { authority: { following: false }, observedScrollTop }
  }
  if (intent === 'towardBottom') {
    return { authority: { following: isAtBottom(metrics) }, observedScrollTop }
  }
  if (regressedBelowObservation(metrics, input.lastObservedScrollTop)) {
    return { authority: { following: false }, observedScrollTop }
  }
  return { authority: current, observedScrollTop }
}

/**
 * 内容变化(新消息追加 / 流式 delta 撑高)后的动作。
 *
 * 行为变更登记:**已解除跟随 ⇒ 新消息也不得拉回**。改动前的判据是
 * `isNewMessage || (!userScrolledUp && isStreaming)`,新消息那一支无条件强制滚底,
 * 用户正在上翻读历史时同样被拽走。这里把"是否拉回"的决定权完整地交还给 following 本身;
 * `isNewMessage` / `isStreaming` 保留在入参里,是为了让这条决策表与改动前的输入一一对得上。
 */
export function anchorActionForContentChange(input: {
  readonly authority: ScrollAuthority
  readonly isNewMessage: boolean
  readonly isStreaming: boolean
}): ContentAnchorAction {
  if (!input.authority.following) return 'hold'
  if (input.isNewMessage) return 'stickToBottom'
  if (input.isStreaming) return 'stickToBottom'
  // 跟随中、且既非新消息也非流式(例如同一条消息的内容改写):沿用改动前"在底部就贴住"的行为
  return 'stickToBottom'
}

/**
 * 一枚 scroll 事件该归给哪个来源。
 *
 * 优先级:用户输入凭据 > 程序化窗口 > 归因不明(按用户处理,落点即证据)。
 * 布局/测高那一类自调用不走这里 —— 调用方直接显式传 `source: 'layout'`,
 * 所以这个函数不接"是不是布局自调用"这个入参(接了就是第二个真相)。
 *
 * 程序化窗口只在**位移朝前**时才成立(`scrollTop > lastObservedScrollTop`):
 * 我们发起的贴底只会把位置往底部推,任何没有前进的位移(原地、回退)在成因上都不可能是它。
 * 少了这一条,窗口就成了"从我方滚过一次底起,一段时间内谁的 scroll 事件都不算数"——
 * 实测会把用户滚动条拖动、以及测试里那枚"位置未变的 scroll 事件"整片洗成 programmatic,
 * 于是「跳到最新」永远不显形。失效方向由此固定为"少吞掉一次用户意图"。
 */
export function resolveScrollEventSource(input: {
  readonly userIntent: UserScrollIntent | null
  readonly programmaticWindowActive: boolean
  readonly metrics: ScrollMetrics
  readonly lastObservedScrollTop: number
}): ScrollEventSource {
  if (input.userIntent !== null && input.userIntent !== 'none') return 'user'
  if (input.programmaticWindowActive && input.metrics.scrollTop > input.lastObservedScrollTop) {
    return 'programmatic'
  }
  return 'user'
}

/** wheel 的 deltaY 与 scrollTop 同向:负值阅读更早内容,正值靠近底部。 */
export function wheelScrollIntent(deltaY: number): UserScrollIntent {
  if (deltaY < 0) return 'awayFromBottom'
  if (deltaY > 0) return 'towardBottom'
  return 'none'
}

/** touch 手指位移与 scrollTop 反向:手指下移表示阅读更早内容。 */
export function touchScrollIntent(previousClientY: number, nextClientY: number): UserScrollIntent {
  if (nextClientY > previousClientY) return 'awayFromBottom'
  if (nextClientY < previousClientY) return 'towardBottom'
  return 'none'
}

/**
 * 按键滚动意图。`editableTarget` 为真时输入控件内的按键不属于列表滚动(光标键/空格都属于打字)。
 * 只列**本仓未被自有导航拦截**的键:↑/↓/Home/End 由 use-message-list-scroll 的键盘导航
 * preventDefault(它们切换聚焦消息、不产生原生滚动),把它们记成用户滚动就是造一个
 * 并不存在的意图 —— 所以这里刻意不含它们。
 */
export function keyboardScrollIntent(input: {
  readonly key: string
  readonly shiftKey: boolean
  readonly editableTarget: boolean
}): UserScrollIntent {
  if (input.editableTarget) return 'none'
  if (input.key === 'PageUp') return 'awayFromBottom'
  if (input.key === 'PageDown') return 'towardBottom'
  if (input.key === ' ') return input.shiftKey ? 'awayFromBottom' : 'towardBottom'
  return 'none'
}

/**
 * 前补历史的位置恢复。
 *
 * 确定性锚点替代旧的"rAF 轮询 scrollHeight 等变化"。三条判据按顺序:
 * ① 首行 key 必须**变小**(窗口起点往历史方向挪了)才算前插 —— 追加时首行 key 不变,
 *    替换/清空时锚点量不到,两者一律不动滚动位置。
 * ② 位移量按**触发瞬间保存的绝对视口偏移**算目标:`(锚点在内容中的新偏移) - savedOffset - 实时 scrollTop`。
 *    绝不用"触发时的 scrollTop + 高度差",因为触发到提交之间 virtualizer/测高可能已经自己改写过
 *    scrollTop,那样会把中间位移重复计入(旧实现的 `prevScrollTop + (newScrollHeight - prevScrollHeight)`
 *    就是这一型,而且它只在高度差 >50px 时才补偿 —— 前插不足 50px 永不补偿)。
 * ③ 算出非正 ⇒ 不是前插(上面的行是被删掉的),不动。
 */
export type PrependHoldReason =
  | 'no-rows'
  | 'first-row-unchanged'
  | 'anchor-unmeasurable'
  | 'not-a-prepend'
  | 'non-finite'

export type PrependScrollOutcome =
  | { readonly kind: 'adjust'; readonly delta: number }
  | { readonly kind: 'hold'; readonly reason: PrependHoldReason }

export function prependScrollAdjustment<Key extends string | number>(input: {
  /** 触发瞬间窗口首行 key(`null` = 当时没有行)。 */
  readonly firstRowKeyBefore: Key | null
  /** 提交瞬间窗口首行 key(`null` = 行已被清空)。 */
  readonly firstRowKeyAfter: Key | null
  /** 触发瞬间锚点相对视口顶部的偏移(px)。 */
  readonly savedOffset: number
  /** 提交瞬间锚点相对内容顶部的偏移(px);锚点量不到(被替换/未渲染)传 `null`。 */
  readonly anchorOffsetAfter: number | null
  /** 提交瞬间的**实时** scrollTop(必须现读,不得用触发时的旧值)。 */
  readonly currentScrollTop: number
}): PrependScrollOutcome {
  const { firstRowKeyBefore, firstRowKeyAfter, savedOffset, anchorOffsetAfter, currentScrollTop } = input
  if (firstRowKeyBefore === null || firstRowKeyAfter === null) {
    return { kind: 'hold', reason: 'no-rows' }
  }
  if (firstRowKeyAfter === firstRowKeyBefore) {
    return { kind: 'hold', reason: 'first-row-unchanged' }
  }
  if (anchorOffsetAfter === null) {
    return { kind: 'hold', reason: 'anchor-unmeasurable' }
  }
  if (
    !Number.isFinite(savedOffset) ||
    !Number.isFinite(anchorOffsetAfter) ||
    !Number.isFinite(currentScrollTop)
  ) {
    return { kind: 'hold', reason: 'non-finite' }
  }
  const delta = anchorOffsetAfter - savedOffset - currentScrollTop
  if (delta <= 0) {
    return { kind: 'hold', reason: 'not-a-prepend' }
  }
  return { kind: 'adjust', delta }
}

/** 顶部触发阈值:按视口高推,并给一个下限(视口量不到时退化为下限档,不退化为 0)。 */
export function historyPrefetchTriggerPx(viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return HISTORY_PREFETCH_MIN_TRIGGER_PX
  }
  return Math.max(HISTORY_PREFETCH_MIN_TRIGGER_PX, viewportHeight * HISTORY_PREFETCH_VIEWPORTS)
}

/** scroll 事件是否应触发补页(到阈值 + 可拉 + 非在途)。 */
export function shouldTriggerHistoryLoad(input: {
  readonly scrollTop: number
  readonly triggerPx: number
  readonly canLoad: boolean
  readonly loading: boolean
}): boolean {
  return input.canLoad && !input.loading && input.scrollTop <= input.triggerPx
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
