// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ?turn= 深链锚点目标(差距④,2026-10-30 立)。
 *
 * 链路:`/chat?conversationId=X&turn=<turnOrdinal>` → page.tsx 的 ChatConversationSync
 * 解析并写入本模块 → AISidePanel 的 loadHistory effect peek 命中 ⇒ 走
 * `getConversationHistory({aroundTurnId, aroundWindow})` 居中窗口,并以窗口内锚点
 * turn 的首条消息为凭据走既有 ProgressJumpStore 跳转定位。
 *
 * 为什么是模块级一次性目标、而不是塞进 chat store:
 * - 目标的生命周期 = "本页 URL 还指着这一轮",消费权归 URL(page.tsx 参数变化即清),
 *   不是任何窗格的会话域状态;塞 store 会造出第二个"谁最后写谁赢"的真相源。
 * - **peek 不消费**:React StrictMode 双 effect、切走再切回都必须能按同一目标重放;
 *   消费点只有两处 —— turn 不存在(404)降级与 URL 参数变化,两处都显式 clear。
 *
 * 差距⑤遗留边界(2026-10-30 补两条):
 * - **边界1 同会话换 turn 重锚**:目标值变化(set 到不同值 / URL 权威 clear)会广播版本号,
 *   承载窗格的历史 effect 订阅该版本号 ⇒ ?turn= 变了无需刷新/重进即重走 around 取窗+锚定;
 *   值没变不广播(幂等 set / StrictMode 双 effect 可重放的现状不破)。404 降级走
 *   consumeTurnDeepLink(静默消费):同一次 loadHistory 已就地落常规路径,广播会多放一枪重放。
 * - **边界2 多窗格深链**:目标带 paneId 维度(null = 根窗格)。page.tsx 解析时若布局树里
 *   已有**非根叶**承载该会话,目标归属那一叶;跳转投递该叶的 ProgressJumpStore 实例
 *   (MessageList 经 useProgressJumpStoreForPane 消费,通道现成)。版本号按窗格取快照
 *   (getTurnDeepLinkVersionForPane):别窗格的目标变化不动本窗格快照 ⇒ 零多余重放;
 *   默认单窗格(树里无非根承载叶)paneId 恒 null,与既有根窗格行为逐字节一致。
 */

export interface TurnDeepLinkTarget {
  conversationId: string
  turnOrdinal: number
}

/** 内部存储形态:目标归属窗格(null = 根窗格/全局单例);peek 对外仍只投影两字段 */
interface StoredTurnDeepLinkTarget extends TurnDeepLinkTarget {
  paneId: string | null
}

let target: StoredTurnDeepLinkTarget | null = null
let version = 0
const listeners = new Set<() => void>()

/** 目标值真变化才广播(set 幂等重放与 404 静默消费都不进这里) */
function notifyTurnDeepLinkChange(): void {
  version += 1
  for (const listener of listeners) listener()
}

/**
 * 解析 ?turn= 原始值:只接受非负整数(服务端 turnOrdinal 语义);
 * 其余(null/小数/负数/非数字/空串)一律 null —— 坏参数不触发窗口通道,
 * 会话按现状(最新页)打开,不猜位置。
 */
export function parseTurnParam(raw: string | null): number | null {
  // 空串显式拒:Number('') === 0,不拦就会把 ?turn= 误判成"锚第 0 轮"
  if (raw === null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function setTurnDeepLink(
  conversationId: string,
  turnOrdinal: number,
  paneId: string | null = null,
): void {
  // 同值幂等不广播:URL 权威随 searchParams 引用重跑,参数没变不得触发重锚
  // (StrictMode 双 effect 可重放的现状依赖这一条)
  if (
    target !== null &&
    target.conversationId === conversationId &&
    target.turnOrdinal === turnOrdinal &&
    target.paneId === paneId
  )
    return
  target = { conversationId, turnOrdinal, paneId }
  notifyTurnDeepLinkChange()
}

/** URL 权威清口(参数变化/缺席):广播 ⇒ 承载窗格的历史 effect 重跑 */
export function clearTurnDeepLink(): void {
  if (target === null) return
  target = null
  notifyTurnDeepLinkChange()
}

/** 404 降级消费:静默清、不广播 —— 同一次 loadHistory 已就地落常规路径,再广播会多放一枪重放 */
export function consumeTurnDeepLink(): void {
  target = null
}

/**
 * 只读不消:conversationId 不匹配 ⇒ null(目标绑定会话,不跨会话误命中);
 * paneId 归属不匹配同样 null(根窗格消费面默认 null ⇒ 别窗格的目标不误命中)。
 */
export function peekTurnDeepLink(
  conversationId: string,
  paneId: string | null = null,
): TurnDeepLinkTarget | null {
  if (target === null || target.conversationId !== conversationId || target.paneId !== paneId)
    return null
  return { conversationId: target.conversationId, turnOrdinal: target.turnOrdinal }
}

/** 订阅目标变化(返回退订函数);只有"值真变了"才通知 */
export function subscribeTurnDeepLink(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 窗格维度的快照版本号(useSyncExternalStore 的 getSnapshot 形态):
 * 目标归属本窗格(根窗格 = null)时返回当前版本,其余一律 0。
 * ⇒ 别窗格的目标变化不动本窗格快照,历史 effect 不为无关目标空重放。
 */
export function getTurnDeepLinkVersionForPane(paneId: string | null): number {
  return target !== null && target.paneId === paneId ? version : 0
}

/**
 * 从 around 窗口里挑锚点消息 id:锚点 turn 的首条消息(一轮的开场 user 行)。
 * 结构性入参(不 import api-client 类型,与 history-message.ts 同一处置),
 * `ConversationHistoryTurn[]` 可直接传入。锚点 turn 缺席 / 空 turn ⇒ null
 * (服务端对不存在的 turn 回 404,正常路径到不了这里;到得了就是不跳转、不猜)。
 */
export function pickTurnAnchorMessageId(
  turns: readonly { turnOrdinal: number; messages: readonly { id: string }[] }[],
  turnOrdinal: number,
): string | null {
  const turn = turns.find((t) => t.turnOrdinal === turnOrdinal)
  return turn?.messages[0]?.id ?? null
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 生成侧(差距⑤补全,2026-10-30):「分享此回合」深链生成 + 轮次序号投影。
 * 与上方接收端同一模块、同一 turnOrdinal 语义(服务端 createMessage 轮次口径:
 * user 行开新轮 maxTurn+1 自 1 起,assistant/system 沿用当前轮)。
 * ──────────────────────────────────────────────────────────────────────────── */

/** 生成回合深链:`<origin>/chat?conversationId=X&turn=<n>`(参数名与 page.tsx 接收端对齐) */
export function buildTurnDeepLinkUrl(
  origin: string,
  conversationId: string,
  turnOrdinal: number,
): string {
  const qs = new URLSearchParams({ conversationId, turn: String(turnOrdinal) })
  return `${origin}/chat?${qs.toString()}`
}

/**
 * 完整页(自 turn 1 起无截断)按服务端口径盖章:遇 user 行开新轮,
 * 其余角色沿用当前轮;会话开头即 assistant/system 的边角料归入第 1 轮。
 * 纯计数镜像 apps/api createMessage,不引入第二套口径。
 */
export function stampCompletePageTurnOrdinals<T extends { role: string }>(
  rows: readonly T[],
): (T & { turnOrdinal: number })[] {
  let turn = 0
  return rows.map((row) => {
    if (row.role === 'user') turn += 1
    return { ...row, turnOrdinal: Math.max(turn, 1) }
  })
}

/**
 * getMessages 一页 → 带三态序号的行:hasMore=false ⇒ 页头即 turn 1,按口径计数盖章;
 * hasMore=true ⇒ 页头被截断、首行序号无从得知 ⇒ 整页 null(宁可无入口,不猜号)。
 */
export function markPageTurnOrdinals<T extends { role: string }>(
  rows: readonly T[],
  hasMore: boolean,
): (T & { turnOrdinal: number | null })[] {
  return hasMore
    ? rows.map((row) => ({ ...row, turnOrdinal: null }))
    : stampCompletePageTurnOrdinals(rows)
}

/**
 * 把消息列表投影为 id → turnOrdinal。行上三态:
 * - `number`  = 已盖章(around 窗口服务端盖章 / 完整页 stamp 计数),直接采信并续算;
 * - `null`    = 已加载但序号未知(截断页 / 翻页更早行),自此**不可推导** ⇒ 之后的
 *   live 行也不再给号(验收「不猜」);翻到底整体重盖后恢复;
 * - `undefined` = live 本地行,仅在可推导时按口径续算。
 * `windowed:true`(around 窗口)时列表头部可能不是 turn 1,未盖章行一律不给号。
 */
export function projectTurnOrdinals(
  messages: readonly { id: string; role: string; turnOrdinal?: number | null }[],
  opts: { windowed?: boolean } = {},
): Map<string, number> {
  const out = new Map<string, number>()
  let turn = 0
  let derivable = opts.windowed !== true
  for (const m of messages) {
    if (typeof m.turnOrdinal === 'number') {
      turn = m.turnOrdinal
      out.set(m.id, turn)
      continue
    }
    if (m.turnOrdinal === null) {
      derivable = false
      continue
    }
    if (!derivable) continue
    if (m.role === 'user') turn += 1
    out.set(m.id, Math.max(turn, 1))
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
