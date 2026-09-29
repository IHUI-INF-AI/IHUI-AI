// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 未识别 SSE 事件名的计数与一次性报名(G-816042,2026-09-29 立)。
//
// 为什么不是"return null 就算处理完":分发工厂遇到不认识的事件名时,静默返回 null 与
// "这条流根本没有这个事件"在消费端完全同形 —— 上游新增一档事件而共享层没跟上时,症状是
// "某个功能永远不出现",而 typecheck / lint / 其余守门全都不响(本仓最高频失效形态:判据
// 失效的表现永远是安静)。这里把那一格变成可指认的事实:计数按事件名累计,同一个名字只在
// 第一次报名(不得刷屏),计数本身随时可查(unknownSseEventCounts),因此"这条流今天掉了
// 多少个未知事件"是可量的,而不是靠人恰好盯着控制台。
//
// 出口只有一份:agent-events.ts 的分发工厂是唯一的调用方,消费端不得再各自 `console.warn`
// 一份(两处算同一件事必漂移,本仓记过多次)。宿主可用 setUnknownSseEventReporter 换成自己的
// 遥测通道;传 null 恢复默认的控制台报名。

/** 一次报名携带的事实:事件名与它是第几次出现。 */
export interface UnknownSseEventNotice {
  readonly name: string
  readonly count: number
}

/** 报名出口的形状。 */
export type UnknownSseEventReporter = (notice: UnknownSseEventNotice) => void

const counts = new Map<string, number>()

function defaultReporter(notice: UnknownSseEventNotice): void {
  // 英文运行时串:packages/shared/src 在守门 70(硬编码中文)射程内,中文只能留在注释里。
  console.warn(
    `[sse] unrecognized agent-stream event name: ${notice.name} (seen ${notice.count}x; reported once per name)`,
  )
}

let reporter: UnknownSseEventReporter = defaultReporter

/** 把非字符串的名字归成一个可点名的键,而不是让它把 Map 的键空间弄脏。 */
function nameKey(name: unknown): string {
  if (typeof name === 'string' && name.length > 0) return name
  return `<non-string:${typeof name}>`
}

/**
 * 记一次"未识别事件名"。返回该名字累计出现次数(含本次)。
 * 只在**第一次**遇到某个名字时报名;后续只累加计数 —— 静默与刷屏都不是答案。
 */
export function recordUnknownSseEventName(name: unknown): number {
  const key = nameKey(name)
  const next = (counts.get(key) ?? 0) + 1
  counts.set(key, next)
  if (next === 1) reporter({ name: key, count: next })
  return next
}

/** 当前累计快照(拷贝,调用方改了不影响内部状态)。 */
export function unknownSseEventCounts(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of counts) out[key] = value
  return out
}

/** 已知事件名不得进这一族:测试与人工复核用它确认"计数为 0"。 */
export function unknownSseEventTotal(): number {
  let total = 0
  for (const value of counts.values()) total += value
  return total
}

/** 换报名出口;传 null 恢复默认控制台报名。 */
export function setUnknownSseEventReporter(next: UnknownSseEventReporter | null): void {
  reporter = next ?? defaultReporter
}

/** 清空计数与报名状态(测试隔离用;宿主一般不需要)。 */
export function resetUnknownSseEventTelemetry(): void {
  counts.clear()
  reporter = defaultReporter
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
