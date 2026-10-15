// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级滚动状态账目(P2,2026-10-13 立;对标 Trae 的"每会话保存 {offset, stickToBottom}")。
 *
 * 立因:此前切换会话一律 `followingAtSessionStart()` + 滚底 —— 用户在会话 A 里上翻到
 * 某条历史读到一半,切到 B 再切回 A,位置被重置到最底部,阅读现场丢失。Trae 的做法是
 * 每会话保存 {offset, stickToBottom},切回时二段恢复(先 scrollTo 保存位,100ms 后恢复
 * 追底态);本文件把这套账目的**纯逻辑**(存储 + 淘汰 + 消费判据)单点收拢,DOM 写入
 * 仍归 use-message-list-scroll(与 scroll-authority 的分工同型:判据纯函数,几何在 hook)。
 *
 * 存储范围:模块级 Map(SPA 生命周期内有效,刷新即弃)。刻意不做 localStorage 持久化:
 * offset 是对"那次渲染的内容高度"的量,跨刷新后内容(分页窗口/流式续传)可能已不同,
 * 恢复一个陈旧绝对 offset 反而制造错位;会话内切换才是这套账目的语义边界。
 */

/** 单个会话的滚动现场快照。`following` 即 scroll-authority 的滚动权(= Trae 的 stickToBottom)。 */
export interface ScrollSessionState {
  readonly offset: number
  readonly following: boolean
  readonly savedAt: number
}

/** 待消费的恢复请求:消费判据要求的全部凭据都在这里,不散落在 hook 的闭包里。 */
export interface PendingScrollRestore {
  readonly conversationId: string
  readonly state: ScrollSessionState
  /** 切换瞬间(同一 commit)的 messages 数组引用 —— 消费必须等"新会话内容已就位"。 */
  readonly messagesAtSwitch: unknown
  readonly createdAt: number
}

/** 二段恢复的第二段延迟:Trae 同款 100ms(等首帧测量补齐后再钉一次位置)。 */
export const RESTORE_PHASE2_DELAY_MS = 100

/**
 * 恢复宽限期(2026-10-13 真机实测立的第三段):异步资源(图片 / 代码高亮 / mermaid)
 * 在恢复完成后仍会继续撑高内容 —— 一次性的钉位会被"内容还不够高"的浏览器 clamp
 * 砸回 0,一次性的贴底会被随后的高度增长甩到半路(真机:恢复 762px 停 0、贴底后
 * 距底 1893px)。宽限期内每次真实高度测量都修正一次位置,到期自动失效 —— 不干扰
 * 用户其后的自由滚动(用户夺权后修正分支按滚动权现读自动让位,失效方向是少修正)。
 */
export const RESTORE_GRACE_MS = 1500

/** 宽限期内的修正目标:`null` = 跟随档(每次测量贴底),数值 = 钉位档(每次测量钉保存位)。 */
export interface RestoreGrace {
  readonly until: number
  readonly target: number | null
}

/**
 * 恢复请求的有效窗。切换后历史拉取是异步的(ai-side-panel 缓存未命中路径),
 * 若拉取失败/被本地写入覆盖,messages 引用可能在很久之后才变 —— 那时再消费就是把
 * 旧位置砸到一份已经不属于这次切换的内容上。过期即作废,行为回落"跟随滚底"现状。
 */
export const RESTORE_PENDING_TTL_MS = 5000

/** 会话账目上限:超出按"最近保存"LRU 淘汰(量级依据同 heightMap 缓存,每条约 100B)。 */
export const SCROLL_SESSION_STORE_MAX = 100

export interface ScrollSessionStore {
  save: (conversationId: string, offset: number, following: boolean) => void
  lookup: (conversationId: string) => ScrollSessionState | undefined
  clear: () => void
}

/**
 * 会话滚动账目存储(Map 插入序即最近使用序:save 先 delete 再 set 重插到尾部)。
 * 每实例独立 —— 生产用模块级单例,测试各起新例互不污染。
 */
export function createScrollSessionStore(maxEntries: number = SCROLL_SESSION_STORE_MAX): ScrollSessionStore {
  const map = new Map<string, ScrollSessionState>()
  return {
    save(conversationId, offset, following) {
      if (map.has(conversationId)) map.delete(conversationId)
      map.set(conversationId, { offset, following, savedAt: Date.now() })
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value
        if (oldest === undefined) break
        map.delete(oldest)
      }
    },
    lookup(conversationId) {
      return map.get(conversationId)
    },
    clear() {
      map.clear()
    },
  }
}

/** 消费失败的原因(测试逐条锁;`'not-pending'` = 已消费或从未挂起)。 */
export type RestoreConsumeReason =
  | 'not-pending'
  | 'conversation-mismatch'
  | 'messages-not-ready'
  | 'expired'

export type RestoreConsumeOutcome =
  | { readonly kind: 'consume' }
  | { readonly kind: 'hold'; readonly reason: RestoreConsumeReason }
  | { readonly kind: 'discard'; readonly reason: Extract<RestoreConsumeReason, 'expired'> }

/**
 * 一次渲染是否该消费挂起的恢复请求。
 *
 * 四条判据按序:
 * ① 必须有挂起(消费是一次性的,consume 后由调用方清空);
 * ② 会话 id 仍与挂起时一致 —— 中途又切走一次则作废(挂起被新切换覆盖,走不到这);
 * ③ **新会话内容已就位**:messages 引用必须不同于切换瞬间的引用。切换有两条时序
 *    (ai-side-panel 的 LRU 缓存命中 = 同步替换;未命中 = 异步拉取后替换),两条都会
 *    产生新引用;缓存在途时 messages 还是上一个会话的内容,此刻消费会把旧视图滚到
 *    新会话的保存位;
 * ④ 未超 TTL —— 见 RESTORE_PENDING_TTL_MS 的立因。
 */
export function resolveRestoreConsume(input: {
  readonly pending: PendingScrollRestore | null
  readonly conversationId: string | null
  readonly messages: unknown
  readonly now: number
}): RestoreConsumeOutcome {
  const { pending, conversationId, messages, now } = input
  if (!pending) return { kind: 'hold', reason: 'not-pending' }
  if (pending.conversationId !== conversationId) {
    return { kind: 'hold', reason: 'conversation-mismatch' }
  }
  if (messages === pending.messagesAtSwitch || !Array.isArray(messages) || messages.length === 0) {
    return { kind: 'hold', reason: 'messages-not-ready' }
  }
  if (now - pending.createdAt > RESTORE_PENDING_TTL_MS) {
    return { kind: 'discard', reason: 'expired' }
  }
  return { kind: 'consume' }
}

/** 会话滚动账目的生产单例:活得比 MessageList 卸载更久(SPA 生命周期),刷新即弃。 */
export const sessionScrollStore = createScrollSessionStore()

/** 测试隔离口:清空生产单例(账目跨用例残留会让"无账目回落现状"一档假绿)。 */
export function resetSessionScrollStore(): void {
  sessionScrollStore.clear()
}

/**
 * 第一段钉位的目标值(纯判据,只用于"未恢复滚动权"分支):
 * 非有限/负数一律保持现位(账目脏值不得把视口钉到非法位置);
 * 合法保存位原样返回 —— 防闪顶的第一段,第二段(100ms 后)再钉一次作测量修正。
 * 恢复滚动权的分支**不钉位**(回落档的保存位是 0,钉了反而先闪顶)。
 */
export function phase1TargetOffset(state: ScrollSessionState, currentScrollTop: number): number {
  if (!Number.isFinite(state.offset) || state.offset < 0) return currentScrollTop
  return state.offset
}

/** 第二段是否需要再钉一次位置(仅"未恢复滚动权"的分支;返回 false 即只恢复权限)。 */
export function needsPhase2Repin(state: ScrollSessionState): boolean {
  return !state.following
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
