// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会话历史日期分桶 —— 跨端唯一实现(web 侧栏 sidebar-chat-history 与小程序历史页共用)。
//
// 2026-11-05 下沉:此前 web 修好了「自然周/自然月」口径,小程序仍留着自写的「滚动 7 天」
// 分桶 —— 同一份列表在两个端上分到不同桶。把切界与回退链收在此处,端内只提供「行 → 时间锚点」
// 与「桶 → 文案」两件事,下次改语义不会再出现「一端修好、另一端还是旧逻辑」。
//
// 语义(全部按**本地时区**的自然日/自然周/自然月切界):
//  - today     : 今天 00:00 起
//  - thisWeek  : 本周一 00:00 起(周日属上一自然周的末尾,不是本周第一天)
//  - thisMonth : 本月 1 号 00:00 起
//  - earlier   : 更早(含无可用时间戳的会话)
// 零平台依赖(不碰 DOM / Taro / RN),三端可共用。

/** 分桶键。顺序即渲染顺序。 */
export type ConversationDateGroupKey = 'today' | 'thisWeek' | 'thisMonth' | 'earlier'

/** 桶的固定输出顺序(空桶会被过滤,顺序不变)。 */
export const CONVERSATION_DATE_GROUP_ORDER: readonly ConversationDateGroupKey[] = [
  'today',
  'thisWeek',
  'thisMonth',
  'earlier',
]

/** 当前时刻的日历切界(毫秒时间戳)。 */
export interface ConversationDateBounds {
  startOfToday: number
  startOfWeek: number
  startOfMonth: number
}

/** 由运行时刻派生三个切界(本地时区)。 */
export function getConversationDateBounds(now: Date = new Date()): ConversationDateBounds {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  // getDay():0=周日 ⇒ 距本周一的天数 = (getDay()+6)%7;setDate 负数会自动跨月/跨年
  const daysSinceMonday = (now.getDay() + 6) % 7
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysSinceMonday,
  ).getTime()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return { startOfToday, startOfWeek, startOfMonth }
}

/**
 * 时间锚点回退链:按顺序取第一个可解析的值(空值跳过、非法值跳过),全不可用 ⇒ null。
 *
 * 调用方把「本端的字段优先级」排成数组传进来(web:`lastMessageAt → updatedAt → createdAt`;
 * 小程序:`timestamp → time`)。**刻意不以 t=0 / 当前时刻兜底** —— 那会让没有时间戳的行
 * 冒领「今天」或「本月」,而这几个桶是给真实近期会话用的。
 */
export function resolveConversationTimestamp(
  raws: readonly (string | number | null | undefined)[],
): number | null {
  for (const raw of raws) {
    if (!raw) continue
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t)) return t
  }
  return null
}

/** 单个时间锚点落哪个桶。 */
export function classifyConversationDateGroup(
  t: number | null,
  bounds: ConversationDateBounds,
): ConversationDateGroupKey {
  if (t === null) return 'earlier'
  if (t >= bounds.startOfToday) return 'today'
  if (t >= bounds.startOfWeek) return 'thisWeek'
  if (t >= bounds.startOfMonth) return 'thisMonth'
  return 'earlier'
}

/**
 * 按日历桶分组:保持入参内的相对顺序,丢掉空桶,桶序恒为 CONVERSATION_DATE_GROUP_ORDER。
 *
 * resolveTime 由端内提供(行结构各端不同),返回 null 即归「更早」。
 * now 仅为单测给定固定时刻用,生产调用省略即取当前时刻。
 */
export function groupConversationByDate<T>(
  items: readonly T[],
  resolveTime: (item: T) => number | null,
  now: Date = new Date(),
): Array<{ key: ConversationDateGroupKey; items: T[] }> {
  const bounds = getConversationDateBounds(now)
  const buckets: Record<ConversationDateGroupKey, T[]> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  }
  for (const item of items)
    buckets[classifyConversationDateGroup(resolveTime(item), bounds)].push(item)
  return CONVERSATION_DATE_GROUP_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
    key: k,
    items: buckets[k],
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
